import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { SmsService } from './channels/sms.service';
import { TelegramService } from './channels/telegram.service';
import { PushService } from './channels/push.service';
import { Role } from '../../common/enums/role.enum';

function makeRepo() {
  return {
    create: jest.fn((d: any) => ({ id: 'notif-id', ...d })),
    save: jest.fn(async (d: any) => ({ id: 'notif-id', ...d })),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let notifRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let parentRepo: ReturnType<typeof makeRepo>;
  let sms: { send: jest.Mock; sendBulk: jest.Mock };
  let telegram: { sendMessage: jest.Mock; broadcast: jest.Mock };
  let push: { send: jest.Mock; sendMulticast: jest.Mock };

  const mockUser = {
    id: 'user-1',
    firstName: 'Ali',
    phone: '+998901234567',
    telegramChatId: '12345678',
    fcmToken: 'fcm-token-abc',
  };

  beforeEach(async () => {
    notifRepo = makeRepo();
    userRepo = makeRepo();
    parentRepo = makeRepo();
    sms = { send: jest.fn().mockResolvedValue(true), sendBulk: jest.fn() };
    telegram = { sendMessage: jest.fn().mockResolvedValue(true), broadcast: jest.fn() };
    push = { send: jest.fn().mockResolvedValue(true), sendMulticast: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Parent), useValue: parentRepo },
        { provide: SmsService, useValue: sms },
        { provide: TelegramService, useValue: telegram },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  // ─── notify ────────────────────────────────────────────────────────────────
  describe('notify', () => {
    it('bildirishnomani DB ga saqlaydi', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.notify('user-1', NotificationType.PAYMENT, 'Sarlavha', 'Matn');

      expect(notifRepo.save).toHaveBeenCalled();
      expect(notifRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.PAYMENT,
          title: 'Sarlavha',
          body: 'Matn',
        }),
      );
    });

    it('user.phone bo\'lsa SMS yuboriladi', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, telegramChatId: null, fcmToken: null });

      await service.notify('user-1', NotificationType.ATTENDANCE, 'T', 'Matn');

      expect(sms.send).toHaveBeenCalledWith(mockUser.phone, 'Matn');
    });

    it('user.telegramChatId bo\'lsa Telegram yuboriladi', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, phone: null, fcmToken: null });

      await service.notify('user-1', NotificationType.TEST, 'T', 'Matn');

      expect(telegram.sendMessage).toHaveBeenCalledWith('12345678', 'Matn');
    });

    it('user.fcmToken bo\'lsa Push yuboriladi', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, phone: null, telegramChatId: null });

      await service.notify('user-1', NotificationType.SCHEDULE, 'Sarlavha', 'Matn');

      expect(push.send).toHaveBeenCalledWith('fcm-token-abc', 'Sarlavha', 'Matn');
    });

    it('barcha kanallar bir vaqtda ishlaydi', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.notify('user-1', NotificationType.ANNOUNCEMENT, 'T', 'M');

      expect(sms.send).toHaveBeenCalled();
      expect(telegram.sendMessage).toHaveBeenCalled();
      expect(push.send).toHaveBeenCalled();
    });

    it('skipSms=true bo\'lsa SMS yuborilmaydi', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.notify('user-1', NotificationType.BIRTHDAY, 'T', 'M', { skipSms: true });

      expect(sms.send).not.toHaveBeenCalled();
      expect(telegram.sendMessage).toHaveBeenCalled();
    });

    it('skipTelegram=true bo\'lsa Telegram yuborilmaydi', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.notify('user-1', NotificationType.EMERGENCY, 'T', 'M', { skipTelegram: true });

      expect(telegram.sendMessage).not.toHaveBeenCalled();
      expect(sms.send).toHaveBeenCalled();
    });

    it('skipPush=true bo\'lsa Push yuborilmaydi', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.notify('user-1', NotificationType.HOMEWORK, 'T', 'M', { skipPush: true });

      expect(push.send).not.toHaveBeenCalled();
    });

    it('yuborilgan kanallar notif yozuvida yangilanadi', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      await service.notify('user-1', NotificationType.PAYMENT, 'T', 'M');

      expect(notifRepo.update).toHaveBeenCalledWith(
        'notif-id',
        expect.objectContaining({ smsSent: true, telegramSent: true, pushSent: true }),
      );
    });

    it('foydalanuvchi topilmasa kanallar chaqirilmaydi', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await service.notify('no-user', NotificationType.PAYMENT, 'T', 'M');

      expect(sms.send).not.toHaveBeenCalled();
      expect(telegram.sendMessage).not.toHaveBeenCalled();
      expect(push.send).not.toHaveBeenCalled();
    });

    it('notifyParents=true bo\'lsa ota-onalarga ham yuboriladi', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser, phone: null, telegramChatId: null, fcmToken: null });
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: '+998901111111', telegramChatId: null },
      ]);

      await service.notify('user-1', NotificationType.ATTENDANCE, 'T', 'Xabar', {
        notifyParents: true,
      });

      expect(sms.send).toHaveBeenCalledWith('+998901111111', 'Xabar');
    });
  });

  // ─── broadcast ─────────────────────────────────────────────────────────────
  describe('broadcast', () => {
    it('har bir userId uchun notify chaqiriladi', async () => {
      const spy = jest.spyOn(service, 'notify').mockResolvedValue(undefined);

      await service.broadcast(
        ['u1', 'u2', 'u3'],
        NotificationType.PAYMENT,
        'T',
        'M',
      );

      expect(spy).toHaveBeenCalledTimes(3);
      spy.mockRestore();
    });

    it('bo\'sh massiv — hech narsa chaqirilmaydi', async () => {
      const spy = jest.spyOn(service, 'notify').mockResolvedValue(undefined);

      await service.broadcast([], NotificationType.PAYMENT, 'T', 'M');

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ─── broadcastByRole ───────────────────────────────────────────────────────
  describe('broadcastByRole', () => {
    it('rol bo\'yicha foydalanuvchilarni topadi va broadcast qiladi', async () => {
      userRepo.find.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      const spy = jest.spyOn(service, 'broadcast').mockResolvedValue(undefined);

      await service.broadcastByRole(Role.USTOZ, NotificationType.ANNOUNCEMENT, 'T', 'M');

      expect(userRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: Role.USTOZ, isActive: true } }),
      );
      expect(spy).toHaveBeenCalledWith(['u1', 'u2'], NotificationType.ANNOUNCEMENT, 'T', 'M', undefined);
      spy.mockRestore();
    });
  });

  // ─── notifyParents ─────────────────────────────────────────────────────────
  describe('notifyParents', () => {
    it('telefoni bor ota-onaga SMS yuboriladi', async () => {
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: '+998901111111', telegramChatId: null },
      ]);

      await service.notifyParents('student-1', 'Test xabar');

      expect(sms.send).toHaveBeenCalledWith('+998901111111', 'Test xabar');
    });

    it('telegramChatId bor ota-onaga Telegram yuboriladi', async () => {
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: null, telegramChatId: '99887766' },
      ]);

      await service.notifyParents('student-1', 'Test xabar');

      expect(telegram.sendMessage).toHaveBeenCalledWith('99887766', 'Test xabar');
    });

    it('skipSms bilan SMS yuborilmaydi', async () => {
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: '+998901111111', telegramChatId: null },
      ]);

      await service.notifyParents('student-1', 'Test', { skipSms: true });

      expect(sms.send).not.toHaveBeenCalled();
    });
  });

  // ─── markRead ──────────────────────────────────────────────────────────────
  describe('markRead', () => {
    it('bildirishnoma o\'qildi deb belgilanadi', async () => {
      notifRepo.findOne.mockResolvedValue({ id: 'n1', userId: 'user-1', isRead: false });

      await service.markRead('n1', 'user-1');

      expect(notifRepo.update).toHaveBeenCalledWith('n1', {
        isRead: true,
        readAt: expect.any(Date),
      });
    });

    it('NotFoundException — bildirishnoma topilmasa', async () => {
      notifRepo.findOne.mockResolvedValue(null);
      await expect(service.markRead('no-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── markAllRead ───────────────────────────────────────────────────────────
  describe('markAllRead', () => {
    it('foydalanuvchining barcha o\'qilmagan bildirishnomalari yangilanadi', async () => {
      await service.markAllRead('user-1');

      expect(notifRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true, readAt: expect.any(Date) },
      );
    });
  });

  // ─── getByUser ─────────────────────────────────────────────────────────────
  describe('getByUser', () => {
    it('pagination bilan bildirishnomalar qaytariladi', async () => {
      const mockItems = [{ id: 'n1', type: NotificationType.PAYMENT }];
      notifRepo.findAndCount.mockResolvedValue([mockItems, 1]);
      notifRepo.count.mockResolvedValue(3);

      const result = await service.getByUser('user-1', 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(3);
      expect(result.page).toBe(1);
    });

    it('skip to\'g\'ri hisoblanadi: page=2, limit=10 → skip=10', async () => {
      notifRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getByUser('user-1', 2, 10);

      expect(notifRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ─── registerFcmToken ──────────────────────────────────────────────────────
  describe('registerFcmToken', () => {
    it('userRepo.update chaqiriladi', async () => {
      await service.registerFcmToken('user-1', 'new-fcm-token');
      expect(userRepo.update).toHaveBeenCalledWith('user-1', { fcmToken: 'new-fcm-token' });
    });
  });
});
