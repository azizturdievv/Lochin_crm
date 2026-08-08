import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsEnum,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class MatrixChangeDto {
  @IsEnum(Role)
  role: Role;

  @IsUUID()
  permissionId: string;

  @IsBoolean()
  granted: boolean;
}

export class UpdateMatrixDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MatrixChangeDto)
  changes: MatrixChangeDto[];
}
