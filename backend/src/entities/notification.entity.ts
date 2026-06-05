import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum NotificationType {
  ATTENDANCE = 'attendance',
  PAYMENT = 'payment',
  TEST = 'test',
  HOMEWORK = 'homework',
  SCHEDULE = 'schedule',
  ANNOUNCEMENT = 'announcement',
  BIRTHDAY = 'birthday',
  EMERGENCY = 'emergency',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', nullable: true, type: 'timestamptz' })
  readAt: Date | null;

  // Push, SMS, Telegram orqali yubordimi
  @Column({ name: 'push_sent', default: false })
  pushSent: boolean;

  @Column({ name: 'sms_sent', default: false })
  smsSent: boolean;

  @Column({ name: 'telegram_sent', default: false })
  telegramSent: boolean;

  // Qo'shimcha ma'lumot (JSON)
  @Column({ name: 'data', type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;
}
