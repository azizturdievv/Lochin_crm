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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { FinanceService } from './finance.service';
import { SalaryService } from './salary.service';
import { ExpenseService } from './expense.service';
import { CreateExpenseDto, UpdateExpenseDto, QueryExpenseDto } from './dto/expense.dto';
import { SetSalaryDto, CalculateSalaryDto, QuarterlyBonusQueryDto } from './dto/salary.dto';
import { PnlQueryDto, TelegramExportDto } from './dto/report.dto';

// Joriy oyni YYYY-MM formatida qaytaruvchi yordamchi
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── MOLIYA CONTROLLERI ───────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly salaryService: SalaryService,
    private readonly expenseService: ExpenseService,
  ) {}

  // ─── P&L ────────────────────────────────────────────────────────────────────
  @Get('pnl')
  @Roles(Role.SUPER_ADMIN)
  getPnl(@Query() query: PnlQueryDto) {
    if (query.month) return this.financeService.getMonthlyPnl(query.month);
    const year = query.year ?? String(new Date().getFullYear());
    return this.financeService.getAnnualPnl(year);
  }

  @Get('kpi')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getKpi(@Query('month') month?: string) {
    return this.financeService.getKpiDashboard(month ?? currentMonth());
  }

  @Get('subject-revenue')
  @Roles(Role.SUPER_ADMIN)
  getSubjectRevenue(@Query('year') year?: string) {
    return this.financeService.getSubjectRevenue(year ?? String(new Date().getFullYear()));
  }

  // ─── ISH HAQI ────────────────────────────────────────────────────────────────
  @Get('salary')
  @RequirePermissions('finance:salary:read')
  getSalaries(@Query('month') month?: string) {
    return this.salaryService.findAll(month ?? currentMonth());
  }

  @Get('salary/config')
  @Roles(Role.SUPER_ADMIN)
  getSalaryConfigs() {
    return this.salaryService.getSalaryConfigs();
  }

  @Post('salary/config')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  setSalaryConfig(@Body() dto: SetSalaryDto, @CurrentUser() user: User) {
    return this.salaryService.setSalaryConfig(dto, user.id, user.role);
  }

  @Post('salary/calculate')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  calculateSalary(@Body() dto: CalculateSalaryDto, @CurrentUser() user: User) {
    if (dto.teacherId) {
      return this.salaryService.calculateMonthly(dto.teacherId, dto.periodMonth, user.id);
    }
    return this.salaryService.calculateAllMonthly(dto.periodMonth, user.id);
  }

  @Patch('salary/:id/approve')
  @RequirePermissions('finance:salary:approve')
  @HttpCode(HttpStatus.OK)
  approveSalary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.salaryService.approve(id, user.id);
  }

  @Patch('salary/:id/paid')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  markPaid(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.salaryService.markPaid(id, user.id);
  }

  @Get('quarterly-bonus')
  @Roles(Role.SUPER_ADMIN)
  getQuarterlyBonus(@Query() query: QuarterlyBonusQueryDto, @CurrentUser() user: User) {
    return this.salaryService.calculateQuarterlyBonus(
      query.year,
      Number(query.quarter),
      query.coefficientPerPoint ? Number(query.coefficientPerPoint) : undefined,
      user.id,
    );
  }

  // ─── XARAJATLAR ──────────────────────────────────────────────────────────────
  @Post('expenses')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() user: User) {
    return this.expenseService.create(dto, user.id, user.role);
  }

  @Get('expenses')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getExpenses(@Query() query: QueryExpenseDto, @CurrentUser() user: User) {
    return this.expenseService.findAll(query, user.id, user.role);
  }

  @Get('expenses/summary')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getExpenseSummary(@Query('month') month: string, @CurrentUser() user: User) {
    return this.expenseService.getSummary(month ?? currentMonth(), user.role);
  }

  @Patch('expenses/:id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  updateExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: User,
  ) {
    return this.expenseService.update(id, dto, user.id, user.role);
  }

  @Delete('expenses/:id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteExpense(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.expenseService.remove(id, user.id, user.role);
  }

  // ─── EKSPORT ─────────────────────────────────────────────────────────────────
  @Get('export/pnl-excel')
  @Roles(Role.SUPER_ADMIN)
  async exportPnlExcel(
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const m = month ?? currentMonth();
    const buffer = await this.financeService.exportPnlExcel(m);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pnl-${m}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('export/salary-excel')
  @Roles(Role.SUPER_ADMIN)
  async exportSalaryExcel(
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const m = month ?? currentMonth();
    const records = await this.salaryService.findAll(m);
    const buffer = await this.financeService.exportSalaryExcel(m, records);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="salary-${m}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('export/pdf')
  @Roles(Role.SUPER_ADMIN)
  async exportPdf(
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const m = month ?? currentMonth();
    const buffer = await this.financeService.exportPdf(m);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="finance-${m}.pdf"`,
    });
    res.send(buffer);
  }

  @Post('export/telegram')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  sendTelegram(@Body() dto: TelegramExportDto) {
    return this.financeService.sendTelegramReport(dto.month, dto.chatId);
  }
}
