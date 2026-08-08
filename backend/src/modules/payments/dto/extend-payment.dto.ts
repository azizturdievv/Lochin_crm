import { IsDateString, IsString, MinLength } from 'class-validator';

export class ExtendPaymentDto {
  @IsDateString()
  until: string;

  @IsString()
  @MinLength(5)
  reason: string;
}
