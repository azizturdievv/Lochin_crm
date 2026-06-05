import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export class WeekQueryDto {
  // Hafta boshlanish sanasi (default: joriy hafta Dushanba)
  @IsOptional()
  @IsDateString()
  weekStart?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  roomNumber?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class FreeSlotsQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  // Nechta o'quvchi sig'ishi kerak
  @IsOptional()
  minCapacity?: number;
}

export class ConflictCheckDto {
  @IsDateString()
  lessonDate: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsString()
  roomNumber: string;

  @IsString()
  teacherId: string;

  // Mavjud dars ID (yangilashda o'zini chetlab o'tish uchun)
  @IsOptional()
  @IsString()
  excludeLessonId?: string;
}

export class AnalysisQueryDto {
  // Tahlil oyi: YYYY-MM
  @IsOptional()
  @IsString()
  month?: string;
}
