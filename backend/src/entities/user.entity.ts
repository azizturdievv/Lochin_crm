import {
  Entity,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Role } from '../common/enums/role.enum';
import { Session } from './session.entity';

@Entity('users')
@Index(['email'], { unique: true, where: '"deleted_at" IS NULL AND email IS NOT NULL' })
@Index(['phone'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['username'], { unique: true, where: '"deleted_at" IS NULL AND username IS NOT NULL' })
export class User extends BaseEntity {
  @Column({ length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', nullable: true, length: 100, name: 'middle_name' })
  middleName: string | null;

  // Username — o'quvchilar uchun asosiy login identifikatori
  @Column({ type: 'varchar', nullable: true, length: 50 })
  username: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  // select:false — hech qanday so'rov standart holatda bu ustunni yuklamaydi
  // (masalan chat xona a'zolari kabi javoblarda tasodifan chiqib ketmasligi uchun);
  // parolni tekshirish kerak bo'lgan joyda .addSelect('user.passwordHash') orqali aniq so'raladi
  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.STUDENT })
  role: Role;

  // 2FA sozlamalari
  @Column({ name: 'two_fa_enabled', default: false })
  twoFaEnabled: boolean;

  // select:false — passwordHash bilan bir xil sabab: TOTP siri tasodifan boshqa javoblarga chiqib ketmasligi uchun
  @Column({ name: 'two_fa_secret', type: 'varchar', nullable: true, select: false })
  twoFaSecret: string | null;

  // Brute force himoya
  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', nullable: true, type: 'timestamptz' })
  lockedUntil: Date | null;

  // To'lov avto-blok: SA tomonidan vaqtincha uzaytirilgan muddat (brute-force lockedUntil'dan farqli)
  @Column({ name: 'payment_extended_until', nullable: true, type: 'timestamptz' })
  paymentExtendedUntil: Date | null;

  @Column({ name: 'last_login_at', nullable: true, type: 'timestamptz' })
  lastLoginAt: Date | null;

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'telegram_chat_id', type: 'varchar', nullable: true })
  telegramChatId: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  // Firebase Cloud Messaging token (push bildirishnomalar uchun)
  @Column({ name: 'fcm_token', type: 'varchar', nullable: true })
  fcmToken: string | null;

  // Tug'ilgan kun (birthday trigger uchun)
  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date | null;

  // Ball tizimi
  @Column({ default: 0, name: 'total_points' })
  totalPoints: number;

  // Shaxsiy ma'lumotlar
  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  // Maktab ma'lumotlari
  @Column({ name: 'school_name', type: 'varchar', length: 200, nullable: true })
  schoolName: string | null;

  @Column({ name: 'school_grade', type: 'smallint', nullable: true })
  schoolGrade: number | null;

  // Qayerdan keldi (Instagram, Telegram, Do'st, Walk-in, Qo'ng'iroq, Boshqa)
  @Column({ name: 'referral_source', type: 'varchar', length: 50, nullable: true })
  referralSource: string | null;

  // Kim orqali keldi (ism)
  @Column({ name: 'referral_person', type: 'varchar', length: 200, nullable: true })
  referralPerson: string | null;

  // Izoh
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];
}
