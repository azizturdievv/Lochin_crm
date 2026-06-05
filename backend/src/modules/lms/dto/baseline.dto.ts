import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
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

  // Sport ko'rsatkichlari
  @IsOptional()
  @IsObject()
  sportData?: Record<string, number>;
}
