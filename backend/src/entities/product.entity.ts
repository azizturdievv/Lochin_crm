import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Column({ length: 200 })
  name: string;

  @Column({ name: 'barcode', type: 'varchar', nullable: true, unique: true })
  barcode: string | null;

  @Column({ name: 'qr_code', type: 'varchar', nullable: true })
  qrCode: string | null;

  @Column({ name: 'price', type: 'bigint' })
  price: bigint;

  @Column({ name: 'cost_price', type: 'bigint', default: 0 })
  costPrice: bigint;

  @Column({ name: 'stock_quantity', default: 0 })
  stockQuantity: number;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
