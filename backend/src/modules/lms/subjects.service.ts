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

    // Har fan bo'yicha statistika (guruh/o'quvchi)
    const groupStats = await this.subjectRepo.query(
      `SELECT
        g.subject_id,
        COUNT(DISTINCT g.id) AS groups,
        COUNT(DISTINCT e.student_id) AS students
       FROM groups g
       LEFT JOIN enrollments e ON e.group_id = g.id AND e.status = 'active'
       WHERE g.is_active = true
       GROUP BY g.subject_id`,
    );

    // Materiallar soni (guruh orqali — material to'g'ridan-to'g'ri fanga bog'lanmagan)
    const materialStats = await this.subjectRepo.query(
      `SELECT g.subject_id, COUNT(m.id) AS count
       FROM materials m
       INNER JOIN groups g ON g.id = m.group_id
       WHERE m.deleted_at IS NULL
       GROUP BY g.subject_id`,
    );

    // Testlar soni (test to'g'ridan-to'g'ri fanga bog'langan)
    const testStats = await this.subjectRepo.query(
      `SELECT subject_id, COUNT(id) AS count
       FROM tests
       WHERE deleted_at IS NULL
       GROUP BY subject_id`,
    );

    // Vazifalar soni (guruh orqali)
    const homeworkStats = await this.subjectRepo.query(
      `SELECT g.subject_id, COUNT(h.id) AS count
       FROM homework h
       INNER JOIN groups g ON g.id = h.group_id
       WHERE h.deleted_at IS NULL
       GROUP BY g.subject_id`,
    );

    // O'rtacha test bali (yakunlangan urinishlar bo'yicha)
    const avgScoreStats = await this.subjectRepo.query(
      `SELECT t.subject_id, AVG(tr.score) AS avg
       FROM test_results tr
       INNER JOIN tests t ON t.id = tr.test_id
       WHERE tr.deleted_at IS NULL AND tr.finished_at IS NOT NULL
       GROUP BY t.subject_id`,
    );

    const toMap = (rows: Record<string, string>[], valueKey: string) =>
      new Map(rows.map((r) => [r.subject_id, Number(r[valueKey])]));

    const groupMap = new Map(
      groupStats.map((s: Record<string, string>) => [s.subject_id, { groups: Number(s.groups), students: Number(s.students) }]),
    );
    const materialsMap = toMap(materialStats, 'count');
    const testsMap = toMap(testStats, 'count');
    const homeworkMap = toMap(homeworkStats, 'count');
    const avgScoreMap = toMap(avgScoreStats, 'avg');

    return subjects.map((s) => ({
      ...s,
      stats: {
        ...(groupMap.get(s.id) ?? { groups: 0, students: 0 }),
        materialsCount: materialsMap.get(s.id) ?? 0,
        testsCount: testsMap.get(s.id) ?? 0,
        homeworkCount: homeworkMap.get(s.id) ?? 0,
        avgScore: avgScoreMap.has(s.id) ? Math.round(avgScoreMap.get(s.id)! * 10) / 10 : null,
      },
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
