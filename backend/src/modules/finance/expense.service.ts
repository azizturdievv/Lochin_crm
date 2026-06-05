import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../../entities/expense.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateExpenseDto, UpdateExpenseDto, QueryExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,
    private auditLog: AuditLogService,
  ) {}

  // ─── XARAJAT QO'SHISH ─────────────────────────────────────────────────────
  async create(dto: CreateExpenseDto, actorId: string, actorRole: string) {
    const expense = this.expenseRepo.create({
      title: dto.title,
      category: dto.category,
      amount: BigInt(dto.amount),
      expenseDate: new Date(dto.expenseDate),
      description: dto.description ?? null,
      createdById: actorId,
      isConfidential: dto.isConfidential ?? false,
    });

    await this.expenseRepo.save(expense);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'EXPENSE_CREATED',
      entityName: 'expenses',
      entityId: expense.id,
      newValues: { title: dto.title, amount: dto.amount, category: dto.category },
    });

    return expense;
  }

  // ─── RO'YXAT (maxfiy xarajatlar faqat SA ga ko'rinadi) ──────────────────
  async findAll(query: QueryExpenseDto, actorId: string, actorRole: string) {
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoin('e.createdBy', 'u')
      .addSelect(['u.id', 'u.firstName', 'u.lastName'])
      .where('e.deleted_at IS NULL');

    if (actorRole !== Role.SUPER_ADMIN) {
      qb.andWhere('e.is_confidential = false');
    }

    if (query.month) {
      qb.andWhere("TO_CHAR(e.expense_date, 'YYYY-MM') = :month", { month: query.month });
    }
    if (query.category) {
      qb.andWhere('e.category = :cat', { cat: query.category });
    }

    return qb.orderBy('e.expense_date', 'DESC').getMany();
  }

  // ─── KATEGORIYA BO'YICHA XULOSA ──────────────────────────────────────────
  async getSummary(month: string, actorRole: string) {
    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where("TO_CHAR(e.expense_date, 'YYYY-MM') = :month", { month })
      .andWhere('e.deleted_at IS NULL');

    if (actorRole !== Role.SUPER_ADMIN) {
      qb.andWhere('e.is_confidential = false');
    }

    const rows = await qb
      .select([
        'e.category AS category',
        'SUM(e.amount) AS total',
        'COUNT(*) AS cnt',
      ])
      .groupBy('e.category')
      .orderBy('total', 'DESC')
      .getRawMany();

    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);

    return {
      month,
      grandTotal,
      byCategory: rows.map((r) => ({
        category: r.category,
        total: Number(r.total),
        count: Number(r.cnt),
        percent: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 1000) / 10 : 0,
      })),
    };
  }

  // ─── TAHRIRLASH ───────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateExpenseDto, actorId: string, actorRole: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');

    const updates: Partial<Expense> = {};
    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.category !== undefined) updates.category = dto.category;
    if (dto.amount !== undefined) updates.amount = BigInt(dto.amount);
    if (dto.expenseDate !== undefined) updates.expenseDate = new Date(dto.expenseDate);
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.isConfidential !== undefined) {
      if (actorRole !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Maxfiylik belgisini faqat SA o\'zgartira oladi');
      }
      updates.isConfidential = dto.isConfidential;
    }

    await this.expenseRepo.update(id, updates);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'EXPENSE_UPDATED',
      entityName: 'expenses',
      entityId: id,
      newValues: updates,
    });

    return this.expenseRepo.findOne({ where: { id } });
  }

  // ─── O'CHIRISH (soft delete, faqat SA) ───────────────────────────────────
  async remove(id: string, actorId: string, actorRole: string) {
    if (actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Xarajatni faqat SA o\'chira oladi');
    }

    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');

    await this.expenseRepo.softDelete(id);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'EXPENSE_DELETED',
      entityName: 'expenses',
      entityId: id,
      oldValues: { title: expense.title, amount: String(expense.amount) },
    });

    return { message: 'Xarajat o\'chirildi' };
  }
}
