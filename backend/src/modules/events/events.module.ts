import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../../entities/event.entity';
import { EventParticipant } from '../../entities/event-participant.entity';
import { EventQuestion } from '../../entities/event-question.entity';
import { EventSubmission } from '../../entities/event-submission.entity';
import { Certificate } from '../../entities/certificate.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PermitService } from './permit.service';
import { CompetitionService } from './competition.service';
import { CertificateService } from './certificate.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LmsModule } from '../lms/lms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event,
      EventParticipant,
      EventQuestion,
      EventSubmission,
      Certificate,
    ]),
    AuditLogModule,
    NotificationsModule,
    LmsModule,        // MinioService uchun
  ],
  controllers: [EventsController],
  providers: [EventsService, PermitService, CompetitionService, CertificateService],
  exports: [EventsService, CertificateService],
})
export class EventsModule {}
