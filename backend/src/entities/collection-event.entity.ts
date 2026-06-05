import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('collection_events')
export class CollectionEvent extends BaseEntity {
  @Column({ length: 200 })
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ name: 'target_amount', type: 'bigint' })
  targetAmount: bigint;

  @Column({ name: 'collected_amount', type: 'bigint', default: 0 })
  collectedAmount: bigint;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
