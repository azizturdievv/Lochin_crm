import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryInstallmentDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)
  isCompleted?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
