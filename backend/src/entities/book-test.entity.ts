import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Book } from './book.entity';
import { User } from './user.entity';

@Entity('book_tests')
export class BookTest extends BaseEntity {
  @ManyToOne(() => Book)
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column({ name: 'book_id' })
  bookId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // AI tomonidan yaratilgan savollar (JSON)
  @Column({ name: 'questions', type: 'jsonb' })
  questions: { question: string; options: string[]; correctAnswer: string }[];

  @Column({ name: 'score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number | null;

  // 80%+ → +50 ball
  @Column({ name: 'passed', default: false })
  passed: boolean;

  @Column({ name: 'completed_at', nullable: true, type: 'timestamptz' })
  completedAt: Date | null;
}
