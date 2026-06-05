import { SmsService } from './sms.service';

// global.fetch ni mock qilish
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('SmsService', () => {
  let service: SmsService;

  beforeEach(() => {
    service = new SmsService();
    mockFetch.mockClear();
    // Token keshini tozalash (private fieldga reflection orqali)
    (service as any).token = null;
    (service as any).tokenExpiresAt = 0;
  });

  afterEach(() => {
    delete process.env.ESKIZ_EMAIL;
    delete process.env.ESKIZ_PASSWORD;
    delete process.env.ESKIZ_SENDER;
  });

  // ─── TELEFON NORMALIZATSIYA ─────────────────────────────────────────────────
  describe('normalize (send orqali test)', () => {
    beforeEach(() => {
      process.env.ESKIZ_EMAIL = 'test@test.com';
      process.env.ESKIZ_PASSWORD = 'pass';
      // Token olish
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: { token: 'test-token' } }),
        status: 200,
      });
    });

    it('9-raqamli → 998XXXXXXXXX', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'waiting' }),
        status: 200,
      });
      await service.send('901234567', 'Test');

      const lastCall = mockFetch.mock.calls[1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.mobile_phone).toBe('998901234567');
    });

    it('0 + 9-raqamli → 998XXXXXXXXX', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'waiting' }),
        status: 200,
      });
      await service.send('0901234567', 'Test');

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.mobile_phone).toBe('998901234567');
    });

    it('998 + 12-raqamli → o\'zgarmaydi', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'waiting' }),
        status: 200,
      });
      await service.send('998901234567', 'Test');

      const body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(body.mobile_phone).toBe('998901234567');
    });
  });

  // ─── SEND ──────────────────────────────────────────────────────────────────
  describe('send', () => {
    it('ESKIZ sozlanmasa false qaytaradi', async () => {
      // env yo'q
      const result = await service.send('901234567', 'Test xabar');
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('status=waiting → true qaytaradi', async () => {
      process.env.ESKIZ_EMAIL = 'test@ilm.uz';
      process.env.ESKIZ_PASSWORD = 'secret';
      // Login
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: { token: 'tok-123' } }),
        status: 200,
      });
      // Send
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'waiting' }),
        status: 200,
      });

      const result = await service.send('901234567', 'Salom');
      expect(result).toBe(true);
    });

    it('status=success → true qaytaradi', async () => {
      process.env.ESKIZ_EMAIL = 'test@ilm.uz';
      process.env.ESKIZ_PASSWORD = 'secret';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: { token: 'tok-123' } }),
        status: 200,
      });
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'success' }),
        status: 200,
      });

      const result = await service.send('901234567', 'Salom');
      expect(result).toBe(true);
    });

    it('noto\'g\'ri status → false qaytaradi', async () => {
      process.env.ESKIZ_EMAIL = 'test@ilm.uz';
      process.env.ESKIZ_PASSWORD = 'secret';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: { token: 'tok-123' } }),
        status: 200,
      });
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'error', message: 'Raqam noto\'g\'ri' }),
        status: 200,
      });

      const result = await service.send('901234567', 'Salom');
      expect(result).toBe(false);
    });

    it('401 javobida token tozalanadi va qayta uriniladi', async () => {
      process.env.ESKIZ_EMAIL = 'test@ilm.uz';
      process.env.ESKIZ_PASSWORD = 'secret';
      // Login 1
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: { token: 'old-token' } }),
        status: 200,
      });
      // Send → 401
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ message: 'Unauthorized' }),
        status: 401,
      });
      // Login 2 (retry)
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: { token: 'new-token' } }),
        status: 200,
      });
      // Send retry → success
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'waiting' }),
        status: 200,
      });

      const result = await service.send('901234567', 'Salom');
      expect(result).toBe(true);
      // fetch jami 4 marta chaqirilishi kerak (2 login + 2 send)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('fetch xatosida false qaytaradi', async () => {
      process.env.ESKIZ_EMAIL = 'test@ilm.uz';
      process.env.ESKIZ_PASSWORD = 'secret';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: { token: 'tok' } }),
        status: 200,
      });
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.send('901234567', 'Salom');
      expect(result).toBe(false);
    });

    it('token kesh ishlaydi — ikkinchi yuborishda login chaqirilmaydi', async () => {
      process.env.ESKIZ_EMAIL = 'test@ilm.uz';
      process.env.ESKIZ_PASSWORD = 'secret';
      (service as any).token = 'cached-token';
      (service as any).tokenExpiresAt = Date.now() + 1_000_000; // hali muddati o'tmagan

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'waiting' }),
        status: 200,
      });

      await service.send('901234567', 'Salom');

      // Faqat bitta fetch (send), login yo'q
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/message/sms/send');
    });
  });

  // ─── SEND BULK ─────────────────────────────────────────────────────────────
  describe('sendBulk', () => {
    it('yuborilgan va xatoli sonlar to\'g\'ri qaytariladi', async () => {
      const sendSpy = jest.spyOn(service, 'send')
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.sendBulk(['111', '222', '333'], 'Test');

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      sendSpy.mockRestore();
    });

    it('bo\'sh massiv uchun {sent:0, failed:0}', async () => {
      const result = await service.sendBulk([], 'Test');
      expect(result).toEqual({ sent: 0, failed: 0 });
    });
  });
});
