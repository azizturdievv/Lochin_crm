import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum ArchiveEntityType {
  STUDENT = 'student',
  TEACHER = 'teacher',
  MANAGER = 'manager',
  GROUP = 'group',
}

export class QueryArchiveDto {
  @IsEnum(ArchiveEntityType, { message: 'entityType noto\'g\'ri' })
  entityType: ArchiveEntityType;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
