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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { ExportService } from './export.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateInstallmentPlanDto } from './dto/create-installment.dto';
import { OpenCashSessionDto, CloseCashSessionDto } from './dto/cash-session.dto';
import { QueryPaymentDto, QueryDebtorsDto } from './dto/query-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly exportService: ExportService,
  ) {}

  // ─── TO'LOVLAR ─────────────────────────────────────────────────────────
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.paymentsService.create(dto, user.id, user.role);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findAll(@Query() query: QueryPaymentDto, @CurrentUser() user: User) {
    return this.paymentsService.findAll(query, user.id, user.role);
  }

  @Get('report')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getReport(@Query('month') month: string) {
    const m = month ?? getCurrentMonth();
    return this.paymentsService.getReport(m);
  }

  @Get('debtors')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getDebtors(@Query() query: QueryDebtorsDto) {
    return this.paymentsService.getDebtors(query);
  }

  @Get('export/excel')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  async exportExcel(
    @Query('month') month: string,
    @Query('type') type: string,
    @Res() res: Response,
  ) {
    const m = month ?? getCurrentMonth();
    let buffer: Buffer;
    let filename: string;

    if (type === 'debtors') {
      buffer = await this.exportService.exportDebtorsToExcel(m);
      filename = `qarzdorlar-${m}.xlsx`;
    } else {
      buffer = await this.exportService.exportPaymentsToExcel(m);
      filename = `tolovlar-${m}.xlsx`;
    }

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('export/pdf')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  async exportPdf(@Query('month') month: string, @Res() res: Response) {
    const m = month ?? getCurrentMonth();
    const buffer = await this.exportService.exportPaymentsToPdf(m);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tolovlar-${m}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findOne(id);
  }

  @Get(':id/receipt')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getReceiptData(id);
  }

  @Patch(':id/print')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  markPrinted(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.markReceiptPrinted(id, user.id);
  }

  // ─── MUDDATLI TO'LOV ───────────────────────────────────────────────────
  @Post('installments')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  createInstallment(
    @Body() dto: CreateInstallmentPlanDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.createInstallmentPlan(dto, user.id, user.role);
  }

  @Get('installments/:id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getInstallment(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.getInstallmentPlan(id);
  }
}

// ─── SMENA (CASH SESSION) ────────────────────────────────────────────────────
import { Controller as Ctrl } from '@nestjs/common';

@UseGuards(JwtAuthGuard, RolesGuard)
@Ctrl('api/v1/cash-sessions')
export class CashSessionController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('open')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  open(@Body() dto: OpenCashSessionDto, @CurrentUser() user: User) {
    return this.paymentsService.openCashSession(dto, user.id, user.role);
  }

  @Patch(':id/close')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseCashSessionDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.closeCashSession(id, dto, user.id, user.role);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findAll(@CurrentUser() user: User) {
    return this.paymentsService.getCashSessions(user.id, user.role);
  }

  @Get('active')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getOpen(@CurrentUser() user: User) {
    return this.paymentsService.getOpenSession(user.id);
  }
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
