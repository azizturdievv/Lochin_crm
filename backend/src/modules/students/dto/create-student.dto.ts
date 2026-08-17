import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsDateString,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsIn,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateParentDto {
  @IsString()
  @MaxLength(200)
  fullName: string;

  @IsString()
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone2?: string;

  @IsOptional()
  @IsString()
  relation?: string;

  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateStudentDto {
  // ── Asosiy ──────────────────────────────────────────────────────────────────
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  // Username — ixtiyoriy, avtomatik generatsiya qilinadi
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, { message: "Username faqat kichik harf, raqam va _ bo'lishi mumkin" })
  @Transform(({ value }) => (value === '' ? undefined : value))
  username?: string;

  // Email ixtiyoriy — o'quvchilar username bilan ham kira oladi
  @IsOptional()
  @IsEmail({}, { message: "Email noto'g'ri formatda" })
  @Transform(({ value }) => (value === '' ? undefined : value))
  email?: string;

  // Bo'sh string → null (unique constraint xatosini oldini oladi)
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  phone?: string;

  // Ixtiyoriy — berilmasa, 8 xonali tasodifiy raqamli parol avtomatik yaratiladi
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgi bo'lishi kerak" })
  password?: string;

  // ── Shaxsiy ──────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // ── Maktab ────────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(11)
  @Type(() => Number)
  schoolGrade?: number;

  // ── O'quv: bir yoki bir nechta guruh ─────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  groupIds?: string[];

  // Orqaga moslik uchun — bitta groupId ham qabul qilinadi
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value === '' ? undefined : value))
  enrollmentDate?: string;

  // ── Qayerdan keldi ────────────────────────────────────────────────────────────
  @IsOptional()
  @IsIn(['Instagram', 'Telegram', "Do'st", 'Walk-in', "Qo'ng'iroq", 'Boshqa'])
  @Transform(({ value }) => (value === '' ? undefined : value))
  referralSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referralPerson?: string;

  // ── Izoh ──────────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  notes?: string;

  // ── Boshqa ────────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @IsOptional()
  @IsString()
  referralStudentId?: string;

  // Ota-onalar (1-2 ta)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateParentDto)
  parents?: CreateParentDto[];
}
