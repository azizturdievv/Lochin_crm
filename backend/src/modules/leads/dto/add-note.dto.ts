import { IsString, MinLength, MaxLength } from 'class-validator';

export class AddNoteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  content: string;
}
