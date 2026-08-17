import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentMethod, PaymentStatus, PaymentType } from '../../entities/payment.entity';
import { InstallmentPlan } from '../../entities/installment-plan.entity';
import { CashSession, CashSessionStatus } from '../../entities/cash-session.entity';
import { User } from '../../entities/user.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateInstallmentPlanDto } from './dto/create-installment.dto';
import { OpenCashSessionDto, CloseCashSessionDto } from './dto/cash-session.dto';
import { QueryPaymentDto, QueryDebtorsDto } from './dto/query-payment.dto';
import { QueryInstallmentDto } from './dto/query-installment.dto';
import { ExtendPaymentDto } from './dto/extend-payment.dto';

// Kvitansiya raqami generatori: RCP-20260528-0001 formatida
async function generateReceiptNumber(repo: Repository<Payment>): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RCP-${dateStr}-`;

  // Raw SQL orqali — TypeORM property mapping muammoini oldini olish
  const result = await repo.query(
    `SELECT receipt_number FROM payments WHERE receipt_number LIKE $1 ORDER BY receipt_number DESC LIMIT 1`,
    [`${prefix}%`],
  );

  const seq = result.length
    ? parseInt((result[0].receipt_number as string).split('-').pop() ?? '0') + 1
    : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// schedule JSON'ida faqat paidAt saqlanadi — frontend esa isPaid (boolean) kutadi
function withIsPaid(
  schedule: { part: number; amount: bigint; dueDate: string; paidAt?: string }[],
) {
  return schedule.map((s) => ({ ...s, isPaid: !!s.paidAt }));
}

// Kupyuralar bo'yicha jami hisoblash
function calcCashTotal(breakdown: Record<string, number>): number {
  const denominations = [200000, 100000, 50000, 10000, 5000];
  return denominations.reduce(
    (sum, d) => sum + (breakdown[String(d)] ?? 0) * d,
    0,
  );
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(InstallmentPlan)
    private installmentRepo: Repository<InstallmentPlan>,
    @InjectRepository(CashSession)
    private cashSessionRepo: Repository<CashSession>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private dataSource: DataSource,
    private auditLog: AuditLogService,
    private configService: ConfigService,
  ) {}

  private get paymentLockGraceDays(): number {
    return parseInt(this.configService.get<string>('PAYMENT_LOCK_GRACE_DAYS', '15'), 10);
  }

  // ─── TO'LOV YARATISH ──────────────────────────────────────────────────────
  async create(dto: CreatePaymentDto, actorId: string, actorRole: string) {
    const student = await this.userRepo.findOne({
      where: { id: dto.studentId, role: Role.STUDENT, isActive: true },
    });
    if (!student) throw new NotFoundException('O\'quvchi topilmadi');

    // Aralash to'lovni tekshirish
    if (dto.method === PaymentMethod.MIXED) {
      const mixedTotal = (dto.cashAmount ?? 0) + (dto.cardAmount ?? 0);
      if (Math.abs(mixedTotal - dto.amount) > 1) {
        throw new BadRequestException(
          `Aralash to'lov qismlari jami (${mixedTotal}) umumiy summaga (${dto.amount}) mos emas`,
        );
      }
    }

    // Naqd kupyura summasi tekshirish
    if (dto.cashBreakdown) {
      const breakdownTotal = calcCashTotal(dto.cashBreakdown as Record<string, number>);
      const expectedCash =
        dto.method === PaymentMethod.MIXED ? (dto.cashAmount ?? 0) : dto.amount;
      if (breakdownTotal !== expectedCash) {
        throw new BadRequestException(
          `Kupyura jami (${breakdownTotal.toLocaleString()} so'm) naqd summaga mos emas`,
        );
      }
    }

    // Muddatli to'lov bo'lsa — mavjudligini tekshirish
    if (dto.installmentPlanId) {
      const plan = await this.installmentRepo.findOne({
        where: { id: dto.installmentPlanId, studentId: dto.studentId },
      });
      if (!plan) throw new NotFoundException('Muddatli to\'lov rejasi topilmadi');
      if (plan.isCompleted) throw new BadRequestException('Muddatli to\'lov allaqachon yakunlangan');
    }

    // Smena (kassa sessiyasi) ochiq bo'lmasa to'lov qabul qilib bo'lmaydi —
    // aks holda smena yopilganda hisoblangan kutilgan kassa balansi haqiqiy
    // tushumni aks ettirmaydi. Avval bu tekshiruv faqat cashSessionId berilgan
    // bo'lsagina ishlar edi — frontend uni hech qachon yubormagani uchun
    // amalda hech qachon ishlamas edi (sof UI eslatma, backend majburlamas edi).
    let session: CashSession;
    if (dto.cashSessionId) {
      const found = await this.cashSessionRepo.findOne({ where: { id: dto.cashSessionId } });
      if (!found) throw new NotFoundException('Smena topilmadi');
      if (found.cashierId !== actorId) {
        throw new ForbiddenException('Bu smena boshqa kassirga tegishli');
      }
      if (found.status !== CashSessionStatus.OPEN) {
        throw new BadRequestException('Bu smena yopiq — unga to\'lov qo\'shib bo\'lmaydi');
      }
      session = found;
    } else {
      const open = await this.cashSessionRepo.findOne({
        where: { cashierId: actorId, status: CashSessionStatus.OPEN },
      });
      if (!open) {
        throw new BadRequestException('To\'lov qabul qilishdan oldin smenani oching');
      }
      session = open;
    }

    const now = new Date();
    const paymentMonth =
      dto.paymentMonth ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Kvitansiya raqami generatsiyasi tranzaksiya ichida, konflikt bo'lsa qayta
    // urinish bilan — bir vaqtda 2 ta kassir to'lov qabul qilsa, ikkalasi ham
    // "oxirgi raqam+1"ni bir xil o'qib olib, bir xil raqamni hosil qilishi mumkin
    // edi (receipt_number ustunida UNIQUE bor, shuning uchun bu avval xatoni
    // "500 Internal Server Error" sifatida chiqarardi — endi avtomatik tuzatiladi)
    const MAX_RECEIPT_ATTEMPTS = 3;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_RECEIPT_ATTEMPTS; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const receiptNumber = await generateReceiptNumber(queryRunner.manager.getRepository(Payment));

        const payment = queryRunner.manager.create(Payment, {
          studentId: dto.studentId,
          receivedById: actorId,
          amount: BigInt(Math.round(dto.amount)),
          method: dto.method,
          type: dto.type ?? PaymentType.TUITION,
          status: PaymentStatus.COMPLETED,
          paymentMonth,
          receiptNumber,
          notes: dto.notes ?? null,
          cashBreakdown: (dto.cashBreakdown as Record<string, number>) ?? null,
          cashAmount: BigInt(Math.round(dto.cashAmount ?? (dto.method === PaymentMethod.CASH ? dto.amount : 0))),
          cardAmount: BigInt(Math.round(dto.cardAmount ?? (dto.method === PaymentMethod.CARD ? dto.amount : 0))),
          cashSessionId: session.id,
          installmentPlanId: dto.installmentPlanId ?? null,
          installmentPart: dto.installmentPart ?? null,
          receiptPrinted: false,
        });

        await queryRunner.manager.save(payment);

        // Muddatli to'lovni yangilash
        if (dto.installmentPlanId && dto.installmentPart) {
          await this.updateInstallmentPart(
            queryRunner,
            dto.installmentPlanId,
            dto.installmentPart,
            payment.id,
          );
        }

        await queryRunner.commitTransaction();

        await this.auditLog.log({
          userId: actorId,
          userRole: actorRole,
          action: 'PAYMENT_CREATED',
          entityName: 'payments',
          entityId: payment.id,
          newValues: {
            amount: dto.amount,
            method: dto.method,
            studentId: dto.studentId,
            receiptNumber,
          },
        });

        const result = await this.paymentRepo.findOne({
          where: { id: payment.id },
          relations: { student: true },
        });

        return {
          ...result,
          receipt: this.buildReceiptData(result!),
        };
      } catch (err) {
        await queryRunner.rollbackTransaction();

        // Postgres 23505 = unique_violation — receipt_number to'qnashuvida qayta
        // urinamiz (TypeORM constraint nomini xesh sifatida generatsiya qiladi,
        // masalan "UQ_a6659e..." — ustun nomi bo'yicha moslashtirib bo'lmaydi,
        // shuning uchun kod bo'yicha tekshiramiz). Boshqa xatolar (masalan
        // updateInstallmentPart'dagi ConflictException) darhol tashlanadi
        const isUniqueViolation = (err as { code?: string })?.code === '23505';

        if (!isUniqueViolation) throw err;
        lastErr = err;
      } finally {
        await queryRunner.release();
      }
    }

    throw lastErr;
  }

  // ─── TO'LOVLAR RO'YXATI ──────────────────────────────────────────────────
  async findAll(query: QueryPaymentDto, actorId: string, actorRole: string) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    // Xavfsiz ustun xaritasi — ixtiyoriy xom SQL ustun nomi kiritilishining oldini oladi
    const SORT_COLUMNS: Record<string, string> = {
      student:   'st.lastName',
      amount:    'p.amount',
      createdAt: 'p.created_at',
    };
    const sortColumn = SORT_COLUMNS[sortBy] ?? 'p.created_at';

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoin('p.student', 'st')
      .leftJoin('p.receivedBy', 'rb')
      .where('p.deleted_at IS NULL')
      // .addSelect emas .select — aks holda p.id ikki marta tanlanib
      // DISTINCT ostki so'rovida "ambiguous column" (42702) xatosini beradi
      .select([
        'p.id', 'p.amount', 'p.method', 'p.status', 'p.type',
        'p.receiptNumber', 'p.paymentMonth', 'p.createdAt', 'p.notes',
        'p.cashAmount', 'p.cardAmount', 'p.installmentPart',
        'st.id', 'st.firstName', 'st.lastName', 'st.phone',
        'rb.id', 'rb.firstName', 'rb.lastName',
      ]);

    if (query.studentId) qb.andWhere('p.student_id = :sid', { sid: query.studentId });
    if (query.method) qb.andWhere('p.method = :method', { method: query.method });
    if (query.status) qb.andWhere('p.status = :status', { status: query.status });
    if (query.paymentMonth) qb.andWhere('p.payment_month = :pm', { pm: query.paymentMonth });
    if (query.cashSessionId) qb.andWhere('p.cash_session_id = :cs', { cs: query.cashSessionId });
    if (query.receivedById) qb.andWhere('p.received_by = :rbid', { rbid: query.receivedById });
    if (query.dateFrom) qb.andWhere('p.created_at >= :from', { from: new Date(query.dateFrom) });
    if (query.dateTo) qb.andWhere('p.created_at <= :to', { to: new Date(query.dateTo) });

    // getManyAndCount() bir nechta join+addSelect bilan "ambiguous column" (42702)
    // xatosiga olib keladi — count va ro'yxatni alohida so'rov bilan olamiz
    const total = await qb.getCount();
    const data = await qb
      .orderBy(sortColumn, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: { student: true, receivedBy: true },
    });
    if (!payment) throw new NotFoundException('To\'lov topilmadi');
    return { ...payment, receipt: this.buildReceiptData(payment) };
  }

  // ─── QARZDORLAR RO'YXATI ─────────────────────────────────────────────────
  async getDebtors(query: QueryDebtorsDto, actorId?: string, actorRole?: string) {
    const { page = 1, limit = 50 } = query;
    const now = new Date();
    const month =
      query.month ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const qb = this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', 'e.student_id = u.id AND e.status = :es', { es: 'active' })
      .innerJoin('groups', 'g', 'g.id = e.group_id')
      .leftJoin('subjects', 's', 's.id = g.subject_id')
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.student_id = u.id
          AND p.payment_month = :month
          AND p.status = 'completed'
          AND p.deleted_at IS NULL
        )`,
        { month },
      )
      .select([
        'u.id AS id',
        'u."firstName" AS "firstName"',
        'u.last_name AS "lastName"',
        'u.phone AS phone',
        'g.id AS "groupId"',
        'g.name AS "groupName"',
        'g.monthly_price AS "monthlyPrice"',
        's.name AS "subjectName"',
      ]);

    if (query.groupId) qb.andWhere('g.id = :gid', { gid: query.groupId });
    if (query.subjectId) qb.andWhere('s.id = :sid', { sid: query.subjectId });

    // Ustoz — faqat o'z guruhidagi qarzdorlarni ko'radi
    if (actorRole === Role.USTOZ) {
      qb.andWhere('g.teacher_id = :teacherId', { teacherId: actorId });
    }

    const rawRows = await qb.orderBy('u.last_name', 'ASC').getRawMany();

    // Bitta o'quvchi bir nechta guruhda qarzdor bo'lishi mumkin — o'quvchi bo'yicha guruhlaymiz
    const byStudent = new Map<
      string,
      { studentId: string; studentName: string; phone: string | null; monthPrice: number; groups: string[] }
    >();
    for (const r of rawRows) {
      const monthlyPrice = Number(r.monthlyPrice) || 0;
      const existing = byStudent.get(r.id);
      if (existing) {
        existing.monthPrice += monthlyPrice;
        existing.groups.push(r.groupName);
      } else {
        byStudent.set(r.id, {
          studentId: r.id,
          studentName: `${r.firstName} ${r.lastName}`,
          phone: r.phone,
          monthPrice: monthlyPrice,
          groups: [r.groupName],
        });
      }
    }

    const allDebtors = Array.from(byStudent.values());
    const total = allDebtors.length;
    const paged = allDebtors.slice((page - 1) * limit, (page - 1) * limit + limit);

    const studentIds = paged.map((d) => d.studentId);
    const lastPaymentMap = new Map<string, Date>();
    const paidMonthsMap = new Map<string, Set<string>>();
    if (studentIds.length > 0) {
      const lastPayments = await this.paymentRepo
        .createQueryBuilder('p')
        .select('p.studentId', 'studentId')
        .addSelect('MAX(p.createdAt)', 'lastDate')
        .where('p.studentId IN (:...ids)', { ids: studentIds })
        .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED })
        .groupBy('p.studentId')
        .getRawMany();
      for (const row of lastPayments) lastPaymentMap.set(row.studentId, row.lastDate);

      // Qarz oylari sonini hisoblash uchun — oxirgi 12 oy ichida qaysi oylar to'langan
      const paidMonthRows = await this.paymentRepo
        .createQueryBuilder('p')
        .select('p.studentId', 'studentId')
        .addSelect('p.paymentMonth', 'month')
        .where('p.studentId IN (:...ids)', { ids: studentIds })
        .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED })
        .groupBy('p.studentId')
        .addGroupBy('p.paymentMonth')
        .getRawMany();
      for (const row of paidMonthRows) {
        if (!paidMonthsMap.has(row.studentId)) paidMonthsMap.set(row.studentId, new Set());
        paidMonthsMap.get(row.studentId)!.add(row.month);
      }
    }

    // "YYYY-MM" oyni `delta` oy orqaga/oldinga suradi
    const shiftMonth = (m: string, delta: number): string => {
      const [y, mo] = m.split('-').map(Number);
      const d = new Date(y, mo - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const data = paged.map((d) => {
      const paidMonths = paidMonthsMap.get(d.studentId) ?? new Set<string>();
      // Joriy oydan orqaga qarab, ketma-ket to'lanmagan oylar sonini sanaymiz (maks. 12 oy)
      let debtMonths = 0;
      for (let i = 0; i < 12; i++) {
        if (!paidMonths.has(shiftMonth(month, -i))) debtMonths++;
        else break;
      }
      return {
        studentId: d.studentId,
        studentName: d.studentName,
        phone: d.phone,
        groups: d.groups,
        debtMonths,
        debtAmount: d.monthPrice * debtMonths,
        isCritical: debtMonths >= 2,
        lastPaymentDate: lastPaymentMap.get(d.studentId) ?? null,
      };
    });

    return {
      month,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // O'quvchi kartochkasi uchun — joriy oy bo'yicha qarzdormi (qizil indikator)
  async getDebtorStatus(studentId: string): Promise<{ isDebtor: boolean; month: string }> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const paid = await this.paymentRepo.exists({
      where: {
        studentId,
        paymentMonth: month,
        status: PaymentStatus.COMPLETED,
      },
    });

    return { isDebtor: !paid, month };
  }

  // ─── TO'LOV AVTO-BLOK: KIRISH HOLATI ──────────────────────────────────────
  async getAccessStatus(
    studentId: string,
    requesterId?: string,
    requesterRole?: string,
  ): Promise<{ isLocked: boolean; isDebtor: boolean; daysOverdue: number; extendedUntil: Date | null }> {
    if (requesterRole === Role.STUDENT && requesterId !== studentId) {
      throw new ForbiddenException('Faqat o\'z holatingizni ko\'rishingiz mumkin');
    }

    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('O\'quvchi topilmadi');

    const { isDebtor } = await this.getDebtorStatus(studentId);
    const now = new Date();
    const daysOverdue = now.getDate();

    const extendedUntil = student.paymentExtendedUntil;
    const hasActiveExtension = !!extendedUntil && extendedUntil > now;

    const isLocked = !hasActiveExtension && isDebtor && daysOverdue >= this.paymentLockGraceDays;

    return { isLocked, isDebtor, daysOverdue, extendedUntil };
  }

  // ─── TO'LOV AVTO-BLOK: SA MUDDATNI UZAYTIRISH ─────────────────────────────
  async extendPayment(
    studentId: string,
    dto: ExtendPaymentDto,
    actorId: string,
  ): Promise<{ message: string }> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('O\'quvchi topilmadi');

    const until = new Date(dto.until);
    const oldValues = { paymentExtendedUntil: student.paymentExtendedUntil };

    await this.userRepo.update(studentId, { paymentExtendedUntil: until });

    await this.auditLog.log({
      userId: actorId,
      action: 'PAYMENT_EXTENSION_GRANTED',
      entityName: 'users',
      entityId: studentId,
      oldValues,
      newValues: { paymentExtendedUntil: until.toISOString(), reason: dto.reason },
    });

    return { message: 'Muddat muvaffaqiyatli uzaytirildi' };
  }

  // ─── MUDDATLI TO'LOV ─────────────────────────────────────────────────────
  async createInstallmentPlan(
    dto: CreateInstallmentPlanDto,
    actorId: string,
    actorRole: string,
  ) {
    const student = await this.userRepo.findOne({
      where: { id: dto.studentId, role: Role.STUDENT, isActive: true },
    });
    if (!student) throw new NotFoundException('O\'quvchi topilmadi');

    // Qismlar summasi tekshirish
    const partsTotal = dto.schedule.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(partsTotal - dto.totalAmount) > 1) {
      throw new BadRequestException(
        `Qismlar jami (${partsTotal}) umumiy summaga (${dto.totalAmount}) mos emas`,
      );
    }

    if (dto.schedule.length !== dto.partsCount) {
      throw new BadRequestException(`${dto.partsCount} ta qism jadval kiritilishi kerak`);
    }

    const plan = this.installmentRepo.create({
      studentId: dto.studentId,
      totalAmount: BigInt(Math.round(dto.totalAmount)),
      partsCount: dto.partsCount,
      paidParts: 0,
      // JSON saqlanadi — amount ni number sifatida
      schedule: dto.schedule.map((p) => ({
        part: p.part,
        amount: p.amount,
        dueDate: p.dueDate,
      })) as unknown as { part: number; amount: bigint; dueDate: string }[],
      description: dto.description ?? null,
      isCompleted: false,
    });

    await this.installmentRepo.save(plan);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'INSTALLMENT_PLAN_CREATED',
      entityName: 'installment_plans',
      entityId: plan.id,
      newValues: { studentId: dto.studentId, totalAmount: dto.totalAmount, partsCount: dto.partsCount },
    });

    return plan;
  }

  async getInstallmentPlan(id: string) {
    const plan = await this.installmentRepo
      .createQueryBuilder('ip')
      .withDeleted() // arxivlangan (soft-deleted) o'quvchi ismi ham ko'rinishi uchun
      .leftJoinAndSelect('ip.student', 'st')
      .where('ip.id = :id', { id })
      .andWhere('ip.deleted_at IS NULL')
      .getOne();
    if (!plan) throw new NotFoundException('Muddatli to\'lov rejasi topilmadi');

    const payments = await this.paymentRepo.find({
      where: { installmentPlanId: id },
      order: { createdAt: 'ASC' },
    });

    return { ...plan, schedule: withIsPaid(plan.schedule), payments };
  }

  // ─── MUDDATLI TO'LOV RO'YXATI ─────────────────────────────────────────────
  async findAllInstallments(query: QueryInstallmentDto) {
    const { page = 1, limit = 20 } = query;

    const qb = this.installmentRepo
      .createQueryBuilder('ip')
      .withDeleted() // arxivlangan (soft-deleted) o'quvchi ismi ham ko'rinishi uchun
      .leftJoinAndSelect('ip.student', 'st')
      .where('ip.deleted_at IS NULL');

    if (query.studentId) qb.andWhere('ip.student_id = :sid', { sid: query.studentId });
    if (query.isCompleted !== undefined) qb.andWhere('ip.is_completed = :ic', { ic: query.isCompleted });

    const total = await qb.getCount();
    const items = await qb
      .orderBy('ip.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const data = items.map((p) => ({ ...p, schedule: withIsPaid(p.schedule) }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── SMENA (CASH SESSION) ─────────────────────────────────────────────────
  async openCashSession(dto: OpenCashSessionDto, actorId: string, actorRole: string) {
    // Allaqachon ochiq smena bormi?
    const existing = await this.cashSessionRepo.findOne({
      where: { cashierId: actorId, status: CashSessionStatus.OPEN },
    });
    if (existing) {
      throw new ConflictException('Smenangiz allaqachon ochiq. Avval yoping.');
    }

    const session = this.cashSessionRepo.create({
      cashierId: actorId,
      openingBalance: BigInt(Math.round(dto.openingBalance)),
      status: CashSessionStatus.OPEN,
      openedAt: new Date(),
      notes: dto.notes ?? null,
      discrepancyAmount: BigInt(0),
      alertSent: false,
    });

    await this.cashSessionRepo.save(session);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'CASH_SESSION_OPENED',
      entityName: 'cash_sessions',
      entityId: session.id,
      newValues: { openingBalance: dto.openingBalance },
    });

    return session;
  }

  async closeCashSession(
    sessionId: string,
    dto: CloseCashSessionDto,
    actorId: string,
    actorRole: string,
  ) {
    const session = await this.cashSessionRepo.findOne({
      where: { id: sessionId, cashierId: actorId },
    });
    if (!session) throw new NotFoundException('Smena topilmadi');
    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Bu smena allaqachon yopilgan');
    }

    // Smena davomida jami to'lovlar (naqd) — raw SQL
    const cashTotal = await this.cashSessionRepo.query(
      `SELECT COALESCE(SUM(cash_amount), 0) AS total FROM payments WHERE cash_session_id = $1 AND status = 'completed' AND deleted_at IS NULL`,
      [sessionId],
    );

    const totalReceived = BigInt(Math.round(Number(cashTotal[0]?.total ?? 0)));
    const openingBal = BigInt(session.openingBalance.toString());
    const expectedBalance = openingBal + totalReceived;
    const actualBalance = BigInt(Math.round(dto.closingBalance));
    const discrepancy = actualBalance - expectedBalance;
    const absDiff = discrepancy < 0n ? -discrepancy : discrepancy;

    // Kassa farqi > 10,000 so'm → SA alerti
    const hasDiscrepancy = absDiff > BigInt(10000);
    const newStatus = hasDiscrepancy ? CashSessionStatus.DISCREPANCY : CashSessionStatus.CLOSED;

    await this.cashSessionRepo.update(sessionId, {
      closingBalance: actualBalance,
      expectedBalance,
      discrepancyAmount: discrepancy,
      status: newStatus,
      closedAt: new Date(),
      notes: dto.notes ?? session.notes,
    });

    if (hasDiscrepancy) {
      await this.sendDiscrepancyAlert(sessionId, actorId, Number(discrepancy), Number(absDiff));
    }

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'CASH_SESSION_CLOSED',
      entityName: 'cash_sessions',
      entityId: sessionId,
      newValues: {
        closingBalance: dto.closingBalance,
        expectedBalance: Number(expectedBalance),
        discrepancy: Number(discrepancy),
        hasDiscrepancy,
      },
    });

    return {
      sessionId,
      openingBalance: Number(openingBal),
      totalReceived: Number(totalReceived),
      expectedBalance: Number(expectedBalance),
      actualBalance: dto.closingBalance,
      discrepancy: Number(discrepancy),
      status: newStatus,
      message: hasDiscrepancy
        ? `⚠️ Kassa farqi: ${Number(absDiff).toLocaleString()} so'm. SA ga xabar yuborildi.`
        : '✅ Smena muvaffaqiyatli yopildi',
    };
  }

  async getCashSessions(actorId: string, actorRole: string) {
    const qb = this.cashSessionRepo
      .createQueryBuilder('cs')
      .leftJoin('cs.cashier', 'c')
      .addSelect(['cs.id', 'cs.openingBalance', 'cs.closingBalance', 'cs.expectedBalance',
        'cs.discrepancyAmount', 'cs.status', 'cs.openedAt', 'cs.closedAt', 'cs.alertSent',
        'c.id', 'c.firstName', 'c.lastName'])
      .orderBy('cs.opened_at', 'DESC')
      .take(50);

    // Manager faqat o'z smenalarini ko'radi
    if (actorRole === Role.MANAGER) {
      qb.where('cs.cashier_id = :id', { id: actorId });
    }

    return qb.getMany();
  }

  async getOpenSession(actorId: string) {
    // cashier relatsiyasi ataylab yuklanmaydi — User'ning to'liq qatorini
    // (parolHash bilan) qaytarib yuborardi; bu javobni faqat o'z smenasini
    // ko'rayotgan kassirning o'zi chaqiradi, shuning uchun kassir kimligi
    // allaqachon ma'lum (cashierId yetarli)
    const session = await this.cashSessionRepo.findOne({
      where: { cashierId: actorId, status: CashSessionStatus.OPEN },
    });
    if (!session) return null;

    // Smena davomida jami qabul qilingan to'lovlar (barcha usullar) — vidjetda
    // "Yig'ilgan" sifatida ko'rsatiladi. Faqat naqd (expectedBalance) smena
    // yopilganda alohida hisoblanadi.
    const totalRow = await this.cashSessionRepo.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE cash_session_id = $1 AND status = 'completed' AND deleted_at IS NULL`,
      [session.id],
    );

    return {
      ...session,
      // bigint ustunlar pg orqali string sifatida qaytadi — raqamga aylantirmasa
      // frontendda "500000" + 30000 kabi satr birlashtirish bo'lib qolardi
      openingBalance: Number(session.openingBalance),
      closingBalance: session.closingBalance !== null ? Number(session.closingBalance) : null,
      totalCollected: Number(totalRow[0]?.total ?? 0),
    };
  }

  // ─── HISOBOT ─────────────────────────────────────────────────────────────
  async getReport(month: string) {
    const raw = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .select([
        'p.method AS method',
        'SUM(p.amount) AS total',
        'COUNT(*) AS count',
      ])
      .groupBy('p.method')
      .getRawMany();

    const byMethod: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;
    for (const row of raw) {
      byMethod[row.method] = {
        total: Number(row.total),
        count: Number(row.count),
      };
      grandTotal += Number(row.total);
    }

    // Qaysi xodim qancha qabul qilgani (admin/manager KPI uchun)
    const staffRaw = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('p.receivedBy', 'rb')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .select([
        'rb.id AS "staffId"',
        'rb.firstName AS "firstName"',
        'rb.lastName AS "lastName"',
        'SUM(p.amount) AS total',
        'COUNT(*) AS count',
      ])
      .groupBy('rb.id')
      .addGroupBy('rb.firstName')
      .addGroupBy('rb.lastName')
      .orderBy('total', 'DESC')
      .getRawMany<{ staffId: string; firstName: string; lastName: string; total: string; count: string }>();

    const byStaff = staffRaw.map((row) => ({
      staffId: row.staffId,
      firstName: row.firstName,
      lastName: row.lastName,
      total: Number(row.total),
      count: Number(row.count),
    }));

    // Oylik debtorlar soni
    const debtorCount = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', 'e.student_id = u.id AND e.status = :es', { es: 'active' })
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM payments p WHERE p.student_id = u.id AND p.payment_month = :month AND p.status = 'completed' AND p.deleted_at IS NULL)`,
        { month },
      )
      .getCount();

    return { month, grandTotal, byMethod, byStaff, debtorCount };
  }

  // ─── KVITANSIYA (TERMAL PRINTER) ─────────────────────────────────────────
  getReceiptData(paymentId: string) {
    return this.paymentRepo
      .findOne({ where: { id: paymentId }, relations: { student: true, receivedBy: true } })
      .then((p) => {
        if (!p) throw new NotFoundException('To\'lov topilmadi');
        return this.buildReceiptData(p);
      });
  }

  async markReceiptPrinted(paymentId: string, actorId: string) {
    await this.paymentRepo.update(paymentId, { receiptPrinted: true });
    await this.auditLog.log({
      userId: actorId,
      action: 'RECEIPT_PRINTED',
      entityName: 'payments',
      entityId: paymentId,
    });
    return { message: 'Kvitansiya chop etilgan deb belgilandi' };
  }

  // ─── ICHKI YORDAMCHILAR ───────────────────────────────────────────────────

  private buildReceiptData(payment: Payment & { student?: User; receivedBy?: User }) {
    const now = new Date(payment.createdAt);
    return {
      header: {
        title: 'LOCHIN SCHOOL',
        subtitle: 'To\'lov kvitansiyasi',
      },
      receiptNumber: payment.receiptNumber,
      dateTime: {
        date: now.toLocaleDateString('uz-UZ'),
        time: now.toLocaleTimeString('uz-UZ'),
        month: payment.paymentMonth,
        year: now.getFullYear(),
      },
      student: {
        fullName: payment.student
          ? `${payment.student.firstName} ${payment.student.lastName}`
          : '',
        phone: payment.student?.phone ?? '',
      },
      payment: {
        amount: Number(payment.amount).toLocaleString('uz-UZ') + ' so\'m',
        method: this.methodLabel(payment.method),
        type: payment.type,
        ...(payment.method === PaymentMethod.MIXED && {
          cashAmount: Number(payment.cashAmount).toLocaleString('uz-UZ') + ' so\'m',
          cardAmount: Number(payment.cardAmount).toLocaleString('uz-UZ') + ' so\'m',
        }),
        ...(payment.installmentPart && {
          installmentPart: `${payment.installmentPart}-qism`,
        }),
      },
      cashBreakdown: payment.cashBreakdown
        ? this.formatBreakdown(payment.cashBreakdown)
        : null,
      cashier: payment.receivedBy
        ? `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`
        : '',
      footer: 'Rahmat! Ilm yo\'lida omad!',
    };
  }

  private methodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CASH]: 'Naqd',
      [PaymentMethod.CARD]: 'Karta',
      [PaymentMethod.BANK]: 'Bank',
      [PaymentMethod.PAYME]: 'Payme',
      [PaymentMethod.CLICK]: 'Click',
      [PaymentMethod.MIXED]: 'Aralash',
    };
    return labels[method] ?? method;
  }

  private formatBreakdown(breakdown: Record<string, number>) {
    const labels: Record<string, string> = {
      '200000': '200 000',
      '100000': '100 000',
      '50000': '50 000',
      '10000': '10 000',
      '5000': '5 000',
    };
    return Object.entries(breakdown)
      .filter(([, count]) => count > 0)
      .map(([d, count]) => ({
        denomination: `${labels[d] ?? d} so'm`,
        count,
        subtotal: `${(parseInt(d) * count).toLocaleString('uz-UZ')} so'm`,
      }));
  }

  private async updateInstallmentPart(
    queryRunner: ReturnType<typeof this.dataSource.createQueryRunner>,
    planId: string,
    partNumber: number,
    paymentId: string,
  ) {
    // pessimistic_write (SELECT ... FOR UPDATE) — shu qatorni boshqa parallel
    // to'lov tranzaksiyasi tugagunicha bloklaydi. Bu bo'lmasa, ikkita bir xil
    // qism uchun deyarli bir vaqtda yuborilgan to'lov (masalan ikki marta
    // bosilgan tugma yoki ikki kassir) ikkalasi ham "hali to'lanmagan" holatni
    // o'qib, ikkalasi ham qismni to'langan deb belgilab, real pulni ikki marta
    // hisoblab qo'yishi mumkin edi
    const plan = await queryRunner.manager.findOne(InstallmentPlan, {
      where: { id: planId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) return;

    const alreadyPaid = plan.schedule.find((s) => s.part === partNumber)?.paidAt;
    if (alreadyPaid) {
      throw new ConflictException(`${partNumber}-qism allaqachon to'langan`);
    }

    const updatedSchedule = plan.schedule.map((s) => {
      if (s.part === partNumber) {
        return { ...s, paidAt: new Date().toISOString() };
      }
      return s;
    });

    const paidCount = updatedSchedule.filter((s) => s.paidAt).length;
    const isCompleted = paidCount >= plan.partsCount;

    await queryRunner.manager.update(InstallmentPlan, planId, {
      schedule: updatedSchedule,
      paidParts: paidCount,
      isCompleted,
    });
  }

  private async sendDiscrepancyAlert(
    sessionId: string,
    cashierId: string,
    discrepancy: number,
    absDiff: number,
  ) {
    // SA larga notification yuborish
    const superAdmins = await this.userRepo.find({
      where: { role: Role.SUPER_ADMIN, isActive: true },
      select: { id: true },
    });

    const cashier = await this.userRepo.findOne({
      where: { id: cashierId },
      select: { firstName: true, lastName: true },
    });

    const notifications = superAdmins.map((sa) =>
      this.notificationRepo.create({
        userId: sa.id,
        type: NotificationType.SYSTEM,
        title: '⚠️ Kassa farqi aniqlandi',
        body: `${cashier?.firstName} ${cashier?.lastName} smenasida ${absDiff.toLocaleString()} so'm farq bor. Smena: ${sessionId}`,
        pushSent: false,
        telegramSent: false,
        smsSent: false,
      }),
    );

    if (notifications.length) {
      await this.notificationRepo.save(notifications);
    }

    await this.cashSessionRepo.update(sessionId, { alertSent: true });
  }
}
