import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Group } from './group.entity';
import { Lesson } from './lesson.entity';
import { User } from './user.entity';

export enum MaterialType {
  PDF = 'pdf',
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image',
  LINK = 'link',
  OTHER = 'other',
}

@Entity('materials')
export class Material extends BaseEntity {
  @Column({ length: 200 })
  title: string;

  @Column({ type: 'enum', enum: MaterialType })
  type: MaterialType;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ name: 'group_id', type: 'varchar', nullable: true })
  groupId: string | null;

  @ManyToOne(() => Lesson, { nullable: true })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson | null;

  @Column({ name: 'lesson_id', type: 'varchar', nullable: true })
  lessonId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User;

  @Column({ name: 'uploaded_by' })
  uploadedById: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  // O'quvchilarga ko'rinadimi
  @Column({ name: 'is_visible', default: true })
  isVisible: boolean;
}
