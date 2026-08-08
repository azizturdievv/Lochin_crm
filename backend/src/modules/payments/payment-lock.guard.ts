import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../common/enums/role.enum';
import { PAYMENT_LOCK_KEY } from '../../common/decorators/block-when-payment-locked.decorator';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentLockGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private paymentsService: PaymentsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isGated = this.reflector.getAllAndOverride<boolean>(PAYMENT_LOCK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isGated) return true;

    const { user } = context.switchToHttp().getRequest();

    // Xodimlar (SA/Manager/Ustoz) hech qachon qulflanmaydi — faqat o'quvchi tekshiriladi
    if (!user || user.role !== Role.STUDENT) return true;

    const status = await this.paymentsService.getAccessStatus(user.id);

    if (status.isLocked) {
      throw new ForbiddenException({
        message: 'To\'lov muddati o\'tgan. Iltimos, to\'lovni amalga oshiring yoki administratsiya bilan bog\'laning.',
        ...status,
      });
    }

    return true;
  }
}
