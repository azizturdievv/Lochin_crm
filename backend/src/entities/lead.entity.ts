import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum LeadStage {
  NEW = 'new',
  IN_TALK = 'in_talk',
  WAITING = 'waiting',
  TRIAL = 'trial',
  ENROLLED = 'enrolled',
  LOST = 'lost',
}

export enum LeadSource {
  INSTAGRAM = 'instagram',
  TELEGRAM = 'telegram',
  PHONE = 'phone',
  WEBSITE = 'website',
  WHATSAPP = 'whatsapp',
  WALKIN = 'walkin',
  REFERRAL = 'referral',
}

@Entity('leads')
export class Lead extends BaseEntity {
  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'enum', enum: LeadStage, default: LeadStage.NEW })
  stage: LeadStage;

  @Column({ type: 'enum', enum: LeadSource, nullable: true })
  source: LeadSource | null;

  // Mas'ul manager
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User | null;

  @Column({ name: 'assigned_to', type: 'varchar', nullable: true })
  assignedToId: string | null;

  // Qiziqtirgan fan
  @Column({ name: 'interested_subject', type: 'varchar', nullable: true })
  interestedSubject: string | null;

  // 15 daqiqa qoidasi: birinchi aloqa sanasi
  @Column({ name: 'first_contact_at', nullable: true, type: 'timestamptz' })
  firstContactAt: Date | null;

  // 15 daqiqa qoidasi bajarilib alert yubordimi
  @Column({ name: 'alert_15min_sent', default: false })
  alert15minSent: boolean;

  @Column({ name: 'trial_date', nullable: true, type: 'date' })
  trialDate: Date | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  // Yo'qotilgan sabab
  @Column({ name: 'lost_reason', type: 'varchar', nullable: true })
  lostReason: string | null;

  // ENROLLED bosqichiga o'tgan sana — manager lid-bonusini oylik hisoblash uchun
  @Column({ name: 'enrolled_at', nullable: true, type: 'timestamptz' })
  enrolledAt: Date | null;
}
