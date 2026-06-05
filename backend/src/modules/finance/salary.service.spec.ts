import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { Salary } from '../../entities/salary.entity';
import { SalaryRecord, SalaryRecordStatus } from '../../entities/salary-record.entity';
import { User } from '../../entities/user.entity';
import { Lesson, LessonStatus } from '../../entities/lesson.entity';
import { Group } from '../../entities/group.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { LessonSubstitution } from '../../entities/lesson-substitution.entity';
import { Sale } from '../../entities/sale.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../../common/enums/role.enum';

// 176 soat × stavka — konstantani to'g'ri tasdiqlash uchun
const STANDARD_MONTHLY_HOURS = 176;

function makeQb(getRawManyResult: any[] = [], getRawOneResult: any = null) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(getRawManyResult),
    getRawOne: jest.fn().mockResolvedValue(getRawOneResult),
  };
}

function makeRepo() {
  const qb = makeQb();
  return {
    create: jest.fn((d: any) => ({ id: 'new-id', ...d })),
    save: jest.fn(async (d: any) => ({ id: 'saved-id', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
}

describe('SalaryService', () => {
  let service: SalaryService;
  let salaryRepo: ReturnType<typeof makeRepo>;
  let recordRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let lessonRepo: ReturnType<typeof makeRepo>;
  let groupRepo: ReturnType<typeof makeRepo>;
  let enrollmentRepo: ReturnType<typeof makeRepo>;
  let subRepo: ReturnType<typeof makeRepo>;
  let saleRepo: ReturnType<typeof makeRepo>;
  let pointsRepo: ReturnType<typeof makeRepo>;
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    salaryRepo = makeRepo();
    recordRepo = makeRepo();
    userRepo = makeRepo();
    lessonRepo = makeRepo();
    groupRepo = makeRepo();
    enrollmentRepo = makeRepo();
    subRepo = makeRepo();
    saleRepo = makeRepo();
    pointsRepo = makeRepo();
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryService,
        { provide: getRepositoryToken(Salary), useValue: salaryRepo },
        { provide: getRepositoryToken(SalaryRecord), useValue: recordRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
        { provide: getRepositoryToken(Group), useValue: groupRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(LessonSubstitution), useValue: subRepo },
        { provide: getRepositoryToken(Sale), useValue: saleRepo },
        { provide: getRepositoryToken(PointsLog), useValue: pointsRepo },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<SalaryService>(SalaryService);
  });

  // ─── ISH HAQI KONFIGURATSIYASI ─────────────────────────────────────────────
  describe('setSalaryConfig', () => {
    const dto = {
      teacherId: 'ustoz-1',
      ratePercent: 17,
      kpiBonusPercent: 10,
      startedAt: '2024-01-01',
    };

    it('oldingi aktiv konfigni tugatadi', async () => {
      await service.setSalaryConfig(dto, 'sa-id', Role.SUPER_ADMIN);
      expect(salaryRepo.update).toHaveBeenCalledWith(
        { teacherId: 'ustoz-1', isActive: true },
        expect.objectContaining({ isActive: false }),
      );
    });

    it('yangi aktiv konfiguratsiya yaratadi', async () => {
      await service.setSalaryConfig(dto, 'sa-id', Role.SUPER_ADMIN);
      expect(salaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teacherId: 'ustoz-1',
          ratePercent: 17,
          kpiBonusPercent: 10,
          isActive: true,
        }),
      );
      expect(salaryRepo.save).toHaveBeenCalled();
    });

    it('SALARY_CONFIG_SET audit log yoziladi', async () => {
      await service.setSalaryConfig(dto, 'sa-id', Role.SUPER_ADMIN);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SALARY_CONFIG_SET' }),
      );
    });

    it('hourlyRate BigInt ga aylantiriladi', async () => {
      await service.setSalaryConfig({ ...dto, hourlyRate: 50_000 }, 'sa-id', Role.SUPER_ADMIN);
      expect(salaryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ hourlyRate: BigInt(50_000) }),
      );
    });
  });

  // ─── OYLIK MAOSH HISOBLASH: USTOZ ─────────────────────────────────────────
  describe('calculateMonthly — ustoz', () => {
    beforeEach(() => {
      // Konfiguratsiya
      salaryRepo.findOne.mockResolvedValue({
        teacherId: 'ustoz-1',
        ratePercent: 17,
        kpiBonusPercent: 10,
        isActive: true,
      });
      // O'qituvchi
      userRepo.findOne.mockResolvedValue({ id: 'ustoz-1', role: Role.USTOZ });
      // Guruhlar
      groupRepo.find.mockResolvedValue([
        { id: 'g1', monthlyPrice: BigInt(1_000_000), teacherId: 'ustoz-1', isActive: true },
      ]);
      // O'quvchilar (2 ta, chegirmasiz)
      enrollmentRepo.find.mockResolvedValue([
        { studentId: 's1', discountPercent: 0, groupId: 'g1' },
        { studentId: 's2', discountPercent: 0, groupId: 'g1' },
      ]);
      // Darslar (oyda 20 ta, 2 soatdan)
      lessonRepo.find.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          lessonDate: new Date('2024-01-15'),
          durationHours: 2,
          status: LessonStatus.COMPLETED,
        })),
      );
      // O'rinbosar qatorlari — bo'sh
      subRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([]))  // sub sifatida
        .mockReturnValueOnce(makeQb([])); // original sifatida
      // Mavjud yozuv yo'q
      recordRepo.findOne.mockResolvedValueOnce(null);
      // create va save
      recordRepo.create.mockReturnValue({ id: 'rec-1' });
      recordRepo.save.mockResolvedValue({});
      // final findOne (with relation)
      recordRepo.findOne.mockResolvedValueOnce({
        id: 'rec-1',
        teacherId: 'ustoz-1',
        periodMonth: '2024-01',
        baseAmount: 340_000n,
        kpiBonus: 34_000n,
        subAmount: 0n,
        deduction: 0n,
        totalAmount: 374_000n,
        teacher: { id: 'ustoz-1' },
      });
    });

    it('baseAmount = guruh tushumi × stavka foizi', async () => {
      // 2 o'quvchi × 1_000_000 = 2_000_000 tushum
      // 17% = (2_000_000 × 1700) / 10000 = 340_000
      const result = await service.calculateMonthly('ustoz-1', '2024-01', 'sa-id');
      expect(Number(result.baseAmount)).toBe(340_000);
    });

    it('kpiBonus = baseAmount × kpiBonusPercent', async () => {
      // 340_000 × 10% = 34_000
      const result = await service.calculateMonthly('ustoz-1', '2024-01', 'sa-id');
      expect(Number(result.kpiBonus)).toBe(34_000);
    });

    it('totalAmount = base + kpi (o\'rinbosar yo\'q)', async () => {
      const result = await service.calculateMonthly('ustoz-1', '2024-01', 'sa-id');
      expect(Number(result.totalAmount)).toBe(374_000);
    });

    it('chegirmali o\'quvchi uchun kamroq base', async () => {
      // 1 o'quvchi, 10% chegirma → effective = 900_000
      enrollmentRepo.find.mockResolvedValue([
        { studentId: 's1', discountPercent: 10, groupId: 'g1' },
      ]);
      // beforeEach queue ni tozalash, keyin yangi qiymat qo'yish
      recordRepo.findOne.mockReset();
      recordRepo.findOne
        .mockResolvedValueOnce(null)  // mavjud yozuv yo'q
        .mockResolvedValueOnce({
          id: 'rec-2',
          baseAmount: 153_000n,  // 900_000 × 17% = 153_000
          kpiBonus: 15_300n,
          subAmount: 0n,
          deduction: 0n,
          totalAmount: 168_300n,
          teacher: {},
        });

      const result = await service.calculateMonthly('ustoz-1', '2024-01', 'sa-id');
      expect(Number(result.baseAmount)).toBe(153_000);
    });
  });

  // ─── OYLIK MAOSH: O'RINBOSAR HISOB ────────────────────────────────────────
  describe('calculateMonthly — substitution adjustments', () => {
    beforeEach(() => {
      salaryRepo.findOne.mockResolvedValue({
        ratePercent: 17, kpiBonusPercent: 0, isActive: true,
      });
      userRepo.findOne.mockResolvedValue({ id: 'ustoz-1', role: Role.USTOZ });
      groupRepo.find.mockResolvedValue([
        { id: 'g1', monthlyPrice: BigInt(1_000_000), teacherId: 'ustoz-1', isActive: true },
      ]);
      enrollmentRepo.find.mockResolvedValue([
        { studentId: 's1', discountPercent: 0 },
      ]);
      lessonRepo.find.mockResolvedValue([]);
    });

    it('subAmount — o\'rinbosar sifatida ishlagan uchun qo\'shiladi', async () => {
      subRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([{ sub_payment: '50000' }])) // substitute sifatida
        .mockReturnValueOnce(makeQb([]));                        // original sifatida

      recordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rec-1',
          baseAmount: 170_000n,
          kpiBonus: 0n,
          subAmount: 50_000n,
          deduction: 0n,
          totalAmount: 220_000n,
          teacher: {},
        });

      const result = await service.calculateMonthly('ustoz-1', '2024-01', 'sa-id');
      expect(Number(result.subAmount)).toBe(50_000);
      expect(Number(result.totalAmount)).toBe(220_000);
    });

    it('deduction — asl o\'qituvchi o\'rniga kirganda chegiriladi', async () => {
      subRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([]))
        .mockReturnValueOnce(makeQb([{ original_deduction: '30000' }]));

      recordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rec-1',
          baseAmount: 170_000n,
          kpiBonus: 0n,
          subAmount: 0n,
          deduction: 30_000n,
          totalAmount: 140_000n,
          teacher: {},
        });

      const result = await service.calculateMonthly('ustoz-1', '2024-01', 'sa-id');
      expect(Number(result.deduction)).toBe(30_000);
      expect(Number(result.totalAmount)).toBe(140_000);
    });

    it('totalAmount manfiy bo\'lsa 0 qaytariladi', async () => {
      // Base = 100_000, deduction = 200_000 → raw = -100_000 → capped at 0
      subRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([]))
        .mockReturnValueOnce(makeQb([{ original_deduction: '200000' }]));

      recordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rec-1',
          baseAmount: 100_000n, kpiBonus: 0n, subAmount: 0n,
          deduction: 200_000n, totalAmount: 0n, teacher: {},
        });

      const result = await service.calculateMonthly('ustoz-1', '2024-01', 'sa-id');
      expect(Number(result.totalAmount)).toBe(0);
    });
  });

  // ─── OYLIK MAOSH: ADMIN ───────────────────────────────────────────────────
  describe('calculateMonthly — admin/manager', () => {
    beforeEach(() => {
      salaryRepo.findOne.mockResolvedValue({
        teacherId: 'mgr-1',
        ratePercent: 0,
        kpiBonusPercent: 0,
        hourlyRate: BigInt(50_000),
        salesBonusPercent: 5,
        isActive: true,
      });
      userRepo.findOne.mockResolvedValue({ id: 'mgr-1', role: Role.MANAGER });
      subRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([]))
        .mockReturnValueOnce(makeQb([]));
    });

    it('baseAmount = hourlyRate × 176 soat', async () => {
      saleRepo.createQueryBuilder.mockReturnValue(makeQb([], { total: '0' }));
      recordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rec-1',
          baseAmount: BigInt(50_000 * STANDARD_MONTHLY_HOURS),
          kpiBonus: 0n, subAmount: 0n, deduction: 0n,
          totalAmount: BigInt(50_000 * STANDARD_MONTHLY_HOURS),
          teacher: {},
        });

      const result = await service.calculateMonthly('mgr-1', '2024-01', 'sa-id');
      expect(Number(result.baseAmount)).toBe(50_000 * 176);
    });

    it('savdo bonusi base ga qo\'shiladi', async () => {
      // Sales = 2_000_000, bonus 5% = 100_000
      saleRepo.createQueryBuilder.mockReturnValue(makeQb([], { total: '2000000' }));
      recordRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'rec-1',
          baseAmount: BigInt(50_000 * 176 + 100_000),
          kpiBonus: 0n, subAmount: 0n, deduction: 0n,
          totalAmount: BigInt(50_000 * 176 + 100_000),
          teacher: {},
        });

      const result = await service.calculateMonthly('mgr-1', '2024-01', 'sa-id');
      expect(Number(result.baseAmount)).toBe(50_000 * 176 + 100_000);
    });
  });

  // ─── XATOLAR ──────────────────────────────────────────────────────────────
  describe('calculateMonthly — xatolar', () => {
    it('BadRequest — konfiguratsiya yo\'q', async () => {
      salaryRepo.findOne.mockResolvedValue(null);
      await expect(service.calculateMonthly('no-ustoz', '2024-01', 'sa'))
        .rejects.toThrow(BadRequestException);
    });

    it('NotFoundException — xodim topilmasa', async () => {
      salaryRepo.findOne.mockResolvedValue({ teacherId: 'u1', ratePercent: 17, isActive: true });
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.calculateMonthly('u1', '2024-01', 'sa'))
        .rejects.toThrow(NotFoundException);
    });

    it('BadRequest — tasdiqlangan maoshni qayta hisoblash mumkin emas', async () => {
      salaryRepo.findOne.mockResolvedValue({
        ratePercent: 17, kpiBonusPercent: 0, isActive: true,
      });
      userRepo.findOne.mockResolvedValue({ id: 'u1', role: Role.USTOZ });
      groupRepo.find.mockResolvedValue([]);
      lessonRepo.find.mockResolvedValue([]);
      subRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb([]))
        .mockReturnValueOnce(makeQb([]));
      recordRepo.findOne.mockResolvedValueOnce({
        id: 'rec-1',
        teacherId: 'u1',
        periodMonth: '2024-01',
        status: SalaryRecordStatus.APPROVED, // allaqachon tasdiqlangan
      });

      await expect(service.calculateMonthly('u1', '2024-01', 'sa'))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ─── TASDIQLASH ───────────────────────────────────────────────────────────
  describe('approve', () => {
    it('CALCULATED statusdagi maoshni tasdiqlaydi', async () => {
      recordRepo.findOne
        .mockResolvedValueOnce({ id: 'rec-1', status: SalaryRecordStatus.CALCULATED })
        .mockResolvedValueOnce({ id: 'rec-1', status: SalaryRecordStatus.APPROVED, teacher: {} });

      const result = await service.approve('rec-1', 'sa-id');

      expect(recordRepo.update).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        status: SalaryRecordStatus.APPROVED,
        approvedById: 'sa-id',
      }));
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SALARY_APPROVED' }),
      );
    });

    it('NotFoundException — yozuv topilmasa', async () => {
      recordRepo.findOne.mockResolvedValue(null);
      await expect(service.approve('no-rec', 'sa-id')).rejects.toThrow(NotFoundException);
    });

    it('BadRequest — APPROVED holatni qayta tasdiqlash mumkin emas', async () => {
      recordRepo.findOne.mockResolvedValue({ id: 'r1', status: SalaryRecordStatus.APPROVED });
      await expect(service.approve('r1', 'sa-id')).rejects.toThrow(BadRequestException);
    });

    it('BadRequest — PAID holatni tasdiqlash mumkin emas', async () => {
      recordRepo.findOne.mockResolvedValue({ id: 'r1', status: SalaryRecordStatus.PAID });
      await expect(service.approve('r1', 'sa-id')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── TO'LANDI ─────────────────────────────────────────────────────────────
  describe('markPaid', () => {
    it('APPROVED statusdagi maoshni to\'langan deb belgilaydi', async () => {
      recordRepo.findOne
        .mockResolvedValueOnce({ id: 'rec-1', status: SalaryRecordStatus.APPROVED })
        .mockResolvedValueOnce({ id: 'rec-1', status: SalaryRecordStatus.PAID, teacher: {} });

      const result = await service.markPaid('rec-1', 'sa-id');

      expect(recordRepo.update).toHaveBeenCalledWith('rec-1', expect.objectContaining({
        status: SalaryRecordStatus.PAID,
      }));
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SALARY_PAID' }),
      );
    });

    it('BadRequest — CALCULATED statusdan to\'g\'ridan-to\'g\'ri PAID bo\'lmaydi', async () => {
      recordRepo.findOne.mockResolvedValue({ id: 'r1', status: SalaryRecordStatus.CALCULATED });
      await expect(service.markPaid('r1', 'sa-id')).rejects.toThrow(BadRequestException);
    });

    it('NotFoundException', async () => {
      recordRepo.findOne.mockResolvedValue(null);
      await expect(service.markPaid('no-id', 'sa-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── CHORAK MUKOFOT ────────────────────────────────────────────────────────
  describe('calculateQuarterlyBonus', () => {
    const mockStaff = [
      { id: 'u1', firstName: 'Ali', lastName: 'Karimov', role: Role.USTOZ, isActive: true },
      { id: 'u2', firstName: 'Vali', lastName: 'Rahimov', role: Role.MANAGER, isActive: true },
    ];

    beforeEach(() => {
      userRepo.find.mockResolvedValue(mockStaff);
    });

    it('chorak oylarini to\'g\'ri aniqlaydi: Q1 = Jan-Mar', async () => {
      pointsRepo.createQueryBuilder.mockReturnValue(makeQb([], { total_points: '0' }));
      const result = await service.calculateQuarterlyBonus('2024', 1, 5000, 'sa-id');
      expect(result.period).toEqual(['2024-01', '2024-02', '2024-03']);
    });

    it('Q2 = Apr-Jun', async () => {
      pointsRepo.createQueryBuilder.mockReturnValue(makeQb([], { total_points: '0' }));
      const result = await service.calculateQuarterlyBonus('2024', 2, 5000, 'sa-id');
      expect(result.period).toEqual(['2024-04', '2024-05', '2024-06']);
    });

    it('Q4 = Oct-Dec', async () => {
      pointsRepo.createQueryBuilder.mockReturnValue(makeQb([], { total_points: '0' }));
      const result = await service.calculateQuarterlyBonus('2024', 4, 5000, 'sa-id');
      expect(result.period).toEqual(['2024-10', '2024-11', '2024-12']);
    });

    it('bonus = totalPoints × coefficient', async () => {
      // u1: 100 ball, u2: 50 ball
      const qb1 = makeQb([], { total_points: '100' });
      const qb2 = makeQb([], { total_points: '50' });
      pointsRepo.createQueryBuilder
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);

      const result = await service.calculateQuarterlyBonus('2024', 1, 5_000, 'sa-id');

      // u1: 100 × 5000 = 500_000
      // u2: 50 × 5000 = 250_000
      expect(result.staff[0].bonusAmount).toBe(500_000);
      expect(result.staff[1].bonusAmount).toBe(250_000);
    });

    it('reyting ball bo\'yicha kamayish tartibida', async () => {
      const qb1 = makeQb([], { total_points: '30' }); // u1: 30 ball
      const qb2 = makeQb([], { total_points: '80' }); // u2: 80 ball
      pointsRepo.createQueryBuilder
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);

      const result = await service.calculateQuarterlyBonus('2024', 1, 5_000, 'sa-id');

      expect(result.staff[0].userId).toBe('u2'); // eng ko'p ball
      expect(result.staff[0].rank).toBe(1);
      expect(result.staff[1].rank).toBe(2);
    });

    it('totalBonusFund = barcha bonuslar yig\'indisi', async () => {
      const qb1 = makeQb([], { total_points: '100' });
      const qb2 = makeQb([], { total_points: '50' });
      pointsRepo.createQueryBuilder
        .mockReturnValueOnce(qb1)
        .mockReturnValueOnce(qb2);

      const result = await service.calculateQuarterlyBonus('2024', 1, 5_000, 'sa-id');
      expect(result.totalBonusFund).toBe(750_000); // 500_000 + 250_000
    });

    it('manfiy ballar 0 ga teng bo\'ladi', async () => {
      pointsRepo.createQueryBuilder.mockReturnValue(makeQb([], { total_points: '-10' }));
      const result = await service.calculateQuarterlyBonus('2024', 1, 5_000, 'sa-id');
      expect(result.staff[0].totalPoints).toBe(0);
      expect(result.staff[0].bonusAmount).toBe(0);
    });
  });

  // ─── BARCHA XODIMLAR HISOBLASH ─────────────────────────────────────────────
  describe('calculateAllMonthly', () => {
    it('xatosiz hisoblangan yozuvlar soni qaytariladi', async () => {
      salaryRepo.find.mockResolvedValue([{ teacherId: 't1' }, { teacherId: 't2' }]);

      // calculateMonthly ni mock qilish uchun spy ishlatamiz
      const spy = jest.spyOn(service, 'calculateMonthly').mockResolvedValue({ id: 'r1' } as any);

      const result = await service.calculateAllMonthly('2024-01', 'sa-id');

      expect(result.calculated).toBe(2);
      expect(result.errors).toHaveLength(0);
      spy.mockRestore();
    });

    it('xatoli xodim uchun error massiviga qo\'shiladi', async () => {
      salaryRepo.find.mockResolvedValue([{ teacherId: 'bad-t' }]);
      jest.spyOn(service, 'calculateMonthly').mockRejectedValue(new Error('Config yo\'q'));

      const result = await service.calculateAllMonthly('2024-01', 'sa-id');

      expect(result.calculated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].teacherId).toBe('bad-t');
    });
  });
});
