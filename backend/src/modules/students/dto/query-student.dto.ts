import { IsOptional, IsString, IsInt, Min, Max, IsBoolean, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryStudentDto {
  @IsOptional()
  @IsString()
  search?: string;

  // Guruh bo'yicha filter
  @IsOptional()
  @IsString()
  groupId?: string;

  // Fan bo'yicha filter
  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  // Qarzdorlar filteri
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  hasDebt?: boolean;

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

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
