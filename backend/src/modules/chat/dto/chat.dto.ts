import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ChatRoomType } from '../../../entities/chat-room.entity';
import { MessageType } from '../../../entities/message.entity';

// Xona yaratish
export class CreateRoomDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsEnum(ChatRoomType)
  type: ChatRoomType;

  // Guruh sinfxonasi uchun
  @IsOptional()
  @IsUUID()
  groupId?: string;

  // Shaxsiy chat: ikkinchi foydalanuvchi
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  // Dastlabki a'zolar
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds?: string[];
}

// REST orqali xabar yuborish
export class SendMessageDto {
  @IsUUID()
  roomId: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  // Audio/video uchun
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}

// Video xabar yuborish (Circle, 30-60 sek)
export class SendVideoMessageDto {
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsInt()
  @Min(30)
  @Max(60)
  durationSeconds: number;
}

// Xabarlari so'rovi
export class QueryMessagesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  // Bundan oldingi xabarlar (pagination cursor)
  @IsOptional()
  @IsString()
  before?: string;
}

// A'zo qo'shish
export class AddMemberDto {
  @IsUUID()
  userId: string;
}
