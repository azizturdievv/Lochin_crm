import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AssessmentType } from '../../../entities/baseline-assessment.entity';

export class CreateBaselineDto {
  @IsString()
  studentId: string;

  @IsString()
  subjectId: string;

  @IsEnum(AssessmentType)
  type: AssessmentType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  // Ustoz bahosi (og'zaki/ijodiy uchun)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  teacherScore?: number;

  @IsOptional()
  @IsString()
  teacherNotes?: string;

  // Sport ko'rsatkichlari — multipart/form-data orqali JSON-string sifatida keladi
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string' || value === '') return value;
    try { return JSON.parse(value); } catch { return value; }
  })
  @IsObject()
  sportData?: Record<string, number>;
}
