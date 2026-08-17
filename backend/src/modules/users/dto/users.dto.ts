import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '../../../common/enums/role.enum';

// Faqat xodim rollari (student qo'shilmaydi)
const STAFF_ROLES = [Role.MANAGER, Role.USTOZ] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

export class CreateUserDto {
  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (value === '' ? undefined : value?.toLowerCase().trim()))
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
  password: string;

  @IsEnum([Role.MANAGER, Role.USTOZ], {
    message: 'Rol manager yoki ustoz bo\'lishi kerak',
  })
  role: StaffRole;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEnum([Role.MANAGER, Role.USTOZ], {
    message: 'Rol manager yoki ustoz bo\'lishi kerak',
  })
  role?: StaffRole;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;
}

export class QueryUserDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum([Role.MANAGER, Role.USTOZ])
  role?: StaffRole;

  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === 'true' || obj[key] === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 20)
  limit?: number = 20;
}

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 ta belgi bo\'lishi kerak' })
  newPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, { message: "Username faqat kichik harf, raqam va _ bo'lishi mumkin" })
  username?: string;
}

// Foydalanuvchi o'z profilini yangilashi uchun
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  // Username (o'quvchilar va boshqalar uchun)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, { message: "Username faqat kichik harf, raqam va _ bo'lishi mumkin" })
  username?: string;

  // Email ixtiyoriy
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => (value === '' ? undefined : value?.toLowerCase().trim()))
  email?: string;

  // Xodimlar uchun (ustoz/manager)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}

// O'z parolini o'zgartirish uchun
export class ChangeOwnPasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(8, { message: 'Yangi parol kamida 8 belgi bo\'lishi kerak' })
  newPassword: string;
}
