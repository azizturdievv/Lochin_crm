import { Injectable, Logger } from '@nestjs/common';

// Eskiz.uz SMS API integratsiyasi
const ESKIZ_BASE = 'https://notify.eskiz.uz/api';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  // Token keshi (28 kunlik muddatdan foydalaniladi)
  private token: string | null = null;
  private tokenExpiresAt = 0;

  // Telefon raqamini 998XXXXXXXXX formatga keltiradi
  private normalize(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('998') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `998${digits.slice(1)}`;
    if (digits.length === 9) return `998${digits}`;
    return digits;
  }

  // Eskiz.uz tokenini oladi yoki yangilaydi
  private async getToken(): Promise<string | null> {
    const email = process.env.ESKIZ_EMAIL;
    const password = process.env.ESKIZ_PASSWORD;
    if (!email || !password) return null;

    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    try {
      const res = await fetch(`${ESKIZ_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as any;
      this.token = json.data?.token ?? null;
      // 28 kunlik kesh (token 29 kunda tugaydi)
      this.tokenExpiresAt = Date.now() + 28 * 24 * 60 * 60 * 1000;
      return this.token;
    } catch (err) {
      this.logger.error(`Eskiz token olishda xato: ${err}`);
      return null;
    }
  }

  // Bitta raqamga SMS yuboradi
  async send(phone: string, message: string): Promise<boolean> {
    const token = await this.getToken();
    if (!token) {
      this.logger.warn('Eskiz sozlanmagan — SMS yuborilmadi');
      return false;
    }

    try {
      const res = await fetch(`${ESKIZ_BASE}/message/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mobile_phone: this.normalize(phone),
          message,
          from: process.env.ESKIZ_SENDER ?? 'IlmAcademy',
        }),
      });

      const json = (await res.json()) as any;

      if (json.status === 'waiting' || json.status === 'success') {
        return true;
      }

      // Token muddati tugagan bo'lsa — yangilab qayta urinish
      if (res.status === 401) {
        this.token = null;
        this.tokenExpiresAt = 0;
        return this.send(phone, message);
      }

      this.logger.warn(`Eskiz javob: ${JSON.stringify(json)}`);
      return false;
    } catch (err) {
      this.logger.error(`SMS yuborishda xato (${phone}): ${err}`);
      return false;
    }
  }

  // Bir nechta raqamga parallel SMS
  async sendBulk(phones: string[], message: string): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(phones.map((p) => this.send(p, message)));
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    return { sent, failed: phones.length - sent };
  }
}
