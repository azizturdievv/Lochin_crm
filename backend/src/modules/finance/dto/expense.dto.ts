import {
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ExpenseCategory } from '../../../entities/expense.entity';

export class CreateExpenseDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsInt()
  @Min(1)
  amount: number;

  @IsDateString()
  expenseDate: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Faqat SA ko'rishi uchun (ish haqi kabi maxfiy xarajatlar)
  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isConfidential?: boolean;
}

export class QueryExpenseDto {
  // YYYY-MM formatida
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;
}
