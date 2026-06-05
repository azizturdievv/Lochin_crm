import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExpenseService } from './expense.service';
import { Expense, ExpenseCategory } from '../../entities/expense.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../../common/enums/role.enum';

function makeRepo() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    create: jest.fn((data: any) => ({ id: 'exp-id', ...data })),
    save: jest.fn(async (data: any) => ({ id: 'exp-id', ...data })),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    softDelete: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
}

describe('ExpenseService', () => {
  let service: ExpenseService;
  let expenseRepo: ReturnType<typeof makeRepo>;
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    expenseRepo = makeRepo();
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: getRepositoryToken(Expense), useValue: expenseRepo },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
  });

  // ─── CREATE ────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      title: 'Ijara',
      category: ExpenseCategory.RENT,
      amount: 5_000_000,
      expenseDate: '2024-01-15',
    };

    it('to\'g\'ri maydonlar bilan xarajat yaratadi', async () => {
      await service.create(dto, 'actor-id', Role.MANAGER);

      expect(expenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Ijara',
          category: ExpenseCategory.RENT,
          amount: BigInt(5_000_000),
          createdById: 'actor-id',
          isConfidential: false,
        }),
      );
      expect(expenseRepo.save).toHaveBeenCalled();
    });

    it('isConfidential default false ga o\'rnatiladi', async () => {
      await service.create(dto, 'actor-id', Role.SUPER_ADMIN);
      expect(expenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isConfidential: false }),
      );
    });

    it('isConfidential=true bilan maxfiy xarajat yaratiladi', async () => {
      await service.create({ ...dto, isConfidential: true }, 'sa-id', Role.SUPER_ADMIN);
      expect(expenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isConfidential: true }),
      );
    });

    it('EXPENSE_CREATED audit log yoziladi', async () => {
      await service.create(dto, 'actor-id', Role.MANAGER);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EXPENSE_CREATED', entityName: 'expenses' }),
      );
    });
  });

  // ─── FIND ALL ──────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('SA — maxfiy filtr qo\'shilmaydi', async () => {
      await service.findAll({}, 'sa-id', Role.SUPER_ADMIN);
      // isConfidential filtri andWhere ga qo'shilmasligi kerak
      expect(expenseRepo._qb.andWhere).not.toHaveBeenCalledWith(
        'e.is_confidential = false',
      );
    });

    it('Manager — maxfiy xarajatlar filtrlanadi', async () => {
      await service.findAll({}, 'mgr-id', Role.MANAGER);
      expect(expenseRepo._qb.andWhere).toHaveBeenCalledWith('e.is_confidential = false');
    });

    it('month query bo\'lsa filter qo\'shiladi', async () => {
      await service.findAll({ month: '2024-01' }, 'mgr-id', Role.MANAGER);
      expect(expenseRepo._qb.andWhere).toHaveBeenCalledWith(
        "TO_CHAR(e.expense_date, 'YYYY-MM') = :month",
        { month: '2024-01' },
      );
    });

    it('category query bo\'lsa filter qo\'shiladi', async () => {
      await service.findAll({ category: ExpenseCategory.RENT }, 'mgr-id', Role.MANAGER);
      expect(expenseRepo._qb.andWhere).toHaveBeenCalledWith('e.category = :cat', {
        cat: ExpenseCategory.RENT,
      });
    });
  });

  // ─── GET SUMMARY ───────────────────────────────────────────────────────────
  describe('getSummary', () => {
    it('kategoriya bo\'yicha foiz to\'g\'ri hisoblanadi', async () => {
      expenseRepo._qb.getRawMany.mockResolvedValue([
        { category: 'rent', total: '3000000', cnt: '1' },
        { category: 'utilities', total: '1000000', cnt: '2' },
      ]);

      const result = await service.getSummary('2024-01', Role.SUPER_ADMIN);

      expect(result.grandTotal).toBe(4_000_000);
      expect(result.byCategory[0].percent).toBe(75); // 3M/4M = 75%
      expect(result.byCategory[1].percent).toBe(25); // 1M/4M = 25%
    });

    it('grandTotal 0 bo\'lsa percent 0 qaytariladi', async () => {
      expenseRepo._qb.getRawMany.mockResolvedValue([]);
      const result = await service.getSummary('2024-01', Role.SUPER_ADMIN);
      expect(result.grandTotal).toBe(0);
      expect(result.byCategory).toHaveLength(0);
    });

    it('manager uchun is_confidential filtri qo\'shiladi', async () => {
      await service.getSummary('2024-01', Role.MANAGER);
      expect(expenseRepo._qb.andWhere).toHaveBeenCalledWith('e.is_confidential = false');
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────────────
  describe('update', () => {
    const existingExpense = {
      id: 'exp-1',
      title: 'Old',
      amount: 1000n,
      isConfidential: false,
    };

    it('xarajat yangilanadi', async () => {
      expenseRepo.findOne
        .mockResolvedValueOnce(existingExpense) // first: check exists
        .mockResolvedValueOnce({ ...existingExpense, title: 'New' }); // final return

      const result = await service.update('exp-1', { title: 'New' }, 'sa-id', Role.SUPER_ADMIN);

      expect(expenseRepo.update).toHaveBeenCalledWith(
        'exp-1',
        expect.objectContaining({ title: 'New' }),
      );
    });

    it('NotFoundException — xarajat topilmasa', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(service.update('no-id', { title: 'X' }, 'sa', Role.SUPER_ADMIN))
        .rejects.toThrow(NotFoundException);
    });

    it('ForbiddenException — manager isConfidential ni o\'zgartira olmaydi', async () => {
      expenseRepo.findOne.mockResolvedValue(existingExpense);
      await expect(
        service.update('exp-1', { isConfidential: true }, 'mgr', Role.MANAGER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SA isConfidential ni o\'zgartira oladi', async () => {
      expenseRepo.findOne
        .mockResolvedValueOnce(existingExpense)
        .mockResolvedValueOnce({ ...existingExpense, isConfidential: true });

      await service.update('exp-1', { isConfidential: true }, 'sa-id', Role.SUPER_ADMIN);

      expect(expenseRepo.update).toHaveBeenCalledWith(
        'exp-1',
        expect.objectContaining({ isConfidential: true }),
      );
    });

    it('EXPENSE_UPDATED audit log yoziladi', async () => {
      expenseRepo.findOne.mockResolvedValue(existingExpense);
      await service.update('exp-1', { title: 'New' }, 'sa-id', Role.SUPER_ADMIN);
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EXPENSE_UPDATED' }),
      );
    });
  });

  // ─── REMOVE ────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('ForbiddenException — SA bo\'lmasa o\'chira olmaydi', async () => {
      await expect(service.remove('exp-1', 'mgr-id', Role.MANAGER))
        .rejects.toThrow(ForbiddenException);
    });

    it('NotFoundException — xarajat topilmasa', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('no-id', 'sa-id', Role.SUPER_ADMIN))
        .rejects.toThrow(NotFoundException);
    });

    it('SA soft delete qiladi va audit log yozadi', async () => {
      expenseRepo.findOne.mockResolvedValue({ id: 'exp-1', title: 'Ijara', amount: 1000n });

      const result = await service.remove('exp-1', 'sa-id', Role.SUPER_ADMIN);

      expect(expenseRepo.softDelete).toHaveBeenCalledWith('exp-1');
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EXPENSE_DELETED' }),
      );
      expect(result.message).toBeDefined();
    });
  });
});
