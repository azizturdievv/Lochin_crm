import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaselineAssessment } from '../../entities/baseline-assessment.entity';
import { User } from '../../entities/user.entity';
import { Subject } from '../../entities/subject.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MinioService } from './minio.service';
import { CreateBaselineDto } from './dto/baseline.dto';
import { Role } from '../../common/enums/role.enum';

// MUHIM: Ilk qabul muhrlanadi — hech kim o'zgartira olmaydi (SA ham)
@Injectable()
export class BaselineService {
  constructor(
    @InjectRepository(BaselineAssessment)
    private baselineRepo: Repository<BaselineAssessment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    private minioService: MinioService,
    private auditLog: AuditLogService,
  ) {}

  // ─── ILKQABUL YARATISH ────────────────────────────────────────────────────
  async create(
    dto: CreateBaselineDto,
    actorId: string,
    actorRole: string,
    audioUrl?: string,
    fileUrl?: string,
  ) {
    const student = await this.userRepo.findOne({ where: { id: dto.studentId } });
    if (!student) throw new NotFoundException('O\'quvchi topilmadi');

    const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException('Fan topilmadi');

    // Bir o'quvchi, bir fan, bir baholash turi bo'yicha faqat 1 ta baseline
    // (turlar — test/og'zaki/ijodiy/sport — bir-biridan mustaqil yozuvlar)
    const existing = await this.baselineRepo.findOne({
      where: { studentId: dto.studentId, subjectId: dto.subjectId, type: dto.type },
    });

    if (existing?.sealedAt) {
      throw new BadRequestException(
        'Bu o\'quvchining ilk qabul natijasi allaqachon muhrlanган. O\'zgartirib bo\'lmaydi.',
      );
    }

    const baseline = this.baselineRepo.create({
      studentId: dto.studentId,
      subjectId: dto.subjectId,
      type: dto.type,
      score: dto.score ?? null,
      audioUrl: audioUrl ?? null,
      fileUrl: fileUrl ?? null,
      sportData: dto.sportData ?? null,
      teacherScore: dto.teacherScore ?? null,
      teacherNotes: dto.teacherNotes ?? null,
      assessedById: actorId,
      sealedAt: null,
    });

    if (existing) {
      // Yangilash — yuborilmagan maydonlar eskisicha qoladi (null bilan ustidan yozilmaydi)
      await this.baselineRepo.update(existing.id, {
        score: baseline.score ?? existing.score,
        audioUrl: baseline.audioUrl ?? existing.audioUrl,
        fileUrl: baseline.fileUrl ?? existing.fileUrl,
        sportData: baseline.sportData ?? existing.sportData,
        teacherScore: baseline.teacherScore ?? existing.teacherScore,
        teacherNotes: baseline.teacherNotes ?? existing.teacherNotes,
      });
      return this.findOne(existing.id);
    }

    await this.baselineRepo.save(baseline);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'BASELINE_CREATED',
      entityName: 'baseline_assessments', entityId: baseline.id,
      newValues: { studentId: dto.studentId, subjectId: dto.subjectId, type: dto.type },
    });

    return baseline;
  }

  // ─── MUHRLASH (FAQAT SA) ─────────────────────────────────────────────────
  async seal(id: string, actorId: string) {
    const baseline = await this.baselineRepo.findOne({ where: { id } });
    if (!baseline) throw new NotFoundException('Ilk qabul topilmadi');

    if (baseline.sealedAt) {
      throw new BadRequestException('Bu ilk qabul allaqachon muhrlanган');
    }

    await this.baselineRepo.update(id, { sealedAt: new Date() });

    await this.auditLog.log({
      userId: actorId,
      action: 'BASELINE_SEALED',
      entityName: 'baseline_assessments', entityId: id,
      newValues: { sealedAt: new Date() },
    });

    return { message: '✅ Ilk qabul muhrlanди. Endi o\'zgartirib bo\'lmaydi.' };
  }

  // ─── GURUH O'QUVCHILARI (baholash uchun tanlash) ──────────────────────────
  // Faqat haqiqiy faol o'quvchilar — arxivlangan/o'chirilganlar chiqarilmaydi
  async getGroupStudents(groupId: string) {
    const enrollments = await this.enrollmentRepo
      .createQueryBuilder('e')
      .innerJoin('e.student', 'student')
      .addSelect(['student.id', 'student.firstName', 'student.lastName'])
      .where('e.group_id = :groupId', { groupId })
      .andWhere('e.status = :status', { status: EnrollmentStatus.ACTIVE })
      .andWhere('student.deleted_at IS NULL')
      .andWhere('student.is_active = true')
      .orderBy('student.firstName', 'ASC')
      .getMany();

    return enrollments.map((e) => ({
      id: e.student.id,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
    }));
  }

  // ─── KO'RISH ─────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const baseline = await this.baselineRepo.findOne({
      where: { id },
      relations: { student: true, subject: true, assessedBy: true },
    });
    if (!baseline) throw new NotFoundException('Ilk qabul topilmadi');
    return { ...baseline, isSealed: !!baseline.sealedAt };
  }

  async findByStudent(studentId: string, requesterId: string, requesterRole: string) {
    if (requesterRole === Role.STUDENT && studentId !== requesterId) {
      throw new ForbiddenException('Faqat o\'zingizning ilk qabul natijalaringizni ko\'ra olasiz');
    }

    const baselines = await this.baselineRepo.find({
      where: { studentId },
      relations: { subject: true },
      order: { createdAt: 'DESC' },
    });

    return baselines.map((b) => ({ ...b, isSealed: !!b.sealedAt }));
  }

  async findAll(query: { studentId?: string; subjectId?: string; sealed?: boolean }) {
    const qb = this.baselineRepo.createQueryBuilder('b')
      .leftJoin('b.student', 'st')
      .leftJoin('b.subject', 's')
      .addSelect(['b.id','b.type','b.score','b.teacherScore','b.sealedAt','b.createdAt',
                  'st.id','st.firstName','st.lastName',
                  's.id','s.name']);

    if (query.studentId) qb.andWhere('b.student_id = :sid', { sid: query.studentId });
    if (query.subjectId) qb.andWhere('b.subject_id = :subid', { subid: query.subjectId });
    if (query.sealed !== undefined) {
      if (query.sealed) qb.andWhere('b.sealed_at IS NOT NULL');
      else qb.andWhere('b.sealed_at IS NULL');
    }

    return qb.orderBy('b.created_at', 'DESC').getMany();
  }
}
