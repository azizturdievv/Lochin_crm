import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  IsInt,
  IsPositive,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, PaymentType } from '../../../entities/payment.entity';

// Naqd kupyura tarkibi
export class CashBreakdownDto {
  @IsOptional() @IsInt() @Min(0) '200000'?: number;
  @IsOptional() @IsInt() @Min(0) '100000'?: number;
  @IsOptional() @IsInt() @Min(0) '50000'?: number;
  @IsOptional() @IsInt() @Min(0) '10000'?: number;
  @IsOptional() @IsInt() @Min(0) '5000'?: number;
}

export class CreatePaymentDto {
  @IsString()
  studentId: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'Summa musbat bo\'lishi kerak' })
  amount: number;

  @IsEnum(PaymentMethod, { message: 'To\'lov usuli noto\'g\'ri' })
  method: PaymentMethod;

  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  // To'lov oyi: YYYY-MM
  @IsOptional()
  @IsString()
  paymentMonth?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Aralash to'lov
  @ValidateIf((o: CreatePaymentDto) => o.method === PaymentMethod.MIXED)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashAmount?: number;

  @ValidateIf((o: CreatePaymentDto) => o.method === PaymentMethod.MIXED)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cardAmount?: number;

  // Naqd kupyura tarkibi
  @IsOptional()
  @IsObject()
  @Type(() => CashBreakdownDto)
  cashBreakdown?: CashBreakdownDto;

  // Smena ID (kassir smena ochgan bo'lsa)
  @IsOptional()
  @IsString()
  cashSessionId?: string;

  // Muddatli to'lov rejasi ID va qism raqami
  @IsOptional()
  @IsString()
  installmentPlanId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  installmentPart?: number;

  // Termal printer chop etish
  @IsOptional()
  @IsBoolean()
  printReceipt?: boolean;
}
