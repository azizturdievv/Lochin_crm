import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../common/enums/role.enum';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permissions.decorator';
import { PermissionsService } from './permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Foydalanuvchi aniqlanmadi');
    }

    // Super admin — barcha ruxsatlarga ega
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const granted = await this.permissionsService.getRolePermissionActions(user.role);
    const hasAll = requiredPermissions.every((p) => granted.has(p));

    if (!hasAll) {
      throw new ForbiddenException(
        `Bu amalni bajarish uchun ruxsat yo'q: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
