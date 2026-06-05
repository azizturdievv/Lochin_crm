import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum CashSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  DISCREPANCY = 'discrepancy',
}

@Entity('cash_sessions')
export class CashSession extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ name: 'cashier_id' })
  cashierId: string;

  @Column({ name: 'opening_balance', type: 'bigint', default: 0 })
  openingBalance: bigint;

  @Column({ name: 'closing_balance', type: 'bigint', nullable: true })
  closingBalance: bigint | null;

  @Column({ name: 'expected_balance', type: 'bigint', nullable: true })
  expectedBalance: bigint | null;

  // Kassa farqi (closing - expected) — SA alert uchun
  @Column({ name: 'discrepancy_amount', type: 'bigint', default: 0 })
  discrepancyAmount: bigint;

  @Column({ type: 'enum', enum: CashSessionStatus, default: CashSessionStatus.OPEN })
  status: CashSessionStatus;

  @Column({ name: 'opened_at', type: 'timestamptz' })
  openedAt: Date;

  @Column({ name: 'closed_at', nullable: true, type: 'timestamptz' })
  closedAt: Date | null;

  // SA alert yubordimi
  @Column({ name: 'alert_sent', default: false })
  alertSent: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;
}
