import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { LeadSource } from '../../../entities/lead.entity';

export class CreateLeadDto {
  @IsString()
  @MaxLength(200)
  fullName: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  // Qiziqtirgan fan
  @IsOptional()
  @IsString()
  interestedSubject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // Kim tayinlansin (manager ID)
  @IsOptional()
  @IsString()
  assignedToId?: string;

  // Instagram DM / Telegram username va h.k.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  channelUsername?: string;
}
