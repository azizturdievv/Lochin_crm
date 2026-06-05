import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
  Max,
  Length,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '../../../entities/event.entity';
import { ParticipantPaymentStatus } from '../../../entities/event-participant.entity';

// ─── TADBIR ──────────────────────────────────────────────────────────────────

export class CreateEventDto {
  @IsString()
  @Length(3, 300)
  title: string;

  @IsEnum(EventType)
  type: EventType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  questionCount?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  timeLimit?: number;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @Length(3, 300)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsDateString()
  registrationDeadline?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  questionCount?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  timeLimit?: number;
}

export class QueryEventDto {
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

// ─── RO'YXATDAN O'TISH ───────────────────────────────────────────────────────

export class RegisterParticipantDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(25)
  age?: number;

  @IsOptional()
  @IsEnum(ParticipantPaymentStatus)
  paymentStatus?: ParticipantPaymentStatus;
}

export class UpdateParticipantDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(25)
  age?: number;

  @IsOptional()
  @IsEnum(ParticipantPaymentStatus)
  paymentStatus?: ParticipantPaymentStatus;
}

export class QueryParticipantDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ParticipantPaymentStatus)
  paymentStatus?: ParticipantPaymentStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  permitVerified?: boolean;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}

// ─── SAVOL ───────────────────────────────────────────────────────────────────

export class OptionDto {
  @IsString()
  id: string;

  @IsString()
  text: string;
}

export class CreateQuestionDto {
  @IsString()
  question: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options: OptionDto[];

  @IsString()
  correctAnswer: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class BulkCreateQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}

// ─── JAVOB YUBORISH ───────────────────────────────────────────────────────────

export class AnswerDto {
  @IsUUID()
  questionId: string;

  @IsString()
  answer: string;
}

export class SubmitAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  timeTaken?: number;
}

// ─── SERTIFIKAT ───────────────────────────────────────────────────────────────

export class GenerateCertificatesDto {
  @IsOptional()
  @IsBoolean()
  sendNotification?: boolean = true;
}
