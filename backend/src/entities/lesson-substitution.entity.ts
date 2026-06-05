import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lesson } from './lesson.entity';
import { User } from './user.entity';

export enum AbsenceReason {
  SICK = 'sick',
  PERSONAL = 'personal',
  FAMILY = 'family',
  TRAINING = 'training',
  OTHER = 'other',
}

// O'rinbosarlik moduli
@Entity('lesson_substitutions')
export class LessonSubstitution extends BaseEntity {
  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  // Asl o'qituvchi
  @ManyToOne(() => User)
  @JoinColumn({ name: 'original_teacher_id' })
  originalTeacher: User;

  @Column({ name: 'original_teacher_id' })
  originalTeacherId: string;

  // O'rinbosar
  @ManyToOne(() => User)
  @JoinColumn({ name: 'substitute_teacher_id' })
  substituteTeacher: User;

  @Column({ name: 'substitute_teacher_id' })
  substituteTeacherId: string;

  @Column({ type: 'enum', enum: AbsenceReason })
  reason: AbsenceReason;

  @Column({ name: 'notes', nullable: true, type: 'text' })
  notes: string | null;

  // O'rinbosar uchun hisoblangan maosh: dars_soat × stavka
  @Column({ name: 'sub_payment', type: 'bigint', default: 0 })
  subPayment: bigint;

  // Asl o'qituvchidan chegirilgan miqdor
  @Column({ name: 'original_deduction', type: 'bigint', default: 0 })
  originalDeduction: bigint;

  // Maosh hisoblandi
  @Column({ name: 'salary_processed', default: false })
  salaryProcessed: boolean;

  // Bildirishnoma yuborildi
  @Column({ name: 'notification_sent', default: false })
  notificationSent: boolean;
}
