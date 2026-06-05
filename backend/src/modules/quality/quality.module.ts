import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpellingError } from '../../entities/spelling-error.entity';
import { Message } from '../../entities/message.entity';
import { User } from '../../entities/user.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { ProgressSnapshot } from '../../entities/progress-snapshot.entity';
import { BaselineAssessment } from '../../entities/baseline-assessment.entity';
import { TestResult } from '../../entities/test-result.entity';
import { Attendance } from '../../entities/attendance.entity';
import { HomeworkSubmission } from '../../entities/homework-submission.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { QualityController } from './quality.controller';
import { QualityService } from './quality.service';
import { SpellingService } from './spelling.service';
import { GrowthService } from './growth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpellingError,
      Message,
      User,
      PointsLog,
      ProgressSnapshot,
      BaselineAssessment,
      TestResult,
      Attendance,
      HomeworkSubmission,
      Enrollment,
      Group,
    ]),
  ],
  controllers: [QualityController],
  providers: [QualityService, SpellingService, GrowthService],
  exports: [SpellingService],
})
export class QualityModule {}
