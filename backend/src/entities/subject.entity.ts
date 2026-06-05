import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('subjects')
export class Subject extends BaseEntity {
  @Column({ length: 100, unique: true })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ name: 'icon_url', type: 'varchar', nullable: true })
  iconUrl: string | null;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  // Plugin arxitektura uchun tartib raqami
  @Column({ default: 0, name: 'sort_order' })
  sortOrder: number;
}
