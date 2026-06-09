import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('rooms')
@Index(['number'], { unique: true, where: '"deleted_at" IS NULL' })
export class Room extends BaseEntity {
  // Ko'rsatiladigan nom (masalan: "Xona 101")
  @Column({ type: 'varchar' })
  name: string;

  // Dars jadvalidagi identifikator (masalan: "101")
  @Column({ type: 'varchar' })
  number: string;

  // O'rinlar soni
  @Column({ type: 'int', default: 20 })
  capacity: number;

  // Faollik holati
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Tartib raqami
  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;
}
