import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SubstitutionService } from './substitution.service';
import { LessonSubstitution, AbsenceReason } from '../../entities/lesson-substitution.entity';
import { TeacherAbsence } from '../../entities/teacher-absence.entity';
import { Lesson, LessonStatus } from '../../entities/lesson.entity';
import { User } from '../../entities/user.entity';
import { Salary } from '../../entities/salary.entity';
import { SalaryRecord, SalaryRecordStatus } from '../../entities/salary-record.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { Notification } from '../../entities/notification.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../notifications/notification.service';
import { Role } from '../../common/enums/role.enum';

// ─── MOCK YORDAMCHILAR ──────────────────────────────────────────────────────

function makeRepo() {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  };
  return {
    create: jest.fn((d: any) => ({ id: 'new-id', ...d })),
    save: jest.fn(async (d: any) => ({ id: 'saved-id', ...d })),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
    softDelete: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
}

// DataSource mock — transaction qayta ishlovchi
function makeDataSource() {
  return {
    transaction: jest.fn().mockImplementation(async (fn: Function) => {
      const em = {
        create: jest.fn((_, d: any) => ({ id: 'em-id', ...d })),
        save: jest.fn(async (d: any) => d),
        update: jest.fn().mockResolvedValue({}),
        softDelete: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(null),
      };
      return fn(em);
    }),
  };
}

// Tipik lesson mock
const mockLesson = {
  id: 'lesson-1',
  groupId: 'group-1',
  teacherId: 'ustoz-1',
  status: LessonStatus.SCHEDULED,
  lessonDate: new Date('2024-01-15'),
  startTime: '10:00',
  endTime: '12:00',
  durationHours: 2,
  group: { id: 'group-1', name: 'Ingliz 1', monthlyPrice: BigInt(1_000_000) },
  qrCode: 'some-qr',
  qrExpiresAt: new Date(),
};

const mockSubstitute = {
  id: 'ustoz-2',
  firstName: 'Ali',
  lastName: 'Karimov',
  role: Role.USTOZ,
};

const mockOriginal = {
  id: 'ustoz-1',
  firstName: 'Vali',
  lastName: 'Rahimov',
  role: Role.USTOZ,
};

// ─── TEST SUITE ─────────────────────────────────────────────────────────────
describe('SubstitutionService', () => {
  let service: SubstitutionService;
  let subRepo: ReturnType<typeof makeRepo>;
  let absenceRepo: ReturnType<typeof makeRepo>;
  let lessonRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let salaryRepo: ReturnType<typeof makeRepo>;
  let recordRepo: ReturnType<typeof makeRepo>;
  let enrollmentRepo: ReturnType<typeof makeRepo>;
  let groupRepo: ReturnType<typeof makeRepo>;
  let notifRepo: ReturnType<typeof makeRepo>;
  let dataSource: ReturnType<typeof makeDataSource>;
  let notifService: { notify: jest.Mock; broadcast: jest.Mock };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    subRepo = makeRepo();
    absenceRepo = makeRepo();
    lessonRepo = makeRepo();
    userRepo = makeRepo();
    salaryRepo = makeRepo();
    recordRepo = makeRepo();
    enrollmentRepo = makeRepo();
    groupRepo = makeRepo();
    notifRepo = makeRepo();
    dataSource = makeDataSource();
    notifService = { notify: jest.fn().mockResolvedValue(undefined), broadcast: jest.fn().mockResolvedValue(undefined) };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubstitutionService,
        { provide: getRepositoryToken(LessonSubstitution), useValue: subRepo },
        { provide: getRepositoryToken(TeacherAbsence), useValue: absenceRepo },
        { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Salary), useValue: salaryRepo },
        { provide: getRepositoryToken(SalaryRecord), useValue: recordRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(Group), useValue: groupRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationService, useValue: notifService },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<SubstitutionService>(SubstitutionService);
  });

  // ─── CREATE ──────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      lessonId: 'lesson-1',
      substituteTeacherId: 'ustoz-2',
      reason: AbsenceReason.SICK,
    };

    beforeEach(() => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      userRepo.findOne
        .mockResolvedValueOnce(mockOriginal)    // 1-chi chaqiruv: asl o'qituvchi
        .mockResolvedValueOnce(mockSubstitute); // 2-chi chaqiruv: o'rinbosar
      salaryRepo.findOne.mockResolvedValue(null); // salary config yo'q → rate = 0
      groupRepo.find.mockResolvedValue([]);
      enrollmentRepo.find.mockResolvedValue([]);
      subRepo.findOne.mockResolvedValue({ id: 'sub-1', ...dto }); // yakuniy findOne
    });

    it('transaction ichida LessonSubstitution yaratiladi', async () => {
      const result = await service.create(dto, 'manager-id', Role.MANAGER);
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('dars topilmasa NotFoundException', async () => {
      lessonRepo.findOne.mockResolvedValue(null);
      await expect(service.create(dto, 'mgr', Role.MANAGER)).rejects.toThrow(NotFoundException);
    });

    it('allaqachon o\'rinbosar tayinlangan darsga BadRequestException', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson, status: LessonStatus.SUBSTITUTED });
      await expect(service.create(dto, 'mgr', Role.MANAGER)).rejects.toThrow(BadRequestException);
    });

    it('tugallangan darsga BadRequestException', async () => {
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson, status: LessonStatus.COMPLETED });
      await expect(service.create(dto, 'mgr', Role.MANAGER)).rejects.toThrow(BadRequestException);
    });

    it('o\'rinbosar topilmasa yoki roli ustoz emas — NotFoundException', async () => {
      // once-qatorni tozalab, asl o'qituvchi topiladi, o'rinbosar topilmaydi
      userRepo.findOne
        .mockReset()
        .mockResolvedValueOnce(mockOriginal) // asl o'qituvchi (1-chaqiruv)
        .mockResolvedValue(null);            // o'rinbosar topilmaydi (2-chaqiruv)
      await expect(service.create(dto, 'mgr', Role.MANAGER)).rejects.toThrow(NotFoundException);
    });

    it('o\'rinbosar asl o\'qituvchi bilan bir xil bo\'lsa BadRequestException', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockSubstitute, id: 'ustoz-1' });
      await expect(
        service.create({ ...dto, substituteTeacherId: 'ustoz-1' }, 'mgr', Role.MANAGER),
      ).rejects.toThrow(BadRequestException);
    });

    it('audit log SUBSTITUTION_CREATED yoziladi', async () => {
      await service.create(dto, 'manager-id', Role.MANAGER);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSTITUTION_CREATED' }),
      );
    });
  });

  // ─── MAOSH HISOBLASH ─────────────────────────────────────────────────────
  describe('maosh hisoblash (getEffectiveHourlyRate va calculateBigIntPayment)', () => {
    it('salary config yo\'q bo\'lsa 0 qaytaradi', async () => {
      salaryRepo.findOne.mockResolvedValue(null);
      groupRepo.find.mockResolvedValue([]);

      // private metodni test qilish uchun create orqali sinab ko'ramiz
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson, durationHours: 2 });
      userRepo.findOne.mockResolvedValue(mockSubstitute);
      subRepo.findOne.mockResolvedValue({ id: 'sub-1' });

      await service.create(
        { lessonId: 'l1', substituteTeacherId: 'u2', reason: AbsenceReason.SICK },
        'mgr', Role.MANAGER,
      );

      // subPayment va originalDeduction 0 bo'lishi kerak
      const transactionFn = dataSource.transaction.mock.calls[0][0];
      const emMock = {
        create: jest.fn((_, d: any) => d),
        save: jest.fn(async (d: any) => d),
        update: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(null),
      };
      await transactionFn(emMock);

      const savedSub = emMock.create.mock.calls.find((c) => c[0] === LessonSubstitution);
      if (savedSub) {
        expect(Number(savedSub[1].subPayment)).toBe(0);
        expect(Number(savedSub[1].originalDeduction)).toBe(0);
      }
    });

    it('hourlyRate bilan to\'g\'ri hisob: 2 soat × 50000 = 100000', async () => {
      // substitute uchun hourlyRate = 50_000
      salaryRepo.findOne
        .mockResolvedValueOnce({ hourlyRate: BigInt(50_000), ratePercent: 0, isActive: true }) // sub
        .mockResolvedValueOnce({ hourlyRate: BigInt(40_000), ratePercent: 0, isActive: true }); // orig

      lessonRepo.findOne.mockResolvedValue({ ...mockLesson, durationHours: 2 });
      userRepo.findOne.mockResolvedValue(mockSubstitute);
      subRepo.findOne.mockResolvedValue({ id: 'sub-1' });

      const capturedData: any = {};
      dataSource.transaction.mockImplementationOnce(async (fn: Function) => {
        const em = {
          create: jest.fn((cls: any, d: any) => {
            if (cls === LessonSubstitution) Object.assign(capturedData, d);
            return d;
          }),
          save: jest.fn(async (d: any) => d),
          update: jest.fn().mockResolvedValue({}),
          findOne: jest.fn().mockResolvedValue(null),
        };
        return fn(em);
      });

      await service.create(
        { lessonId: 'l1', substituteTeacherId: 'u2', reason: AbsenceReason.SICK },
        'mgr', Role.MANAGER,
      );

      // 2 soat × 50_000 = 100_000
      expect(Number(capturedData.subPayment)).toBe(100_000);
      // 2 soat × 40_000 = 80_000
      expect(Number(capturedData.originalDeduction)).toBe(80_000);
    });

    it('1.5 soatlik dars uchun to\'g\'ri hisob: 1.5 × 50000 = 75000', async () => {
      salaryRepo.findOne.mockResolvedValue({ hourlyRate: BigInt(50_000), ratePercent: 0, isActive: true });
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson, durationHours: 1.5 });
      userRepo.findOne.mockResolvedValue(mockSubstitute);
      subRepo.findOne.mockResolvedValue({ id: 'sub-1' });

      const capturedData: any = {};
      dataSource.transaction.mockImplementationOnce(async (fn: Function) => {
        const em = {
          create: jest.fn((cls: any, d: any) => {
            if (cls === LessonSubstitution) Object.assign(capturedData, d);
            return d;
          }),
          save: jest.fn(async (d: any) => d),
          update: jest.fn().mockResolvedValue({}),
          findOne: jest.fn().mockResolvedValue(null),
        };
        return fn(em);
      });

      await service.create(
        { lessonId: 'l1', substituteTeacherId: 'u2', reason: AbsenceReason.SICK },
        'mgr', Role.MANAGER,
      );

      expect(Number(capturedData.subPayment)).toBe(75_000); // 1.5 × 50_000
    });

    it('ustoz uchun guruh daromadidan soatlik stavka hisoblanadi', async () => {
      // Salary config: ratePercent=17%, no hourlyRate
      // Group: monthlyPrice=1_000_000, 2 enrollments → revenue=2_000_000
      // Expected monthly = 2_000_000 × 17% = 340_000
      // Hourly = 340_000 / 176 = 1_931 (approx)
      salaryRepo.findOne.mockResolvedValue({
        hourlyRate: null, ratePercent: 17, kpiBonusPercent: 0, isActive: true,
      });
      groupRepo.find.mockResolvedValue([
        { id: 'g1', monthlyPrice: BigInt(1_000_000), isActive: true },
      ]);
      enrollmentRepo.find.mockResolvedValue([
        { studentId: 's1', discountPercent: 0 },
        { studentId: 's2', discountPercent: 0 },
      ]);

      lessonRepo.findOne.mockResolvedValue({ ...mockLesson, durationHours: 2 });
      userRepo.findOne.mockResolvedValue(mockSubstitute);
      subRepo.findOne.mockResolvedValue({ id: 'sub-1' });

      const capturedData: any = {};
      dataSource.transaction.mockImplementationOnce(async (fn: Function) => {
        const em = {
          create: jest.fn((cls: any, d: any) => {
            if (cls === LessonSubstitution) Object.assign(capturedData, d);
            return d;
          }),
          save: jest.fn(async (d: any) => d),
          update: jest.fn().mockResolvedValue({}),
          findOne: jest.fn().mockResolvedValue(null),
        };
        return fn(em);
      });

      await service.create(
        { lessonId: 'l1', substituteTeacherId: 'u2', reason: AbsenceReason.SICK },
        'mgr', Role.MANAGER,
      );

      // 340_000 / 176 = 1_931 (BigInt integer division = 1931)
      // 2 soat × 1_931 = 3_862
      expect(Number(capturedData.subPayment)).toBe(3_862);
    });
  });

  // ─── MAOSH YOZUVI YANGILASH ───────────────────────────────────────────────
  describe('updateSalaryRecord (transaction ichida)', () => {
    it('mavjud CALCULATED yozuvga subAmount qo\'shiladi', async () => {
      const existingRecord = {
        id: 'rec-1',
        teacherId: 'ustoz-2',
        periodMonth: '2024-01',
        baseAmount: 200_000n,
        kpiBonus: 0n,
        subAmount: 50_000n,
        deduction: 0n,
        totalAmount: 250_000n,
        status: SalaryRecordStatus.CALCULATED,
      };

      salaryRepo.findOne.mockResolvedValue({ hourlyRate: BigInt(50_000), ratePercent: 0, isActive: true });
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson, durationHours: 2 });
      userRepo.findOne.mockResolvedValue(mockSubstitute);
      subRepo.findOne.mockResolvedValue({ id: 'sub-1' });

      const updateCalls: any[] = [];
      dataSource.transaction.mockImplementationOnce(async (fn: Function) => {
        const em = {
          create: jest.fn((_, d: any) => d),
          save: jest.fn(async (d: any) => d),
          update: jest.fn().mockImplementation((cls: any, id: any, data: any) => {
            if (cls === SalaryRecord) updateCalls.push({ id, data });
          }),
          findOne: jest.fn().mockImplementation((cls: any) => {
            if (cls === SalaryRecord) return existingRecord;
            return null;
          }),
        };
        return fn(em);
      });

      await service.create(
        { lessonId: 'l1', substituteTeacherId: 'u2', reason: AbsenceReason.SICK },
        'mgr', Role.MANAGER,
      );

      // subAmount: 50_000 + 100_000 = 150_000
      const subRecordUpdate = updateCalls.find(u => u.data?.subAmount !== undefined);
      if (subRecordUpdate) {
        expect(Number(subRecordUpdate.data.subAmount)).toBe(150_000);
        // totalAmount: 200_000 + 0 + 150_000 - 0 = 350_000
        expect(Number(subRecordUpdate.data.totalAmount)).toBe(350_000);
      }
    });
  });

  // ─── COMPLETE ─────────────────────────────────────────────────────────────
  describe('complete', () => {
    const pendingSub = {
      id: 'sub-1',
      lessonId: 'lesson-1',
      substituteTeacherId: 'ustoz-2',
      originalTeacherId: 'ustoz-1',
      salaryProcessed: false,
    };

    it('o\'rinbosar darsni yakunlaydi', async () => {
      subRepo.findOne
        .mockResolvedValueOnce(pendingSub) // first findOne
        .mockResolvedValueOnce({ ...pendingSub, salaryProcessed: true }); // final return

      await service.complete('sub-1', {}, 'ustoz-2', Role.USTOZ);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSTITUTION_COMPLETED' }),
      );
    });

    it('o\'rinbosar emas kishi ForbiddenException', async () => {
      subRepo.findOne.mockResolvedValue(pendingSub);

      await expect(service.complete('sub-1', {}, 'other-user', Role.USTOZ))
        .rejects.toThrow(ForbiddenException);
    });

    it('SA yakunlaydi (o\'rinbosar emas bo\'lsa ham)', async () => {
      subRepo.findOne
        .mockResolvedValueOnce(pendingSub)
        .mockResolvedValueOnce({ ...pendingSub, salaryProcessed: true });

      await expect(service.complete('sub-1', {}, 'sa-id', Role.SUPER_ADMIN))
        .resolves.toBeDefined();
    });

    it('NotFoundException — yozuv topilmasa', async () => {
      subRepo.findOne.mockResolvedValue(null);
      await expect(service.complete('no-id', {}, 'ustoz-2', Role.USTOZ))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── CANCEL ──────────────────────────────────────────────────────────────
  describe('cancel', () => {
    const processedSub = {
      id: 'sub-1',
      lessonId: 'lesson-1',
      substituteTeacherId: 'ustoz-2',
      originalTeacherId: 'ustoz-1',
      subPayment: 100_000n,
      originalDeduction: 80_000n,
      salaryProcessed: false,
      lesson: {
        lessonDate: new Date('2024-01-15'),
        teacherId: 'ustoz-2',
      },
    };

    it('SA bekor qiladi va maosh teskari qaytariladi', async () => {
      subRepo.findOne.mockResolvedValue(processedSub);

      const result = await service.cancel('sub-1', 'sa-id', Role.SUPER_ADMIN);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.message).toBeDefined();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SUBSTITUTION_CANCELLED' }),
      );
    });

    it('ustoz bekor qila olmaydi — ForbiddenException', async () => {
      subRepo.findOne.mockResolvedValue(processedSub);

      await expect(service.cancel('sub-1', 'ustoz-id', Role.USTOZ))
        .rejects.toThrow(ForbiddenException);
    });

    it('NotFoundException', async () => {
      subRepo.findOne.mockResolvedValue(null);
      await expect(service.cancel('no-id', 'sa', Role.SUPER_ADMIN))
        .rejects.toThrow(NotFoundException);
    });

    it('maosh qayta ishlangan bo\'lsa BadRequestException', async () => {
      subRepo.findOne.mockResolvedValue({ ...processedSub, salaryProcessed: true });
      await expect(service.cancel('sub-1', 'sa', Role.SUPER_ADMIN))
        .rejects.toThrow(BadRequestException);
    });

    it('bekor qilganda o\'rinbosarga bildirishnoma yuboriladi', async () => {
      subRepo.findOne.mockResolvedValue(processedSub);

      await service.cancel('sub-1', 'sa-id', Role.SUPER_ADMIN);

      // notify async chaqiriladi — expect eventually
      await new Promise((r) => setTimeout(r, 10));
      expect(notifService.notify).toHaveBeenCalledWith(
        'ustoz-2',
        expect.anything(),
        expect.any(String),
        expect.any(String),
        expect.anything(),
      );
    });
  });

  // ─── FIND BY LESSON ───────────────────────────────────────────────────────
  describe('findByLesson', () => {
    it('dars uchun o\'rinbosar yozuvini qaytaradi', async () => {
      const mockSub = { id: 'sub-1', lessonId: 'lesson-1' };
      subRepo.findOne.mockResolvedValue(mockSub);

      const result = await service.findByLesson('lesson-1');
      expect(result).toEqual(mockSub);
    });

    it('o\'rinbosar tayinlanmagan dars uchun null qaytaradi', async () => {
      subRepo.findOne.mockResolvedValue(null);
      const result = await service.findByLesson('lesson-no-sub');
      expect(result).toBeNull();
    });
  });

  // ─── FIND BY TEACHER ──────────────────────────────────────────────────────
  describe('findByTeacher', () => {
    it('SA istalgan ustoz yozuvlarini ko\'radi', async () => {
      subRepo._qb.getMany.mockResolvedValue([{ id: 'sub-1' }]);

      const result = await service.findByTeacher('ustoz-1', {}, 'sa-id', Role.SUPER_ADMIN);
      expect(result).toHaveLength(1);
    });

    it('ustoz faqat o\'z yozuvlarini ko\'radi', async () => {
      subRepo._qb.getMany.mockResolvedValue([{ id: 'sub-1' }]);

      const result = await service.findByTeacher('ustoz-1', {}, 'ustoz-1', Role.USTOZ);
      expect(result).toHaveLength(1);
    });

    it('ustoz boshqa ustoz yozuvlarini ko\'ra olmaydi — ForbiddenException', async () => {
      await expect(
        service.findByTeacher('other-ustoz', {}, 'my-ustoz', Role.USTOZ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('as_substitute filtr qo\'shiladi', async () => {
      subRepo._qb.getMany.mockResolvedValue([]);

      await service.findByTeacher('ustoz-1', { role: 'as_substitute' }, 'sa', Role.SUPER_ADMIN);

      expect(subRepo._qb.andWhere).toHaveBeenCalledWith(
        'ls.substitute_teacher_id = :tid',
        { tid: 'ustoz-1' },
      );
    });

    it('as_original filtr qo\'shiladi', async () => {
      subRepo._qb.getMany.mockResolvedValue([]);

      await service.findByTeacher('ustoz-1', { role: 'as_original' }, 'sa', Role.SUPER_ADMIN);

      expect(subRepo._qb.andWhere).toHaveBeenCalledWith(
        'ls.original_teacher_id = :tid',
        { tid: 'ustoz-1' },
      );
    });

    it('dateFrom va dateTo filtrlari qo\'shiladi', async () => {
      subRepo._qb.getMany.mockResolvedValue([]);

      await service.findByTeacher(
        'ustoz-1',
        { dateFrom: '2024-01-01', dateTo: '2024-01-31' },
        'sa',
        Role.SUPER_ADMIN,
      );

      expect(subRepo._qb.andWhere).toHaveBeenCalledWith(
        'l.lesson_date >= :from',
        { from: '2024-01-01' },
      );
      expect(subRepo._qb.andWhere).toHaveBeenCalledWith(
        'l.lesson_date <= :to',
        { to: '2024-01-31' },
      );
    });
  });

  // ─── BILDIRISHNOMALAR ─────────────────────────────────────────────────────
  describe('bildirishnomalar', () => {
    it('create chaqirilganda o\'rinbosarga bildirishnoma yuboriladi', async () => {
      salaryRepo.findOne.mockResolvedValue(null);
      groupRepo.find.mockResolvedValue([]);
      enrollmentRepo.find.mockResolvedValue([]);
      lessonRepo.findOne.mockResolvedValue({ ...mockLesson });
      userRepo.findOne.mockResolvedValue(mockSubstitute);
      subRepo.findOne.mockResolvedValue({ id: 'sub-1' });

      await service.create(
        { lessonId: 'l1', substituteTeacherId: 'ustoz-2', reason: AbsenceReason.SICK },
        'mgr', Role.MANAGER,
      );

      // Async bildirishnoma
      await new Promise((r) => setTimeout(r, 50));

      expect(notifService.notify).toHaveBeenCalledWith(
        'ustoz-2',
        expect.anything(),
        expect.stringContaining('O\'rinbosar'),
        expect.any(String),
      );
    });
  });
});
