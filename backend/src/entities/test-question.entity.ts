import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Test } from './test.entity';
import { TestDifficulty } from './test.entity';

@Entity('test_questions')
export class TestQuestion extends BaseEntity {
  @ManyToOne(() => Test, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test: Test;

  @Column({ name: 'test_id' })
  testId: string;

  @Column({ type: 'text' })
  question: string;

  // Javob variantlari (JSON array)
  @Column({ type: 'jsonb' })
  options: { id: string; text: string }[];

  @Column({ name: 'correct_answer' })
  correctAnswer: string;

  @Column({ type: 'enum', enum: TestDifficulty, default: TestDifficulty.MEDIUM })
  difficulty: TestDifficulty;

  @Column({ name: 'points', default: 1 })
  points: number;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
