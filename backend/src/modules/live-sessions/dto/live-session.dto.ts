import { IsString, IsOptional, IsDateString, IsEnum, IsInt, IsBoolean, Min, Max, MaxLength } from 'class-validator';
import { LiveSessionType } from '../../../entities/live-session.entity';

export class CreateLiveSessionDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsEnum(LiveSessionType)
  type: LiveSessionType;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsDateString()
  scheduledAt: string;

  // Berilmasa — xona turiga (teacher_student + guruh bo'lsa guruh sig'imiga) qarab avtomatik tanlanadi
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  maxParticipants?: number;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;
}

// Faqat status=scheduled bo'lganda ishlatiladi. groupId qasddan yo'q —
// guruhni o'zgartirish "bu boshqa sessiya" degani, bekor qilib qayta
// yaratish aniqroq yo'l
export class UpdateLiveSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsEnum(LiveSessionType)
  type?: LiveSessionType;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(1000)
  maxParticipants?: number;

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;
}

export class CancelLiveSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
