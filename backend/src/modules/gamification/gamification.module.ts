import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamificationController } from './gamification.controller';
import { PointsService } from './points.service';
import { BadgeService } from './badge.service';
import { BookService } from './book.service';
import { VocabularyService } from './vocabulary.service';
import { LeaderboardService } from './leaderboard.service';
import { AiService } from './ai.service';
import { PointsLog } from '../../entities/points-log.entity';
import { Badge } from '../../entities/badge.entity';
import { Book } from '../../entities/book.entity';
import { BookTest } from '../../entities/book-test.entity';
import { VocabularyWord } from '../../entities/vocabulary-word.entity';
import { ProgressSnapshot } from '../../entities/progress-snapshot.entity';
import { User } from '../../entities/user.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointsLog,
      Badge,
      Book,
      BookTest,
      VocabularyWord,
      ProgressSnapshot,
      User,
      Enrollment,
    ]),
    NotificationsModule,
    AuditLogModule,
  ],
  controllers: [GamificationController],
  providers: [
    AiService,
    PointsService,
    BadgeService,
    BookService,
    VocabularyService,
    LeaderboardService,
  ],
  exports: [PointsService, BadgeService],
})
export class GamificationModule {}
