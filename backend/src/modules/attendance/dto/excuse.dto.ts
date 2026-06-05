import { IsString, MinLength, IsOptional } from 'class-validator';

// Ota-ona sabab kiritishi
export class SubmitExcuseDto {
  @IsString()
  @MinLength(10, { message: 'Sabab kamida 10 belgi bo\'lishi kerak' })
  reason: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}
