import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { LiveSessionsService } from './live-sessions.service';
import { CreateLiveSessionDto, UpdateLiveSessionDto, CancelLiveSessionDto } from './dto/live-session.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/live-sessions')
export class LiveSessionsController {
  constructor(private readonly liveSessionsService: LiveSessionsService) {}

  @Get('config/status')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  configStatus() {
    return { configured: this.liveSessionsService.videoConfigured };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findAll(@CurrentUser() user: User) {
    return this.liveSessionsService.findAll(user.id, user.role);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.liveSessionsService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLiveSessionDto, @CurrentUser() user: User) {
    return this.liveSessionsService.create(dto, user.id, user.role);
  }

  @Post(':id/join')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  join(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.liveSessionsService.join(id, user.id, user.role, `${user.firstName} ${user.lastName}`);
  }

  @Post(':id/end')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  end(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.liveSessionsService.end(id, user.id, user.role);
  }

  // Faqat hali boshlanmagan (scheduled) sessiyani tahrirlash mumkin
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLiveSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.liveSessionsService.update(id, dto, user.id, user.role);
  }

  @Post(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelLiveSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.liveSessionsService.cancel(id, dto, user.id, user.role);
  }
}
