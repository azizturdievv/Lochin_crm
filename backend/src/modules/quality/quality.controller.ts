import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { QualityService } from './quality.service';
import { SpellingService } from './spelling.service';
import { GrowthService } from './growth.service';
import {
  QueryQualityDto,
  QueryStaffSpellingDto,
  CheckSpellingDto,
  MarkCorrectedDto,
  QueryGrowthDto,
  QualityPeriod,
} from './dto/quality.dto';

@Controller('api/v1/quality')
export class QualityController {
  constructor(
    private readonly qualityService: QualityService,
    private readonly spellingService: SpellingService,
    private readonly growthService: GrowthService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // ROL BO'YICHA DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════

  // SA: barcha xodim imlo + AI muloqot tahlili
  @Get('dashboard/sa')
  @Roles(Role.SUPER_ADMIN)
  getSaDashboard(@Query() q: QueryQualityDto) {
    return this.qualityService.getSaDashboard(q.period ?? QualityPeriod.MONTH);
  }

  // Manager: o'z imlo xatolari + muloqot sifati
  @Get('dashboard/manager')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getManagerDashboard(
    @Query() q: QueryQualityDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.qualityService.getManagerDashboard(user.id, q.period ?? QualityPeriod.MONTH);
  }

  // Ustoz: o'z imlo + guruh umumiy ko'rsatkichi
  @Get('dashboard/ustoz')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getUstozDashboard(
    @Query() q: QueryQualityDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.qualityService.getUstозDashboard(user.id, q.period ?? QualityPeriod.MONTH);
  }

  // Ota-ona ko'rinishi: farzand imlo + ustoz izohlari + o'sish grafigi
  // SA/Manager studentId bilan chaqiradi
  @Get('dashboard/parent/:studentId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getParentDashboard(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() q: QueryQualityDto & { subjectId?: string },
  ) {
    return this.qualityService.getParentDashboard(
      studentId,
      q.period ?? QualityPeriod.MONTH,
      q.subjectId,
    );
  }

  // O'quvchi: o'z imlo + to'g'ri variant + mashq + o'sish
  @Get('dashboard/student')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getStudentDashboard(
    @Query() q: QueryQualityDto & { studentId?: string; subjectId?: string },
    @CurrentUser() user: { id: string; role: string },
  ) {
    const targetId = q.studentId ?? user.id;
    return this.qualityService.getStudentDashboard(
      targetId,
      user.id,
      user.role,
      q.period ?? QualityPeriod.MONTH,
      q.subjectId,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IMLO TEKSHIRUVI
  // ══════════════════════════════════════════════════════════════════════════

  // Matnni imlo tekshiruvi (AI)
  @Post('spelling/check')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  checkSpelling(
    @Body() dto: CheckSpellingDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.spellingService.checkAndSave(
      dto.text,
      user.id,
      user.role,
      dto.messageId,
    );
  }

  // O'quvchi xatoni o'zi tuzatdi (+5 ball)
  @Post('spelling/correct')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  markCorrected(
    @Body() dto: MarkCorrectedDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.spellingService.markCorrected(dto.errorId, user.id);
  }

  // Foydalanuvchi imlo xatolari ro'yxati
  @Get('spelling/user/:userId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getUserSpellingErrors(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() q: QueryStaffSpellingDto,
  ) {
    const { from } = q.period ? getPeriodDate(q.period) : { from: undefined };
    return this.spellingService.getUserErrors(userId, from, q.limit ?? 20);
  }

  // O'zining imlo xatolari (ustoz/manager)
  @Get('spelling/mine')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getMySpellingErrors(
    @Query() q: QueryStaffSpellingDto,
    @CurrentUser() user: { id: string },
  ) {
    const { from } = q.period ? getPeriodDate(q.period) : { from: undefined };
    return this.spellingService.getUserErrors(user.id, from, q.limit ?? 20);
  }

  // Barcha xodim imlo statistikasi (SA)
  @Get('spelling/staff')
  @Roles(Role.SUPER_ADMIN)
  getStaffSpellingStats(@Query() q: QueryQualityDto) {
    const { from, to } = getPeriodDateRange(q.period ?? QualityPeriod.MONTH);
    return this.spellingService.getStaffSpellingStats(from, to);
  }

  // Muloqot sifati tahlili (SA/Manager o'zi yoki boshqa xodim)
  @Get('spelling/conversation/:userId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getConversationQuality(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() q: QueryQualityDto,
  ) {
    const { from, to } = getPeriodDateRange(q.period ?? QualityPeriod.MONTH);
    return this.spellingService.analyzeConversationQuality(userId, from, to);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // O'SISH GRAFIGI
  // ══════════════════════════════════════════════════════════════════════════

  // O'quvchi o'sish grafigi (ilk qabuldan bugunga)
  @Get('growth/:studentId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getStudentGrowth(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Query() q: QueryGrowthDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    // O'quvchi faqat o'zini ko'radi
    const targetId = user.role === Role.STUDENT ? user.id : studentId;
    return this.growthService.getStudentGrowth(targetId, q.subjectId, q.interval ?? 'monthly');
  }

  // Guruh umumiy ko'rsatkichlari
  @Get('group/:groupId/metrics')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getGroupMetrics(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.growthService.getGroupMetrics(groupId);
  }
}

// ─── Yordamchi: davr sanasini hisoblash ──────────────────────────────────────
function getPeriodDate(period: QualityPeriod): { from: Date } {
  const from = new Date();
  if (period === QualityPeriod.WEEK)    from.setDate(from.getDate() - 7);
  else if (period === QualityPeriod.QUARTER) from.setMonth(from.getMonth() - 3);
  else from.setMonth(from.getMonth() - 1);
  return { from };
}

function getPeriodDateRange(period: QualityPeriod): { from: Date; to: Date } {
  return { ...getPeriodDate(period), to: new Date() };
}
