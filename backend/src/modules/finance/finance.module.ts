import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { SalaryService } from './salary.service';
import { ExpenseService } from './expense.service';
import { Payment } from '../../entities/payment.entity';
import { Expense } from '../../entities/expense.entity';
import { Salary } from '../../entities/salary.entity';
import { SalaryRecord } from '../../entities/salary-record.entity';
import { User } from '../../entities/user.entity';
import { Lesson } from '../../entities/lesson.entity';
import { Group } from '../../entities/group.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { LessonSubstitution } from '../../entities/lesson-substitution.entity';
import { Sale } from '../../entities/sale.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Expense,
      Salary,
      SalaryRecord,
      User,
      Lesson,
      Group,
      Enrollment,
      LessonSubstitution,
      Sale,
      PointsLog,
    ]),
    AuditLogModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService, SalaryService, ExpenseService],
  exports: [FinanceService, SalaryService],
})
export class FinanceModule {}
