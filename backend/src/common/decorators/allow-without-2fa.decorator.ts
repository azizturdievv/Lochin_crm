import { SetMetadata } from '@nestjs/common';

// SA/Manager uchun 2FA hali sozlanmagan bo'lsa ham ruxsat etiladigan endpointlar
// (2FA sozlash oqimining o'zi + chiqish + profil ko'rish)
export const ALLOW_WITHOUT_2FA_KEY = 'allowWithout2fa';
export const AllowWithout2FA = () => SetMetadata(ALLOW_WITHOUT_2FA_KEY, true);
