import {
  IsString,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TestDifficulty } from '../../../entities/test.entity';

// Test yaratish DTO
export class CreateTestDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  subjectId: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Havzadagi savollar soni (default: 30)
  @IsOptional()
  @IsInt()
  @Min(1)
  totalQuestions?: number;

  // Ko'rsatiladigan savollar (default: 10)
  @IsOptional()
  @IsInt()
  @Min(1)
  questionsToShow?: number;

  // Vaqt limiti (daqiqada, default: 30)
  @IsOptional()
  @IsInt()
  @Min(5)
  timeLimitMinutes?: number;

  // Ball hisoblash: best | average | last
  @IsOptional()
  @IsEnum(['best', 'average', 'last'])
  scoreMethod?: string;

  // Maksimal urinishlar soni
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  // Baseline (ilk qabul) testmi?
  @IsOptional()
  @IsBoolean()
  isBaseline?: boolean;

  // Daraja tegi (Beginner, A1, B1, B2, ...) — erkin matn
  @IsOptional()
  @IsString()
  @MaxLength(50)
  level?: string;

  // Faqat shu guruhlarga ko'rinsin (bo'sh/berilmagan = fanning barcha guruhiga)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];

  // false = Nazorat ishi rejimi — natijalar SA/Manager/ustoz "ochguncha" yashirin
  @IsOptional()
  @IsBoolean()
  resultsAutoVisible?: boolean;
}

// Savol opsiyasi
export class OptionDto {
  @IsString()
  id: string;

  @IsString()
  text: string;
}

// Savol qo'shish
export class AddQuestionDto {
  @IsString()
  question: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options: OptionDto[];

  @IsString()
  correctAnswer: string;

  @IsEnum(TestDifficulty)
  difficulty: TestDifficulty;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

// Bitta savol javobini darhol tekshirish (Duolingo uslubi — ball yozmaydi)
export class CheckAnswerDto {
  @IsString()
  testResultId: string;

  @IsString()
  questionId: string;

  @IsString()
  answer: string;
}

// Test javoblarini yuborish
export class SubmitTestDto {
  @IsString()
  testResultId: string;

  // { questionId: selectedOptionId }
  @IsObject()
  answers: Record<string, string>;

  // Boshlash vaqti (anti-cheat uchun)
  @IsOptional()
  @IsString()
  startedAt?: string;

  // Har savol uchun ketgan vaqt (soniyada) — anti-cheat
  @IsOptional()
  @IsObject()
  questionTimes?: Record<string, number>;
}

// Vaqt uzaytirish so'rovi
export class TimeExtensionRequestDto {
  @IsString()
  testId: string;

  // Aynan qaysi urinishga tegishli — shu urinish yakunlanmaguncha amal qiladi
  @IsString()
  testResultId: string;

  @IsInt()
  @Min(5)
  @Max(30)
  extraMinutes: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

// Test nashr holati o'zgartirish (zanjir)
export class UpdateTestStatusDto {
  @IsEnum(['review', 'published', 'archived'])
  status: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
