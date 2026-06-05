import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { Lead } from '../../entities/lead.entity';
import { LeadNote } from '../../entities/lead-note.entity';
import { User } from '../../entities/user.entity';
import { Notification } from '../../entities/notification.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, LeadNote, User, Notification]),
    AuditLogModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
