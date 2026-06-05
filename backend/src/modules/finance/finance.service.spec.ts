import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FinanceService } from './finance.service';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { Expense } from '../../entities/expense.entity';
import { SalaryRecord } from '../../entities/salary-record.entity';
import { User } from '../../entities/user.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Role } from '../../common/enums/role.enum';

function makeQb(rawOneResult: any = null, rawManyResult: any[] = []) {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawOneResult),
    getRawMany: jest.fn().mockResolvedValue(rawManyResult),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

function makeRepo() {
  const qb = makeQb();
  return {
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
}

describe('FinanceService', () => {
  let service: FinanceService;
  let paymentRepo: ReturnType<typeof makeRepo>;
  let expenseRepo: ReturnType<typeof makeRepo>;
  let recordRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let enrollmentRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    paymentRepo = makeRepo();
    expenseRepo = makeRepo();
    recordRepo = makeRepo();
    userRepo = makeRepo();
    enrollmentRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: getRepositoryToken(SalaryRecord), useValue: recordRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // KPI uchun DB natijalarini mock qiluvchi yordamchi
  function mockKpiData(opts: {
    income?: number;
    operationalExpenses?: number;
    salaries?: number;
    activeStudents?: number;
    debtorCount?: number;
    debtAmount?: number;
  }) {
    const {
      income = 10_000_000,
      operationalExpenses = 2_000_000,
      salaries = 1_500_000,
      activeStudents = 50,
      debtorCount = 5,
      debtAmount = 500_000,
    } = opts;

    // payment repo: income
    paymentRepo.createQueryBuilder.mockReturnValue(
      makeQb({ total: String(income), cnt: '20' }),
    );
    // expense repo: operational
    expenseRepo.createQueryBuilder.mockReturnValue(
      makeQb({ total: String(operationalExpenses) }),
    );
    // record repo: salaries
    recordRepo.createQueryBuilder.mockReturnValue(
      makeQb({ total: String(salaries) }),
    );
    // enrollment: active students
    enrollmentRepo.count.mockResolvedValue(activeStudents);
    // user repo: debtorCount then debtAmount
    userRepo.createQueryBuilder
      .mockReturnValueOnce({ ...makeQb(), getCount: jest.fn().mockResolvedValue(debtorCount) })
      .mockReturnValueOnce(makeQb({ debt_total: String(debtAmount) }));
  }

  // ─── KPI DASHBOARD ─────────────────────────────────────────────────────────
  describe('getKpiDashboard', () => {
    it('netProfit = daromad - barcha xarajatlar', async () => {
      mockKpiData({ income: 10_000_000, operationalExpenses: 2_000_000, salaries: 1_500_000 });

      const result = await service.getKpiDashboard('2024-01');

      expect(result.totalIncome).toBe(10_000_000);
      expect(result.totalExpenses).toBe(3_500_000); // 2M + 1.5M
      expect(result.netProfit).toBe(6_500_000);
    });

    it('marginPercent = (netProfit / income) × 100', async () => {
      mockKpiData({ income: 10_000_000, operationalExpenses: 2_000_000, salaries: 0 });

      const result = await service.getKpiDashboard('2024-01');

      // netProfit = 8_000_000, margin = 80%
      expect(result.marginPercent).toBe(80);
    });

    it('marginPercent = 0 agar income = 0', async () => {
      mockKpiData({ income: 0, operationalExpenses: 0, salaries: 0 });

      const result = await service.getKpiDashboard('2024-01');

      expect(result.marginPercent).toBe(0);
    });

    it('xarajat bo\'linishi to\'g\'ri', async () => {
      mockKpiData({ operationalExpenses: 2_000_000, salaries: 1_500_000 });

      const result = await service.getKpiDashboard('2024-01');

      expect(result.expensesBreakdown.operational).toBe(2_000_000);
      expect(result.expensesBreakdown.salaries).toBe(1_500_000);
    });

    it('faol o\'quvchilar, qarzdorlar, qarz summasi qaytariladi', async () => {
      mockKpiData({ activeStudents: 45, debtorCount: 7, debtAmount: 700_000 });

      const result = await service.getKpiDashboard('2024-01');

      expect(result.activeStudents).toBe(45);
      expect(result.debtorCount).toBe(7);
      expect(result.debtAmount).toBe(700_000);
    });

    it('manfiy sof foyda ham to\'g\'ri hisoblanadi', async () => {
      mockKpiData({ income: 1_000_000, operationalExpenses: 2_000_000, salaries: 500_000 });

      const result = await service.getKpiDashboard('2024-01');

      expect(result.netProfit).toBe(-1_500_000);
      // Manfiy marginda ham hisob ishlashi kerak
      expect(result.marginPercent).toBe(-150);
    });
  });

  // ─── OYLIK P&L ─────────────────────────────────────────────────────────────
  describe('getMonthlyPnl', () => {
    it('KPI ma\'lumotlarini ham qaytaradi', async () => {
      // getKpiDashboard ni mock qilamiz
      jest.spyOn(service, 'getKpiDashboard').mockResolvedValue({
        month: '2024-01',
        totalIncome: 10_000_000,
        totalExpenses: 3_500_000,
        expensesBreakdown: { operational: 2_000_000, salaries: 1_500_000 },
        netProfit: 6_500_000,
        marginPercent: 65,
        activeStudents: 50,
        debtorCount: 5,
        debtAmount: 500_000,
      });

      // payment: byMethod
      paymentRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb(null, [{ method: 'cash', total: '6000000', cnt: '10' }]))
        .mockReturnValueOnce(makeQb(null, [{ type: 'tuition', total: '9000000', cnt: '15' }]));

      // expense: byCategory
      expenseRepo.createQueryBuilder.mockReturnValue(
        makeQb(null, [{ category: 'rent', total: '2000000' }]),
      );

      // subject revenue (innerJoin chain)
      const subjectQb = makeQb(null, [{ subject_name: 'Ingliz', total: '5000000', students: '10' }]);
      // getSubjectRevenueForMonth uses paymentRepo as well - but spy already set
      // Let's just spy on getKpiDashboard which is used internally

      const result = await service.getMonthlyPnl('2024-01');

      expect(result.totalIncome).toBe(10_000_000);
      expect(result.netProfit).toBe(6_500_000);
      expect(result).toHaveProperty('income');
      expect(result).toHaveProperty('expenses');
    });

    it('byMethod to\'g\'ri formatlangan', async () => {
      jest.spyOn(service, 'getKpiDashboard').mockResolvedValue({
        month: '2024-01', totalIncome: 0, totalExpenses: 0,
        expensesBreakdown: { operational: 0, salaries: 0 },
        netProfit: 0, marginPercent: 0, activeStudents: 0, debtorCount: 0, debtAmount: 0,
      });

      paymentRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb(null, [
          { method: 'cash', total: '6000000', cnt: '10' },
          { method: 'payme', total: '4000000', cnt: '8' },
        ]))
        .mockReturnValueOnce(makeQb(null, []))
        .mockReturnValueOnce(makeQb(null, [])); // subject revenue

      expenseRepo.createQueryBuilder.mockReturnValue(makeQb(null, []));

      const result = await service.getMonthlyPnl('2024-01');

      expect(result.income.byMethod).toHaveLength(2);
      expect(result.income.byMethod[0]).toMatchObject({ method: 'cash', total: 6_000_000, count: 10 });
    });
  });

  // ─── YILLIK P&L ────────────────────────────────────────────────────────────
  describe('getAnnualPnl', () => {
    it('12 oy qaytariladi', async () => {
      jest.spyOn(service, 'getKpiDashboard').mockResolvedValue({
        month: '2024-01', totalIncome: 10_000_000, totalExpenses: 3_500_000,
        expensesBreakdown: { operational: 2_000_000, salaries: 1_500_000 },
        netProfit: 6_500_000, marginPercent: 65, activeStudents: 50,
        debtorCount: 0, debtAmount: 0,
      });

      const result = await service.getAnnualPnl('2024');

      expect(result.months).toHaveLength(12);
      expect(result.year).toBe('2024');
    });

    it('yillik jami to\'g\'ri hisoblanadi', async () => {
      // Har oy: 10M daromad, 3.5M xarajat → 6.5M foyda
      jest.spyOn(service, 'getKpiDashboard').mockResolvedValue({
        month: '2024-01', totalIncome: 10_000_000, totalExpenses: 3_500_000,
        expensesBreakdown: { operational: 2_000_000, salaries: 1_500_000 },
        netProfit: 6_500_000, marginPercent: 65, activeStudents: 50,
        debtorCount: 0, debtAmount: 0,
      });

      const result = await service.getAnnualPnl('2024');

      expect(result.annualTotal.income).toBe(10_000_000 * 12);
      expect(result.annualTotal.expenses).toBe(3_500_000 * 12);
      expect(result.annualTotal.netProfit).toBe(6_500_000 * 12);
    });

    it('yillik marja = netProfit / income × 100', async () => {
      jest.spyOn(service, 'getKpiDashboard').mockResolvedValue({
        month: '2024-01', totalIncome: 10_000_000, totalExpenses: 2_000_000,
        expensesBreakdown: { operational: 2_000_000, salaries: 0 },
        netProfit: 8_000_000, marginPercent: 80, activeStudents: 0,
        debtorCount: 0, debtAmount: 0,
      });

      const result = await service.getAnnualPnl('2024');

      // 8M * 12 / 10M * 12 = 80%
      expect(result.annualTotal.marginPercent).toBe(80);
    });

    it('oylar to\'g\'ri formatda', async () => {
      // mockImplementation — har chaqiruvda tegishli oy bilan qaytaradi
      jest.spyOn(service, 'getKpiDashboard').mockImplementation(async (month: string) => ({
        month,
        totalIncome: 0,
        totalExpenses: 0,
        expensesBreakdown: { operational: 0, salaries: 0 },
        netProfit: 0,
        marginPercent: 0,
        activeStudents: 0,
        debtorCount: 0,
        debtAmount: 0,
      }));

      const result = await service.getAnnualPnl('2024');

      expect(result.months[0].month).toBe('2024-01');
      expect(result.months[11].month).toBe('2024-12');
    });
  });
});
