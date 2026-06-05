import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TriggerService } from './trigger.service';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { NotificationService } from './notification.service';
import { SmsService } from './channels/sms.service';
import { TelegramService } from './channels/telegram.service';
import { PushService } from './channels/push.service';
import { Role } from '../../common/enums/role.enum';

function makeQb(result: any[] = []) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
    getCount: jest.fn().mockResolvedValue(0),
  };
}

describe('TriggerService', () => {
  let service: TriggerService;
  let userRepo: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let parentRepo: { find: jest.Mock };
  let notifRepo: { save: jest.Mock; create: jest.Mock };
  let notifService: {
    notify: jest.Mock;
    broadcast: jest.Mock;
    broadcastByRole: jest.Mock;
  };
  let sms: { send: jest.Mock };
  let telegram: { sendMessage: jest.Mock };
  let push: { send: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    };
    parentRepo = { find: jest.fn().mockResolvedValue([]) };
    notifRepo = {
      create: jest.fn((d: any) => d),
      save: jest.fn().mockResolvedValue({}),
    };
    notifService = {
      notify: jest.fn().mockResolvedValue(undefined),
      broadcast: jest.fn().mockResolvedValue(undefined),
      broadcastByRole: jest.fn().mockResolvedValue(undefined),
    };
    sms = { send: jest.fn().mockResolvedValue(true) };
    telegram = { sendMessage: jest.fn().mockResolvedValue(true) };
    push = { send: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriggerService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Parent), useValue: parentRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: NotificationService, useValue: notifService },
        { provide: SmsService, useValue: sms },
        { provide: TelegramService, useValue: telegram },
        { provide: PushService, useValue: push },
      ],
    }).compile();

    service = module.get<TriggerService>(TriggerService);
  });

  // ─── triggerAttendanceAbsent ───────────────────────────────────────────────
  describe('triggerAttendanceAbsent', () => {
    const opts = {
      studentId: 'student-1',
      studentName: 'Ali Karimov',
      subjectName: 'Ingliz tili',
      lessonDate: new Date('2024-01-15'),
    };

    it('o\'quvchiga push yuboriladi (skipSms=true)', async () => {
      parentRepo.find.mockResolvedValue([]);

      await service.triggerAttendanceAbsent(opts);

      expect(notifService.notify).toHaveBeenCalledWith(
        'student-1',
        NotificationType.ATTENDANCE,
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ skipSms: true }),
      );
    });

    it('telefoni bor ota-onaga SMS yuboriladi', async () => {
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: '+998901111111', telegramChatId: null, fullName: 'Ota-ona' },
      ]);

      await service.triggerAttendanceAbsent(opts);

      expect(sms.send).toHaveBeenCalledWith('+998901111111', expect.any(String));
    });

    it('telegramChatId bor ota-onaga Telegram yuboriladi', async () => {
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: null, telegramChatId: '87654321', fullName: 'Ota' },
      ]);

      await service.triggerAttendanceAbsent(opts);

      expect(telegram.sendMessage).toHaveBeenCalledWith('87654321', expect.any(String));
    });

    it('SMS matni o\'quvchi ismini o\'z ichiga oladi', async () => {
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: '+998901111111', telegramChatId: null, fullName: 'Ota' },
      ]);

      await service.triggerAttendanceAbsent(opts);

      const smsText = sms.send.mock.calls[0][1];
      expect(smsText).toContain('Ali Karimov');
    });

    it('bir nechta ota-onaga yuboriladi', async () => {
      parentRepo.find.mockResolvedValue([
        { id: 'p1', phone: '+998901111111', telegramChatId: null, fullName: 'Ota' },
        { id: 'p2', phone: '+998902222222', telegramChatId: '12345', fullName: 'Ona' },
      ]);

      await service.triggerAttendanceAbsent(opts);

      expect(sms.send).toHaveBeenCalledTimes(2);
    });
  });

  // ─── triggerAttendanceLate ─────────────────────────────────────────────────
  describe('triggerAttendanceLate', () => {
    it('kech qolish bildirishnomasi yuboriladi', async () => {
      await service.triggerAttendanceLate({
        studentId: 's1',
        studentName: 'Vali',
        subjectName: 'Matematika',
        lessonDate: new Date(),
        lateMinutes: 15,
      });

      expect(notifService.notify).toHaveBeenCalledWith(
        's1',
        NotificationType.ATTENDANCE,
        expect.any(String),
        expect.stringContaining('15'),
        expect.anything(),
      );
    });
  });

  // ─── triggerPaymentReceived ────────────────────────────────────────────────
  describe('triggerPaymentReceived', () => {
    it('to\'lov qabul qilindi bildirishnomasi yuboriladi', async () => {
      await service.triggerPaymentReceived({
        studentId: 's1',
        studentName: 'Ali',
        amount: BigInt(500_000),
        month: '2024-01',
      });

      expect(notifService.notify).toHaveBeenCalledWith(
        's1',
        NotificationType.PAYMENT,
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ notifyParents: true }),
      );
    });

    it('xabar matni summa va oyni o\'z ichiga oladi', async () => {
      await service.triggerPaymentReceived({
        studentId: 's1',
        studentName: 'Ali',
        amount: 500_000,
        month: '2024-01',
      });

      const body = notifService.notify.mock.calls[0][3];
      expect(body).toContain('500');
      expect(body).toContain('Yanvar 2024');
    });
  });

  // ─── triggerTestResult ─────────────────────────────────────────────────────
  describe('triggerTestResult', () => {
    it('test natijasi bildirishnomasi yuboriladi', async () => {
      await service.triggerTestResult({
        studentId: 's1',
        studentName: 'Ali',
        subjectName: 'Ingliz',
        score: 85,
        level: 'Qiyin daraja',
      });

      expect(notifService.notify).toHaveBeenCalledWith(
        's1',
        NotificationType.TEST,
        expect.any(String),
        expect.any(String),
      );
    });

    it('xabar matni ball va darajani o\'z ichiga oladi', async () => {
      await service.triggerTestResult({
        studentId: 's1',
        studentName: 'Ali',
        subjectName: 'Ingliz',
        score: 85,
        level: 'Qiyin daraja',
      });

      const body = notifService.notify.mock.calls[0][3];
      expect(body).toContain('85');
      expect(body).toContain('Qiyin daraja');
    });
  });

  // ─── triggerHomeworkAssigned ───────────────────────────────────────────────
  describe('triggerHomeworkAssigned', () => {
    it('barcha o\'quvchilarga broadcast yuboriladi', async () => {
      await service.triggerHomeworkAssigned({
        studentIds: ['s1', 's2', 's3'],
        subjectName: 'Matematika',
        homeworkTitle: 'Mavzu 5 — Algebra',
        dueDate: new Date('2024-01-20'),
      });

      expect(notifService.broadcast).toHaveBeenCalledWith(
        ['s1', 's2', 's3'],
        NotificationType.HOMEWORK,
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ─── triggerBirthday ──────────────────────────────────────────────────────
  describe('triggerBirthday (cron)', () => {
    it('bugun tug\'ilgan kun bo\'lgan foydalanuvchilarga yuboriladi', async () => {
      const birthdayUsers = [
        { id: 'u1', firstName: 'Ali', role: Role.USTOZ },
        { id: 'u2', firstName: 'Kamol', role: Role.STUDENT },
      ];
      userRepo.createQueryBuilder.mockReturnValue({
        ...makeQb(birthdayUsers),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(birthdayUsers),
      });

      await service.triggerBirthday();

      expect(notifService.notify).toHaveBeenCalledTimes(2);
    });

    it('tug\'ilgan kunlik foydalanuvchi yo\'q — notify chaqirilmaydi', async () => {
      userRepo.createQueryBuilder.mockReturnValue({
        ...makeQb([]),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.triggerBirthday();

      expect(notifService.notify).not.toHaveBeenCalled();
    });

    it('xodim uchun staff shabloni ishlatiladi', async () => {
      const staffUser = { id: 'u1', firstName: 'Ali', role: Role.USTOZ };
      userRepo.createQueryBuilder.mockReturnValue({
        ...makeQb([staffUser]),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([staffUser]),
      });

      await service.triggerBirthday();

      const opts = notifService.notify.mock.calls[0][4];
      expect(opts).toMatchObject({ skipSms: true }); // Staff uchun SMS yuborilmaydi
    });
  });

  // ─── triggerEmergency ─────────────────────────────────────────────────────
  describe('triggerEmergency', () => {
    it('userIds berilsa broadcast qilinadi', async () => {
      await service.triggerEmergency({
        title: 'Muhim xabar',
        body: 'Detallar...',
        targetUserIds: ['u1', 'u2'],
      });

      expect(notifService.broadcast).toHaveBeenCalledWith(
        ['u1', 'u2'],
        NotificationType.EMERGENCY,
        expect.any(String),
        expect.any(String),
      );
    });

    it('targetRole berilsa broadcastByRole qilinadi', async () => {
      await service.triggerEmergency({
        title: 'Favqulodda',
        body: 'Vaziyat...',
        targetRole: Role.STUDENT,
      });

      expect(notifService.broadcastByRole).toHaveBeenCalledWith(
        Role.STUDENT,
        NotificationType.EMERGENCY,
        expect.any(String),
        expect.any(String),
      );
    });

    it('hech kim ko\'rsatilmasa barcha faol foydalanuvchilarga', async () => {
      userRepo.find.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);

      await service.triggerEmergency({ title: 'Xabar', body: 'Matn' });

      expect(notifService.broadcast).toHaveBeenCalledWith(
        ['u1', 'u2', 'u3'],
        NotificationType.EMERGENCY,
        expect.any(String),
        expect.any(String),
      );
    });

    it('emergency xabari sarlavha va matni o\'z ichiga oladi', async () => {
      await service.triggerEmergency({
        title: 'GAS OQMOQDA',
        body: 'Darhol binoni tark eting!',
        targetUserIds: ['u1'],
      });

      const body = notifService.broadcast.mock.calls[0][3];
      expect(body).toContain('GAS OQMOQDA');
    });
  });

  // ─── triggerScheduleChanged ────────────────────────────────────────────────
  describe('triggerScheduleChanged', () => {
    it('barcha ta\'sirlangan foydalanuvchilarga yuboriladi', async () => {
      await service.triggerScheduleChanged({
        affectedUserIds: ['t1', 's1', 's2'],
        subjectName: 'Ingliz',
        newTime: '10:00–12:00',
        lessonDate: new Date('2024-01-20'),
      });

      expect(notifService.broadcast).toHaveBeenCalledWith(
        ['t1', 's1', 's2'],
        NotificationType.SCHEDULE,
        expect.any(String),
        expect.stringContaining('10:00–12:00'),
      );
    });
  });
});
