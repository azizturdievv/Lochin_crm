import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

export class CreateLessonDto {
  @IsString()
  groupId: string;

  @IsString()
  teacherId: string;

  @IsDateString()
  lessonDate: string;

  // HH:MM formatida
  @Matches(/^\d{2}:\d{2}$/, { message: 'Vaqt HH:MM formatida bo\'lishi kerak' })
  startTime: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'Vaqt HH:MM formatida bo\'lishi kerak' })
  endTime: string;

  @IsString()
  roomNumber: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Takroriy darslar: har hafta shu vaqtda dars qo'shish
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  // Takroriy bo'lsa nechi hafta (default: 12)
  @IsOptional()
  recurringWeeks?: number;
}
