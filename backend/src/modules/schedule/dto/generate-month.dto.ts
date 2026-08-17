import { IsOptional, IsString, Matches } from 'class-validator';

// Guruh pattern (lessonDays/lessonTime/roomNumber) asosida bir oylik
// darslarni avtomatik generatsiya qilish uchun
export class GenerateMonthScheduleDto {
  // Berilmasa — pattern to'liq sozlangan barcha faol guruhlar uchun
  @IsOptional()
  @IsString()
  groupId?: string;

  // "YYYY-MM"
  @Matches(/^\d{4}-\d{2}$/, { message: 'Oy YYYY-MM formatida bo\'lishi kerak' })
  month: string;
}
