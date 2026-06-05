import { Injectable, Logger } from '@nestjs/common';

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
};

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  private get apiUrl(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
    return `https://api.telegram.org/bot${token}`;
  }

  // Telegram xabar yuboradi (Markdown yoki HTML formatlash bilan)
  async sendMessage(
    chatId: string | number,
    text: string,
    parseMode: 'Markdown' | 'HTML' = 'Markdown',
  ): Promise<boolean> {
    if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return false;

    try {
      const res = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });

      const json = (await res.json()) as any;
      if (!json.ok) {
        this.logger.warn(`Telegram xato (${chatId}): ${json.description}`);
      }
      return json.ok === true;
    } catch (err) {
      this.logger.error(`Telegram yuborishda xato (${chatId}): ${err}`);
      return false;
    }
  }

  // Bir nechta foydalanuvchiga parallel yuborish
  async broadcast(
    chatIds: (string | number)[],
    text: string,
    parseMode: 'Markdown' | 'HTML' = 'Markdown',
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      chatIds.map((id) => this.sendMessage(id, text, parseMode)),
    );
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    return { sent, failed: chatIds.length - sent };
  }

  // Webhook URL ni o'rnatish
  async setWebhook(webhookUrl: string, secretToken?: string): Promise<boolean> {
    if (!process.env.TELEGRAM_BOT_TOKEN) return false;
    try {
      const res = await fetch(`${this.apiUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ['message'],
        }),
      });
      const json = (await res.json()) as any;
      this.logger.log(`Webhook o'rnatildi: ${json.description}`);
      return json.ok === true;
    } catch (err) {
      this.logger.error(`Webhook o'rnatishda xato: ${err}`);
      return false;
    }
  }

  // Webhook ni o'chirish (polling rejimga o'tish uchun)
  async deleteWebhook(): Promise<void> {
    if (!process.env.TELEGRAM_BOT_TOKEN) return;
    await fetch(`${this.apiUrl}/deleteWebhook`, { method: 'POST' }).catch(() => {});
  }

  // Bot haqida ma'lumot
  async getMe(): Promise<any> {
    const res = await fetch(`${this.apiUrl}/getMe`);
    return res.json();
  }
}
