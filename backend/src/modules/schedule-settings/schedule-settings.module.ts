import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleTimeSlot } from '../../entities/schedule-time-slot.entity';
import { Room } from '../../entities/room.entity';
import { ScheduleSettingsService } from './schedule-settings.service';
import { TimeSlotController, RoomController } from './schedule-settings.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduleTimeSlot, Room]),
    AuditLogModule,
  ],
  controllers: [TimeSlotController, RoomController],
  providers: [ScheduleSettingsService],
  exports: [ScheduleSettingsService],
})
export class ScheduleSettingsModule {}
