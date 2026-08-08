import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { ALLOW_WITHOUT_2FA_KEY } from '../decorators/allow-without-2fa.decorator';
import { IS_PUBLIC_KEY } from './jwt-auth.guard';

// SA/Manager uchun 2FA "MAJBURIY" qoidasini majburlaydi: 2FA hali yoqilmagan
// bo'lsa, 2FA sozlash/tasdiqlash/chiqish/profil ko'rishdan tashqari HECH QANDAY
// endpointga kirish berilmaydi. Login o'zi to'liq JWT beradi (chunki 2FA
// sozlash ham JWT talab qiladi), lekin bu guard shu JWT bilan boshqa
// hech narsa qila olmasligini ta'minlaydi.
@Injectable()
export class TwoFaEnforcementGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isAllowed = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_2FA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isAllowed) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return true; // JwtAuthGuard bu holatni allaqachon ushlagan bo'ladi

    const requires2Fa = user.role === Role.SUPER_ADMIN || user.role === Role.MANAGER;
    if (requires2Fa && !user.twoFaEnabled) {
      throw new ForbiddenException({
        message: 'Davom etishdan oldin 2FA (ikki bosqichli tasdiqlash) sozlanishi shart.',
        requiresTwoFaSetup: true,
      });
    }

    return true;
  }
}
