import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Event } from './event.entity';
import { EventParticipant } from './event-participant.entity';

// Onlayn musobaqa — ishtirokchi javoblari
@Entity('event_submissions')
@Index(['eventId', 'participantId'], { unique: true })
export class EventSubmission extends BaseEntity {
  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => EventParticipant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participant_id' })
  participant: EventParticipant;

  @Column({ name: 'participant_id' })
  participantId: string;

  // { questionId: string; answer: string }[]
  @Column({ type: 'jsonb' })
  answers: { questionId: string; answer: string }[];

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  score: number;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  // Sarflangan vaqt (soniyada)
  @Column({ name: 'time_taken', type: 'int', nullable: true })
  timeTaken: number | null;
}
