import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

export enum AnnouncementTarget {
  ALL = 'all',
  STUDENTS = 'students',
  TEACHERS = 'teachers',
  PARENTS = 'parents',
  GROUP = 'group',
}

@Entity('announcements')
export class Announcement extends BaseEntity {
  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: AnnouncementTarget, default: AnnouncementTarget.ALL })
  target: AnnouncementTarget;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ name: 'group_id', type: 'varchar', nullable: true })
  groupId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @Column({ name: 'published_at', nullable: true, type: 'timestamptz' })
  publishedAt: Date | null;

  @Column({ name: 'expires_at', nullable: true, type: 'timestamptz' })
  expiresAt: Date | null;

  @Column({ name: 'attachment_urls', type: 'jsonb', default: [] })
  attachmentUrls: string[];

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;
}
