import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from '../../entities/subject.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

// Plugin arxitektura: yangi fan qo'shish — dasturchi kerak emas
@Injectable()
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    private auditLog: AuditLogService,
  ) {}

  async create(dto: CreateSubjectDto, actorId: string, actorRole: string) {
    const existing = await this.subjectRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`"${dto.name}" fani allaqachon mavjud`);

    const subject = this.subjectRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: true,
    });

    await this.subjectRepo.save(subject);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'SUBJECT_CREATED',
      entityName: 'subjects', entityId: subject.id,
      newValues: { name: dto.name },
    });

    return subject;
  }

  async findAll(includeInactive = false) {
    const qb = this.subjectRepo.createQueryBuilder('s')
      .orderBy('s.sort_order', 'ASC')
      .addOrderBy('s.name', 'ASC');

    if (!includeInactive) qb.where('s.is_active = true');

    const subjects = await qb.getMany();

    // Har fan bo'yicha statistika
    const stats = await this.subjectRepo.query(
      `SELECT
        g.subject_id,
        COUNT(DISTINCT g.id) AS groups,
        COUNT(DISTINCT e.student_id) AS students
       FROM groups g
       LEFT JOIN enrollments e ON e.group_id = g.id AND e.status = 'active'
       WHERE g.is_active = true
       GROUP BY g.subject_id`,
    );

    const statsMap = new Map(
      stats.map((s: Record<string, string>) => [
        s.subject_id,
        { groups: Number(s.groups), students: Number(s.students) },
      ]),
    );

    return subjects.map((s) => ({
      ...s,
      stats: statsMap.get(s.id) ?? { groups: 0, students: 0 },
    }));
  }

  async findOne(id: string) {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Fan topilmadi');
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto, actorId: string, actorRole: string) {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Fan topilmadi');

    if (dto.name && dto.name !== subject.name) {
      const dup = await this.subjectRepo.findOne({ where: { name: dto.name } });
      if (dup) throw new ConflictException('Bu nom allaqachon mavjud');
    }

    await this.subjectRepo.update(id, {
      ...(dto.name && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'SUBJECT_UPDATED',
      entityName: 'subjects', entityId: id,
      newValues: dto as Record<string, unknown>,
    });

    return this.subjectRepo.findOne({ where: { id } });
  }

  async remove(id: string, actorId: string, actorRole: string) {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Fan topilmadi');

    // Faqat o'chirish o'rniga deactivate
    await this.subjectRepo.update(id, { isActive: false });

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'SUBJECT_DEACTIVATED',
      entityName: 'subjects', entityId: id,
    });

    return { message: `"${subject.name}" fani deaktivatsiya qilindi` };
  }
}
