import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ModerationService } from './moderation.service';
import { MinioService } from '../lms/minio.service';
import { ChatRoom } from '../../entities/chat-room.entity';
import { Message } from '../../entities/message.entity';
import { VideoMessage } from '../../entities/video-message.entity';
import { User } from '../../entities/user.entity';
import { Group } from '../../entities/group.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoom,
      Message,
      VideoMessage,
      User,
      Group,
      Enrollment,
    ]),

    // JWT tekshirish uchun (WebSocket handshake)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
      }),
    }),

    AuditLogModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    ModerationService,
    MinioService,
  ],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
