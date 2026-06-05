import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointsLog, PointsAction } from '../../entities/points-log.entity';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';

// Ball mezonlari (TZ bo'yicha)
export const POINTS_CONFIG: Record<PointsAction, number> = {
  // O'quvchi
  [PointsAction.CORRECT_MESSAGE]: 3,
  [PointsAction.SELF_CORRECT]: 5,
  [PointsAction.BOOK_PASSED]: 50,
  [PointsAction.TEST_HIGH_SCORE]: 20,
  // Xodim
  [PointsAction.SPELLING_CORRECT]: 2,
  [PointsAction.DUTY_DONE]: 5,
  [PointsAction.KPI_100]: 100,
  [PointsAction.NEW_STUDENT]: 30,
  // Jazo (manfiy)
  [PointsAction.SPELLING_ERROR]: -3,
  [PointsAction.DUTY_MISSED]: -10,
  // Qo'lda
  [PointsAction.MANUAL]: 0,
};

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectRepository(PointsLog)
    private pointsRepo: Repository<PointsLog>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private auditLog: AuditLogService,
  ) {}

  // ─── BALL BERISH (asosiy metod) ────────────────────────────────────────────
  async award(opts: {
    userId: string;
    action: PointsAction;
    points?: number;           // ko'rsatilmasa POINTS_CONFIG dan oladi
    description?: string;
    referenceId?: string;
    referenceType?: string;
    actorId?: string;
    actorRole?: string;
  }): Promise<PointsLog> {
    const delta = opts.points ?? POINTS_CONFIG[opts.action] ?? 0;
    if (delta === 0 && opts.action !== PointsAction.MANUAL) {
      this.logger.warn(`${opts.action} uchun ball miqdori 0 — yozuv saqlanmaydi`);
      return this.pointsRepo.create({ userId: opts.userId, action: opts.action, points: 0 });
    }

    const log = this.pointsRepo.create({
      userId: opts.userId,
      action: opts.action,
      points: delta,
      description: opts.description ?? null,
      referenceId: opts.referenceId ?? null,
      referenceType: opts.referenceType ?? null,
    });

    await this.pointsRepo.save(log);

    // user.totalPoints ni yangilash
    if (delta > 0) {
      await this.userRepo.increment({ id: opts.userId }, 'totalPoints', delta);
    } else if (delta < 0) {
      // Manfiy bo'lib ketmaslik uchun
      const user = await this.userRepo.findOne({ where: { id: opts.userId }, select: { totalPoints: true } });
      const safeDecrement = Math.min(Math.abs(delta), user?.totalPoints ?? 0);
      if (safeDecrement > 0) {
        await this.userRepo.decrement({ id: opts.userId }, 'totalPoints', safeDecrement);
      }
    }

    if (opts.actorId) {
      await this.auditLog.log({
        userId: opts.actorId,
        userRole: opts.actorRole ?? 'system',
        action: delta >= 0 ? 'POINTS_AWARDED' : 'POINTS_PENALIZED',
        entityName: 'points_log',
        entityId: log.id,
        newValues: { userId: opts.userId, action: opts.action, points: delta },
      });
    }

    return log;
  }

  // ─── BALL TARIXI ──────────────────────────────────────────────────────────
  async getHistory(
    userId: string,
    limit = 20,
    page = 1,
  ): Promise<{ items: PointsLog[]; total: number }> {
    const [items, total] = await this.pointsRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  // ─── FOYDALANUVCHI STATISTIKASI ────────────────────────────────────────────
  async getUserStats(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, role: true, totalPoints: true },
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Oylik yig'im
    const monthlyRow = await this.pointsRepo
      .createQueryBuilder('p')
      .where('p.user_id = :uid', { uid: userId })
      .andWhere('p.created_at >= :start', { start: monthStart })
      .andWhere('p.points > 0')
      .select('SUM(p.points) AS total')
      .getRawOne();

    // Haftalik yig'im
    const weeklyRow = await this.pointsRepo
      .createQueryBuilder('p')
      .where('p.user_id = :uid', { uid: userId })
      .andWhere('p.created_at >= :start', { start: weekStart })
      .andWhere('p.points > 0')
      .select('SUM(p.points) AS total')
      .getRawOne();

    // Streak (ketma-ket kun)
    const streak = await this.calculateStreak(userId);

    return {
      userId,
      totalPoints: user?.totalPoints ?? 0,
      monthlyPoints: Number(monthlyRow?.total ?? 0),
      weeklyPoints: Number(weeklyRow?.total ?? 0),
      streak,
    };
  }

  // ─── KETMA-KET KUN HISOBI (streak) ────────────────────────────────────────
  async calculateStreak(userId: string): Promise<number> {
    const rows = await this.pointsRepo
      .createQueryBuilder('p')
      .where('p.user_id = :uid', { uid: userId })
      .andWhere('p.created_at >= :since', {
        since: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
      })
      .select("DATE(p.created_at) AS day")
      .distinct(true)
      .orderBy('day', 'DESC')
      .getRawMany();

    if (!rows.length) return 0;

    let streak = 1;
    const today = new Date().toISOString().split('T')[0];
    const firstDay = rows[0].day?.toString().split('T')[0];

    // Bugun yoki kecha faollik bo'lmasa streak = 0
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0];
    if (firstDay !== today && firstDay !== yesterday) return 0;

    for (let i = 1; i < rows.length; i++) {
      const curr = rows[i].day?.toString().split('T')[0];
      const prev = rows[i - 1].day?.toString().split('T')[0];
      if (!curr || !prev) break;

      const diff = (new Date(prev).getTime() - new Date(curr).getTime()) / 86_400_000;
      if (Math.round(diff) === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  // ─── OYLIK BALL QO'SHISH STATISTIKASI ─────────────────────────────────────
  async getMonthlyEarned(userId: string, month: string): Promise<number> {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59);

    const row = await this.pointsRepo
      .createQueryBuilder('p')
      .where('p.user_id = :uid', { uid: userId })
      .andWhere('p.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('p.points > 0')
      .select('SUM(p.points) AS total')
      .getRawOne();

    return Number(row?.total ?? 0);
  }
}
