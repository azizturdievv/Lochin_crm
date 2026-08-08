import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

// Ruxsat katalogi — format: "modul:resurs:amal" (masalan: "finance:salary:read")
@Entity('permissions')
@Index(['action'], { unique: true, where: '"deleted_at" IS NULL' })
export class Permission extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  action: string;

  // Guruhlash uchun (masalan: "finance", "crm", "chat")
  @Column({ type: 'varchar', length: 100 })
  module: string;

  @Column({ name: 'display_name', type: 'varchar', length: 300 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
