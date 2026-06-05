import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge } from '../../entities/badge.entity';
import { PointsLog, PointsAction } from '../../entities/points-log.entity';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { PointsService } from './points.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../../entities/notification.entity';

// Badge turlari
export enum BadgeType {
  SPELLING_MASTER = 'spelling_master',   // Imlo ustasi
  GROWTH = 'growth',                     // O'sish
  STREAK_30 = 'streak_30',               // 30 kunlik streak
  QUICK_FIX = 'quick_fix',              // Tezkor tuzatish
  BOOK_READER = 'book_reader',           // 5 ta kitob o'qigan
  TOP_STUDENT = 'top_student',           // Oylik 1-o'rin
}

const BADGE_META: Record<BadgeType, { name: string; description: string }> = {
  [BadgeType.SPELLING_MASTER]: {
    name: 'Imlo Ustasi 🏆',
    description: '30 ta ketma-ket xatosiz xabar',
  },
  [BadgeType.GROWTH]: {
    name: "O'sish 📈",
    description: "Oldingi oyga nisbatan 20%+ ko'proq ball",
  },
  [BadgeType.STREAK_30]: {
    name: '30 Kunlik Streak 🔥',
    description: '30 kun ketma-ket tizimda faol',
  },
  [BadgeType.QUICK_FIX]: {
    name: 'Tezkor Tuzatish ⚡',
    description: "O'z xatosini 5 daqiqada tuzatdi",
  },
  [BadgeType.BOOK_READER]: {
    name: 'Kitobxon 📚',
    description: '5 ta kitob testidan o\'tgan',
  },
  [BadgeType.TOP_STUDENT]: {
    name: 'Oylik Chempion 🥇',
    description: 'Oylik reytingda birinchi o\'rin',
  },
};

@Injectable()
export class BadgeService {
  private readonly logger = new Logger(BadgeService.name);

  constructor(
    @InjectRepository(Badge)
    private badgeRepo: Repository<Badge>,
    @InjectRepository(PointsLog)
    private pointsRepo: Repository<PointsLog>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private pointsService: PointsService,
    private notifService: NotificationService,
  ) {}

  // ─── BADGE TEKSHIRISH VA BERISH ────────────────────────────────────────────
  async checkAndAward(userId: string): Promise<Badge[]> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: { role: true } });
    if (!user) return [];

    const earned: Badge[] = [];

    // Har bir badge mezonini tekshirish
    const checks = [
      this.checkSpellingMaster(userId, user.role),
      this.checkGrowth(userId),
      this.checkStreak30(userId),
      this.checkBookReader(userId),
    ];

    const results = await Promise.allSettled(checks);

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled' && r.value) {
        const types = [
          BadgeType.SPELLING_MASTER,
          BadgeType.GROWTH,
          BadgeType.STREAK_30,
          BadgeType.BOOK_READER,
        ];
        const badge = await this.grantIfNew(userId, types[i]);
        if (badge) earned.push(badge);
      }
    }

    return earned;
  }

  // ─── 1. IMLO USTASI: 30 ketma-ket xatosiz xabar ───────────────────────────
  private async checkSpellingMaster(userId: string, role: string): Promise<boolean> {
    const correctAction =
      role === Role.STUDENT ? PointsAction.CORRECT_MESSAGE : PointsAction.SPELLING_CORRECT;
    const errorAction =
      role === Role.STUDENT ? PointsAction.CORRECT_MESSAGE : PointsAction.SPELLING_ERROR;

    // Oxirgi 50 ta faoliyat (xato + to'g'ri)
    const recent = await this.pointsRepo.find({
      where: [
        { userId, action: correctAction },
        { userId, action: errorAction },
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });

    let streak = 0;
    for (const log of recent) {
      if (log.action === correctAction) {
        streak++;
        if (streak >= 30) return true;
      } else {
        break; // Xato topildi — streak uzildi
      }
    }
    return false;
  }

  // ─── 2. O'SISH: Oldingi oyga nisbatan 20%+ ────────────────────────────────
  private async checkGrowth(userId: string): Promise<boolean> {
    const now = new Date();
    const currMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    const [curr, prev] = await Promise.all([
      this.pointsService.getMonthlyEarned(userId, currMonth),
      this.pointsService.getMonthlyEarned(userId, prevMonth),
    ]);

    if (prev <= 0) return false; // O'tgan oy ball yo'q — solishtirib bo'lmaydi
    return curr >= prev * 1.2;  // 20%+ o'sish
  }

  // ─── 3. 30 KUNLIK STREAK ──────────────────────────────────────────────────
  private async checkStreak30(userId: string): Promise<boolean> {
    const streak = await this.pointsService.calculateStreak(userId);
    return streak >= 30;
  }

  // ─── 4. TEZKOR TUZATISH: xato → tuzatish < 5 daqiqa ─────────────────────
  async checkQuickFix(userId: string): Promise<boolean> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    const recentError = await this.pointsRepo.findOne({
      where: { userId, action: PointsAction.SPELLING_ERROR },
      order: { createdAt: 'DESC' },
    });

    if (!recentError) return false;
    return new Date(recentError.createdAt) >= fiveMinAgo;
  }

  // ─── 5. KITOBXON: 5 ta kitob ──────────────────────────────────────────────
  private async checkBookReader(userId: string): Promise<boolean> {
    const count = await this.pointsRepo.count({
      where: { userId, action: PointsAction.BOOK_PASSED },
    });
    return count >= 5;
  }

  // ─── BADGE YANGI BERISH (duplicate oldini oladi) ──────────────────────────
  async grantIfNew(userId: string, type: BadgeType): Promise<Badge | null> {
    const exists = await this.badgeRepo.findOne({
      where: { userId, badgeType: type },
    });
    if (exists) return null;

    const meta = BADGE_META[type];
    const badge = this.badgeRepo.create({
      userId,
      badgeType: type,
      badgeName: meta.name,
      iconUrl: null,
      earnedAt: new Date(),
    });

    await this.badgeRepo.save(badge);
    this.logger.log(`Badge berildi: ${meta.name} → ${userId}`);

    // Foydalanuvchiga bildirishnoma
    await this.notifService.notify(
      userId,
      NotificationType.SYSTEM,
      `🏅 Yangi badge: ${meta.name}`,
      `Tabriklaymiz! "${meta.name}" badge qo'lga kiritdingiz!\n${meta.description}`,
      { skipSms: true },
    ).catch(() => {});

    return badge;
  }

  // ─── FOYDALANUVCHI BADGELARI ──────────────────────────────────────────────
  async getUserBadges(userId: string): Promise<Badge[]> {
    return this.badgeRepo.find({
      where: { userId },
      order: { earnedAt: 'DESC' },
    });
  }

  // ─── BARCHA BADGE STATISTIKASI (SA) ──────────────────────────────────────
  async getStats() {
    const rows = await this.badgeRepo
      .createQueryBuilder('b')
      .select(['b.badge_type AS type', 'COUNT(*) AS cnt'])
      .groupBy('b.badge_type')
      .orderBy('cnt', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      type: r.type,
      name: BADGE_META[r.type as BadgeType]?.name ?? r.type,
      count: Number(r.cnt),
    }));
  }
}
