import {
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '../../../entities/attendance.entity';

export class OfflineRecordDto {
  @IsString()
  lessonId: string;

  @IsString()
  studentId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsDateString()
  scannedAt: string;

  // Offline da saqlangan qrPayload — server validatsiya qiladi
  @IsOptional()
  @IsString()
  qrPayload?: string;

  // Qurilma tomonidan generatsiya qilingan unikal ID (duplikat oldini olish)
  @IsString()
  localId: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class OfflineSyncDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineRecordDto)
  records: OfflineRecordDto[];
}
