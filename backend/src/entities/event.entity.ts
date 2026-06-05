import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum EventType {
  OLYMPIAD  = 'olympiad',
  SPORT     = 'sport',
  ROBOTICS  = 'robotics',
  CHESS     = 'chess',
  RUNNING   = 'running',
  CULTURAL  = 'cultural',
  OTHER     = 'other',
}

export enum CompetitionStatus {
  NOT_STARTED = 'not_started',
  ONGOING     = 'ongoing',
  FINISHED    = 'finished',
}

@Entity('events')
export class Event extends BaseEntity {
  @Column({ length: 300 })
  title: string;

  @Column({ type: 'enum', enum: EventType })
  type: EventType;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ name: 'event_date', type: 'date' })
  eventDate: Date;

  @Column({ name: 'start_time', nullable: true, type: 'time' })
  startTime: string | null;

  @Column({ name: 'location', type: 'varchar', nullable: true })
  location: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  // Ishtirokchilar chegarasi
  @Column({ name: 'max_participants', type: 'int', nullable: true })
  maxParticipants: number | null;

  // Ro'yxatdan o'tish muddati
  @Column({ name: 'registration_deadline', type: 'timestamptz', nullable: true })
  registrationDeadline: Date | null;

  // Ishtirok to'lovi (0 = bepul)
  @Column({ name: 'entry_fee', type: 'bigint', default: 0 })
  entryFee: bigint;

  // Onlayn musobaqa
  @Column({ name: 'is_online', default: false })
  isOnline: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Musobaqa savollari soni
  @Column({ name: 'question_count', default: 10 })
  questionCount: number;

  // Vaqt chegarasi (daqiqada)
  @Column({ name: 'time_limit', default: 60 })
  timeLimit: number;

  @Column({
    name: 'competition_status',
    type: 'enum',
    enum: CompetitionStatus,
    default: CompetitionStatus.NOT_STARTED,
  })
  competitionStatus: CompetitionStatus;

  // Natijalar JSON (g'oliblar xulosasi)
  @Column({ name: 'results', type: 'jsonb', nullable: true })
  results: Record<string, unknown> | null;
}
