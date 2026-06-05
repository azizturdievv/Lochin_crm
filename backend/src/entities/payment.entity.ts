import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK = 'bank',
  PAYME = 'payme',
  CLICK = 'click',
  MIXED = 'mixed',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentType {
  TUITION = 'tuition',
  REGISTRATION = 'registration',
  BOOK = 'book',
  OTHER = 'other',
}

@Entity('payments')
export class Payment extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  // Qabul qilgan kassir/manager
  @ManyToOne(() => User)
  @JoinColumn({ name: 'received_by' })
  receivedBy: User;

  @Column({ name: 'received_by' })
  receivedById: string;

  @Column({ name: 'amount', type: 'bigint' })
  amount: bigint;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.COMPLETED })
  status: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentType, default: PaymentType.TUITION })
  type: PaymentType;

  // To'lov oyi (YYYY-MM formatida)
  @Column({ name: 'payment_month', type: 'varchar', nullable: true, length: 7 })
  paymentMonth: string | null;

  // Kvitansiya raqami
  @Column({ name: 'receipt_number', unique: true })
  receiptNumber: string;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  // Naqd kupyura tafsiloti (JSON: {"200000": 2, "100000": 1})
  @Column({ name: 'cash_breakdown', type: 'jsonb', nullable: true })
  cashBreakdown: Record<string, number> | null;

  // Aralash to'lov uchun
  @Column({ name: 'cash_amount', type: 'bigint', default: 0 })
  cashAmount: bigint;

  @Column({ name: 'card_amount', type: 'bigint', default: 0 })
  cardAmount: bigint;

  // Smena ID
  @Column({ name: 'cash_session_id', type: 'varchar', nullable: true })
  cashSessionId: string | null;

  // Muddatli to'lov
  @Column({ name: 'installment_plan_id', type: 'varchar', nullable: true })
  installmentPlanId: string | null;

  @Column({ name: 'installment_part', type: 'int', nullable: true })
  installmentPart: number | null;

  // Termal printer uchun chop etildimi
  @Column({ name: 'receipt_printed', default: false })
  receiptPrinted: boolean;
}
