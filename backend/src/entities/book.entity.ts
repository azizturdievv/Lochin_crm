import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('books')
export class Book extends BaseEntity {
  @Column({ length: 300 })
  title: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  author: string | null;

  @Column({ name: 'cover_url', type: 'varchar', nullable: true })
  coverUrl: string | null;

  @Column({ name: 'file_url', type: 'varchar', nullable: true })
  fileUrl: string | null;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  // SA tomonidan oyda 1-2 ta tavsiya
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_by' })
  assignedBy: User | null;

  @Column({ name: 'assigned_by', type: 'varchar', nullable: true })
  assignedById: string | null;

  @Column({ name: 'assigned_month', type: 'varchar', nullable: true, length: 7 })
  assignedMonth: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
