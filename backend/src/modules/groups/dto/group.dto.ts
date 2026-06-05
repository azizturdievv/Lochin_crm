import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// Guruh yaratish
export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  subjectId: string;

  @IsUUID()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  roomNumber?: string;

  // Dars boshlanish vaqti: "08:00"
  @IsString()
  @IsOptional()
  lessonStartTime?: string;

  // Dars tugash vaqti: "10:00"
  @IsString()
  @IsOptional()
  lessonEndTime?: string;

  // Dars kunlari: ["monday","wednesday","friday"]
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  lessonDays?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  monthlyPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  maxStudents?: number;
}

// Guruh yangilash — barcha maydonlar ixtiyoriy
export class UpdateGroupDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @IsUUID()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  roomNumber?: string;

  @IsString()
  @IsOptional()
  lessonStartTime?: string;

  @IsString()
  @IsOptional()
  lessonEndTime?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  lessonDays?: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  monthlyPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  maxStudents?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

// So'rov parametrlari
export class QueryGroupDto {
  @IsOptional()
  subjectId?: string;

  @IsOptional()
  teacherId?: string;

  @IsOptional()
  isActive?: string;

  @IsOptional()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
