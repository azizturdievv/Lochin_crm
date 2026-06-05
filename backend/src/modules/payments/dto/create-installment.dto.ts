import {
  IsString,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InstallmentPartDto {
  @IsInt()
  @Min(1)
  part: number;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDateString()
  dueDate: string;
}

export class CreateInstallmentPlanDto {
  @IsString()
  studentId: string;

  @IsNumber()
  @IsPositive()
  totalAmount: number;

  @IsInt()
  @Min(2)
  @Max(4)
  partsCount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallmentPartDto)
  schedule: InstallmentPartDto[];

  @IsOptional()
  @IsString()
  description?: string;
}
