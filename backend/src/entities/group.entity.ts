import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Subject } from './subject.entity';
import { User } from './user.entity';

@Entity('groups')
export class Group extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  // Asosiy o'qituvchi
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User | null;

  @Column({ name: 'teacher_id', type: 'varchar', nullable: true })
  teacherId: string | null;

  // Dars soatlari va narxi
  @Column({ name: 'lesson_hours', type: 'decimal', precision: 4, scale: 1, default: 2 })
  lessonHours: number;

  @Column({ name: 'monthly_price', type: 'bigint', default: 0 })
  monthlyPrice: bigint;

  // Xona raqami va sigimi
  @Column({ name: 'room_number', type: 'varchar', nullable: true })
  roomNumber: string | null;

  @Column({ name: 'max_students', default: 12 })
  maxStudents: number;

  @Column({ name: 'current_students', default: 0 })
  currentStudents: number;

  // Dars kunlari (JSON: ["monday","wednesday","friday"])
  @Column({ name: 'lesson_days', type: 'jsonb', default: [] })
  lessonDays: string[];

  // Dars vaqti (JSON: {"start": "08:00", "end": "10:00"})
  @Column({ name: 'lesson_time', type: 'jsonb', nullable: true })
  lessonTime: { start: string; end: string } | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'started_at', type: 'date', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'ended_at', type: 'date', nullable: true })
  endedAt: Date | null;
}
