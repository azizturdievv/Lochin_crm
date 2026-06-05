import { IsOptional, IsString, Matches } from 'class-validator';

export class PnlQueryDto {
  // Yillik hisobot uchun: YYYY
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  year?: string;

  // Oylik hisobot uchun: YYYY-MM
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}

export class TelegramExportDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month: string;

  // Telegram chat_id (SA profili yoki maxsus kanal)
  @IsString()
  chatId: string;
}
