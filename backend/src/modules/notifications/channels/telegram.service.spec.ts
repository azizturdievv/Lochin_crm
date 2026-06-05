import { TelegramService } from './telegram.service';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('TelegramService', () => {
  let service: TelegramService;

  beforeEach(() => {
    service = new TelegramService();
    mockFetch.mockClear();
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  // ─── sendMessage ──────────────────────────────────────────────────────────
  describe('sendMessage', () => {
    it('TELEGRAM_BOT_TOKEN yo\'q → false qaytaradi', async () => {
      const result = await service.sendMessage('123456', 'Salom');
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('chatId bo\'sh → false qaytaradi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      const result = await service.sendMessage('', 'Salom');
      expect(result).toBe(false);
    });

    it('ok=true bo\'lsa true qaytaradi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '7000000000:AAtest';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, result: { message_id: 1 } }),
      });

      const result = await service.sendMessage('123456', 'Test xabar');
      expect(result).toBe(true);
    });

    it('ok=false bo\'lsa false qaytaradi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: false, description: 'Blocked' }),
      });

      const result = await service.sendMessage('123456', 'Test');
      expect(result).toBe(false);
    });

    it('to\'g\'ri URL va parametrlar bilan chaqiriladi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'mytoken123';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      });

      await service.sendMessage('987654', 'Xabar matni', 'Markdown');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.telegram.org/botmytoken123/sendMessage');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.chat_id).toBe('987654');
      expect(body.text).toBe('Xabar matni');
      expect(body.parse_mode).toBe('Markdown');
    });

    it('network xatosida false qaytaradi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.sendMessage('123', 'Test');
      expect(result).toBe(false);
    });

    it('raqam chatId ham ishlaydi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true }),
      });

      const result = await service.sendMessage(123456789, 'Test');
      expect(result).toBe(true);
    });
  });

  // ─── broadcast ────────────────────────────────────────────────────────────
  describe('broadcast', () => {
    it('bir nechta chatga yuboradi va {sent, failed} qaytaradi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, description: 'X' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

      const result = await service.broadcast(['111', '222', '333'], 'Test');

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('bo\'sh massiv → {sent:0, failed:0}', async () => {
      const result = await service.broadcast([], 'Test');
      expect(result).toEqual({ sent: 0, failed: 0 });
    });
  });

  // ─── setWebhook ───────────────────────────────────────────────────────────
  describe('setWebhook', () => {
    it('token yo\'q → false qaytaradi', async () => {
      const result = await service.setWebhook('https://my.site/webhook');
      expect(result).toBe(false);
    });

    it('to\'g\'ri URL bilan webhook o\'rnatadi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ ok: true, description: 'Webhook was set' }),
      });

      const result = await service.setWebhook(
        'https://my.site/api/v1/notifications/telegram/webhook',
        'my-secret',
      );

      expect(result).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.url).toBe('https://my.site/api/v1/notifications/telegram/webhook');
      expect(body.secret_token).toBe('my-secret');
    });

    it('fetch xatosida false qaytaradi', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
      mockFetch.mockRejectedValueOnce(new Error('Network'));

      const result = await service.setWebhook('https://x.com/hook');
      expect(result).toBe(false);
    });
  });
});
