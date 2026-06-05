import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

// Audit log: o'chirimsiz, 5 yil saqlanadi
// BaseEntity ishlatilmaydi — soft delete bo'lmasligi kerak
@Entity('audit_logs')
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId: string | null;

  @Column({ name: 'user_role', type: 'varchar', nullable: true })
  userRole: string | null;

  @Column({ name: 'user_email', type: 'varchar', nullable: true })
  userEmail: string | null;

  // Amal turi: CREATE, READ, UPDATE, DELETE, LOGIN, LOGOUT va h.k.
  @Column({ length: 100 })
  action: string;

  // Jadval nomi: users, payments, test_results...
  @Column({ name: 'entity_name', type: 'varchar', nullable: true })
  entityName: string | null;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId: string | null;

  // O'zgartirish tafsilotlari (JSON)
  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: Record<string, unknown> | null;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', nullable: true, type: 'text' })
  userAgent: string | null;

  @Column({ name: 'request_path', type: 'varchar', nullable: true })
  requestPath: string | null;

  @Column({ name: 'request_method', type: 'varchar', nullable: true, length: 10 })
  requestMethod: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
