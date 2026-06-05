import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { NotificationType } from '../../../entities/notification.entity';
import { Role } from '../../../common/enums/role.enum';

export class SendNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  body: string;

  // Muayyan foydalanuvchilar ro'yxati
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  // Rol bo'yicha yuborish (userIds ko'rsatilmasa)
  @IsOptional()
  @IsEnum(Role)
  targetRole?: Role;

  // Barcha faol foydalanuvchilarga
  @IsOptional()
  @IsBoolean()
  sendToAll?: boolean;

  // Ota-onalarga ham yuborsin (o'quvchi ID berilganda)
  @IsOptional()
  @IsBoolean()
  notifyParents?: boolean;

  // Kanallarni o'chirish imkoni
  @IsOptional()
  @IsBoolean()
  skipSms?: boolean;

  @IsOptional()
  @IsBoolean()
  skipTelegram?: boolean;

  @IsOptional()
  @IsBoolean()
  skipPush?: boolean;
}

export class RegisterFcmTokenDto {
  @IsString()
  fcmToken: string;
}

export class SetupWebhookDto {
  @IsString()
  webhookUrl: string;

  @IsOptional()
  @IsString()
  secretToken?: string;
}
