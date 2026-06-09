import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseUUIDPipe, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ScheduleSettingsService } from './schedule-settings.service';
import {
  CreateTimeSlotDto, UpdateTimeSlotDto,
  CreateRoomDto,     UpdateRoomDto,
} from './dto/schedule-settings.dto';
import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { CurrentUser }   from '../../common/decorators/current-user.decorator';
import { Role }          from '../../common/enums/role.enum';
import { User }          from '../../entities/user.entity';

// ─── PARALAR ──────────────────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/schedule/time-slots')
export class TimeSlotController {
  constructor(private readonly svc: ScheduleSettingsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getAll(@Query('active') active?: string) {
    return this.svc.getTimeSlots(active === 'true');
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateTimeSlotDto, @CurrentUser() user: User) {
    return this.svc.createTimeSlot(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeSlotDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateTimeSlot(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.deleteTimeSlot(id, user.id);
  }
}

// ─── XONALAR ──────────────────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/schedule/rooms')
export class RoomController {
  constructor(private readonly svc: ScheduleSettingsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getAll(@Query('active') active?: string) {
    return this.svc.getRooms(active === 'true');
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateRoomDto, @CurrentUser() user: User) {
    return this.svc.createRoom(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() user: User,
  ) {
    return this.svc.updateRoom(id, dto, user.id);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.svc.deleteRoom(id, user.id);
  }
}
