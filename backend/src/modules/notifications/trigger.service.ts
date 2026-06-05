import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { Role } from '../../common/enums/role.enum';
import { NotificationService } from './notification.service';
import { SmsService } from './channels/sms.service';
import { TelegramService } from './channels/telegram.service';
import { PushService } from './channels/push.service';
import { TEMPLATES, render, formatDate, formatMonth, TemplateVars } from './templates';

@Injectable()
export class TriggerService {
  private readonly logger = new Logger(TriggerService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Parent)
    private parentRepo: Repository<Parent>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    private notif: NotificationService,
    private sms: SmsService,
    private telegram: TelegramService,
    private push: PushService,
  ) {}

  // ─── 1. DAVOMAT: D+15 QOIDASI ──────────────────────────────────────────────
  // Dars boshlanganidan 15 daqiqa o'tib, kelmagan o'quvchi ota-onasiga xabar
  async triggerAttendanceAbsent(opts: {
    studentId: string;
    studentName: string;
    subjectName: string;
    lessonDate: Date;
  }): Promise<void> {
    const vars: TemplateVars = {
      ism: opts.studentName,
      fan: opts.subjectName,
      sana: formatDate(opts.lessonDate),
    };

    const tmpl = TEMPLATES['attendance.absent'];

    // O'quvchiga CRM push
    await this.notif.notify(
      opts.studentId,
      NotificationType.ATTENDANCE,
      tmpl.pushTitle,
      render(tmpl.telegram, vars),
      { skipSms: true, skipTelegram: false },
    );

    // Ota-onalarga SMS + Telegram
    const parents = await this.parentRepo.find({
      where: { studentId: opts.studentId },
    });

    const parentVars: TemplateVars = { ...vars, ota_ism: '' };

    await Promise.allSettled(
      parents.map(async (parent) => {
        parentVars.ota_ism = parent.fullName;
        const sends: Promise<any>[] = [];

        if (parent.phone) {
          sends.push(this.sms.send(parent.phone, render(tmpl.sms, parentVars)));
        }
        if (parent.telegramChatId) {
          sends.push(this.telegram.sendMessage(parent.telegramChatId, render(tmpl.telegram, parentVars)));
        }

        await Promise.allSettled(sends);
      }),
    );
  }

  // ─── 2. DAVOMAT: KECH QOLISH ──────────────────────────────────────────────
  async triggerAttendanceLate(opts: {
    studentId: string;
    studentName: string;
    subjectName: string;
    lessonDate: Date;
    lateMinutes: number;
  }): Promise<void> {
    const tmpl = TEMPLATES['attendance.late'];
    const vars: TemplateVars = {
      ism: opts.studentName,
      fan: opts.subjectName,
      sana: formatDate(opts.lessonDate),
      kech_daqiqa: String(opts.lateMinutes),
    };

    await this.notif.notify(
      opts.studentId,
      NotificationType.ATTENDANCE,
      tmpl.pushTitle,
      render(tmpl.telegram, vars),
      { notifyParents: false },
    );
  }

  // ─── 3. TO'LOV — QABUL QILINDI ────────────────────────────────────────────
  async triggerPaymentReceived(opts: {
    studentId: string;
    studentName: string;
    amount: bigint | number;
    month: string;
  }): Promise<void> {
    const tmpl = TEMPLATES['payment.received'];
    const vars: TemplateVars = {
      ism: opts.studentName,
      summa: Number(opts.amount).toLocaleString('uz-UZ'),
      oy: formatMonth(opts.month),
    };

    await this.notif.notify(
      opts.studentId,
      NotificationType.PAYMENT,
      tmpl.pushTitle,
      render(tmpl.telegram, vars),
      { notifyParents: true },
    );
  }

  // ─── 4. TO'LOV ESLATMASI (Cron: har kuni 09:00) ───────────────────────────
  @Cron('0 9 * * *', { name: 'debt-trigger', timeZone: 'Asia/Tashkent' })
  async triggerPaymentReminder(): Promise<void> {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const REMINDER_DAYS = [1, 5, 10, 15, 30];
    if (!REMINDER_DAYS.includes(dayOfMonth)) return;

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.logger.log(`To'lov eslatmasi ishga tushdi: ${month} (${dayOfMonth}-kun)`);

    const debtors = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', "e.student_id = u.id AND e.status = 'active' AND e.deleted_at IS NULL")
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM payments p WHERE p.student_id = u.id AND p.payment_month = :month AND p.status = 'completed' AND p.deleted_at IS NULL)`,
        { month },
      )
      .select(['u.id', 'u.firstName', 'u.lastName', 'u.phone', 'u.telegramChatId', 'u.fcmToken'])
      .distinct(true)
      .getMany();

    this.logger.log(`${debtors.length} ta qarzdor topildi`);

    const tmpl = TEMPLATES['payment.reminder'];

    for (const student of debtors) {
      const vars: TemplateVars = {
        ism: student.firstName,
        oy: formatMonth(month),
      };

      await this.notif.notify(
        student.id,
        NotificationType.PAYMENT,
        tmpl.pushTitle,
        render(tmpl.telegram, vars),
        { notifyParents: true },
      );
    }
  }

  // ─── 5. TEST NATIJASI ──────────────────────────────────────────────────────
  async triggerTestResult(opts: {
    studentId: string;
    studentName: string;
    subjectName: string;
    score: number;
    level: string;
  }): Promise<void> {
    const tmpl = TEMPLATES['test.result'];
    const vars: TemplateVars = {
      ism: opts.studentName,
      fan: opts.subjectName,
      ball: String(opts.score),
      daraja: opts.level,
    };

    await this.notif.notify(
      opts.studentId,
      NotificationType.TEST,
      render(tmpl.pushTitle, vars),
      render(tmpl.telegram, vars),
    );
  }

  // ─── 6. VAZIFA BERILDI ────────────────────────────────────────────────────
  async triggerHomeworkAssigned(opts: {
    studentIds: string[];
    subjectName: string;
    homeworkTitle: string;
    dueDate: Date;
  }): Promise<void> {
    const tmpl = TEMPLATES['homework.assigned'];
    const vars: TemplateVars = {
      fan: opts.subjectName,
      sarlavha: opts.homeworkTitle,
      sana: formatDate(opts.dueDate),
    };

    await this.notif.broadcast(
      opts.studentIds,
      NotificationType.HOMEWORK,
      render(tmpl.pushTitle, vars),
      render(tmpl.telegram, vars),
    );
  }

  // ─── 7. VAZIFA BAHOLANDI ──────────────────────────────────────────────────
  async triggerHomeworkGraded(opts: {
    studentId: string;
    studentName: string;
    subjectName: string;
    grade: number;
  }): Promise<void> {
    const tmpl = TEMPLATES['homework.graded'];
    const vars: TemplateVars = {
      ism: opts.studentName,
      fan: opts.subjectName,
      ball: String(opts.grade),
    };

    await this.notif.notify(
      opts.studentId,
      NotificationType.HOMEWORK,
      render(tmpl.pushTitle, vars),
      render(tmpl.telegram, vars),
    );
  }

  // ─── 8. JADVAL O'ZGARDI ───────────────────────────────────────────────────
  async triggerScheduleChanged(opts: {
    affectedUserIds: string[];
    subjectName: string;
    newTime: string;
    lessonDate: Date;
  }): Promise<void> {
    const tmpl = TEMPLATES['schedule.changed'];
    const vars: TemplateVars = {
      fan: opts.subjectName,
      dars_vaqt: opts.newTime,
      sana: formatDate(opts.lessonDate),
    };

    await this.notif.broadcast(
      opts.affectedUserIds,
      NotificationType.SCHEDULE,
      render(tmpl.pushTitle, vars),
      render(tmpl.telegram, vars),
    );
  }

  // ─── 9. DARS BEKOR ────────────────────────────────────────────────────────
  async triggerScheduleCancelled(opts: {
    affectedUserIds: string[];
    subjectName: string;
    lessonDate: Date;
  }): Promise<void> {
    const tmpl = TEMPLATES['schedule.cancelled'];
    const vars: TemplateVars = {
      fan: opts.subjectName,
      sana: formatDate(opts.lessonDate),
    };

    await this.notif.broadcast(
      opts.affectedUserIds,
      NotificationType.SCHEDULE,
      render(tmpl.pushTitle, vars),
      render(tmpl.telegram, vars),
    );
  }

  // ─── 10. YANGI E'LON ──────────────────────────────────────────────────────
  async triggerAnnouncement(opts: {
    targetUserIds: string[];
    title: string;
    content: string;
    publishedAt: Date;
  }): Promise<void> {
    const tmpl = TEMPLATES['announcement.new'];
    const vars: TemplateVars = {
      sarlavha: opts.title,
      ism: opts.content.slice(0, 200),
      sana: formatDate(opts.publishedAt),
    };

    await this.notif.broadcast(
      opts.targetUserIds,
      NotificationType.ANNOUNCEMENT,
      render(tmpl.pushTitle, vars),
      render(tmpl.telegram, vars),
    );
  }

  // ─── 11. TUG'ILGAN KUN CRON (har kuni 08:00) ─────────────────────────────
  @Cron('0 8 * * *', { name: 'birthday-trigger', timeZone: 'Asia/Tashkent' })
  async triggerBirthday(): Promise<void> {
    const now = new Date();
    const todayMmDd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.is_active = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere('u.birth_date IS NOT NULL')
      .andWhere("TO_CHAR(u.birth_date, 'MM-DD') = :today", { today: todayMmDd })
      .select(['u.id', 'u.firstName', 'u.role', 'u.telegramChatId', 'u.fcmToken', 'u.phone'])
      .getMany();

    if (!users.length) return;

    this.logger.log(`${users.length} ta foydalanuvchining tug'ilgan kuni bugun`);

    for (const user of users) {
      const isStaff = user.role !== Role.STUDENT;
      const key = isStaff ? 'birthday.staff' : 'birthday.student';
      const tmpl = TEMPLATES[key];
      const vars: TemplateVars = { ism: user.firstName };

      await this.notif.notify(
        user.id,
        NotificationType.BIRTHDAY,
        render(tmpl.pushTitle, vars),
        render(tmpl.telegram, vars),
        { skipSms: true },
      );
    }
  }

  // ─── 12. FAVQULODDA XABAR ────────────────────────────────────────────────
  async triggerEmergency(opts: {
    title: string;
    body: string;
    targetUserIds?: string[];
    targetRole?: Role;
  }): Promise<void> {
    const tmpl = TEMPLATES['emergency.urgent'];
    const vars: TemplateVars = {
      sarlavha: opts.title,
      ism: opts.body,
    };

    const telegramText = render(tmpl.telegram, vars);
    const pushTitle = render(tmpl.pushTitle, vars);
    const smsText = render(tmpl.sms, vars);

    if (opts.targetUserIds?.length) {
      await this.notif.broadcast(
        opts.targetUserIds,
        NotificationType.EMERGENCY,
        pushTitle,
        telegramText,
      );
    } else if (opts.targetRole) {
      await this.notif.broadcastByRole(
        opts.targetRole,
        NotificationType.EMERGENCY,
        pushTitle,
        telegramText,
      );
    } else {
      // Barcha faol foydalanuvchilarga
      const users = await this.userRepo.find({
        where: { isActive: true },
        select: { id: true },
      });
      await this.notif.broadcast(
        users.map((u) => u.id),
        NotificationType.EMERGENCY,
        pushTitle,
        telegramText,
      );
    }
  }
}
