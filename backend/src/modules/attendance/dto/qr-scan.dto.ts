import { IsString, IsOptional } from 'class-validator';

export class QrScanDto {
  // QR kodda kodlangan ma'lumot
  @IsString()
  qrPayload: string;

  // Mobil qurilma ID (offline sinxronizatsiya uchun)
  @IsOptional()
  @IsString()
  deviceId?: string;
}
