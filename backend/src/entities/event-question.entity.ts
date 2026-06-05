import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Event } from './event.entity';

// Onlayn musobaqa savollari
@Entity('event_questions')
export class EventQuestion extends BaseEntity {
  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ type: 'text' })
  question: string;

  // Javob variantlari: [{ id: 'a', text: '...' }, ...]
  @Column({ type: 'jsonb' })
  options: { id: string; text: string }[];

  @Column({ name: 'correct_answer' })
  correctAnswer: string;

  @Column({ default: 1 })
  points: number;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
