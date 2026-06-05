import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './notification.service';
import { TriggerService } from './trigger.service';
import { BotService } from './bot.service';
import { SmsService } from './channels/sms.service';
import { TelegramService } from './channels/telegram.service';
import { PushService } from './channels/push.service';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, Parent]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    TriggerService,
    BotService,
    SmsService,
    TelegramService,
    PushService,
  ],
  exports: [NotificationService, TriggerService, SmsService, TelegramService, PushService],
})
export class NotificationsModule {}
