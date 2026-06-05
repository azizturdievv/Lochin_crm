import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Event } from './event.entity';

export enum CertificateType {
  COMPLETION = 'completion',
  ACHIEVEMENT = 'achievement',
  PARTICIPATION = 'participation',
  DIPLOMA = 'diploma',
}

@Entity('certificates')
export class Certificate extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ type: 'enum', enum: CertificateType })
  type: CertificateType;

  @Column({ length: 300 })
  title: string;

  @ManyToOne(() => Event, { nullable: true })
  @JoinColumn({ name: 'event_id' })
  event: Event | null;

  @Column({ name: 'event_id', type: 'varchar', nullable: true })
  eventId: string | null;

  // PDF URL
  @Column({ name: 'file_url', type: 'varchar', nullable: true })
  fileUrl: string | null;

  // QR verifikatsiya kodi
  @Column({ name: 'verification_code', unique: true })
  verificationCode: string;

  @Column({ name: 'issued_at', type: 'date' })
  issuedAt: Date;

  @Column({ name: 'is_sent', default: false })
  isSent: boolean;
}
