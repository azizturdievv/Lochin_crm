import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { CashSession } from './cash-session.entity';

@Entity('sales')
export class Sale extends BaseEntity {
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: User | null;

  @Column({ name: 'customer_id', type: 'varchar', nullable: true })
  customerId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sold_by' })
  soldBy: User;

  @Column({ name: 'sold_by' })
  soldById: string;

  @ManyToOne(() => CashSession, { nullable: true })
  @JoinColumn({ name: 'cash_session_id' })
  cashSession: CashSession | null;

  @Column({ name: 'cash_session_id', type: 'varchar', nullable: true })
  cashSessionId: string | null;

  // Sotilgan mahsulotlar (JSON array)
  @Column({ name: 'items', type: 'jsonb' })
  items: { productId: string; name: string; quantity: number; price: bigint; total: bigint }[];

  @Column({ name: 'total_amount', type: 'bigint' })
  totalAmount: bigint;

  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ name: 'receipt_number', unique: true })
  receiptNumber: string;
}
