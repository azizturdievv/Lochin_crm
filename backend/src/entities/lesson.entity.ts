import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Group } from './group.entity';
import { User } from './user.entity';

export enum LessonStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  SUBSTITUTED = 'substituted',
}

@Entity('lessons')
export class Lesson extends BaseEntity {
  @ManyToOne(() => Group)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @Column({ name: 'lesson_date', type: 'date' })
  lessonDate: Date;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'room_number', type: 'varchar', nullable: true })
  roomNumber: string | null;

  @Column({ type: 'enum', enum: LessonStatus, default: LessonStatus.SCHEDULED })
  status: LessonStatus;

  // QR kod (24 soatda yangilanadi)
  @Column({ name: 'qr_code', nullable: true, type: 'text' })
  qrCode: string | null;

  @Column({ name: 'qr_expires_at', nullable: true, type: 'timestamptz' })
  qrExpiresAt: Date | null;

  @Column({ name: 'topic', nullable: true, type: 'text' })
  topic: string | null;

  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes: string | null;

  // Dars soati (hisoblash uchun)
  @Column({ name: 'duration_hours', type: 'decimal', precision: 4, scale: 1, default: 2 })
  durationHours: number;
}
