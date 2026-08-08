import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { Group } from '../../entities/group.entity';
import { Subject } from '../../entities/subject.entity';
import { User } from '../../entities/user.entity';
import { ChatRoom } from '../../entities/chat-room.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Group, Subject, User, ChatRoom, Enrollment]),
    AuditLogModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
