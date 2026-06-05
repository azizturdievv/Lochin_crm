import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProgressSnapshot } from '../../entities/progress-snapshot.entity';
import { BaselineAssessment } from '../../entities/baseline-assessment.entity';
import { TestResult } from '../../entities/test-result.entity';
import { Attendance, AttendanceStatus } from '../../entities/attendance.entity';
import { HomeworkSubmission, SubmissionStatus } from '../../entities/homework-submission.entity';
import { SpellingError } from '../../entities/spelling-error.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { User } from '../../entities/user.entity';

export type GrowthPoint = {
  date:              string;        // 'YYYY-MM'
  testScore:         number;        // 0-100
  attendanceRate:    number;        // 0-100
  homeworkRate:      number;        // 0-100
  totalPoints:       number;
  spellingErrors:    number;
};

export type GrowthData = {
  studentId:   string;
  studentName: string;
  baseline: {
    date:         string;
    testScore:    number | null;
    teacherNotes: string | null;
    assessmentType: string | null;
  } | null;
  dataPoints:  GrowthPoint[];
  current:     GrowthPoint;
  improvement: {
    testScore:     number | null; // % o'zgarish
    attendance:    number | null;
    points:        number | null;
  };
  subjectId:   string | null;
};

@Injectable()
export class GrowthService {
  private readonly logger = new Logger(GrowthService.name);

  constructor(
    @InjectRepository(ProgressSnapshot)
    private snapshotRepo: Repository<ProgressSnapshot>,
    @InjectRepository(BaselineAssessment)
    private baselineRepo: Repository<BaselineAssessment>,
    @InjectRepository(TestResult)
    private testResultRepo: Repository<TestResult>,
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(HomeworkSubmission)
    private hwSubmRepo: Repository<HomeworkSubmission>,
    @InjectRepository(SpellingError)
    private spellingRepo: Repository<SpellingError>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // ─── O'QUVCHI O'SISH GRAFIGI ──────────────────────────────────────────────
  async getStudentGrowth(
    studentId: string,
    subjectId?: string,
    interval: 'weekly' | 'monthly' = 'monthly',
  ): Promise<GrowthData> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('O\'quvchi topilmadi');

    // 1. Ilk qabul (baseline) — eng birinchi yozuv
    const baseline = await this.baselineRepo.findOne({
      where: {
        studentId,
        ...(subjectId ? { subjectId } : {}),
      },
      order: { createdAt: 'ASC' },
    });

    // 2. Mavjud snapshotlar (oylik/haftalik yozuvlar)
    const snapshots = await this.snapshotRepo.find({
      where: {
        studentId,
        ...(subjectId ? { subjectId } : {}),
      },
      order: { snapshotDate: 'ASC' },
    });

    // 3. So'nggi 6 oy uchun hisoblangan ma'lumotlar
    const computed = await this.computeRecentPoints(studentId, 6, interval);

    // Snapshotlarni GrowthPoint formatiga o'tkazish
    const historical: GrowthPoint[] = snapshots.map((s) => ({
      date:           this.formatDate(new Date(s.snapshotDate), interval),
      testScore:      s.metrics.avgTestScore ?? 0,
      attendanceRate: s.metrics.attendanceRate ?? 0,
      homeworkRate:   s.metrics.homeworkCompletion ?? 0,
      totalPoints:    s.metrics.totalPoints ?? 0,
      spellingErrors: s.metrics.spellingErrors ?? 0,
    }));

    // Hisoblangan so'nggi nuqtalar (tarixiylarda bo'lmagan oylar)
    const existingDates = new Set(historical.map((p) => p.date));
    const fresh = computed.filter((p) => !existingDates.has(p.date));

    const dataPoints = [...historical, ...fresh].sort((a, b) => a.date.localeCompare(b.date));

    // Joriy holat (eng so'nggi ma'lumotlar)
    const current = await this.computeCurrentMetrics(studentId);

    // Yaxshilanish foizi
    const baseScore = baseline?.score !== null ? Number(baseline?.score) : null;
    const improvement = {
      testScore:  baseScore !== null ? Math.round(current.testScore - baseScore) : null,
      attendance: null as number | null,
      points:     null as number | null,
    };

    if (dataPoints.length >= 2) {
      const first = dataPoints[0];
      improvement.attendance = Math.round(current.attendanceRate - first.attendanceRate);
      improvement.points     = current.totalPoints - first.totalPoints;
    }

    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      baseline: baseline
        ? {
            date:           this.formatDate(new Date(baseline.createdAt), interval),
            testScore:      baseline.score !== null ? Number(baseline.score) : null,
            teacherNotes:   baseline.teacherNotes,
            assessmentType: baseline.type,
          }
        : null,
      dataPoints,
      current,
      improvement,
      subjectId: subjectId ?? null,
    };
  }

  // ─── GURUH UMUMIY KO'RSATKICHI (Ustoz uchun) ──────────────────────────────
  async getGroupMetrics(groupId: string): Promise<{
    groupId:           string;
    totalStudents:     number;
    avgTestScore:      number;
    attendanceRate:    number;
    homeworkRate:      number;
    avgPoints:         number;
    topStudents:       Array<{ studentId: string; name: string; score: number }>;
    needsAttention:    Array<{ studentId: string; name: string; reason: string }>;
  }> {
    const enrollments = await this.enrollmentRepo.find({
      where: { groupId, status: EnrollmentStatus.ACTIVE },
      relations: { student: true },
    });

    if (enrollments.length === 0) {
      return {
        groupId,
        totalStudents: 0,
        avgTestScore: 0,
        attendanceRate: 0,
        homeworkRate: 0,
        avgPoints: 0,
        topStudents: [],
        needsAttention: [],
      };
    }

    const studentIds  = enrollments.map((e) => e.studentId);
    const studentMap  = new Map(enrollments.map((e) => [e.studentId, e.student]));

    // 30 kunlik statistika
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Test o'rtacha bali
    const testRows = await this.testResultRepo
      .createQueryBuilder('tr')
      .select('tr.student_id', 'studentId')
      .addSelect('AVG(tr.score)', 'avgScore')
      .where('tr.student_id IN (:...ids)', { ids: studentIds })
      .andWhere('tr.created_at >= :since', { since })
      .groupBy('tr.student_id')
      .getRawMany<{ studentId: string; avgScore: string }>();

    const testMap = new Map(testRows.map((r) => [r.studentId, Number(r.avgScore)]));

    // Davomat
    const attRows = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('a.student_id', 'studentId')
      .addSelect('COUNT(*)',  'total')
      .addSelect(
        `SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)`,
        'present',
      )
      .where('a.student_id IN (:...ids)', { ids: studentIds })
      .andWhere('a.created_at >= :since', { since })
      .groupBy('a.student_id')
      .getRawMany<{ studentId: string; total: string; present: string }>();

    const attMap = new Map(attRows.map((r) => [
      r.studentId,
      Number(r.total) > 0 ? Math.round((Number(r.present) / Number(r.total)) * 100) : 0,
    ]));

    // Uyga vazifa
    const hwRows = await this.hwSubmRepo
      .createQueryBuilder('hs')
      .select('hs.student_id', 'studentId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN hs.on_time = true THEN 1 ELSE 0 END)`,
        'onTime',
      )
      .where('hs.student_id IN (:...ids)', { ids: studentIds })
      .andWhere('hs.submitted_at >= :since', { since })
      .groupBy('hs.student_id')
      .getRawMany<{ studentId: string; total: string; onTime: string }>();

    const hwMap = new Map(hwRows.map((r) => [
      r.studentId,
      Number(r.total) > 0 ? Math.round((Number(r.onTime) / Number(r.total)) * 100) : 0,
    ]));

    // O'rtachalar
    const allScores = studentIds.map((id) => testMap.get(id) ?? 0);
    const allAtt    = studentIds.map((id) => attMap.get(id) ?? 0);
    const allHw     = studentIds.map((id) => hwMap.get(id) ?? 0);
    const allPoints = enrollments.map((e) => e.student?.totalPoints ?? 0);

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    // Top o'quvchilar (test bali bo'yicha)
    const topStudents = studentIds
      .map((id) => ({
        studentId: id,
        name:      `${studentMap.get(id)?.firstName} ${studentMap.get(id)?.lastName}`,
        score:     testMap.get(id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Diqqat talab qiluvchilar
    const needsAttention: Array<{ studentId: string; name: string; reason: string }> = [];
    for (const id of studentIds) {
      const name    = `${studentMap.get(id)?.firstName} ${studentMap.get(id)?.lastName}`;
      const attRate = attMap.get(id) ?? 0;
      const hwRate  = hwMap.get(id) ?? 0;
      const score   = testMap.get(id) ?? 0;

      if (attRate < 60) needsAttention.push({ studentId: id, name, reason: `Davomat past: ${attRate}%` });
      else if (hwRate < 50) needsAttention.push({ studentId: id, name, reason: `Uyga vazifa kam: ${hwRate}%` });
      else if (score < 40) needsAttention.push({ studentId: id, name, reason: `Test bali past: ${score}` });
    }

    return {
      groupId,
      totalStudents:  studentIds.length,
      avgTestScore:   avg(allScores),
      attendanceRate: avg(allAtt),
      homeworkRate:   avg(allHw),
      avgPoints:      avg(allPoints),
      topStudents,
      needsAttention: needsAttention.slice(0, 10),
    };
  }

  // ─── SON OY UCHUN HISOBLASH ────────────────────────────────────────────────
  private async computeRecentPoints(
    studentId: string,
    months:    number,
    interval:  'weekly' | 'monthly',
  ): Promise<GrowthPoint[]> {
    const points: GrowthPoint[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodEnd   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const [testScore, attRate, hwRate, spCount] = await Promise.all([
        this.avgTestScore(studentId,  periodStart, periodEnd),
        this.attRate(studentId,       periodStart, periodEnd),
        this.hwRate(studentId,        periodStart, periodEnd),
        this.spellingCount(studentId, periodStart, periodEnd),
      ]);

      // Umumiy ballar — snapshot yoki user.totalPoints dan olinadi (tarix yo'q, shuning uchun 0)
      points.push({
        date:           this.formatDate(periodStart, interval),
        testScore,
        attendanceRate: attRate,
        homeworkRate:   hwRate,
        totalPoints:    0,
        spellingErrors: spCount,
      });
    }

    return points;
  }

  // ─── JORIY KO'RSATKICHLAR ─────────────────────────────────────────────────
  private async computeCurrentMetrics(studentId: string): Promise<GrowthPoint> {
    const now   = new Date();
    const since = new Date(now.getFullYear(), now.getMonth(), 1);

    const user = await this.userRepo.findOne({ where: { id: studentId }, select: { totalPoints: true } });

    const [testScore, attRate, hwRate, spCount] = await Promise.all([
      this.avgTestScore(studentId,  since, now),
      this.attRate(studentId,       since, now),
      this.hwRate(studentId,        since, now),
      this.spellingCount(studentId, since, now),
    ]);

    return {
      date:           this.formatDate(now, 'monthly'),
      testScore,
      attendanceRate: attRate,
      homeworkRate:   hwRate,
      totalPoints:    user?.totalPoints ?? 0,
      spellingErrors: spCount,
    };
  }

  // ─── YORDAMCHI HISOB METODLARI ────────────────────────────────────────────

  private async avgTestScore(studentId: string, from: Date, to: Date): Promise<number> {
    const r = await this.testResultRepo
      .createQueryBuilder('tr')
      .select('AVG(tr.score)', 'avg')
      .where('tr.student_id = :id', { id: studentId })
      .andWhere('tr.created_at BETWEEN :from AND :to', { from, to })
      .getRawOne<{ avg: string | null }>();
    return r?.avg !== null ? Math.round(Number(r?.avg)) : 0;
  }

  private async attRate(studentId: string, from: Date, to: Date): Promise<number> {
    const r = await this.attendanceRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END)`, 'present')
      .where('a.student_id = :id', { id: studentId })
      .andWhere('a.created_at BETWEEN :from AND :to', { from, to })
      .getRawOne<{ total: string; present: string }>();
    const total = Number(r?.total ?? 0);
    return total > 0 ? Math.round((Number(r?.present ?? 0) / total) * 100) : 0;
  }

  private async hwRate(studentId: string, from: Date, to: Date): Promise<number> {
    const r = await this.hwSubmRepo
      .createQueryBuilder('hs')
      .select('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN hs.on_time = true THEN 1 ELSE 0 END)`, 'onTime')
      .where('hs.student_id = :id', { id: studentId })
      .andWhere('hs.submitted_at BETWEEN :from AND :to', { from, to })
      .getRawOne<{ total: string; onTime: string }>();
    const total = Number(r?.total ?? 0);
    return total > 0 ? Math.round((Number(r?.onTime ?? 0) / total) * 100) : 0;
  }

  private async spellingCount(studentId: string, from: Date, to: Date): Promise<number> {
    return this.spellingRepo
      .createQueryBuilder('e')
      .where('e.sender_id = :id', { id: studentId })
      .andWhere('e.checked_at BETWEEN :from AND :to', { from, to })
      .getCount();
  }

  private formatDate(date: Date, _interval: 'weekly' | 'monthly'): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
