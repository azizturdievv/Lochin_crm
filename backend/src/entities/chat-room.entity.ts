import { Entity, Column, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

export enum ChatRoomType {
  GROUP_CLASS = 'group_class',
  PRIVATE = 'private',
  ANNOUNCEMENTS = 'announcements',
  PARENT_TEACHER = 'parent_teacher',
}

@Entity('chat_rooms')
export class ChatRoom extends BaseEntity {
  @Column({ type: 'varchar', nullable: true, length: 200 })
  name: string | null;

  @Column({ type: 'enum', enum: ChatRoomType })
  type: ChatRoomType;

  @ManyToOne(() => Group, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: Group | null;

  @Column({ name: 'group_id', type: 'varchar', nullable: true })
  groupId: string | null;

  @ManyToMany(() => User)
  @JoinTable({
    name: 'chat_room_members',
    joinColumn: { name: 'room_id' },
    inverseJoinColumn: { name: 'user_id' },
  })
  members: User[];

  @Column({ name: 'last_message_at', nullable: true, type: 'timestamptz' })
  lastMessageAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
