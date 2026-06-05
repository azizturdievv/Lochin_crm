import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LessonSubstitution, AbsenceReason } from '../../entities/lesson-substitution.entity';
import { TeacherAbsence } from '../../entities/teacher-absence.entity';
import { Lesson, LessonStatus } from '../../entities/lesson.entity';
import { User } from '../../entities/user.entity';
import { Salary } from '../../entities/salary.entity';
import { SalaryRecord, SalaryRecordStatus } from '../../entities/salary-record.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../notifications/notification.service';
import { CreateSubstitutionDto, CompleteSubstitutionDto, QuerySubstitutionDto } from './dto/substitution.dto';

// Standart oylik ish soatlari (soatlik ekvivalent uchun)
const STANDARD_MONTHLY_HOURS = 176;

@Injectable()
export class SubstitutionService {
  private readonly logger = new Logger(SubstitutionService.name);

  constructor(
    @InjectRepository(LessonSubstitution)
    private subRepo: Repository<LessonSubstitution>,
    @InjectRepository(TeacherAbsence)
    private absenceRepo: Repository<TeacherAbsence>,
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Salary)
    private salaryRepo: Repository<Salary>,
    @InjectRepository(SalaryRecord)
    private recordRepo: Repository<SalaryRecord>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    private dataSource: DataSource,
    private notifService: NotificationService,
    private auditLog: AuditLogService,
  ) {}

  // ─── O'RINBOSAR TAYINLASH (5 qadam, transaction) ──────────────────────────
  async create(
    dto: CreateSubstitutionDto,
    actorId: string,
    actorRole: string,
  ): Promise<LessonSubstitution> {
    // Qadam 1: Dars tekshirish
    const lesson = await this.lessonRepo.findOne({
      where: { id: dto.lessonId },
      relations: { group: true },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (lesson.status === LessonStatus.SUBSTITUTED) {
      throw new BadRequestException('Bu darsga allaqachon o\'rinbosar tayinlangan');
    }
    if (lesson.status === LessonStatus.COMPLETED) {
      throw new BadRequestException('Tugallangan darsga o\'rinbosar tayinlab bo\'lmaydi');
    }

    // Qadam 2: O'rinbosar tekshirish
    const originalTeacher = await this.userRepo.findOne({ where: { id: lesson.teacherId } });
    const substituteTeacher = await this.userRepo.findOne({
      where: { id: dto.substituteTeacherId, role: Role.USTOZ },
    });
    if (!substituteTeacher) {
      throw new NotFoundException('O\'rinbosar ustoz topilmadi yoki roli noto\'g\'ri');
    }
    if (dto.substituteTeacherId === lesson.teacherId) {
      throw new BadRequestException('O\'rinbosar asl o\'qituvchi bilan bir xil bo\'lishi mumkin emas');
    }

    // Oy (maosh yozuvi uchun)
    const lessonDate = new Date(lesson.lessonDate);
    const periodMonth = `${lessonDate.getFullYear()}-${String(lessonDate.getMonth() + 1).padStart(2, '0')}`;

    // Qadam 3: Avtomatik maosh hisoblash
    const subHourlyRate = await this.getEffectiveHourlyRate(dto.substituteTeacherId);
    const origHourlyRate = await this.getEffectiveHourlyRate(lesson.teacherId);
    const durationHours = Number(lesson.durationHours);

    // durationHours decimal bo'lishi mumkin (masalan 1.5)
    // BigInt uchun: 1.5 soat × 50000 = 75000
    const subPayment = calculateBigIntPayment(subHourlyRate, durationHours);
    const originalDeduction = calculateBigIntPayment(origHourlyRate, durationHours);

    // ─── TRANSACTION: barcha DB o'zgarishlari ────────────────────────────────
    const substitution = await this.dataSource.transaction(async (em) => {
      // Substitution yozuvi yaratish
      const sub = em.create(LessonSubstitution, {
        lessonId: dto.lessonId,
        originalTeacherId: lesson.teacherId,
        substituteTeacherId: dto.substituteTeacherId,
        reason: dto.reason,
        notes: dto.notes ?? null,
        subPayment,
        originalDeduction,
        salaryProcessed: false,
        notificationSent: false,
      });
      await em.save(sub);

      // Dars statusini va o'qituvchini yangilash (QR davomat o'rinbosar nomiga)
      await em.update(Lesson, dto.lessonId, {
        teacherId: dto.substituteTeacherId,
        status: LessonStatus.SUBSTITUTED,
        qrCode: null,      // QR keyingi ochilishda yangidan generatsiya qilinadi
        qrExpiresAt: null,
      });

      // O'qituvchi yo'qlik yozuvi
      await em.save(
        em.create(TeacherAbsence, {
          teacherId: lesson.teacherId,
          absenceDate: lessonDate,
          reason: dto.reason,
          notes: dto.notes ?? null,
          documentUrl: dto.documentUrl ?? null,
          approved: true,
          approvedById: actorId,
        }),
      );

      // Maosh yozuvlarini yangilash
      await this.updateSalaryRecord(em, dto.substituteTeacherId, periodMonth, subPayment, 'sub');
      await this.updateSalaryRecord(em, lesson.teacherId, periodMonth, originalDeduction, 'deduction');

      return sub;
    });

    // Qadam 4: Bildirishnomalar (async, non-blocking)
    this.sendNotifications({
      substitutionId: substitution.id,
      substituteTeacher,
      originalTeacher,
      lesson,
      reason: dto.reason,
      subPayment,
      originalDeduction,
    }).catch((err) => this.logger.error(`Bildirishnoma xato: ${err}`));

    // Audit log
    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'SUBSTITUTION_CREATED',
      entityName: 'lesson_substitutions',
      entityId: substitution.id,
      newValues: {
        lessonId: dto.lessonId,
        substituteTeacherId: dto.substituteTeacherId,
        reason: dto.reason,
        subPayment: subPayment.toString(),
        originalDeduction: originalDeduction.toString(),
      },
    });

    this.logger.log(`O'rinbosar tayinlandi: ${substituteTeacher.firstName} → dars ${dto.lessonId}`);

    return (await this.subRepo.findOne({
      where: { id: substitution.id },
      relations: { lesson: { group: true }, substituteTeacher: true, originalTeacher: true },
    }))!;
  }

  // ─── DARSNI YAKUNLASH (o'rinbosar) ───────────────────────────────────────
  async complete(
    substitutionId: string,
    dto: CompleteSubstitutionDto,
    actorId: string,
    actorRole: string,
  ): Promise<LessonSubstitution> {
    const sub = await this.subRepo.findOne({
      where: { id: substitutionId },
      relations: { lesson: true },
    });
    if (!sub) throw new NotFoundException('O\'rinbosar yozuvi topilmadi');

    // Faqat o'rinbosar yoki SA/Manager yakunlay oladi
    if (actorId !== sub.substituteTeacherId && actorRole !== Role.SUPER_ADMIN && actorRole !== Role.MANAGER) {
      throw new ForbiddenException('Faqat o\'rinbosar yoki menejer yakunlay oladi');
    }

    await this.dataSource.transaction(async (em) => {
      await em.update(Lesson, sub.lessonId, { status: LessonStatus.COMPLETED });
      await em.update(LessonSubstitution, substitutionId, {
        salaryProcessed: true,
        notes: dto.notes ?? sub.notes,
      });
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'SUBSTITUTION_COMPLETED',
      entityName: 'lesson_substitutions',
      entityId: substitutionId,
    });

    return (await this.subRepo.findOne({
      where: { id: substitutionId },
      relations: { substituteTeacher: true, originalTeacher: true, lesson: true },
    }))!;
  }

  // ─── BEKOR QILISH (maosh teskari qaytariladi, transaction) ────────────────
  async cancel(
    substitutionId: string,
    actorId: string,
    actorRole: string,
  ): Promise<{ message: string }> {
    const sub = await this.subRepo.findOne({
      where: { id: substitutionId },
      relations: { lesson: true },
    });
    if (!sub) throw new NotFoundException('O\'rinbosar yozuvi topilmadi');

    if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.MANAGER) {
      throw new ForbiddenException('Faqat SA yoki Manager bekor qila oladi');
    }

    if (sub.salaryProcessed) {
      throw new BadRequestException(
        'Maosh qayta ishlangan o\'rinbosarni bekor qilib bo\'lmaydi. SA dan ruxsat so\'rang.',
      );
    }

    const lessonDate = new Date(sub.lesson.lessonDate);
    const periodMonth = `${lessonDate.getFullYear()}-${String(lessonDate.getMonth() + 1).padStart(2, '0')}`;

    await this.dataSource.transaction(async (em) => {
      // Darsni asl holatiga qaytarish
      await em.update(Lesson, sub.lessonId, {
        teacherId: sub.originalTeacherId,
        status: LessonStatus.SCHEDULED,
        qrCode: null,
        qrExpiresAt: null,
      });

      // Maosh yozuvlarini teskari qaytarish
      await this.revertSalaryRecord(em, sub.substituteTeacherId, periodMonth, sub.subPayment, 'sub');
      await this.revertSalaryRecord(em, sub.originalTeacherId, periodMonth, sub.originalDeduction, 'deduction');

      // Soft delete
      await em.softDelete(LessonSubstitution, substitutionId);

      // Yo'qlik yozuvini ham o'chirish
      await em.softDelete(TeacherAbsence, {
        teacherId: sub.originalTeacherId,
        absenceDate: lessonDate,
      });
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'SUBSTITUTION_CANCELLED',
      entityName: 'lesson_substitutions',
      entityId: substitutionId,
      oldValues: {
        substituteTeacherId: sub.substituteTeacherId,
        subPayment: sub.subPayment.toString(),
      },
    });

    // Bekor qilish haqida xabar
    this.notifService.notify(
      sub.substituteTeacherId,
      NotificationType.SCHEDULE,
      'O\'rinbosar bekor qilindi',
      `Siz tayinlangan o\'rinbosar bekor qilindi. Dars asl o\'qituvchiga qaytarildi.`,
      { skipSms: true },
    ).catch(() => {});

    return { message: 'O\'rinbosar bekor qilindi va maosh teskari qaytarildi' };
  }

  // ─── DARS BO'YICHA O'RINBOSAR ─────────────────────────────────────────────
  async findByLesson(lessonId: string): Promise<LessonSubstitution | null> {
    return this.subRepo.findOne({
      where: { lessonId },
      relations: { substituteTeacher: true, originalTeacher: true, lesson: { group: true } },
    });
  }

  // ─── USTOZ BO'YICHA O'RINBOSARLAR ─────────────────────────────────────────
  async findByTeacher(
    teacherId: string,
    query: QuerySubstitutionDto,
    actorId: string,
    actorRole: string,
  ): Promise<LessonSubstitution[]> {
    // RBAC: ustoz faqat o'z yozuvlarini ko'radi
    if (actorRole === Role.USTOZ && actorId !== teacherId) {
      throw new ForbiddenException('Faqat o\'z o\'rinbosar ma\'lumotlarini ko\'ra olasiz');
    }

    const qb = this.subRepo
      .createQueryBuilder('ls')
      .leftJoinAndSelect('ls.lesson', 'l')
      .leftJoinAndSelect('l.group', 'g')
      .leftJoinAndSelect('g.subject', 's')
      .leftJoinAndSelect('ls.substituteTeacher', 'sub')
      .leftJoinAndSelect('ls.originalTeacher', 'orig')
      .where('ls.deleted_at IS NULL');

    // Rol bo'yicha filtr
    const role = query.role ?? 'both';
    if (role === 'as_substitute') {
      qb.andWhere('ls.substitute_teacher_id = :tid', { tid: teacherId });
    } else if (role === 'as_original') {
      qb.andWhere('ls.original_teacher_id = :tid', { tid: teacherId });
    } else {
      qb.andWhere(
        '(ls.substitute_teacher_id = :tid OR ls.original_teacher_id = :tid)',
        { tid: teacherId },
      );
    }

    if (query.dateFrom) {
      qb.andWhere('l.lesson_date >= :from', { from: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('l.lesson_date <= :to', { to: query.dateTo });
    }

    return qb.orderBy('l.lesson_date', 'DESC').getMany();
  }

  // ─── BARCHA O'RINBOSARLAR (SA/Manager) ────────────────────────────────────
  async findAll(query: QuerySubstitutionDto) {
    const qb = this.subRepo
      .createQueryBuilder('ls')
      .leftJoinAndSelect('ls.lesson', 'l')
      .leftJoinAndSelect('l.group', 'g')
      .leftJoinAndSelect('g.subject', 's')
      .leftJoinAndSelect('ls.substituteTeacher', 'sub')
      .leftJoinAndSelect('ls.originalTeacher', 'orig')
      .where('ls.deleted_at IS NULL');

    if (query.dateFrom) qb.andWhere('l.lesson_date >= :from', { from: query.dateFrom });
    if (query.dateTo) qb.andWhere('l.lesson_date <= :to', { to: query.dateTo });

    return qb.orderBy('l.lesson_date', 'DESC').getMany();
  }

  // ─── YORDAMCHI: SOATLIK EKVIVALENT STAVKA ─────────────────────────────────
  private async getEffectiveHourlyRate(teacherId: string): Promise<bigint> {
    const config = await this.salaryRepo.findOne({
      where: { teacherId, isActive: true },
    });
    if (!config) return 0n;

    // Admin: to'g'ridan-to'g'ri soatlik stavka
    if (config.hourlyRate && config.hourlyRate > 0n) {
      return config.hourlyRate;
    }

    // Ustoz: guruh daromadi × stavka foizi → oylik ÷ standart soat
    const groups = await this.groupRepo.find({
      where: { teacherId, isActive: true },
    });

    let monthlyExpected = 0n;
    for (const group of groups) {
      const enrollments = await this.enrollmentRepo.find({
        where: { groupId: group.id, status: EnrollmentStatus.ACTIVE },
      });
      for (const enr of enrollments) {
        const price = Number(group.monthlyPrice) * (1 - Number(enr.discountPercent) / 100);
        monthlyExpected += BigInt(Math.round(price));
      }
    }

    // monthlyExpected × ratePercent / 100
    const rateBps = BigInt(Math.round(Number(config.ratePercent) * 100));
    const expectedSalary = (monthlyExpected * rateBps) / 10_000n;

    if (expectedSalary === 0n) return 0n;

    // Soatlik ekvivalent
    return expectedSalary / BigInt(STANDARD_MONTHLY_HOURS);
  }

  // ─── YORDAMCHI: MAOSH YOZUVI YANGILASH ────────────────────────────────────
  private async updateSalaryRecord(
    em: any,
    teacherId: string,
    periodMonth: string,
    amount: bigint,
    type: 'sub' | 'deduction',
  ): Promise<void> {
    const existing = await em.findOne(SalaryRecord, {
      where: { teacherId, periodMonth },
    });

    if (existing) {
      if (existing.status === SalaryRecordStatus.APPROVED || existing.status === SalaryRecordStatus.PAID) {
        this.logger.warn(
          `Maosh ${existing.status} holatida, ${type} o'zgartirilmadi. Manuel tekshiruv kerak (teacher: ${teacherId})`,
        );
        return;
      }

      if (type === 'sub') {
        const newSub = existing.subAmount + amount;
        await em.update(SalaryRecord, existing.id, {
          subAmount: newSub,
          totalAmount: this.recalcTotal(existing, { subAmount: newSub }),
        });
      } else {
        const newDeduction = existing.deduction + amount;
        await em.update(SalaryRecord, existing.id, {
          deduction: newDeduction,
          totalAmount: this.recalcTotal(existing, { deduction: newDeduction }),
        });
      }
    } else {
      // Yangi maosh yozuvi (faqat sub/deduction bilan)
      const record = em.create(SalaryRecord, {
        teacherId,
        periodMonth,
        baseAmount: 0n,
        kpiBonus: 0n,
        subAmount: type === 'sub' ? amount : 0n,
        deduction: type === 'deduction' ? amount : 0n,
        totalAmount: type === 'sub' ? amount : 0n, // deduction uchun 0 (hali hisob bo'lmagan)
        lessonsCount: 0,
        totalHours: 0,
        status: SalaryRecordStatus.CALCULATED,
      });
      await em.save(record);
    }
  }

  // ─── YORDAMCHI: MAOSH YOZUVINI TESKARI QAYTARISH ──────────────────────────
  private async revertSalaryRecord(
    em: any,
    teacherId: string,
    periodMonth: string,
    amount: bigint,
    type: 'sub' | 'deduction',
  ): Promise<void> {
    const existing = await em.findOne(SalaryRecord, { where: { teacherId, periodMonth } });
    if (!existing) return;

    if (existing.status !== SalaryRecordStatus.CALCULATED) {
      this.logger.warn(`Maosh ${existing.status} — teskari qaytarish bajarilmadi (${teacherId})`);
      return;
    }

    if (type === 'sub') {
      const newSub = existing.subAmount - amount < 0n ? 0n : existing.subAmount - amount;
      await em.update(SalaryRecord, existing.id, {
        subAmount: newSub,
        totalAmount: this.recalcTotal(existing, { subAmount: newSub }),
      });
    } else {
      const newDeduction = existing.deduction - amount < 0n ? 0n : existing.deduction - amount;
      await em.update(SalaryRecord, existing.id, {
        deduction: newDeduction,
        totalAmount: this.recalcTotal(existing, { deduction: newDeduction }),
      });
    }
  }

  // totalAmount qayta hisoblash
  private recalcTotal(
    record: SalaryRecord,
    overrides: Partial<{ subAmount: bigint; deduction: bigint }>,
  ): bigint {
    const base = record.baseAmount;
    const kpi = record.kpiBonus;
    const sub = overrides.subAmount ?? record.subAmount;
    const ded = overrides.deduction ?? record.deduction;
    const raw = base + kpi + sub - ded;
    return raw < 0n ? 0n : raw;
  }

  // ─── BILDIRISHNOMALAR ─────────────────────────────────────────────────────
  private async sendNotifications(opts: {
    substitutionId: string;
    substituteTeacher: User;
    originalTeacher: User | null;
    lesson: Lesson & { group?: any };
    reason: AbsenceReason;
    subPayment: bigint;
    originalDeduction: bigint;
  }): Promise<void> {
    const lessonDate = new Date(opts.lesson.lessonDate);
    const dateStr = lessonDate.toLocaleDateString('uz-UZ');
    const groupName = opts.lesson.group?.name ?? 'Guruh';
    const fmt = (n: bigint) => Number(n).toLocaleString('uz-UZ');

    // O'rinbosarga xabar
    await this.notifService.notify(
      opts.substituteTeacher.id,
      NotificationType.SCHEDULE,
      '📋 O\'rinbosar tayinlandingiz',
      `Siz *${dateStr}* kuni *${groupName}* guruhiga o'rinbosar qilib tayinlandingiz.\n` +
        `Vaqt: ${opts.lesson.startTime}–${opts.lesson.endTime}\n` +
        `Maosh: +${fmt(opts.subPayment)} so'm`,
    );

    // Asl o'qituvchiga xabar
    if (opts.originalTeacher) {
      await this.notifService.notify(
        opts.originalTeacher.id,
        NotificationType.SCHEDULE,
        '🔄 Darsga o\'rinbosar tayinlandi',
        `*${dateStr}* kuni *${groupName}* darsiga o'rinbosar: ` +
          `${opts.substituteTeacher.firstName} ${opts.substituteTeacher.lastName}.\n` +
          `Maosh chegiriladi: -${fmt(opts.originalDeduction)} so'm`,
      );
    }

    // Guruh o'quvchilariga xabar
    const enrollments = await this.enrollmentRepo.find({
      where: { groupId: opts.lesson.groupId, status: EnrollmentStatus.ACTIVE },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);

    if (studentIds.length > 0) {
      await this.notifService.broadcast(
        studentIds,
        NotificationType.SCHEDULE,
        '👨‍🏫 Darsda ustoz almashdi',
        `*${dateStr}* kuni *${groupName}* darsida o'qituvchi almashdi.\n` +
          `Yangi o'qituvchi: ${opts.substituteTeacher.firstName} ${opts.substituteTeacher.lastName}`,
        { skipSms: true },
      );
    }

    // Bildirishnoma yuborilganini belgilash
    await this.subRepo.update(opts.substitutionId, { notificationSent: true });
  }
}

// ─── BIGINT × DECIMAL YORDAMCHI ───────────────────────────────────────────
// durationHours 1.5 kabi bo'lishi mumkin — ×10 / 10 usuli
function calculateBigIntPayment(hourlyRate: bigint, durationHours: number): bigint {
  if (hourlyRate === 0n) return 0n;
  const durationTenths = BigInt(Math.round(durationHours * 10));
  return (hourlyRate * durationTenths) / 10n;
}
