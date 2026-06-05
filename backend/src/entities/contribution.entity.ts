import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CollectionEvent } from './collection-event.entity';
import { User } from './user.entity';

@Entity('contributions')
export class Contribution extends BaseEntity {
  @ManyToOne(() => CollectionEvent)
  @JoinColumn({ name: 'event_id' })
  event: CollectionEvent;

  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'amount', type: 'bigint', default: 0 })
  amount: bigint;

  @Column({ name: 'paid', default: false })
  paid: boolean;

  @Column({ name: 'paid_at', nullable: true, type: 'timestamptz' })
  paidAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;
}
