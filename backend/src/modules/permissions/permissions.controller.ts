import { Controller, Get, Patch, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { PermissionsService } from './permissions.service';
import { UpdateMatrixDto } from './dto/permissions.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('catalog')
  @Roles(Role.SUPER_ADMIN)
  getCatalog() {
    return this.permissionsService.getAllPermissions();
  }

  @Get('matrix')
  @Roles(Role.SUPER_ADMIN)
  getMatrix() {
    return this.permissionsService.getMatrix();
  }

  @Patch('matrix')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  updateMatrix(@Body() dto: UpdateMatrixDto, @CurrentUser() user: User) {
    return this.permissionsService.updateMatrix(dto.changes, user.id);
  }
}
