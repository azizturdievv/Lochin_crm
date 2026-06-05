import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('parents')
export class Parent extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ type: 'varchar', nullable: true, length: 20, name: 'phone2' })
  phone2: string | null;

  @Column({ type: 'varchar', nullable: true })
  relation: string | null;

  @Column({ name: 'telegram_chat_id', type: 'varchar', nullable: true })
  telegramChatId: string | null;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;
}
