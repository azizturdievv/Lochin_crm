import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Event } from './event.entity';
import { User } from './user.entity';

export enum ParticipantPaymentStatus {
  PENDING = 'pending',
  PAID    = 'paid',
  FREE    = 'free',
}

@Entity('event_participants')
@Index(['eventId', 'studentId'], { unique: true })
export class EventParticipant extends BaseEntity {
  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  // Ro'yxat ma'lumotlari
  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'school', type: 'varchar', nullable: true })
  school: string | null;

  @Column({ name: 'grade', type: 'varchar', nullable: true })
  grade: string | null;

  @Column({ name: 'age', type: 'int', nullable: true })
  age: number | null;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: ParticipantPaymentStatus,
    default: ParticipantPaymentStatus.PENDING,
  })
  paymentStatus: ParticipantPaymentStatus;

  // Elektron ruxsatnoma
  @Column({ name: 'permit_code', type: 'varchar', nullable: true, unique: true })
  permitCode: string | null;

  // QR kodi (base64 data URL)
  @Column({ name: 'permit_qr', type: 'text', nullable: true })
  permitQr: string | null;

  @Column({ name: 'permit_verified', default: false })
  permitVerified: boolean;

  @Column({ name: 'permit_verified_at', type: 'timestamptz', nullable: true })
  permitVerifiedAt: Date | null;

  // Musobaqa natijasi
  @Column({ name: 'place', type: 'int', nullable: true })
  place: number | null;

  @Column({ name: 'score', type: 'decimal', precision: 8, scale: 2, nullable: true })
  score: number | null;

  @Column({ name: 'registered_at', type: 'timestamptz' })
  registeredAt: Date;
}
