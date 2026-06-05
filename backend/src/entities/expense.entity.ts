import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum ExpenseCategory {
  SALARY = 'salary',
  RENT = 'rent',
  UTILITIES = 'utilities',
  SUPPLIES = 'supplies',
  MARKETING = 'marketing',
  EQUIPMENT = 'equipment',
  OTHER = 'other',
}

@Entity('expenses')
export class Expense extends BaseEntity {
  @Column({ length: 200 })
  title: string;

  @Column({ type: 'enum', enum: ExpenseCategory, default: ExpenseCategory.OTHER })
  category: ExpenseCategory;

  @Column({ type: 'bigint' })
  amount: bigint;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: Date;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @Column({ name: 'receipt_url', type: 'varchar', nullable: true })
  receiptUrl: string | null;

  // Faqat SA ko'rishi uchun
  @Column({ name: 'is_confidential', default: false })
  isConfidential: boolean;
}
