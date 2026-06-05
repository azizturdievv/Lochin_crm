import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Salary } from '../../entities/salary.entity';
import { SalaryRecord, SalaryRecordStatus } from '../../entities/salary-record.entity';
import { User } from '../../entities/user.entity';
import { Lesson, LessonStatus } from '../../entities/lesson.entity';
import { Group } from '../../entities/group.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { LessonSubstitution } from '../../entities/lesson-substitution.entity';
import { Sale } from '../../entities/sale.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { SetSalaryDto, CalculateSalaryDto, QuarterlyBonusQueryDto } from './dto/salary.dto';

// Oyiga standart ish soatlari (admin maoshi uchun)
const STANDARD_MONTHLY_HOURS = 176;

// Chorak mukofot: default koeffitsient (1 ball = 5 000 so'm)
const DEFAULT_BONUS_COEFFICIENT = 5_000;

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(Salary)
    private salaryRepo: Repository<Salary>,
    @InjectRepository(SalaryRecord)
    private recordRepo: Repository<SalaryRecord>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(LessonSubstitution)
    private subRepo: Repository<LessonSubstitution>,
    @InjectRepository(Sale)
    private saleRepo: Repository<Sale>,
    @InjectRepository(PointsLog)
    private pointsRepo: Repository<PointsLog>,
    private auditLog: AuditLogService,
  ) {}

  // ─── ISH HAQI KONFIGURATSIYASI ─────────────────────────────────────────────
  async setSalaryConfig(dto: SetSalaryDto, actorId: string, actorRole: string) {
    // Oldingi aktiv konfigni tugatish
    await this.salaryRepo.update(
      { teacherId: dto.teacherId, isActive: true },
      { isActive: false, endedAt: new Date() },
    );

    const salary = this.salaryRepo.create({
      teacherId: dto.teacherId,
      ratePercent: dto.ratePercent,
      kpiBonusPercent: dto.kpiBonusPercent ?? 0,
      hourlyRate: dto.hourlyRate ? BigInt(dto.hourlyRate) : null,
      salesBonusPercent: dto.salesBonusPercent ?? 0,
      isActive: true,
      startedAt: new Date(dto.startedAt),
      endedAt: null,
    });

    await this.salaryRepo.save(salary);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'SALARY_CONFIG_SET',
      entityName: 'salaries',
      entityId: salary.id,
      newValues: { teacherId: dto.teacherId, ratePercent: dto.ratePercent },
    });

    return salary;
  }

  // Konfiguratsiya ro'yxati
  async getSalaryConfigs() {
    return this.salaryRepo.find({
      where: { isActive: true },
      relations: { teacher: true },
      order: { createdAt: 'ASC' },
    });
  }

  // ─── OYLIK MAOSH HISOBLASH (bitta xodim) ─────────────────────────────────
  async calculateMonthly(
    teacherId: string,
    periodMonth: string,
    actorId: string,
  ): Promise<SalaryRecord> {
    const config = await this.salaryRepo.findOne({
      where: { teacherId, isActive: true },
    });
    if (!config) {
      throw new BadRequestException(`Xodim uchun ish haqi konfiguratsiyasi topilmadi`);
    }

    const teacher = await this.userRepo.findOne({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Xodim topilmadi');

    // Oy chegaralari
    const [year, month] = periodMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    let baseAmount = 0n;
    let lessonsCount = 0;
    let totalHours = 0;

    if (teacher.role === Role.USTOZ) {
      // Ustoz: o'z guruhlari tushumi × stavka foizi
      const groups = await this.groupRepo.find({
        where: { teacherId, isActive: true },
      });

      for (const group of groups) {
        const enrollments = await this.enrollmentRepo.find({
          where: { groupId: group.id, status: EnrollmentStatus.ACTIVE },
        });
        for (const enr of enrollments) {
          // Har o'quvchi uchun chegirmali oylik narx
          const price = Number(group.monthlyPrice) * (1 - Number(enr.discountPercent) / 100);
          baseAmount += BigInt(Math.round(price));
        }
      }
      // Foizni qo'llash (2 kasrli aniqlik uchun *100/10000)
      const rateBps = BigInt(Math.round(Number(config.ratePercent) * 100));
      baseAmount = (baseAmount * rateBps) / 10_000n;

      // Tugallangan darslar
      const lessons = await this.lessonRepo.find({
        where: { teacherId, status: LessonStatus.COMPLETED },
      });
      const monthLessons = lessons.filter((l) => {
        const d = new Date(l.lessonDate);
        return d >= monthStart && d <= monthEnd;
      });
      lessonsCount = monthLessons.length;
      totalHours = monthLessons.reduce((s, l) => s + Number(l.durationHours), 0);
    } else {
      // Admin/Manager: soatlik stavka × standart soat
      if (config.hourlyRate) {
        baseAmount = config.hourlyRate * BigInt(STANDARD_MONTHLY_HOURS);
      }

      // Savdo bonusi (mini-market)
      if (Number(config.salesBonusPercent) > 0) {
        const salesRow = await this.saleRepo
          .createQueryBuilder('s')
          .where('s.sold_by = :uid', { uid: teacherId })
          .andWhere("TO_CHAR(s.created_at, 'YYYY-MM') = :month", { month: periodMonth })
          .andWhere('s.deleted_at IS NULL')
          .select('SUM(s.total_amount) AS total')
          .getRawOne();

        if (salesRow?.total) {
          const bonusBps = BigInt(Math.round(Number(config.salesBonusPercent) * 100));
          baseAmount += (BigInt(Math.round(Number(salesRow.total))) * bonusBps) / 10_000n;
        }
      }
    }

    // KPI bonus
    const kpiBps = BigInt(Math.round(Number(config.kpiBonusPercent) * 100));
    const kpiBonus = (baseAmount * kpiBps) / 10_000n;

    // O'rinbosar sifatida ishlagan darslar (qo'shimcha daromad)
    const subRows = await this.subRepo
      .createQueryBuilder('ls')
      .innerJoin('lessons', 'l', 'l.id = ls.lesson_id')
      .where('ls.substitute_teacher_id = :tid', { tid: teacherId })
      .andWhere('l.lesson_date BETWEEN :start AND :end', {
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0],
      })
      .andWhere('ls.deleted_at IS NULL')
      .select('ls.sub_payment AS sub_payment')
      .getRawMany();

    const subAmount: bigint = subRows.reduce((s: bigint, r: any) => s + BigInt(r.sub_payment ?? 0), 0n);

    // Asl o'qituvchi sifatida o'rinbosar ishlatgan darslar (chegirma)
    const deductRows = await this.subRepo
      .createQueryBuilder('ls')
      .innerJoin('lessons', 'l', 'l.id = ls.lesson_id')
      .where('ls.original_teacher_id = :tid', { tid: teacherId })
      .andWhere('l.lesson_date BETWEEN :start AND :end', {
        start: monthStart.toISOString().split('T')[0],
        end: monthEnd.toISOString().split('T')[0],
      })
      .andWhere('ls.deleted_at IS NULL')
      .select('ls.original_deduction AS original_deduction')
      .getRawMany();

    const deduction: bigint = deductRows.reduce((s: bigint, r: any) => s + BigInt(r.original_deduction ?? 0), 0n);

    const raw: bigint = baseAmount + kpiBonus + subAmount - deduction;
    const totalAmount: bigint = raw < 0n ? 0n : raw;

    // Mavjud hisoblangan yozuvni tekshirish
    const existing = await this.recordRepo.findOne({ where: { teacherId, periodMonth } });
    if (existing && existing.status !== SalaryRecordStatus.CALCULATED) {
      throw new BadRequestException('Tasdiqlangan yoki to\'langan maoshni qayta hisoblash mumkin emas');
    }

    const data = {
      teacherId,
      periodMonth,
      baseAmount,
      kpiBonus,
      subAmount,
      deduction,
      totalAmount,
      lessonsCount,
      totalHours,
      status: SalaryRecordStatus.CALCULATED,
    };

    if (existing) {
      await this.recordRepo.update(existing.id, data);
      return (await this.recordRepo.findOne({
        where: { id: existing.id },
        relations: { teacher: true },
      }))!;
    }

    const record = this.recordRepo.create(data);
    await this.recordRepo.save(record);

    await this.auditLog.log({
      userId: actorId,
      userRole: Role.SUPER_ADMIN,
      action: 'SALARY_CALCULATED',
      entityName: 'salary_records',
      entityId: record.id,
      newValues: { teacherId, periodMonth, totalAmount: totalAmount.toString() },
    });

    return (await this.recordRepo.findOne({
      where: { id: record.id },
      relations: { teacher: true },
    }))!;
  }

  // ─── BARCHA FAOL XODIMLAR UCHUN HISOBLASH ─────────────────────────────────
  async calculateAllMonthly(periodMonth: string, actorId: string) {
    const configs = await this.salaryRepo.find({ where: { isActive: true } });
    const results: SalaryRecord[] = [];
    const errors: { teacherId: string; error: string }[] = [];

    for (const cfg of configs) {
      try {
        const record = await this.calculateMonthly(cfg.teacherId, periodMonth, actorId);
        results.push(record);
      } catch (err: any) {
        errors.push({ teacherId: cfg.teacherId, error: err.message });
      }
    }

    return { calculated: results.length, errors, results };
  }

  // ─── TASDIQLASH (SA only) ──────────────────────────────────────────────────
  async approve(recordId: string, actorId: string): Promise<SalaryRecord> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Maosh yozuvi topilmadi');

    if (record.status !== SalaryRecordStatus.CALCULATED) {
      throw new BadRequestException('Faqat hisoblangan maoshni tasdiqlash mumkin');
    }

    await this.recordRepo.update(recordId, {
      status: SalaryRecordStatus.APPROVED,
      approvedById: actorId,
      approvedAt: new Date(),
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: Role.SUPER_ADMIN,
      action: 'SALARY_APPROVED',
      entityName: 'salary_records',
      entityId: recordId,
    });

    return (await this.recordRepo.findOne({ where: { id: recordId }, relations: { teacher: true } }))!;
  }

  // ─── TO'LANDI DEb BELGILASH ────────────────────────────────────────────────
  async markPaid(recordId: string, actorId: string): Promise<SalaryRecord> {
    const record = await this.recordRepo.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Maosh yozuvi topilmadi');

    if (record.status !== SalaryRecordStatus.APPROVED) {
      throw new BadRequestException('Faqat tasdiqlangan maoshni to\'langan deb belgilash mumkin');
    }

    await this.recordRepo.update(recordId, {
      status: SalaryRecordStatus.PAID,
      paidAt: new Date(),
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: Role.SUPER_ADMIN,
      action: 'SALARY_PAID',
      entityName: 'salary_records',
      entityId: recordId,
    });

    return (await this.recordRepo.findOne({ where: { id: recordId }, relations: { teacher: true } }))!;
  }

  // ─── CHORAK MUKOFOT HISOBLASH ──────────────────────────────────────────────
  async calculateQuarterlyBonus(
    year: string,
    quarter: number,
    coefficientPerPoint: number = DEFAULT_BONUS_COEFFICIENT,
    actorId: string,
  ) {
    const months = this.quarterMonths(year, quarter);

    // Xodimlar: ustoz va managerlar
    const staff = await this.userRepo.find({
      where: [{ role: Role.USTOZ, isActive: true }, { role: Role.MANAGER, isActive: true }],
    });

    const results = await Promise.all(
      staff.map(async (user) => {
        const row = await this.pointsRepo
          .createQueryBuilder('p')
          .where('p.user_id = :uid', { uid: user.id })
          .andWhere("TO_CHAR(p.created_at, 'YYYY-MM') IN (:...months)", { months })
          .andWhere('p.deleted_at IS NULL')
          .select('SUM(p.points) AS total_points')
          .getRawOne();

        const totalPoints = Math.max(0, Number(row?.total_points ?? 0));
        const bonusAmount = totalPoints * coefficientPerPoint;

        return {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          totalPoints,
          bonusAmount,
        };
      }),
    );

    // Reytingni ball bo'yicha tartiblash
    const sorted = results.sort((a, b) => b.totalPoints - a.totalPoints);
    const totalBonusFund = sorted.reduce((s, r) => s + r.bonusAmount, 0);

    return {
      year,
      quarter,
      period: months,
      coefficientPerPoint,
      totalBonusFund,
      staff: sorted.map((r, i) => ({ rank: i + 1, ...r })),
    };
  }

  // ─── MAOSH RO'YXATI ────────────────────────────────────────────────────────
  async findAll(periodMonth: string) {
    return this.recordRepo.find({
      where: { periodMonth },
      relations: { teacher: true, approvedBy: true },
      order: { createdAt: 'ASC' },
    });
  }

  // ─── YORDAMCHI: chorak oylarini qaytarish ─────────────────────────────────
  private quarterMonths(year: string, quarter: number): string[] {
    const start = (quarter - 1) * 3 + 1;
    return [0, 1, 2].map((i) => {
      const m = start + i;
      return `${year}-${String(m).padStart(2, '0')}`;
    });
  }
}
