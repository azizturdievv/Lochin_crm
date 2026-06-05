import { IsString, IsOptional, IsDateString, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum QualityPeriod {
  WEEK   = 'week',
  MONTH  = 'month',
  QUARTER= 'quarter',
}

export class QueryQualityDto {
  @IsOptional()
  @IsEnum(QualityPeriod)
  period?: QualityPeriod = QualityPeriod.MONTH;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class QueryStaffSpellingDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsEnum(QualityPeriod)
  period?: QualityPeriod = QualityPeriod.MONTH;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

export class CheckSpellingDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsUUID()
  messageId?: string;
}

export class MarkCorrectedDto {
  @IsUUID()
  errorId: string;
}

export class QueryGrowthDto {
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  // Grafik uchun interval: haftalik yoki oylik
  @IsOptional()
  @IsEnum({ weekly: 'weekly', monthly: 'monthly' })
  interval?: 'weekly' | 'monthly' = 'monthly';
}
