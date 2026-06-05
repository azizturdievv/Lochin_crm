import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpellingError } from '../../entities/spelling-error.entity';
import { User } from '../../entities/user.entity';
import { BaselineAssessment } from '../../entities/baseline-assessment.entity';
import { HomeworkSubmission } from '../../entities/homework-submission.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { Role } from '../../common/enums/role.enum';
import { SpellingService } from './spelling.service';
import { GrowthService } from './growth.service';
import { QualityPeriod } from './dto/quality.dto';

// Davr chegaralarini hisoblash
function getPeriodRange(period: QualityPeriod): { from: Date; to: Date } {
  const to   = new Date();
  const from = new Date();
  if (period === QualityPeriod.WEEK) {
    from.setDate(from.getDate() - 7);
  } else if (period === QualityPeriod.QUARTER) {
    from.setMonth(from.getMonth() - 3);
  } else {
    from.setMonth(from.getMonth() - 1);
  }
  return { from, to };
}

@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);

  constructor(
    @InjectRepository(SpellingError)
    private errorRepo: Repository<SpellingError>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(BaselineAssessment)
    private baselineRepo: Repository<BaselineAssessment>,
    @InjectRepository(HomeworkSubmission)
    private hwSubmRepo: Repository<HomeworkSubmission>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    private spellingService: SpellingService,
    private growthService: GrowthService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // SA: BARCHA XODIM IMLO + AI MULOQOT TAHLILI
  // ══════════════════════════════════════════════════════════════════════════
  async getSaDashboard(period: QualityPeriod) {
    const { from, to } = getPeriodRange(period);

    // Barcha xodim imlo statistikasi
    const staffStats = await this.spellingService.getStaffSpellingStats(from, to);

    // Jami xatolar soni
    const totalErrors   = staffStats.reduce((s, r) => s + r.errorCount, 0);
    const cleanStaff    = staffStats.filter((r) => r.errorCount === 0).length;

    // Eng ko'p xato qilganlar (top 5)
    const topOffenders  = staffStats.slice(0, 5);

    // Umumiy sifat balli
    const totalStaff    = staffStats.length;
    const overallScore  = totalStaff > 0
      ? Math.round(100 - (totalErrors / Math.max(totalStaff * 10, 1)) * 10)
      : 100;

    // Muloqot tahlili — barcha xodimlar uchun o'rtacha
    const avgQuality = staffStats.length > 0
      ? Math.round(staffStats.reduce((s, r) => s + (r.errorCount === 0 ? 100 : Math.max(0, 100 - r.errorCount * 5)), 0) / staffStats.length)
      : 100;

    return {
      period,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalStaff,
        cleanStaff,
        totalErrors,
        overallScore: Math.max(0, overallScore),
        avgQuality,
      },
      topOffenders,
      allStaffStats: staffStats,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MANAGER: O'Z IMLO + MULOQOT SIFATI
  // ══════════════════════════════════════════════════════════════════════════
  async getManagerDashboard(managerId: string, period: QualityPeriod) {
    const { from, to } = getPeriodRange(period);

    // O'z imlo xatolari
    const ownErrors = await this.spellingService.getUserErrors(managerId, from, 50);

    // Muloqot sifati tahlili (AI)
    const quality = await this.spellingService.analyzeConversationQuality(managerId, from, to);

    // Haftalik trend (oxirgi 4 hafta)
    const weeklyTrend = await this.buildWeeklyErrorTrend(managerId, 4);

    return {
      period,
      dateRange:    { from: from.toISOString(), to: to.toISOString() },
      ownErrors:    ownErrors.map((e) => ({
        id:          e.id,
        original:    e.originalText,
        suggestions: e.suggestions,
        context:     e.context,
        checkedAt:   e.checkedAt,
      })),
      quality,
      weeklyTrend,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // USTOZ: O'Z IMLO + GURUH UMUMIY KO'RSATKICHI
  // ══════════════════════════════════════════════════════════════════════════
  async getUstозDashboard(teacherId: string, period: QualityPeriod) {
    const { from, to } = getPeriodRange(period);

    // O'z imlo xatolari
    const ownErrors = await this.spellingService.getUserErrors(teacherId, from, 30);

    // Muloqot sifat balli (imlo asosida hisob)
    const errCount = ownErrors.length;
    const qualityScore = Math.max(0, 100 - errCount * 5);

    // O'qituvchi guruhlari
    const groups = await this.groupRepo.find({
      where: { teacherId, isActive: true },
    });

    // Har guruh uchun ko'rsatkichlar
    const groupMetrics = await Promise.all(
      groups.map(async (g) => ({
        groupId:   g.id,
        groupName: g.name,
        metrics:   await this.growthService.getGroupMetrics(g.id),
      })),
    );

    return {
      period,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      ownSpelling: {
        errorCount:   errCount,
        qualityScore,
        recentErrors: ownErrors.slice(0, 10).map((e) => ({
          id:          e.id,
          original:    e.originalText,
          suggestions: e.suggestions,
          context:     e.context,
          checkedAt:   e.checkedAt,
        })),
      },
      groupMetrics,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OTA-ONA: FARZAND IMLO + USTOZ IZOHLARI + O'SISH GRAFIGI
  // studentId bevosita beriladi (SA/Manager pull qiladi)
  // ══════════════════════════════════════════════════════════════════════════
  async getParentDashboard(
    studentId:  string,
    period:     QualityPeriod,
    subjectId?: string,
  ) {
    const { from } = getPeriodRange(period);

    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('O\'quvchi topilmadi');

    // Farzand imlo xatolari (xabarlardan)
    const childErrors = await this.spellingService.getUserErrors(studentId, from, 30);

    // Ustoz izohlari (uyga vazifa baholaridan)
    const teacherComments = await this.hwSubmRepo
      .createQueryBuilder('hs')
      .select([
        'hs.id',
        'hs.teacher_comment',
        'hs.score',
        'hs.graded_at',
      ])
      .where('hs.student_id = :id', { id: studentId })
      .andWhere('hs.teacher_comment IS NOT NULL')
      .andWhere('hs.graded_at >= :from', { from })
      .orderBy('hs.graded_at', 'DESC')
      .take(10)
      .getMany();

    // Baseline ustoz izohlari
    const baselineNotes = await this.baselineRepo.find({
      where: { studentId },
      select: {
        id: true,
        teacherNotes: true,
        type: true,
        createdAt: true,
        score: true,
      } as any,
      order: { createdAt: 'DESC' },
    });

    // O'sish grafigi
    const growth = await this.growthService.getStudentGrowth(
      studentId, subjectId, 'monthly',
    );

    return {
      period,
      studentId,
      childSpelling: {
        errorCount:   childErrors.length,
        recentErrors: childErrors.slice(0, 10).map((e) => ({
          original:    e.originalText,
          suggestions: e.suggestions,
          context:     e.context,
          checkedAt:   e.checkedAt,
          wasCorrected:e.wasCorrected,
        })),
      },
      teacherComments: teacherComments.map((h) => ({
        comment:  h.teacherComment,
        score:    h.score,
        gradedAt: h.gradedAt,
      })),
      baselineNotes: baselineNotes.map((b) => ({
        type:         b.type,
        teacherNotes: b.teacherNotes,
        score:        b.score,
        date:         b.createdAt,
      })),
      growth,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // O'QUVCHI: O'Z IMLO + TO'G'RI VARIANT + MASHQ + O'SISH
  // ══════════════════════════════════════════════════════════════════════════
  async getStudentDashboard(
    studentId: string,
    actorId:   string,
    actorRole: string,
    period:    QualityPeriod,
    subjectId?: string,
  ) {
    // RBAC: o'quvchi faqat o'zini ko'radi
    if (actorRole === Role.STUDENT && actorId !== studentId) {
      throw new ForbiddenException('Faqat o\'z ma\'lumotlaringizni ko\'ra olasiz');
    }

    const { from } = getPeriodRange(period);

    // O'z imlo xatolari (to'g'ri variant va mashqlar bilan)
    const errors = await this.errorRepo.find({
      where: { senderId: studentId },
      order: { checkedAt: 'DESC' },
      take:  20,
    });

    // O'sish grafigi
    const growth = await this.growthService.getStudentGrowth(
      studentId, subjectId, 'monthly',
    );

    // O'z balllari tarixi (so'nggi oylik)
    const recentPoints = await this.getRecentPointsSummary(studentId, from);

    return {
      period,
      studentId,
      spellingReport: {
        totalErrors:     errors.length,
        correctedCount:  errors.filter((e) => e.wasCorrected).length,
        uncorrectedList: errors
          .filter((e) => !e.wasCorrected)
          .map((e) => ({
            id:          e.id,
            original:    e.originalText,
            suggestions: e.suggestions,
            context:     e.context,
            checkedAt:   e.checkedAt,
          })),
        correctedList: errors
          .filter((e) => e.wasCorrected)
          .map((e) => ({
            original:    e.originalText,
            correctedAt: e.correctedAt,
          })),
      },
      growth,
      recentPoints,
    };
  }

  // ─── HAFTALIK XATO TRENDI ─────────────────────────────────────────────────
  private async buildWeeklyErrorTrend(
    userId: string,
    weeks:  number,
  ): Promise<Array<{ week: string; count: number }>> {
    const result: Array<{ week: string; count: number }> = [];
    const now = new Date();

    for (let i = weeks - 1; i >= 0; i--) {
      const to   = new Date(now);
      to.setDate(to.getDate() - i * 7);
      const from = new Date(to);
      from.setDate(from.getDate() - 7);

      const count = await this.errorRepo
        .createQueryBuilder('e')
        .where('e.sender_id = :id', { id: userId })
        .andWhere('e.checked_at BETWEEN :from AND :to', { from, to })
        .getCount();

      result.push({
        week:  `${from.toISOString().slice(0, 10)} – ${to.toISOString().slice(0, 10)}`,
        count,
      });
    }

    return result;
  }

  // ─── SO'NGGI OY BALLAR XULOSASI ───────────────────────────────────────────
  private async getRecentPointsSummary(
    userId: string,
    since:  Date,
  ): Promise<{ gained: number; lost: number; net: number }> {
    const rows = await this.userRepo.manager
      .createQueryBuilder()
      .select('SUM(CASE WHEN pl.points > 0 THEN pl.points ELSE 0 END)', 'gained')
      .addSelect('SUM(CASE WHEN pl.points < 0 THEN pl.points ELSE 0 END)', 'lost')
      .from('points_log', 'pl')
      .where('pl.user_id = :id', { id: userId })
      .andWhere('pl.created_at >= :since', { since })
      .getRawOne<{ gained: string; lost: string }>();

    const gained = Number(rows?.gained ?? 0);
    const lost   = Math.abs(Number(rows?.lost ?? 0));
    return { gained, lost, net: gained - lost };
  }
}
