import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  MaxLength,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHomeworkDto {
  @IsString()
  lessonId: string;

  @IsString()
  groupId: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxScore?: number;
}

export class SubmitHomeworkDto {
  @IsString()
  homeworkId: string;

  @IsOptional()
  @IsString()
  content?: string;
  // fileUrls fayl yuklashdan keyin qo'shiladi
}

export class GradeHomeworkDto {
  @IsString()
  submissionId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;

  @IsOptional()
  @IsString()
  teacherComment?: string;
}
