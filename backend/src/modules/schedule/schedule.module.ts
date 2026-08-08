import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { Lesson } from '../../entities/lesson.entity';
import { Group } from '../../entities/group.entity';
import { User } from '../../entities/user.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { Payment } from '../../entities/payment.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ScheduleSettingsModule } from '../schedule-settings/schedule-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lesson, Group, User, Enrollment, Payment]),
    AuditLogModule,
    AttendanceModule, // QrService uchun
    ScheduleSettingsModule, // Xona/para ro'yxati uchun
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
