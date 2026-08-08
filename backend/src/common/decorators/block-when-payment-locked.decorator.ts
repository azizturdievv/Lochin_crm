import { SetMetadata } from '@nestjs/common';

export const PAYMENT_LOCK_KEY = 'blockWhenPaymentLocked';
export const BlockWhenPaymentLocked = () => SetMetadata(PAYMENT_LOCK_KEY, true);
