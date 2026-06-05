import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController, CashSessionController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ExportService } from './export.service';
import { ReminderService } from './reminder.service';
import { Payment } from '../../entities/payment.entity';
import { InstallmentPlan } from '../../entities/installment-plan.entity';
import { CashSession } from '../../entities/cash-session.entity';
import { User } from '../../entities/user.entity';
import { Notification } from '../../entities/notification.entity';
import { Parent } from '../../entities/parent.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      InstallmentPlan,
      CashSession,
      User,
      Notification,
      Parent,
    ]),
    AuditLogModule,
  ],
  controllers: [PaymentsController, CashSessionController],
  providers: [PaymentsService, ExportService, ReminderService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
