import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { Payment } from '../../entities/payment.entity';
import { Attendance } from '../../entities/attendance.entity';
import { TestResult } from '../../entities/test-result.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Parent,
      Enrollment,
      Group,
      Payment,
      Attendance,
      TestResult,
      PointsLog,
    ]),
    AuditLogModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
