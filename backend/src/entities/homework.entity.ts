import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Group } from './group.entity';
import { User } from './user.entity';
import { Lesson } from './lesson.entity';

export enum HomeworkStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
  LATE = 'late',
}

@Entity('homework')
export class Homework extends BaseEntity {
  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @Column({ name: 'lesson_id' })
  lessonId: string;

  @ManyToOne(() => Group)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @Column({ name: 'group_id' })
  groupId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  // Fayl URL'lari (JSON array)
  @Column({ name: 'attachment_urls', type: 'jsonb', default: [] })
  attachmentUrls: string[];

  @Column({ name: 'max_score', default: 100 })
  maxScore: number;
}
