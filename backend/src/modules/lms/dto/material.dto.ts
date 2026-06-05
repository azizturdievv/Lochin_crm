import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { MaterialType } from '../../../entities/material.entity';

export class CreateMaterialDto {
  @IsString()
  title: string;

  @IsEnum(MaterialType)
  type: MaterialType;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  lessonId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  // Havola uchun (type=link)
  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
