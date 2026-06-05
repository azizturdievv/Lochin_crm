import { PushService } from './push.service';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('PushService', () => {
  let service: PushService;

  beforeEach(() => {
    service = new PushService();
    mockFetch.mockClear();
  });

  afterEach(() => {
    delete process.env.FCM_SERVER_KEY;
  });

  // ─── send ──────────────────────────────────────────────────────────────────
  describe('send', () => {
    it('FCM_SERVER_KEY yo\'q → false qaytaradi', async () => {
      const result = await service.send('device-token', 'Salom', 'Xabar');
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('bo\'sh fcmToken → false qaytaradi', async () => {
      process.env.FCM_SERVER_KEY = 'server-key';
      const result = await service.send('', 'Salom', 'Xabar');
      expect(result).toBe(false);
    });

    it('success=1 → true qaytaradi', async () => {
      process.env.FCM_SERVER_KEY = 'AAAA_test_key';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: 1, failure: 0, results: [{}] }),
      });

      const result = await service.send('fcm-token-abc', 'Dars vaqti', 'Yangi dars qo\'shildi');
      expect(result).toBe(true);
    });

    it('success=0 → false qaytaradi', async () => {
      process.env.FCM_SERVER_KEY = 'server-key';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: 0, failure: 1, results: [{ error: 'SomeError' }] }),
      });

      const result = await service.send('fcm-token', 'Title', 'Body');
      expect(result).toBe(false);
    });

    it('NotRegistered xatosi → false qaytaradi (eskirgan token)', async () => {
      process.env.FCM_SERVER_KEY = 'server-key';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: 0, failure: 1, results: [{ error: 'NotRegistered' }] }),
      });

      const result = await service.send('old-token', 'Title', 'Body');
      expect(result).toBe(false);
    });

    it('network xatosida false qaytaradi', async () => {
      process.env.FCM_SERVER_KEY = 'server-key';
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.send('token', 'T', 'B');
      expect(result).toBe(false);
    });

    it('to\'g\'ri FCM URL va Authorization header bilan chaqiriladi', async () => {
      process.env.FCM_SERVER_KEY = 'my-fcm-key';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: 1 }),
      });

      await service.send('dev-token', 'Push sarlavha', 'Push matni', { type: 'test' });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://fcm.googleapis.com/fcm/send');
      expect(options.headers.Authorization).toBe('key=my-fcm-key');

      const body = JSON.parse(options.body);
      expect(body.to).toBe('dev-token');
      expect(body.notification.title).toBe('Push sarlavha');
      expect(body.notification.body).toBe('Push matni');
      expect(body.data.type).toBe('test');
      expect(body.priority).toBe('high');
    });
  });

  // ─── sendMulticast ─────────────────────────────────────────────────────────
  describe('sendMulticast', () => {
    it('bo\'sh massiv → {sent:0, failed:0} (fetch chaqirilmaydi)', async () => {
      const result = await service.sendMulticast([], 'T', 'B');
      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('server key yo\'q → {sent:0, failed:n}', async () => {
      const result = await service.sendMulticast(['t1', 't2', 't3'], 'T', 'B');
      expect(result).toEqual({ sent: 0, failed: 3 });
    });

    it('barcha tokenlar yuboriladi', async () => {
      process.env.FCM_SERVER_KEY = 'server-key';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: 3, failure: 0 }),
      });

      const tokens = ['t1', 't2', 't3'];
      const result = await service.sendMulticast(tokens, 'Title', 'Body');

      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.registration_ids).toEqual(tokens);
    });

    it('501 token bo\'lsa 2 ta batch yuboriladi', async () => {
      process.env.FCM_SERVER_KEY = 'server-key';
      // Birinchi batch: 500 ta → 500 muvaffaqiyatli
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: 500, failure: 0 }),
      });
      // Ikkinchi batch: 1 ta → 1 muvaffaqiyatli
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: 1, failure: 0 }),
      });

      const tokens = Array.from({ length: 501 }, (_, i) => `token-${i}`);
      const result = await service.sendMulticast(tokens, 'T', 'B');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.sent).toBe(501);
      expect(result.failed).toBe(0);
    });

    it('batch xatosida failed soni to\'g\'ri', async () => {
      process.env.FCM_SERVER_KEY = 'server-key';
      mockFetch.mockRejectedValueOnce(new Error('Network'));

      const result = await service.sendMulticast(['t1', 't2'], 'T', 'B');
      expect(result.failed).toBe(2);
      expect(result.sent).toBe(0);
    });
  });
});
