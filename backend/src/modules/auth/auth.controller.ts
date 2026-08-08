import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, Verify2faDto, RefreshTokenDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowWithout2FA } from '../../common/decorators/allow-without-2fa.decorator';
import { User } from '../../entities/user.entity';
import { SetMetadata } from '@nestjs/common';

const Public = () => SetMetadata('isPublic', true);

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  verify2fa(@Body() dto: Verify2faDto, @Req() req: Request) {
    return this.authService.verify2fa(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @UseGuards(JwtAuthGuard)
  @AllowWithout2FA()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentUser() user: User,
    @Body('sessionId') sessionId: string,
  ) {
    return this.authService.logout(sessionId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @AllowWithout2FA()
  @Get('2fa/setup')
  setup2fa(@CurrentUser() user: User) {
    return this.authService.setup2fa(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @AllowWithout2FA()
  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  confirm2fa(
    @CurrentUser() user: User,
    @Body('code') code: string,
  ) {
    return this.authService.confirm2fa(user.id, code);
  }

  @UseGuards(JwtAuthGuard)
  @AllowWithout2FA()
  @Get('me')
  getProfile(@CurrentUser() user: User) {
    const { passwordHash, twoFaSecret, ...profile } = user;
    return profile;
  }
}
