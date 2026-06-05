import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController, LessonQrController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { QrService } from './qr.service';
import { Attendance } from '../../entities/attendance.entity';
import { Lesson } from '../../entities/lesson.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { Notification } from '../../entities/notification.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attendance,
      Lesson,
      Enrollment,
      User,
      Parent,
      Notification,
    ]),
    AuditLogModule,
  ],
  controllers: [AttendanceController, LessonQrController],
  providers: [AttendanceService, QrService],
  exports: [AttendanceService, QrService],
})
export class AttendanceModule {}
