import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/jwt-auth.guard';

// JWT tekshiruvidan o'tkazmaydigan endpoint uchun dekorator
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
