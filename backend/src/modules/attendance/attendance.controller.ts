import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { QrScanDto } from './dto/qr-scan.dto';
import { OfflineSyncDto } from './dto/offline-sync.dto';
import { SubmitExcuseDto } from './dto/excuse.dto';
import { QueryAttendanceDto, ManualAttendanceDto } from './dto/query-attendance.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ─── QR SCAN: o'quvchi QR skanerlaydi ───────────────────────────────────
  @Post('qr-scan')
  @Roles(Role.STUDENT, Role.MANAGER, Role.USTOZ, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  scanQr(@Body() dto: QrScanDto, @CurrentUser() user: User) {
    return this.attendanceService.scanQr(dto, user.id);
  }

  // ─── OFFLINE SINXRONIZATSIYA ─────────────────────────────────────────────
  @Post('offline-sync')
  @Roles(Role.STUDENT, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  offlineSync(@Body() dto: OfflineSyncDto, @CurrentUser() user: User) {
    return this.attendanceService.syncOffline(dto, user.id);
  }

  // ─── QO'LDA BELGILASH (ustoz / manager) ─────────────────────────────────
  @Post('manual')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.CREATED)
  markManual(@Body() dto: ManualAttendanceDto, @CurrentUser() user: User) {
    return this.attendanceService.markManual(dto, user.id, user.role);
  }

  // ─── BUGUNGI DAVOMAT ─────────────────────────────────────────────────────
  @Get('today')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getToday(@CurrentUser() user: User) {
    return this.attendanceService.getToday(user.id, user.role);
  }

  // ─── DARS DAVOMATI ───────────────────────────────────────────────────────
  @Get('lesson/:lessonId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getLessonAttendance(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: User,
  ) {
    return this.attendanceService.getLessonAttendance(lessonId, user.id, user.role);
  }

  // ─── O'QUVCHI TARIXI ─────────────────────────────────────────────────────
  @Get('student/:studentId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getStudentHistory(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() query: QueryAttendanceDto,
    @CurrentUser() user: User,
  ) {
    return this.attendanceService.getStudentHistory(studentId, query, user.id, user.role);
  }

  // ─── OTA-ONA SABAB KIRITISHI ─────────────────────────────────────────────
  // Ota-ona o'z farzandining davomati uchun sabab kiritadi
  @Patch(':id/excuse')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.STUDENT) // Parent student roli ostida
  @HttpCode(HttpStatus.OK)
  submitExcuse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitExcuseDto,
    @CurrentUser() user: User,
  ) {
    return this.attendanceService.submitExcuse(id, dto, user.id);
  }
}

// ─── QR CONTROLLER (dars uchun alohida) ─────────────────────────────────────
import { Controller as Ctrl } from '@nestjs/common';

@UseGuards(JwtAuthGuard, RolesGuard)
@Ctrl('api/v1/lessons')
export class LessonQrController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // QR kodni ko'rish
  @Get(':lessonId/qr')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getLessonQr(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: User,
  ) {
    return this.attendanceService.getLessonQr(lessonId, user.id, user.role);
  }

  // QR kodni yangilash
  @Post(':lessonId/qr/refresh')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  refreshQr(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @CurrentUser() user: User,
  ) {
    return this.attendanceService.refreshLessonQr(lessonId, user.id, user.role);
  }
}
