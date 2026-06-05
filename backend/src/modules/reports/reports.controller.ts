import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';

interface JwtPayload {
  sub:   string;
  role:  Role;
  email: string;
}

@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // Har rol o'z dashboard ma'lumotlarini oladi
  @Get('dashboard')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.reportsService.getDashboard(user.sub, user.role);
  }
}
