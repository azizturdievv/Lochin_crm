import { IsString, IsOptional, IsDateString, IsEnum, MaxLength } from 'class-validator';
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
}
