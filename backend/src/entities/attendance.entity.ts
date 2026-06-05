import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './lesson.entity';
import { User } from './user.entity';

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
  EXCUSED = 'excused',
  UNEXCUSED = 'unexcused',
}

@Entity('attendance')
@Index(['lessonId', 'studentId'], { unique: true })
export class Attendance extends BaseEntity {
  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.ABSENT })
  status: AttendanceStatus;

  // Kech qolgan bo'lsa, necha daqiqa
  @Column({ name: 'late_minutes', type: 'int', nullable: true })
  lateMinutes: number | null;

  // QR orqali kirilgan vaqt
  @Column({ name: 'scanned_at', nullable: true, type: 'timestamptz' })
  scannedAt: Date | null;

  // Sababli kelmagan bo'lsa sabab
  @Column({ name: 'excuse_reason', nullable: true, type: 'text' })
  excuseReason: string | null;

  // Ota-ona sabab kiritdimi
  @Column({ name: 'excuse_by_parent', default: false })
  excuseByParent: boolean;

  // D+15 qoidasi: 15 daqiqada ota-onaga xabar yubordimi
  @Column({ name: 'parent_notified', default: false })
  parentNotified: boolean;

  // Offline sinxronizatsiya
  @Column({ name: 'synced_from_offline', default: false })
  syncedFromOffline: boolean;
}
