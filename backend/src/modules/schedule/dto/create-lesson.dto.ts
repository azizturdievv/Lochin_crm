import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsBoolean,
  Matches,
} from 'class-validator';

// CLAUDE.md: 4 para vaqtlari
export const TIME_SLOTS = [
  { start: '08:00', end: '10:00' },
  { start: '10:05', end: '12:00' },
  { start: '14:00', end: '16:00' },
  { start: '16:05', end: '18:00' },
] as const;

// CLAUDE.md: 5 xona
export const ROOMS = [
  { number: '101', capacity: 12 },
  { number: '102', capacity: 12 },
  { number: '103', capacity: 12 },
  { number: '104', capacity: 12 },
  { number: '201', capacity: 32 },
] as const;

export type RoomNumber = '101' | '102' | '103' | '104' | '201';

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
