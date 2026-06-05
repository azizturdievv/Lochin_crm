import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LeadStage, LeadSource } from '../../../entities/lead.entity';

export class QueryLeadDto {
  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // Qidiruv: ism, telefon, email
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Faqat 15 daqiqa javob olmaganlar
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  alertOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class ConversionQueryDto {
  // Tahlil oyi: YYYY-MM
  @IsOptional()
  @IsString()
  month?: string;

  // Yil: YYYY
  @IsOptional()
  @IsString()
  year?: string;
}
