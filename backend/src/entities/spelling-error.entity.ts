import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Message } from './message.entity';

// Xabar imlo xatosi (AI analizidan)
@Entity('spelling_errors')
export class SpellingError extends BaseEntity {
  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'message_id' })
  message: Message | null;

  @Column({ name: 'message_id', type: 'varchar', nullable: true })
  messageId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  // Xato so'z yoki ibora
  @Column({ name: 'original_text', type: 'varchar' })
  originalText: string;

  // AI taklif etgan to'g'ri variantlar
  @Column({ type: 'jsonb' })
  suggestions: string[];

  // Xato joylashgan matn parcha (kontekst)
  @Column({ name: 'context', type: 'text', nullable: true })
  context: string | null;

  // O'quvchi/xodim o'zi tuzatdimi (o'quvchiga +5 ball)
  @Column({ name: 'was_corrected', default: false })
  wasCorrected: boolean;

  @Column({ name: 'corrected_at', type: 'timestamptz', nullable: true })
  correctedAt: Date | null;

  // AI tekshirilgan sana
  @Column({ name: 'checked_at', type: 'timestamptz' })
  checkedAt: Date;
}
