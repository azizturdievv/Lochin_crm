import { IsString, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  // Email yoki username qabul qiladi
  @IsString({ message: 'Email yoki username kiritilmagan' })
  identifier: string;

  @IsString()
  @MinLength(8, { message: 'Parol kamida 8 belgi bo\'lishi kerak' })
  password: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

export class Verify2faDto {
  @IsString({ message: 'Foydalanuvchi ID kiritilmagan' })
  userId: string;

  @IsString({ message: '2FA kodi kiritilmagan' })
  code: string;
}

export class RefreshTokenDto {
  @IsString({ message: 'Refresh token kiritilmagan' })
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword: string;

  @IsString()
  @MinLength(8, { message: 'Yangi parol kamida 8 belgi bo\'lishi kerak' })
  newPassword: string;
}
