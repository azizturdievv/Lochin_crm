import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Group } from '../../entities/group.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ArchiveEntityType, QueryArchiveDto } from './dto/query-archive.dto';

// entityType -> User.role xaritasi (student/teacher/manager barchasi bitta
// "users" jadvalida, faqat role bilan farqlanadi)
const ROLE_MAP: Record<'student' | 'teacher' | 'manager', Role> = {
  student: Role.STUDENT,
  teacher: Role.USTOZ,
  manager: Role.MANAGER,
};

const RESTORE_ACTION_MAP: Record<'student' | 'teacher' | 'manager', string> = {
  student: 'RESTORE_STUDENT',
  teacher: 'RESTORE_STAFF',
  manager: 'RESTORE_STAFF',
};

export interface ArchivedItem {
  id: string;
  archiveType: 'deleted' | 'inactive';
  archivedAt: Date;
  [key: string]: unknown;
}

@Injectable()
export class ArchiveService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    private auditLog: AuditLogService,
  ) {}

  // ─── ARXIV RO'YXATI ───────────────────────────────────────────────────────
  // "Arxivlangan" — ikkala eski mexanizmning birortasiga tushgan yozuv:
  // deletedAt (DELETE tugmasi orqali) YOKI isActive=false (arxivlash/faolsizlantirish
  // tugmasi orqali). Yangi maydon qo'shilmadi — mavjud ikkita mexanizm ustiga
  // bitta birlashtirilgan ko'rinish qurildi.
  async list(dto: QueryArchiveDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    if (dto.entityType === ArchiveEntityType.GROUP) {
      const qb = this.groupRepo
        .createQueryBuilder('g')
        .withDeleted()
        .leftJoinAndSelect('g.subject', 's')
        .leftJoinAndSelect('g.teacher', 't')
        .where('(g.deleted_at IS NOT NULL OR g.is_active = false)');

      if (dto.search) {
        qb.andWhere('g.name ILIKE :search', { search: `%${dto.search}%` });
      }

      const total = await qb.getCount();
      const groups = await qb
        .orderBy('g.updated_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      const data: ArchivedItem[] = groups.map((g) => ({
        id: g.id,
        name: g.name,
        subject: g.subject ? { id: g.subject.id, name: g.subject.name } : null,
        teacher: g.teacher ? { id: g.teacher.id, firstName: g.teacher.firstName, lastName: g.teacher.lastName } : null,
        roomNumber: g.roomNumber,
        currentStudents: g.currentStudents,
        archiveType: g.deletedAt ? 'deleted' : 'inactive',
        archivedAt: g.deletedAt ?? g.updatedAt,
      }));

      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const role = ROLE_MAP[dto.entityType];
    const qb = this.userRepo
      .createQueryBuilder('u')
      .withDeleted()
      .where('u.role = :role', { role })
      .andWhere('(u.deleted_at IS NOT NULL OR u.is_active = false)')
      .select([
        'u.id', 'u.firstName', 'u.lastName', 'u.middleName', 'u.username',
        'u.email', 'u.phone', 'u.role', 'u.isActive', 'u.deletedAt', 'u.updatedAt',
      ]);

    if (dto.search) {
      qb.andWhere(
        '(u."firstName" ILIKE :search OR u.last_name ILIKE :search OR u.phone ILIKE :search OR u.email ILIKE :search OR u.username ILIKE :search)',
        { search: `%${dto.search}%` },
      );
    }

    const total = await qb.getCount();
    const users = await qb
      .orderBy('u.updated_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const data: ArchivedItem[] = users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      middleName: u.middleName,
      username: u.username,
      email: u.email,
      phone: u.phone,
      role: u.role,
      archiveType: u.deletedAt ? 'deleted' : 'inactive',
      archivedAt: u.deletedAt ?? u.updatedAt,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── TIKLASH ──────────────────────────────────────────────────────────────
  // Qaysi mexanizm bilan arxivlangan bo'lishidan qat'iy nazar (deletedAt yoki
  // isActive=false, yoki ikkalasi ham) — tiklash ikkalasini ham normal holatga
  // qaytaradi. Guruhning bekor qilingan darslari AVTOMATIK tiklanmaydi — bu
  // ataylab shunday: guruh qayta faollashsa ham, uning eski bekor qilingan
  // darslarini "Jadval" bo'limidan qaytadan generatsiya qilish alohida, ongli
  // qaror bo'lishi kerak.
  async restore(entityType: ArchiveEntityType, id: string, actorId: string, actorRole: string) {
    if (entityType === ArchiveEntityType.GROUP) {
      const group = await this.groupRepo.createQueryBuilder('g').withDeleted().where('g.id = :id', { id }).getOne();
      if (!group) throw new NotFoundException('Guruh topilmadi');

      await this.groupRepo.restore(id);
      await this.groupRepo.update(id, { isActive: true });

      await this.auditLog.log({
        userId: actorId,
        userRole: actorRole,
        action: 'GROUP_RESTORED',
        entityName: 'groups',
        entityId: id,
      });

      return { message: `"${group.name}" guruhi tiklandi` };
    }

    const role = ROLE_MAP[entityType];
    const user = await this.userRepo.createQueryBuilder('u').withDeleted().where('u.id = :id', { id }).getOne();
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role !== role) {
      throw new BadRequestException('Bu yozuv boshqa turdagi foydalanuvchiga tegishli');
    }

    await this.userRepo.restore(id);
    await this.userRepo.update(id, { isActive: true });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: RESTORE_ACTION_MAP[entityType],
      entityName: 'users',
      entityId: id,
      newValues: { restoredRole: role },
    });

    return { message: `"${user.firstName} ${user.lastName}" tiklandi` };
  }

  // ─── TARIX (audit log) ────────────────────────────────────────────────────
  async getHistory(entityType: ArchiveEntityType, entityId: string) {
    const entityName = entityType === ArchiveEntityType.GROUP ? 'groups' : 'users';
    return this.auditLog.findAll({ entityName, entityId, limit: 100 });
  }

  // ─── TO'LIQ MA'LUMOT (kartani bosganda) ───────────────────────────────────
  // Ro'yxatdagi qisqa ma'lumotdan farqli — yozuvning barcha ko'rsatsa
  // bo'ladigan maydonlarini qaytaradi (parol/2FA kabi maxfiy maydonlar
  // hech qachon qaytarilmaydi)
  async getDetail(entityType: ArchiveEntityType, id: string) {
    if (entityType === ArchiveEntityType.GROUP) {
      const group = await this.groupRepo
        .createQueryBuilder('g')
        .withDeleted()
        .leftJoinAndSelect('g.subject', 's')
        .leftJoinAndSelect('g.teacher', 't')
        .where('g.id = :id', { id })
        .getOne();
      if (!group) throw new NotFoundException('Guruh topilmadi');

      return {
        id: group.id,
        name: group.name,
        subject: group.subject ? { id: group.subject.id, name: group.subject.name } : null,
        teacher: group.teacher
          ? { id: group.teacher.id, firstName: group.teacher.firstName, lastName: group.teacher.lastName, phone: group.teacher.phone }
          : null,
        roomNumber: group.roomNumber,
        lessonTime: group.lessonTime,
        lessonDays: group.lessonDays,
        lessonHours: Number(group.lessonHours),
        monthlyPrice: Number(group.monthlyPrice),
        maxStudents: group.maxStudents,
        currentStudents: group.currentStudents,
        startedAt: group.startedAt,
        endedAt: group.endedAt,
        isActive: group.isActive,
        archiveType: group.deletedAt ? 'deleted' : 'inactive',
        archivedAt: group.deletedAt ?? group.updatedAt,
        createdAt: group.createdAt,
      };
    }

    const role = ROLE_MAP[entityType];
    const user = await this.userRepo
      .createQueryBuilder('u')
      .withDeleted()
      .where('u.id = :id', { id })
      .select([
        'u.id', 'u.firstName', 'u.lastName', 'u.middleName', 'u.username', 'u.email', 'u.phone',
        'u.role', 'u.isActive', 'u.deletedAt', 'u.createdAt', 'u.updatedAt', 'u.lastLoginAt',
        'u.avatarUrl', 'u.birthDate', 'u.address', 'u.schoolName', 'u.schoolGrade',
        'u.referralSource', 'u.referralPerson', 'u.notes', 'u.totalPoints', 'u.paymentExtendedUntil',
      ])
      .getOne();
    if (!user || user.role !== role) throw new NotFoundException('Foydalanuvchi topilmadi');

    return {
      ...user,
      archiveType: user.deletedAt ? 'deleted' : 'inactive',
      archivedAt: user.deletedAt ?? user.updatedAt,
    };
  }
}
