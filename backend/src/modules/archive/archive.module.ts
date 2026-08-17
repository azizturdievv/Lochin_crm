import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';
import { User } from '../../entities/user.entity';
import { Group } from '../../entities/group.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Group]),
    AuditLogModule,
  ],
  controllers: [ArchiveController],
  providers: [ArchiveService],
})
export class ArchiveModule {}
