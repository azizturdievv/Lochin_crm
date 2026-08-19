import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  SubjectsController,
  MaterialsController,
  TestsController,
  HomeworkController,
  BaselineController,
} from './lms.controller';
import { SubjectsService } from './subjects.service';
import { MaterialsService } from './materials.service';
import { TestsService } from './tests.service';
import { HomeworkService } from './homework.service';
import { BaselineService } from './baseline.service';
import { MinioService } from './minio.service';
import { TestProctorGateway } from './test-proctor.gateway';
import { Subject } from '../../entities/subject.entity';
import { Group } from '../../entities/group.entity';
import { Material } from '../../entities/material.entity';
import { Test } from '../../entities/test.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { TestResult } from '../../entities/test-result.entity';
import { TestTimeExtension } from '../../entities/test-time-extension.entity';
import { Homework } from '../../entities/homework.entity';
import { HomeworkSubmission } from '../../entities/homework-submission.entity';
import { Lesson } from '../../entities/lesson.entity';
import { BaselineAssessment } from '../../entities/baseline-assessment.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { User } from '../../entities/user.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { Notification } from '../../entities/notification.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subject, Group, Material,
      Test, TestQuestion, TestResult, TestTimeExtension,
      Homework, HomeworkSubmission,
      Lesson,
      BaselineAssessment,
      Enrollment, User, PointsLog, Notification,
    ]),
    // JWT tekshirish uchun (WebSocket handshake — nazorat ishi jonli kuzatuvi)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
      }),
    }),
    AuditLogModule,
  ],
  controllers: [
    SubjectsController,
    MaterialsController,
    TestsController,
    HomeworkController,
    BaselineController,
  ],
  providers: [
    SubjectsService,
    MaterialsService,
    TestsService,
    HomeworkService,
    BaselineService,
    MinioService,
    TestProctorGateway,
  ],
  exports: [MinioService, SubjectsService],
})
export class LmsModule {}
