import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { Role } from '../../common/enums/role.enum';

interface AuditLogParams {
  userId?: string | null;
  userRole?: string | null;
  userEmail?: string | null;
  action: string;
  entityName?: string | null;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestPath?: string | null;
  requestMethod?: string | null;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  // Barcha muhim amallarni yozish (o'chirimsiz, 5 yil saqlanadi)
  async log(params: AuditLogParams): Promise<void> {
    try {
      const entry = this.auditLogRepository.create({
        userId: params.userId ?? null,
        userRole: params.userRole ?? null,
        userEmail: params.userEmail ?? null,
        action: params.action,
        entityName: params.entityName ?? null,
        entityId: params.entityId ?? null,
        oldValues: params.oldValues ?? null,
        newValues: params.newValues ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        requestPath: params.requestPath ?? null,
        requestMethod: params.requestMethod ?? null,
      });

      await this.auditLogRepository.save(entry);
    } catch {
      // Audit log yozishda xato bo'lsa asosiy jarayon to'xtatilmaydi
      console.error('Audit log yozishda xato:', params.action);
    }
  }

  // Audit loglarni olish (faqat SA)
  async findAll(filters: {
    userId?: string;
    action?: string;
    entityName?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const query = this.auditLogRepository.createQueryBuilder('al');

    if (filters.userId) {
      query.andWhere('al.user_id = :userId', { userId: filters.userId });
    }

    if (filters.action) {
      query.andWhere('al.action ILIKE :action', { action: `%${filters.action}%` });
    }

    if (filters.entityName) {
      query.andWhere('al.entity_name = :entityName', { entityName: filters.entityName });
    }

    if (filters.entityId) {
      query.andWhere('al.entity_id = :entityId', { entityId: filters.entityId });
    }

    if (filters.from) {
      query.andWhere('al.created_at >= :from', { from: filters.from });
    }

    if (filters.to) {
      query.andWhere('al.created_at <= :to', { to: filters.to });
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    query
      .orderBy('al.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit };
  }
}
