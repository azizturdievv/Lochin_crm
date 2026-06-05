import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubstitutionController } from './substitution.controller';
import { SubstitutionService } from './substitution.service';
import { LessonSubstitution } from '../../entities/lesson-substitution.entity';
import { TeacherAbsence } from '../../entities/teacher-absence.entity';
import { Lesson } from '../../entities/lesson.entity';
import { User } from '../../entities/user.entity';
import { Salary } from '../../entities/salary.entity';
import { SalaryRecord } from '../../entities/salary-record.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { Notification } from '../../entities/notification.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonSubstitution,
      TeacherAbsence,
      Lesson,
      User,
      Salary,
      SalaryRecord,
      Enrollment,
      Group,
      Notification,
    ]),
    NotificationsModule,
    AuditLogModule,
  ],
  controllers: [SubstitutionController],
  providers: [SubstitutionService],
  exports: [SubstitutionService],
})
export class SubstitutionModule {}
