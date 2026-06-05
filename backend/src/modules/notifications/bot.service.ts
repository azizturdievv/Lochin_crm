import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { TelegramService, TelegramUpdate } from './channels/telegram.service';

const HELP_TEXT =
  '🤖 *Ilm Academy Bot*\n\n' +
  'Mavjud buyruqlar:\n' +
  '/holat — Umumiy holat\n' +
  "/ball — To'plangan ballar\n" +
  '/jadval — Dars jadvali\n' +
  "/tolov — To'lov holati\n" +
  "/farzand — Farzand ma'lumotlari (ota-ona)\n" +
  '/hisobot — Kunlik hisobot (menejer)\n\n' +
  '_Telegram ID ni CRM ilovada ulash kerak._';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private telegram: TelegramService,
  ) {}

  // Telegram webhook updateni qayta ishlaydi
  async processUpdate(update: TelegramUpdate): Promise<void> {
    const msg = update.message;
    if (!msg?.text) return;

    const chatId = String(msg.chat.id);
    const text = msg.text.trim();

    this.logger.log(`Bot buyruq: ${text} (chat: ${chatId})`);

    // Foydalanuvchini telegramChatId orqali aniqlash
    const user = await this.userRepo.findOne({
      where: { telegramChatId: chatId, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true, totalPoints: true, phone: true },
    });

    if (!user) {
      await this.telegram.sendMessage(
        chatId,
        '❌ Siz tizimga ulanmagansiz.\n\nCRM ilovasida *Sozlamalar → Telegram* bo\'limidan hisobingizni ulang.',
      );
      return;
    }

    // Buyruqni ajratib olish (masalan "/holat@botusername" → "/holat")
    const command = text.split('@')[0].toLowerCase();

    switch (command) {
      case '/start':
        await this.cmdStart(chatId, user);
        break;
      case '/holat':
        await this.cmdHolat(chatId, user);
        break;
      case '/ball':
        await this.cmdBall(chatId, user);
        break;
      case '/jadval':
        await this.cmdJadval(chatId, user);
        break;
      case '/tolov':
        await this.cmdTolov(chatId, user);
        break;
      case '/farzand':
        await this.cmdFarzand(chatId, user);
        break;
      case '/hisobot':
        await this.cmdHisobot(chatId, user);
        break;
      case '/help':
        await this.telegram.sendMessage(chatId, HELP_TEXT);
        break;
      default:
        await this.telegram.sendMessage(chatId, `❓ Noma'lum buyruq.\n\n${HELP_TEXT}`);
    }
  }

  // /start — salomlashish
  private async cmdStart(chatId: string, user: User): Promise<void> {
    const roleLabel: Record<string, string> = {
      super_admin: 'Super Admin',
      manager: 'Menejer',
      ustoz: 'Ustoz',
      student: "O'quvchi",
    };

    await this.telegram.sendMessage(
      chatId,
      `👋 Xush kelibsiz, *${user.firstName}*!\n\n` +
        `👤 Rol: *${roleLabel[user.role] ?? user.role}*\n\n` +
        `Buyruqlar ro'yxati uchun /help yuboring.`,
    );
  }

  // /holat — umumiy holat
  private async cmdHolat(chatId: string, user: User): Promise<void> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (user.role === Role.STUDENT) {
      // O'quvchi holati: bugungi davomat + oylik to'lov
      const attendanceRow = await this.userRepo.manager
        .createQueryBuilder()
        .select(['a.status AS status', 'l.topic AS topic'])
        .from('attendance', 'a')
        .innerJoin('lessons', 'l', 'l.id = a.lesson_id')
        .where('a.student_id = :uid', { uid: user.id })
        .andWhere('l.lesson_date = :today', { today })
        .getRawMany();

      const paymentRow = await this.userRepo.manager
        .createQueryBuilder()
        .select('SUM(p.amount) AS total')
        .from('payments', 'p')
        .where('p.student_id = :uid', { uid: user.id })
        .andWhere('p.payment_month = :month', { month })
        .andWhere("p.status = 'completed'")
        .andWhere('p.deleted_at IS NULL')
        .getRawOne();

      const statusEmoji: Record<string, string> = {
        present: '✅', late: '⏰', absent: '❌', excused: '🟡', unexcused: '🔴',
      };

      const attendanceText =
        attendanceRow.length > 0
          ? attendanceRow.map((r: any) => `${statusEmoji[r.status] ?? '?'} ${r.topic ?? 'Dars'}`).join('\n')
          : "Bugun dars yo'q";

      const paid = Number(paymentRow?.total ?? 0);

      await this.telegram.sendMessage(
        chatId,
        `📊 *${user.firstName} — Holat*\n\n` +
          `📚 *Bugungi darslar:*\n${attendanceText}\n\n` +
          `💳 *${month} to\'lov:* ${paid > 0 ? `✅ ${paid.toLocaleString('uz-UZ')} so\'m` : "❌ To'lanmagan"}\n\n` +
          `🏆 *Jami ball:* ${user.totalPoints}`,
      );
    } else {
      // Xodim holati
      await this.telegram.sendMessage(
        chatId,
        `📊 *${user.firstName} — Holat*\n\n` +
          `👤 Rol: *${user.role}*\n` +
          `🏆 Ball: *${user.totalPoints}*\n\n` +
          `Batafsil: /ball, /jadval`,
      );
    }
  }

  // /ball — ballar
  private async cmdBall(chatId: string, user: User): Promise<void> {
    const rows = await this.userRepo.manager
      .createQueryBuilder()
      .select(['p.action AS action', 'p.points AS points', 'p.description AS desc', 'p.created_at AS date'])
      .from('points_log', 'p')
      .where('p.user_id = :uid', { uid: user.id })
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.created_at', 'DESC')
      .limit(5)
      .getRawMany();

    const historyText =
      rows.length > 0
        ? rows
            .map((r: any) => {
              const sign = r.points > 0 ? '+' : '';
              const d = new Date(r.date).toLocaleDateString('uz-UZ');
              return `${sign}${r.points} — ${r.desc ?? r.action} (${d})`;
            })
            .join('\n')
        : 'Ball tarixi yo\'q';

    await this.telegram.sendMessage(
      chatId,
      `🏆 *${user.firstName} — Ballar*\n\n` +
        `Jami: *${user.totalPoints} ball*\n\n` +
        `📋 *So\'nggi 5 ta:*\n${historyText}`,
    );
  }

  // /jadval — dars jadvali
  private async cmdJadval(chatId: string, user: User): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    let qb = this.userRepo.manager
      .createQueryBuilder()
      .select([
        'l.lesson_date AS date',
        'l.start_time AS start',
        'l.end_time AS end',
        'l.room_number AS room',
        'g.name AS group_name',
        'sub.name AS subject',
        'l.status AS status',
      ])
      .from('lessons', 'l')
      .innerJoin('groups', 'g', 'g.id = l.group_id')
      .innerJoin('subjects', 'sub', 'sub.id = g.subject_id')
      .where('l.lesson_date >= :today', { today })
      .andWhere('l.deleted_at IS NULL')
      .orderBy('l.lesson_date', 'ASC')
      .addOrderBy('l.start_time', 'ASC')
      .limit(5);

    if (user.role === Role.STUDENT) {
      qb = qb
        .innerJoin('enrollments', 'e', "e.group_id = g.id AND e.status = 'active' AND e.student_id = :uid", { uid: user.id });
    } else if (user.role === Role.USTOZ) {
      qb = qb.andWhere('l.teacher_id = :uid', { uid: user.id });
    }

    const lessons = await qb.getRawMany();

    if (!lessons.length) {
      await this.telegram.sendMessage(chatId, '📅 Yaqin kunlarda dars yo\'q.');
      return;
    }

    const statusEmoji: Record<string, string> = {
      scheduled: '🔵', completed: '✅', cancelled: '❌', substituted: '🔄',
    };

    const lines = lessons.map((l: any) => {
      const d = new Date(l.date).toLocaleDateString('uz-UZ');
      const status = statusEmoji[l.status] ?? '?';
      return `${status} *${d}* — ${l.subject} (${l.start.slice(0, 5)}–${l.end.slice(0, 5)}) 🏠${l.room ?? '?'}`;
    });

    await this.telegram.sendMessage(
      chatId,
      `📅 *Dars jadvali (keyingi 5 ta)*\n\n${lines.join('\n')}`,
    );
  }

  // /tolov — to'lov holati (o'quvchi uchun)
  private async cmdTolov(chatId: string, user: User): Promise<void> {
    if (user.role !== Role.STUDENT) {
      await this.telegram.sendMessage(chatId, "❌ Bu buyruq faqat o'quvchilar uchun.");
      return;
    }

    const now = new Date();
    const months = [-1, 0].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const payments = await this.userRepo.manager
      .createQueryBuilder()
      .select(['p.payment_month AS month', 'SUM(p.amount) AS total', 'p.method AS method'])
      .from('payments', 'p')
      .where('p.student_id = :uid', { uid: user.id })
      .andWhere('p.payment_month IN (:...months)', { months })
      .andWhere("p.status = 'completed'")
      .andWhere('p.deleted_at IS NULL')
      .groupBy('p.payment_month, p.method')
      .orderBy('p.payment_month', 'DESC')
      .getRawMany();

    if (!payments.length) {
      await this.telegram.sendMessage(
        chatId,
        `💳 *To'lovlar*\n\n⚠️ So'nggi 2 oyda to'lov topilmadi.\n\nMarkaz bilan bog'laning.`,
      );
      return;
    }

    const lines = payments.map(
      (p: any) => `✅ *${p.month}*: ${Number(p.total).toLocaleString('uz-UZ')} so'm (${p.method})`,
    );

    await this.telegram.sendMessage(chatId, `💳 *To'lov tarixi*\n\n${lines.join('\n')}`);
  }

  // /farzand — ota-ona uchun farzand ma'lumotlari
  private async cmdFarzand(chatId: string, user: User): Promise<void> {
    // Ota-ona ekanligini tekshirish (parents jadvalida chatId bor)
    const parent = await this.userRepo.manager
      .createQueryBuilder()
      .select(['pr.student_id AS student_id', 'u.firstName AS first', 'u.last_name AS last'])
      .from('parents', 'pr')
      .innerJoin('users', 'u', 'u.id = pr.student_id')
      .where('pr.telegram_chat_id = :chatId', { chatId })
      .getRawOne();

    if (!parent) {
      await this.telegram.sendMessage(
        chatId,
        "❌ Ota-ona sifatida ro'yxatdan o'tmagansiz.\n\nCRM orqali menejerga murojaat qiling.",
      );
      return;
    }

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Farzandning bu oydagi davomat statistikasi
    const attendanceStats = await this.userRepo.manager
      .createQueryBuilder()
      .select(['a.status AS status', 'COUNT(*) AS cnt'])
      .from('attendance', 'a')
      .innerJoin('lessons', 'l', 'l.id = a.lesson_id')
      .where('a.student_id = :sid', { sid: parent.student_id })
      .andWhere("TO_CHAR(l.lesson_date, 'YYYY-MM') = :month", { month })
      .groupBy('a.status')
      .getRawMany();

    const statsMap: Record<string, number> = {};
    (attendanceStats as any[]).forEach((r: any) => { statsMap[r.status] = Number(r.cnt); });

    const payRow = await this.userRepo.manager
      .createQueryBuilder()
      .select('SUM(p.amount) AS total')
      .from('payments', 'p')
      .where('p.student_id = :sid', { sid: parent.student_id })
      .andWhere('p.payment_month = :month', { month })
      .andWhere("p.status = 'completed'")
      .andWhere('p.deleted_at IS NULL')
      .getRawOne();

    const paid = Number((payRow as any)?.total ?? 0);

    await this.telegram.sendMessage(
      chatId,
      `👶 *${parent.first} ${parent.last} — ${month}*\n\n` +
        `📚 *Davomat:*\n` +
        `✅ Keldi: ${statsMap['present'] ?? 0}\n` +
        `⏰ Kech: ${statsMap['late'] ?? 0}\n` +
        `❌ Kelmadi: ${(statsMap['absent'] ?? 0) + (statsMap['unexcused'] ?? 0)}\n\n` +
        `💳 *To'lov:* ${paid > 0 ? `✅ ${paid.toLocaleString('uz-UZ')} so\'m` : "❌ To'lanmagan"}`,
    );
  }

  // /hisobot — menejer kunlik hisobot
  private async cmdHisobot(chatId: string, user: User): Promise<void> {
    if (user.role !== Role.MANAGER && user.role !== Role.SUPER_ADMIN) {
      await this.telegram.sendMessage(chatId, '❌ Bu buyruq faqat menejer/admin uchun.');
      return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [attendanceToday, paymentsToday, activeStudents, debtorsCount] = await Promise.all([
      // Bugungi davomat
      this.userRepo.manager
        .createQueryBuilder()
        .select('COUNT(*) AS cnt')
        .from('attendance', 'a')
        .innerJoin('lessons', 'l', 'l.id = a.lesson_id')
        .where('l.lesson_date = :today', { today })
        .andWhere("a.status = 'present'")
        .getRawOne(),

      // Bugungi to'lovlar
      this.userRepo.manager
        .createQueryBuilder()
        .select(['SUM(p.amount) AS total', 'COUNT(*) AS cnt'])
        .from('payments', 'p')
        .where("TO_CHAR(p.created_at, 'YYYY-MM-DD') = :today", { today })
        .andWhere("p.status = 'completed'")
        .andWhere('p.deleted_at IS NULL')
        .getRawOne(),

      // Faol o'quvchilar
      this.userRepo.manager
        .createQueryBuilder()
        .select('COUNT(*) AS cnt')
        .from('enrollments', 'e')
        .where("e.status = 'active'")
        .andWhere('e.deleted_at IS NULL')
        .getRawOne(),

      // Qarzdorlar
      this.userRepo.manager
        .createQueryBuilder()
        .select('COUNT(DISTINCT u.id) AS cnt')
        .from('users', 'u')
        .innerJoin('enrollments', 'e', "e.student_id = u.id AND e.status = 'active'")
        .where("u.role = 'student'")
        .andWhere('u.is_active = true')
        .andWhere(
          `NOT EXISTS (SELECT 1 FROM payments p WHERE p.student_id = u.id AND p.payment_month = :month AND p.status = 'completed' AND p.deleted_at IS NULL)`,
          { month },
        )
        .getRawOne(),
    ]);

    const fmt = (n: number) => n.toLocaleString('uz-UZ');

    await this.telegram.sendMessage(
      chatId,
      `📊 *Kunlik hisobot — ${today}*\n\n` +
        `📚 Bugungi davomat: *${Number((attendanceToday as any)?.cnt ?? 0)} ta*\n` +
        `💰 Bugungi to'lovlar: *${fmt(Number((paymentsToday as any)?.total ?? 0))} so'm* (${(paymentsToday as any)?.cnt ?? 0} ta)\n\n` +
        `👥 Faol o'quvchilar: *${Number((activeStudents as any)?.cnt ?? 0)} ta*\n` +
        `⚠️ Qarzdorlar (${month}): *${Number((debtorsCount as any)?.cnt ?? 0)} ta*`,
    );
  }
}
