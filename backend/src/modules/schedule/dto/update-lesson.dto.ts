import { IsString, IsDateString, IsOptional, IsEnum, Matches } from 'class-validator';
import { LessonStatus } from '../../../entities/lesson.entity';

// Drag & drop uchun: faqat o'zgargan maydonlar yuboriladi
export class UpdateLessonDto {
  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsDateString()
  lessonDate?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Vaqt HH:MM formatida bo\'lishi kerak' })
  startTime?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Vaqt HH:MM formatida bo\'lishi kerak' })
  endTime?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;
}
