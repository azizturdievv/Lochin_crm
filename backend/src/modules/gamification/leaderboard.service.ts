import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { PointsLog, PointsAction } from '../../entities/points-log.entity';
import { Badge } from '../../entities/badge.entity';
import { ProgressSnapshot } from '../../entities/progress-snapshot.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Role } from '../../common/enums/role.enum';
import { PointsService } from './points.service';
import { BadgeService, BadgeType } from './badge.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../../entities/notification.entity';

// O'quvchi mukofotlari
export const STUDENT_REWARDS = {
  FIRST_PLACE: { discountPercent: 100, label: 'Kurs bepul 🥇' },
  SECOND_PLACE: { discountPercent: 50, label: '50% chegirma 🥈' },
  THIRD_PLACE: { discountPercent: 0, label: 'Sovg\'a 🥉' },
} as const;

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PointsLog)
    private pointsRepo: Repository<PointsLog>,
    @InjectRepository(Badge)
    private badgeRepo: Repository<Badge>,
    @InjectRepository(ProgressSnapshot)
    private snapshotRepo: Repository<ProgressSnapshot>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    private pointsService: PointsService,
    private badgeService: BadgeService,
    private notifService: NotificationService,
  ) {}

  // ─── REYTING (o'quvchi yoki xodim) ────────────────────────────────────────
  async getLeaderboard(opts: {
    role?: 'student' | 'staff';
    period?: 'weekly' | 'monthly' | 'all';
    limit?: number;
  }) {
    const { role = 'student', period = 'monthly', limit = 10 } = opts;

    const userRole = role === 'student' ? Role.STUDENT : [Role.USTOZ, Role.MANAGER];

    // Davr boshlanish vaqti
    const now = new Date();
    let since: Date | null = null;
    if (period === 'weekly') {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'monthly') {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (since) {
      // Davr ichida eng ko'p ball yig'gan foydalanuvchilar
      const rows = await this.pointsRepo
        .createQueryBuilder('p')
        .innerJoin('users', 'u', 'u.id = p.user_id')
        .where(
          Array.isArray(userRole)
            ? 'u.role IN (:...roles)'
            : 'u.role = :role',
          Array.isArray(userRole) ? { roles: userRole } : { role: userRole },
        )
        .andWhere('u.is_active = true')
        .andWhere('u.deleted_at IS NULL')
        .andWhere('p.points > 0')
        .andWhere('p.created_at >= :since', { since })
        .andWhere('p.deleted_at IS NULL')
        .select([
          'u.id AS user_id',
          'u.firstName AS first_name',
          'u.last_name AS last_name',
          'u.total_points AS total_points',
          'u.role AS role',
          'SUM(p.points) AS period_points',
        ])
        .groupBy('u.id, u.firstName, u.last_name, u.total_points, u.role')
        .orderBy('period_points', 'DESC')
        .limit(limit)
        .getRawMany();

      return rows.map((r, i) => ({
        rank: i + 1,
        userId: r.user_id,
        name: `${r.first_name} ${r.last_name}`,
        role: r.role,
        totalPoints: Number(r.total_points),
        periodPoints: Number(r.period_points),
      }));
    }

    // all-time: user.totalPoints bo'yicha
    const users = await this.userRepo.find({
      where: Array.isArray(userRole)
        ? userRole.map((r) => ({ role: r, isActive: true }))
        : [{ role: userRole as Role, isActive: true }],
      order: { totalPoints: 'DESC' },
      take: limit,
      select: { id: true, firstName: true, lastName: true, role: true, totalPoints: true },
    });

    return users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      totalPoints: u.totalPoints,
      periodPoints: u.totalPoints,
    }));
  }

  // ─── OYLIK MUKOFOT BERISH (SA ishga tushiradi) ─────────────────────────────
  async awardMonthlyRewards(month: string, actorId: string): Promise<{
    winners: Array<{ rank: number; userId: string; name: string; reward: string }>;
  }> {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);

    // O'quvchilar oylik reytingi
    const topStudents = await this.pointsRepo
      .createQueryBuilder('p')
      .innerJoin('users', 'u', "u.id = p.user_id AND u.role = 'student' AND u.is_active = true")
      .where('p.points > 0')
      .andWhere('p.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('p.deleted_at IS NULL')
      .select([
        'u.id AS user_id',
        'u.firstName AS first_name',
        'u.last_name AS last_name',
        'SUM(p.points) AS period_points',
      ])
      .groupBy('u.id, u.firstName, u.last_name')
      .orderBy('period_points', 'DESC')
      .limit(3)
      .getRawMany();

    const winners: Array<{ rank: number; userId: string; name: string; reward: string }> = [];

    for (let i = 0; i < topStudents.length; i++) {
      const student = topStudents[i];
      const rank = i + 1;
      const userId = student.user_id;
      const name = `${student.first_name} ${student.last_name}`;

      let reward = '';
      let discountPercent = 0;

      if (rank === 1) {
        reward = STUDENT_REWARDS.FIRST_PLACE.label;
        discountPercent = STUDENT_REWARDS.FIRST_PLACE.discountPercent;

        // 1-o'rin: badge berish
        await this.badgeService.grantIfNew(userId, BadgeType.TOP_STUDENT);
      } else if (rank === 2) {
        reward = STUDENT_REWARDS.SECOND_PLACE.label;
        discountPercent = STUDENT_REWARDS.SECOND_PLACE.discountPercent;
      } else {
        reward = STUDENT_REWARDS.THIRD_PLACE.label;
        discountPercent = 0; // Sovg'a — alohida beriladi
      }

      // Keyingi oy enrollment ga chegirma o'rnatish (1 va 2-o'rin uchun)
      if (discountPercent > 0) {
        const nextMonthDate = new Date(year, m, 1);
        const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // Faol enrollment'larini yangilash
        await this.enrollmentRepo
          .createQueryBuilder()
          .update()
          .set({ discountPercent })
          .where('student_id = :uid', { uid: userId })
          .andWhere('status = :s', { s: EnrollmentStatus.ACTIVE })
          .execute();
      }

      // Foydalanuvchiga bildirishnoma
      const notifBody = rank === 1
        ? `🎉 Tabriklaymiz! ${month} oyida birinchi o'ringa chiqdingiz! Keyingi oy kurs to'lovi bepul!`
        : rank === 2
        ? `🎊 ${month} oyida ikkinchi o'ringa chiqdingiz! Keyingi oy 50% chegirma qo'llanildi!`
        : `🎁 ${month} oyida uchinchi o'ringa chiqdingiz! Sovg'a siz uchun!`;

      await this.notifService.notify(
        userId,
        NotificationType.SYSTEM,
        `${rank}-o'rin: ${reward}`,
        notifBody,
      ).catch(() => {});

      winners.push({ rank, userId, name, reward });
    }

    this.logger.log(`${month} oylik mukofotlar berildi: ${winners.length} ta g'olib`);

    return { winners };
  }

  // ─── PROGRESS SNAPSHOT YARATISH (Cron: har oy 1-sida) ────────────────────
  @Cron('0 2 1 * *', { name: 'monthly-snapshot', timeZone: 'Asia/Tashkent' })
  async createMonthlySnapshots(): Promise<void> {
    this.logger.log('Oylik progress snapshot yaratilmoqda...');

    const now = new Date();
    const snapshotDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${snapshotDate.getFullYear()}-${String(snapshotDate.getMonth() + 1).padStart(2, '0')}`;

    const students = await this.userRepo.find({
      where: { role: Role.STUDENT, isActive: true },
      select: { id: true },
    });

    for (const student of students) {
      try {
        await this.createSnapshotForStudent(student.id, month);
      } catch (err) {
        this.logger.error(`Snapshot yaratishda xato (${student.id}): ${err}`);
      }
    }

    this.logger.log(`${students.length} ta o'quvchi uchun snapshot yaratildi`);
  }

  private async createSnapshotForStudent(studentId: string, month: string): Promise<void> {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);

    // Davomat %
    const attendanceData = await this.userRepo.manager
      .createQueryBuilder()
      .select(['COUNT(*) AS total', "SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present"])
      .from('attendance', 'a')
      .innerJoin('lessons', 'l', 'l.id = a.lesson_id')
      .where('a.student_id = :sid', { sid: studentId })
      .andWhere('l.lesson_date BETWEEN :start AND :end', { start, end })
      .getRawOne();

    const total = Number((attendanceData as any)?.total ?? 0);
    const present = Number((attendanceData as any)?.present ?? 0);
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    // O'rtacha test bali
    const testData = await this.userRepo.manager
      .createQueryBuilder()
      .select('AVG(tr.score) AS avg_score')
      .from('test_results', 'tr')
      .where('tr.student_id = :sid', { sid: studentId })
      .andWhere('tr.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('tr.deleted_at IS NULL')
      .getRawOne();

    const avgTestScore = Math.round(Number((testData as any)?.avg_score ?? 0) * 10) / 10;

    // Oylik ball
    const totalPoints = await this.pointsService.getMonthlyEarned(studentId, month);

    const user = await this.userRepo.findOne({
      where: { id: studentId },
      select: { totalPoints: true },
    });

    const snapshot = this.snapshotRepo.create({
      studentId,
      snapshotDate: new Date(year, m - 1, 1),
      periodType: 'monthly',
      metrics: {
        attendanceRate,
        avgTestScore,
        homeworkCompletion: 0, // TODO: homework modulidan olish
        totalPoints: user?.totalPoints ?? 0,
        spellingErrors: 0,
      },
    });

    await this.snapshotRepo.save(snapshot);
  }

  // ─── O'SISH GRAFIGI ───────────────────────────────────────────────────────
  async getProgressHistory(studentId: string, limit = 6) {
    return this.snapshotRepo.find({
      where: { studentId },
      order: { snapshotDate: 'DESC' },
      take: limit,
    });
  }
}
