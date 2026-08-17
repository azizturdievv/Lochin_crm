import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { GenerateMonthScheduleDto } from './dto/generate-month.dto';
import {
  WeekQueryDto,
  FreeSlotsQueryDto,
  ConflictCheckDto,
  AnalysisQueryDto,
} from './dto/query-schedule.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  // ─── HAFTALIK JADVAL (7 kunlik grid) ─────────────────────────────────────
  @Get('week')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getWeekSchedule(@Query() query: WeekQueryDto, @CurrentUser() user: User) {
    return this.scheduleService.getWeekSchedule(query, user.id, user.role);
  }

  // ─── GURUHLAR RO'YXATI ────────────────────────────────────────────────────
  @Get('groups')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findGroups(
    @Query('subjectId') subjectId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.scheduleService.findGroups(
      subjectId,
      isActive === undefined ? true : isActive === 'true',
    );
  }

  // XONALAR va VAQT SLOTLARI — endi alohida `schedule-settings` moduli
  // (TimeSlotController/RoomController, /api/v1/schedule/rooms va
  // /api/v1/schedule/time-slots) orqali DB-backed CRUD sifatida boshqariladi.
  // Bu yerda takroriy qattiq-kodlangan GET route qoldirilsa, u yangi
  // controller bilan bir xil yo'lga da'vogar bo'lib, uni "to'sib" qo'yardi.

  // ─── BO'SH SLOTLAR ────────────────────────────────────────────────────────
  @Get('free-slots')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getFreeSlots(@Query() query: FreeSlotsQueryDto) {
    return this.scheduleService.getFreeSlots(query);
  }

  // ─── YAQIN KUNLAR DARSLARI (o'rinbosar tanlash uchun) ─────────────────────
  @Get('upcoming-lessons')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getUpcomingLessons(@Query('days') days?: string) {
    return this.scheduleService.getUpcomingLessons(days ? Number(days) : undefined);
  }

  // ─── TO'QNASHUV TEKSHIRISH ────────────────────────────────────────────────
  @Post('check-conflict')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  checkConflict(@Body() dto: ConflictCheckDto) {
    return this.scheduleService.checkConflict(dto);
  }

  // ─── DAROMAD TAHLILI ──────────────────────────────────────────────────────
  @Get('analysis')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getAnalysis(@Query() query: AnalysisQueryDto) {
    return this.scheduleService.getAnalysis(query);
  }

  // ─── DARS YARATISH ────────────────────────────────────────────────────────
  @Post('lesson')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  createLesson(@Body() dto: CreateLessonDto, @CurrentUser() user: User) {
    return this.scheduleService.createLesson(dto, user.id, user.role);
  }

  // ─── OYLIK JADVAL AVTOMATIK GENERATSIYA ───────────────────────────────────
  @Post('generate-month')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  generateMonthSchedule(@Body() dto: GenerateMonthScheduleDto, @CurrentUser() user: User) {
    return this.scheduleService.generateMonthSchedule(dto, user.id, user.role);
  }

  @Get('month-status')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getMonthGenerationStatus(@Query('month') month: string) {
    return this.scheduleService.getMonthGenerationStatus(month);
  }

  // ─── BITTA DARS ───────────────────────────────────────────────────────────
  @Get('lesson/:id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.scheduleService.findOne(id);
  }

  // ─── DARS YANGILASH (drag & drop) ────────────────────────────────────────
  @Patch('lesson/:id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  updateLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: User,
  ) {
    return this.scheduleService.updateLesson(id, dto, user.id, user.role);
  }

  // ─── DARS BEKOR QILISH ────────────────────────────────────────────────────
  @Delete('lesson/:id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  deleteLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.scheduleService.deleteLesson(id, user.id, user.role);
  }

  // ─── O'QITUVCHI JADVALI ───────────────────────────────────────────────────
  @Get('teacher/:teacherId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getTeacherSchedule(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.scheduleService.getTeacherSchedule(teacherId, weekStart);
  }
}
