import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsDateString,
  IsUUID,
  IsInt,
  Matches,
} from 'class-validator';

// Ish haqi konfiguratsiyasi (SA tomonidan belgilanadi)
export class SetSalaryDto {
  @IsUUID()
  teacherId: string;

  // Ustoz uchun: tushum foizi 15-18%; admin uchun 0 qo'yish mumkin
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  kpiBonusPercent?: number;

  // Manager/admin uchun soatlik stavka (so'mda)
  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyRate?: number;

  // Savdo bonusi foizi (admin uchun mini-market savdosidan)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  salesBonusPercent?: number;

  // O'zi qabul qilgan to'lovlar summasidan foiz (admin/manager KPI)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  paymentBonusPercent?: number;

  // Unga biriktirilgan har bir o'quvchiga aylangan lid uchun so'mda bonus (manager KPI)
  @IsOptional()
  @IsInt()
  @Min(0)
  leadBonusAmount?: number;

  @IsDateString()
  startedAt: string;
}

// Oylik maosh hisoblash parametrlari
export class CalculateSalaryDto {
  // YYYY-MM formatida
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  periodMonth: string;

  // Ko'rsatilmasa, barcha faol xodimlar uchun hisoblanadi
  @IsOptional()
  @IsUUID()
  teacherId?: string;
}

// Chorak mukofot parametrlari
export class QuarterlyBonusQueryDto {
  @IsString()
  @Matches(/^\d{4}$/)
  year: string;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter: number;

  // Bir ball uchun so'mdagi koeffitsient (default: 5000 so'm)
  @IsOptional()
  @IsInt()
  @Min(1)
  coefficientPerPoint?: number;
}
