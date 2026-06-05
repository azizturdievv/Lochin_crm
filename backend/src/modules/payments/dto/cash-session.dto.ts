import { IsNumber, IsOptional, IsString, Min, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { CashBreakdownDto } from './create-payment.dto';

export class OpenCashSessionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingBalance: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseCashSessionDto {
  // Kassir hisoblagan faktik qoldiq
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingBalance: number;

  // Kupyura bo'yicha hisoblash
  @IsOptional()
  @IsObject()
  @Type(() => CashBreakdownDto)
  cashBreakdown?: CashBreakdownDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
