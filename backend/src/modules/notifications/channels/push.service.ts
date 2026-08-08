import { Injectable, Logger } from '@nestjs/common';

// Firebase Cloud Messaging (Legacy HTTP API)
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

interface FcmSendResponse {
  success?: number;
  failure?: number;
  results?: { error?: string }[];
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  // Bitta qurilmaga push yuboradi
  async send(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey || !fcmToken) {
      if (!serverKey) this.logger.warn('FCM_SERVER_KEY sozlanmagan — Push yuborilmadi');
      return false;
    }

    try {
      const res = await fetch(FCM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          to: fcmToken,
          notification: {
            title,
            body,
            sound: 'default',
            badge: '1',
          },
          data: data ?? {},
          priority: 'high',
          content_available: true,
        }),
      });

      const json = (await res.json()) as FcmSendResponse;

      if (json.success === 1) return true;

      // Eski token (qurilma yangilangan yoki ilovadan chiqqan)
      if (json.results?.[0]?.error === 'NotRegistered') {
        this.logger.warn(`FCM token eskirgan: ${fcmToken.slice(0, 20)}...`);
        return false;
      }

      this.logger.warn(`FCM javob: ${JSON.stringify(json)}`);
      return false;
    } catch (err) {
      this.logger.error(`Push yuborishda xato: ${err}`);
      return false;
    }
  }

  // Ko'p qurilmaga parallel push (max 500 ta FCM cheklovi)
  async sendMulticast(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ sent: number; failed: number }> {
    if (!tokens.length) return { sent: 0, failed: 0 };

    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      this.logger.warn('FCM_SERVER_KEY sozlanmagan');
      return { sent: 0, failed: tokens.length };
    }

    // 500 ta batch'ga bo'lib yuborish
    const batches: string[][] = [];
    for (let i = 0; i < tokens.length; i += 500) {
      batches.push(tokens.slice(i, i + 500));
    }

    let sent = 0;
    let failed = 0;

    for (const batch of batches) {
      try {
        const res = await fetch(FCM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${serverKey}`,
          },
          body: JSON.stringify({
            registration_ids: batch,
            notification: { title, body, sound: 'default' },
            data: data ?? {},
            priority: 'high',
          }),
        });

        const json = (await res.json()) as FcmSendResponse;
        sent += json.success ?? 0;
        failed += json.failure ?? batch.length;
      } catch (err) {
        this.logger.error(`Multicast push xato: ${err}`);
        failed += batch.length;
      }
    }

    return { sent, failed };
  }
}
