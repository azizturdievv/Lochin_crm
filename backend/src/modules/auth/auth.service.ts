import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import { User } from '../../entities/user.entity';
import { Session } from '../../entities/session.entity';
import { Role } from '../../common/enums/role.enum';
import { LoginDto, Verify2faDto, RefreshTokenDto } from './dto/login.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class AuthService {
  private readonly maxAttempts: number;
  private readonly blockMinutes: number;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) {
    this.maxAttempts = parseInt(
      configService.get('BRUTE_FORCE_MAX_ATTEMPTS', '5'),
    );
    this.blockMinutes = parseInt(
      configService.get('BRUTE_FORCE_BLOCK_MINUTES', '30'),
    );
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    // Email yoki username bo'yicha qidirish
    const user = await this.userRepository.findOne({
      where: [
        { email: dto.identifier, isActive: true },
        { username: dto.identifier, isActive: true },
      ],
    });

    // Xavfsizlik: user topilmasa ham bir xil xato
    if (!user) {
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    // Bloklangan hisobni tekshirish
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Hisob bloklangan. ${minutesLeft} daqiqadan keyin urinib ko'ring`,
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }

    // Muvaffaqiyatli kirish — urinishlarni tozalash
    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    // SA va Manager uchun 2FA MAJBURIY
    if (
      (user.role === Role.SUPER_ADMIN || user.role === Role.MANAGER) &&
      user.twoFaEnabled
    ) {
      await this.auditLogService.log({
        userId: user.id,
        userRole: user.role,
        userEmail: user.email ?? user.username ?? undefined,
        action: 'LOGIN_2FA_REQUIRED',
        ipAddress,
        userAgent,
      });

      return {
        requiresTwoFa: true,
        userId: user.id,
        message: '2FA kodi kiritilishi kerak',
      };
    }

    return this.generateTokens(user, dto.deviceInfo, ipAddress, userAgent);
  }

  async verify2fa(dto: Verify2faDto, ipAddress?: string, userAgent?: string) {
    const user = await this.userRepository.findOne({
      where: { id: dto.userId, isActive: true },
    });

    if (!user || !user.twoFaSecret) {
      throw new NotFoundException('Foydalanuvchi topilmadi yoki 2FA sozlanmagan');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFaSecret,
      encoding: 'base32',
      token: dto.code,
      window: 1,
    });

    if (!isValid) {
      await this.auditLogService.log({
        userId: user.id,
        userRole: user.role,
        userEmail: user.email,
        action: 'LOGIN_2FA_FAILED',
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('2FA kodi noto\'g\'ri');
    }

    return this.generateTokens(user, undefined, ipAddress, userAgent);
  }

  async refreshToken(dto: RefreshTokenDto) {
    const session = await this.sessionRepository.findOne({
      where: { refreshToken: dto.refreshToken, isActive: true },
      relations: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token yaroqsiz yoki muddati o\'tgan');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('Hisob faol emas');
    }

    const payload = {
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }

  async logout(sessionId: string, userId: string) {
    await this.sessionRepository.update(
      { id: sessionId, userId },
      { isActive: false },
    );

    await this.auditLogService.log({
      userId,
      action: 'LOGOUT',
      entityName: 'sessions',
      entityId: sessionId,
    });
  }

  async setup2fa(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    const secret = speakeasy.generateSecret({
      name: `${this.configService.get('TWO_FA_APP_NAME')}:${user.email}`,
      length: 32,
    });

    // Vaqtinchalik saqla (tasdiqlangandan keyin faollashadi)
    await this.userRepository.update(userId, {
      twoFaSecret: secret.base32,
    });

    return {
      secret: secret.base32,
      otpAuthUrl: secret.otpauth_url,
      message: 'QR kodni skanerlang va kodni tasdiqlang',
    };
  }

  async confirm2fa(userId: string, code: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.twoFaSecret) {
      throw new BadRequestException('2FA sozlanmagan');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFaSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      throw new UnauthorizedException('Kod noto\'g\'ri');
    }

    await this.userRepository.update(userId, { twoFaEnabled: true });

    await this.auditLogService.log({
      userId,
      action: '2FA_ENABLED',
      entityName: 'users',
      entityId: userId,
    });

    return { message: '2FA muvaffaqiyatli yoqildi' };
  }

  private async generateTokens(
    user: User,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payload = {
      sub: user.id,
      email: user.email ?? user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d'),
    });

    // Sessiya saqlash
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const session = this.sessionRepository.create({
      userId: user.id,
      refreshToken,
      deviceInfo: deviceInfo ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      expiresAt,
      isActive: true,
    });
    await this.sessionRepository.save(session);

    await this.auditLogService.log({
      userId: user.id,
      userRole: user.role,
      userEmail: user.email,
      action: 'LOGIN_SUCCESS',
      entityName: 'sessions',
      entityId: session.id,
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        role: user.role,
        twoFaEnabled: user.twoFaEnabled,
      },
    };
  }

  private async handleFailedLogin(user: User) {
    const attempts = user.failedLoginAttempts + 1;

    const update: Partial<User> = { failedLoginAttempts: attempts };

    // 5 marta xato → 30 daqiqa blok
    if (attempts >= this.maxAttempts) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + this.blockMinutes);
      update.lockedUntil = lockedUntil;

      await this.auditLogService.log({
        userId: user.id,
        userEmail: user.email,
        action: 'ACCOUNT_LOCKED',
        newValues: { lockedUntil, attempts },
      });
    }

    await this.userRepository.update(user.id, update);
  }
}
