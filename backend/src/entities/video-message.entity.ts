import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { ChatRoom } from './chat-room.entity';

// Yumaloq video xabarlar (30-60 soniya)
@Entity('video_messages')
export class VideoMessage extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User | null;

  @Column({ name: 'recipient_id', type: 'varchar', nullable: true })
  recipientId: string | null;

  @ManyToOne(() => ChatRoom, { nullable: true })
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom | null;

  @Column({ name: 'room_id', type: 'varchar', nullable: true })
  roomId: string | null;

  @Column({ name: 'video_url' })
  videoUrl: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  // 30-60 soniya
  @Column({ name: 'duration_seconds' })
  durationSeconds: number;

  @Column({ name: 'is_viewed', default: false })
  isViewed: boolean;

  @Column({ name: 'viewed_at', nullable: true, type: 'timestamptz' })
  viewedAt: Date | null;
}
