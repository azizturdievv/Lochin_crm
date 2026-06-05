import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('vocabulary_words')
export class VocabularyWord extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ length: 200 })
  word: string;

  // AI ta'rifi
  @Column({ name: 'ai_definition', nullable: true, type: 'text' })
  aiDefinition: string | null;

  @Column({ name: 'user_definition', nullable: true, type: 'text' })
  userDefinition: string | null;

  @Column({ name: 'example_sentence', nullable: true, type: 'text' })
  exampleSentence: string | null;

  // Til: uz, en, ru
  @Column({ default: 'uz', length: 5 })
  language: string;

  // Haftalik test uchun: biladi / bilmaydi
  @Column({ name: 'mastered', default: false })
  mastered: boolean;

  @Column({ name: 'last_tested_at', nullable: true, type: 'timestamptz' })
  lastTestedAt: Date | null;

  @Column({ name: 'correct_count', default: 0 })
  correctCount: number;

  @Column({ name: 'wrong_count', default: 0 })
  wrongCount: number;
}
