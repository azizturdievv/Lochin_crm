import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LiveSessionsController } from './live-sessions.controller';
import { LiveSessionsService } from './live-sessions.service';
import { LivekitService } from './livekit.service';
import { LiveSession } from '../../entities/live-session.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LiveSession, Enrollment, Group]),
    AuditLogModule,
  ],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService, LivekitService],
})
export class LiveSessionsModule {}
