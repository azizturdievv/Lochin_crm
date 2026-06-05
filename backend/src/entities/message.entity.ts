import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ChatRoom } from './chat-room.entity';
import { User } from './user.entity';

export enum MessageType {
  TEXT = 'text',
  AUDIO = 'audio',
  VIDEO = 'video',
  VIDEO_CIRCLE = 'video_circle',
  FILE = 'file',
  IMAGE = 'image',
  LESSON_PHOTO = 'lesson_photo',
}

@Entity('messages')
export class Message extends BaseEntity {
  @ManyToOne(() => ChatRoom)
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @Column({ name: 'room_id' })
  roomId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ nullable: true, type: 'text' })
  content: string | null;

  @Column({ name: 'file_url', type: 'varchar', nullable: true })
  fileUrl: string | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  // Imlo xatolari soni (AI analizidan)
  @Column({ name: 'spelling_errors', default: 0 })
  spellingErrors: number;

  // AI moderatsiya bayrog'i
  @Column({ name: 'moderation_flag', type: 'varchar', nullable: true })
  moderationFlag: string | null;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  // O'qilgan foydalanuvchilar (JSON array of user IDs)
  @Column({ name: 'read_by', type: 'jsonb', default: [] })
  readBy: string[];
}
