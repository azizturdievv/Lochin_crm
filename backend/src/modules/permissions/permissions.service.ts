import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MatrixChangeDto } from './dto/permissions.dto';

@Injectable()
export class PermissionsService {
  // Rol → ruxsat action'lari keshi (updateMatrix() da tozalanadi)
  private cache = new Map<Role, Set<string>>();

  constructor(
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepo: Repository<RolePermission>,
    private dataSource: DataSource,
    private auditLog: AuditLogService,
  ) {}

  // ─── TO'LIQ KATALOG ────────────────────────────────────────────────────────
  async getAllPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({
      order: { module: 'ASC', action: 'ASC' },
    });
  }

  // ─── MATRITSA (modul → ruxsat → rol grantlari) ────────────────────────────
  async getMatrix() {
    const [permissions, rolePermissions] = await Promise.all([
      this.getAllPermissions(),
      this.rolePermissionRepo.find(),
    ]);

    const grantedSet = new Set(
      rolePermissions.map((rp) => `${rp.role}:${rp.permissionId}`),
    );

    const roles = Object.values(Role);
    const byModule = new Map<string, typeof permissions>();

    for (const p of permissions) {
      const list = byModule.get(p.module) ?? [];
      list.push(p);
      byModule.set(p.module, list);
    }

    const modules = [...byModule.entries()].map(([module, perms]) => ({
      module,
      permissions: perms.map((p) => ({
        id: p.id,
        action: p.action,
        displayName: p.displayName,
        description: p.description,
        grants: Object.fromEntries(
          roles.map((r) => [r, grantedSet.has(`${r}:${p.id}`)]),
        ) as Record<Role, boolean>,
      })),
    }));

    return { roles, modules };
  }

  // ─── MATRITSANI YANGILASH (faqat SA, audit-log) ───────────────────────────
  async updateMatrix(changes: MatrixChangeDto[], actorId: string) {
    const permissionIds = [...new Set(changes.map((c) => c.permissionId))];
    const existing = await this.permissionRepo.find({
      where: { id: In(permissionIds) },
    });
    if (existing.length !== permissionIds.length) {
      throw new NotFoundException('Ba\'zi ruxsatlar topilmadi');
    }

    const oldValues: Record<string, boolean> = {};
    const newValues: Record<string, boolean> = {};

    await this.dataSource.transaction(async (em) => {
      for (const change of changes) {
        const key = `${change.role}:${change.permissionId}`;
        const current = await em.findOne(RolePermission, {
          where: { role: change.role, permissionId: change.permissionId },
        });

        oldValues[key] = !!current;
        newValues[key] = change.granted;

        if (change.granted && !current) {
          await em.save(
            em.create(RolePermission, {
              role: change.role,
              permissionId: change.permissionId,
            }),
          );
        } else if (!change.granted && current) {
          await em.delete(RolePermission, { id: current.id });
        }
      }
    });

    this.cache.clear();

    await this.auditLog.log({
      userId: actorId,
      action: 'PERMISSIONS_MATRIX_UPDATE',
      entityName: 'role_permissions',
      oldValues,
      newValues,
    });

    return { message: 'Ruxsatlar matritsasi yangilandi' };
  }

  // ─── GUARD UCHUN: ROL BO'YICHA RUXSAT TO'PLAMI (keshlangan) ───────────────
  async getRolePermissionActions(role: Role): Promise<Set<string>> {
    const cached = this.cache.get(role);
    if (cached) return cached;

    const rows = await this.rolePermissionRepo.find({
      where: { role },
      relations: { permission: true },
    });

    const actions = new Set(
      rows
        .filter((rp) => rp.permission && !rp.permission.deletedAt)
        .map((rp) => rp.permission.action),
    );

    this.cache.set(role, actions);
    return actions;
  }
}
