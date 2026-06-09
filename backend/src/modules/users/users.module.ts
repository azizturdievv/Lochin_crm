import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from '../../entities/user.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { Attendance } from '../../entities/attendance.entity';
import { Payment } from '../../entities/payment.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { Group } from '../../entities/group.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { LmsModule } from '../lms/lms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Enrollment, Attendance, Payment, PointsLog, Group]),
    AuditLogModule,
    LmsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
