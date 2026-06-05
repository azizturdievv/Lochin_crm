import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { AbsenceReason } from '../../../entities/lesson-substitution.entity';

// O'rinbosar tayinlash (5-qadam jarayoni boshlanadi)
export class CreateSubstitutionDto {
  // Qadam 1: Dars tanlash
  @IsUUID()
  lessonId: string;

  // Qadam 2: O'rinbosar + sabab
  @IsUUID()
  substituteTeacherId: string;

  @IsEnum(AbsenceReason)
  reason: AbsenceReason;

  @IsOptional()
  @IsString()
  notes?: string;

  // Sabab hujjati (kasallik varag'i va h.k.)
  @IsOptional()
  @IsString()
  documentUrl?: string;
}

// O'rinbosar darsni yakunlash
export class CompleteSubstitutionDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

// Ustoz bo'yicha so'rov parametrlari
export class QuerySubstitutionDto {
  // Muayyan sana oralig'i
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  // Faqat o'rinbosar sifatida yoki asl o'qituvchi sifatida
  @IsOptional()
  @IsString()
  role?: 'as_substitute' | 'as_original' | 'both';
}
