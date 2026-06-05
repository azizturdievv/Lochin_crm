import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  IsArray,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  IsObject,
} from 'class-validator';
import { PointsAction } from '../../../entities/points-log.entity';

// Qo'lda ball berish (SA/Manager)
export class AwardPointsDto {
  @IsUUID()
  userId: string;

  @IsEnum(PointsAction)
  action: PointsAction;

  @IsInt()
  @Min(-500)
  @Max(500)
  points: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;
}

// Kitob yaratish (SA)
export class CreateBookDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// Kitob oyga tayinlash
export class AssignBookDto {
  @IsString()
  month: string; // YYYY-MM
}

// Kitob testi javoblarini topshirish
export class SubmitBookTestDto {
  // { questionIndex: selectedOption }
  @IsObject()
  answers: Record<string, string>;
}

// Lug'at so'z qo'shish
export class AddWordDto {
  @IsString()
  @MaxLength(200)
  word: string;

  @IsOptional()
  @IsString()
  userDefinition?: string;

  @IsOptional()
  @IsString()
  language?: string; // uz, en, ru
}

// Haftalik lug'at testi javoblari
export class SubmitVocabTestDto {
  // { wordId: guessedDefinitionWordId }
  @IsObject()
  answers: Record<string, string>;
}

// Oylik mukofot berish
export class AwardMonthlyRewardDto {
  @IsString()
  month: string; // YYYY-MM
}

// Leaderboard so'rovi
export class LeaderboardQueryDto {
  @IsOptional()
  @IsString()
  period?: 'weekly' | 'monthly' | 'all'; // default: monthly

  @IsOptional()
  @IsString()
  role?: 'student' | 'staff'; // default: student

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(100)
  limit?: number; // default: 10
}
