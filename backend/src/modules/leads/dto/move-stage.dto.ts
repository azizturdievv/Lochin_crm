import { IsEnum, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';
import { LeadStage } from '../../../entities/lead.entity';

export class MoveStageDto {
  @IsEnum(LeadStage, { message: 'Bosqich noto\'g\'ri' })
  stage: LeadStage;

  // Yo'qotildi sababini yozish
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lostReason?: string;

  // Sinov darsi sanasini belgilash
  @IsOptional()
  @IsDateString()
  trialDate?: string;

  // Izoh (faoliyat tarixiga qo'shiladi)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
