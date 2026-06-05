import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { Parent } from '../../entities/parent.entity';
import { Role } from '../../common/enums/role.enum';

// Eslatma kunlari: 1, 5, 10, 15, 30 kun
const REMINDER_DAYS = [1, 5, 10, 15, 30];

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(Parent)
    private parentRepo: Repository<Parent>,
  ) {}

  // Har kuni soat 09:00 da ishlaydi
  @Cron('0 9 * * *', { name: 'debt-reminder', timeZone: 'Asia/Tashkent' })
  async sendDebtReminders() {
    this.logger.log('Qarzdorlik eslatmalari tekshirilmoqda...');

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = now.getDate();

    // Faqat eslatma kunlarida ishlat
    if (!REMINDER_DAYS.includes(dayOfMonth)) {
      return;
    }

    const debtors = await this.getDebtorsForMonth(currentMonth);

    if (!debtors.length) {
      this.logger.log('Qarzdor topilmadi');
      return;
    }

    this.logger.log(`${debtors.length} ta qarzdorga eslatma yuborilmoqda (${dayOfMonth}-kun)`);

    const notifications: Notification[] = [];

    for (const debtor of debtors) {
      // O'quvchiga bildirishnoma
      notifications.push(
        this.notificationRepo.create({
          userId: debtor.id,
          type: NotificationType.PAYMENT,
          title: '💳 To\'lov eslatmasi',
          body: this.buildReminderText(debtor, currentMonth, dayOfMonth, 'student'),
          pushSent: false,
          smsSent: false,
          telegramSent: false,
        }),
      );

      // Ota-onalarga bildirishnoma
      const parents = await this.parentRepo.find({
        where: { studentId: debtor.id },
        select: { id: true, studentId: true, fullName: true, phone: true },
      });

      for (const parent of parents) {
        // Ota-ona usersda bo'lmasa faqat SMS/Telegram orqali yuboriladi
        // Hozircha notification sifatida saqlaymiz
        notifications.push(
          this.notificationRepo.create({
            userId: debtor.id, // student ID ga bog'liq
            type: NotificationType.PAYMENT,
            title: `Ota-ona: ${parent.fullName}`,
            body: this.buildReminderText(debtor, currentMonth, dayOfMonth, 'parent'),
            pushSent: false,
            smsSent: false,
            telegramSent: false,
          }),
        );
      }
    }

    // Batch saqlash
    await this.notificationRepo.save(notifications);
    this.logger.log(`${notifications.length} ta bildirishnoma yaratildi`);
  }

  // Muddatli to'lov eslatmasi — har kuni 10:00 da
  @Cron('0 10 * * *', { name: 'installment-reminder', timeZone: 'Asia/Tashkent' })
  async sendInstallmentReminders() {
    this.logger.log('Muddatli to\'lov eslatmalari tekshirilmoqda...');
    // TODO: muddatli to'lov qismlari muddati yaqinlashganda eslatma
  }

  private buildReminderText(
    student: User,
    month: string,
    dayOfMonth: number,
    target: 'student' | 'parent',
  ): string {
    const urgency = dayOfMonth >= 15 ? '‼️ MUHIM' : '⚠️';
    const months: Record<string, string> = {
      '01': 'Yanvar', '02': 'Fevral', '03': 'Mart', '04': 'Aprel',
      '05': 'May', '06': 'Iyun', '07': 'Iyul', '08': 'Avgust',
      '09': 'Sentabr', '10': 'Oktabr', '11': 'Noyabr', '12': 'Dekabr',
    };
    const [year, monthNum] = month.split('-');
    const monthName = `${months[monthNum] ?? monthNum} ${year}`;

    if (target === 'student') {
      return `${urgency} Hurmatli ${student.firstName}! ${monthName} oyi uchun to'lov amalga oshirilmagan. Iltimos, to'lovni amalga oshiring yoki menejer bilan bog'laning.`;
    }

    return `${urgency} ${student.firstName} ${student.lastName} uchun ${monthName} oyi o'quv to'lovi amalga oshirilmagan. Iltimos, CRM orqali yoki markaz kassasiga to'lovni amalga oshiring.`;
  }

  private async getDebtorsForMonth(month: string): Promise<User[]> {
    return this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', 'e.student_id = u.id AND e.status = :es', { es: 'active' })
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.student_id = u.id
          AND p.payment_month = :month
          AND p.status = 'completed'
          AND p.deleted_at IS NULL
        )`,
        { month },
      )
      .select(['u.id', 'u.firstName', 'u.lastName', 'u.phone', 'u.telegramChatId'])
      .distinct(true)
      .getMany();
  }
}
