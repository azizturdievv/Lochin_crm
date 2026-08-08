import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { Role } from '../../common/enums/role.enum';
import { SmsService } from './channels/sms.service';
import { TelegramService } from './channels/telegram.service';
import { PushService } from './channels/push.service';

export type NotifyOptions = {
  notifyParents?: boolean;
  skipSms?: boolean;
  skipTelegram?: boolean;
  skipPush?: boolean;
  data?: Record<string, unknown>;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Parent)
    private parentRepo: Repository<Parent>,
    private sms: SmsService,
    private telegram: TelegramService,
    private push: PushService,
  ) {}

  // ─── ASOSIY YUBORISH: DB saqlash + barcha kanallar ────────────────────────
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    opts?: NotifyOptions,
  ): Promise<void> {
    // Bildirishnomani DB ga saqlash
    const notif = this.notifRepo.create({
      userId,
      type,
      title,
      body,
      data: opts?.data ?? null,
      pushSent: false,
      smsSent: false,
      telegramSent: false,
    });
    await this.notifRepo.save(notif);

    // Foydalanuvchi ma'lumotlarini olish
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, firstName: true, phone: true, telegramChatId: true, fcmToken: true },
    });

    if (!user) return;

    // Kanallar orqali yuborish (parallel, non-blocking)
    let smsSent = false;
    let telegramSent = false;
    let pushSent = false;

    const sends: Promise<void>[] = [];

    if (!opts?.skipSms && user.phone) {
      sends.push(this.sms.send(user.phone, body).then((ok) => { smsSent = ok; }));
    }

    if (!opts?.skipTelegram && user.telegramChatId) {
      sends.push(this.telegram.sendMessage(user.telegramChatId, body).then((ok) => { telegramSent = ok; }));
    }

    if (!opts?.skipPush && user.fcmToken) {
      sends.push(this.push.send(user.fcmToken, title, body).then((ok) => { pushSent = ok; }));
    }

    await Promise.allSettled(sends);

    if (smsSent || telegramSent || pushSent) {
      await this.notifRepo.update(notif.id, { smsSent, telegramSent, pushSent });
    }

    // Ota-onalarga ham yuborish
    if (opts?.notifyParents) {
      await this.notifyParents(userId, body, opts);
    }
  }

  // ─── OMMAVIY YUBORISH ─────────────────────────────────────────────────────
  async broadcast(
    userIds: string[],
    type: NotificationType,
    title: string,
    body: string,
    opts?: NotifyOptions,
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((id) => this.notify(id, type, title, body, opts)),
    );
  }

  // ─── ROL BO'YICHA YUBORISH ────────────────────────────────────────────────
  async broadcastByRole(
    role: Role,
    type: NotificationType,
    title: string,
    body: string,
    opts?: NotifyOptions,
  ): Promise<void> {
    const users = await this.userRepo.find({
      where: { role, isActive: true },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await this.broadcast(ids, type, title, body, opts);
  }

  // ─── OTA-ONALARGA YUBORISH ────────────────────────────────────────────────
  async notifyParents(studentId: string, body: string, opts?: NotifyOptions): Promise<void> {
    const parents = await this.parentRepo.find({
      where: { studentId },
      select: { id: true, phone: true, telegramChatId: true, fullName: true },
    });

    await Promise.allSettled(
      parents.map(async (parent) => {
        const sends: Promise<boolean>[] = [];

        if (!opts?.skipSms && parent.phone) {
          sends.push(this.sms.send(parent.phone, body));
        }
        if (!opts?.skipTelegram && parent.telegramChatId) {
          sends.push(this.telegram.sendMessage(parent.telegramChatId, body));
        }

        await Promise.allSettled(sends);
      }),
    );
  }

  // ─── FCM TOKEN YANGILASH ──────────────────────────────────────────────────
  async registerFcmToken(userId: string, token: string): Promise<void> {
    await this.userRepo.update(userId, { fcmToken: token });
  }

  // ─── O'QILDI DEb BELGILASH ────────────────────────────────────────────────
  async markRead(notifId: string, userId: string): Promise<void> {
    const notif = await this.notifRepo.findOne({
      where: { id: notifId, userId },
    });
    if (!notif) throw new NotFoundException('Bildirishnoma topilmadi');

    await this.notifRepo.update(notifId, { isRead: true, readAt: new Date() });
  }

  // ─── BARCHASINI O'QILDI ────────────────────────────────────────────────────
  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  }

  // ─── FOYDALANUVCHI BILDIRISHNOMALARI ──────────────────────────────────────
  async getByUser(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notifRepo.count({
      where: { userId, isRead: false },
    });

    return { items, total, page, limit, unreadCount };
  }
}
