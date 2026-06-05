import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

export enum LiveSessionType {
  TEACHER_STUDENT = 'teacher_student',
  STAFF = 'staff',
  PARENT_CENTER = 'parent_center',
  COMPETITION = 'competition',
  SPORT_ROBO = 'sport_robo',
  BROADCAST = 'broadcast',
}

export enum LiveSessionStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

@Entity('live_sessions')
export class LiveSession extends BaseEntity {
  @Column({ length: 300 })
  title: string;

  @Column({ type: 'enum', enum: LiveSessionType })
  type: LiveSessionType;

  @Column({ type: 'enum', enum: LiveSessionStatus, default: LiveSessionStatus.SCHEDULED })
  status: LiveSessionStatus;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'host_id' })
  host: User;

  @Column({ name: 'host_id' })
  hostId: string;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ name: 'group_id', type: 'varchar', nullable: true })
  groupId: string | null;

  // Livekit yoki Daily.co xona ID
  @Column({ name: 'room_id', type: 'varchar', nullable: true })
  roomId: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ name: 'started_at', nullable: true, type: 'timestamptz' })
  startedAt: Date | null;

  @Column({ name: 'ended_at', nullable: true, type: 'timestamptz' })
  endedAt: Date | null;

  // Yozuv URL
  @Column({ name: 'recording_url', type: 'varchar', nullable: true })
  recordingUrl: string | null;

  // Maksimal ishtirokchilar: 200
  @Column({ name: 'max_participants', default: 200 })
  maxParticipants: number;
}
