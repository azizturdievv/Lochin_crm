import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Permission } from './permission.entity';

// Rol ↔ ruxsat a'zoligi — a'zolik fakti, soft-delete kerak emas (bekor qilish = hard delete)
@Entity('role_permissions')
@Index(['role', 'permissionId'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @Column({ name: 'permission_id' })
  permissionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
