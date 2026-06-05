import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from '../../entities/group.entity';
import { Subject } from '../../entities/subject.entity';
import { User } from '../../entities/user.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateGroupDto, UpdateGroupDto, QueryGroupDto } from './dto/group.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private auditLog: AuditLogService,
  ) {}

  // Guruh ro'yxati
  async findAll(query: QueryGroupDto, actorId: string, actorRole: string) {
    const {
      subjectId,
      teacherId,
      isActive,
      search,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.subject', 'subject')
      .leftJoinAndSelect('g.teacher', 'teacher')
      .where('g.deleted_at IS NULL');

    // Ustoz faqat o'z guruhlarini ko'radi
    if (actorRole === Role.USTOZ) {
      qb.andWhere('g.teacher_id = :tid', { tid: actorId });
    } else if (teacherId) {
      qb.andWhere('g.teacher_id = :tid', { tid: teacherId });
    }

    if (subjectId) {
      qb.andWhere('g.subject_id = :subjectId', { subjectId });
    }

    if (isActive !== undefined && isActive !== '') {
      qb.andWhere('g.is_active = :isActive', { isActive: isActive === 'true' });
    }

    if (search) {
      qb.andWhere('g.name ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('g.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((g) => this.formatGroup(g)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Bitta guruh
  async findOne(id: string) {
    const group = await this.groupRepo.findOne({
      where: { id },
      relations: { subject: true, teacher: true },
    });

    if (!group) throw new NotFoundException('Guruh topilmadi');
    return this.formatGroup(group);
  }

  // Guruh yaratish
  async create(dto: CreateGroupDto, actorId: string, actorRole: string) {
    // Fan mavjudligini tekshirish
    const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
    if (!subject) throw new BadRequestException('Fan topilmadi');

    // O'qituvchi mavjudligini tekshirish
    let teacher: User | null = null;
    if (dto.teacherId) {
      teacher = await this.userRepo.findOne({
        where: { id: dto.teacherId, role: Role.USTOZ },
      });
      if (!teacher) throw new BadRequestException('O\'qituvchi topilmadi');
    }

    // Guruh nomini takror qilmaslik
    const existing = await this.groupRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`"${dto.name}" guruhi allaqachon mavjud`);

    const group = this.groupRepo.create({
      name: dto.name,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId ?? null,
      roomNumber: dto.roomNumber ?? null,
      lessonTime:
        dto.lessonStartTime && dto.lessonEndTime
          ? { start: dto.lessonStartTime, end: dto.lessonEndTime }
          : null,
      lessonDays: dto.lessonDays ?? [],
      monthlyPrice: BigInt(dto.monthlyPrice ?? 0),
      maxStudents: dto.maxStudents ?? 12,
      isActive: true,
    });

    await this.groupRepo.save(group);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'GROUP_CREATED',
      entityName: 'groups',
      entityId: group.id,
      newValues: { name: dto.name, subjectId: dto.subjectId },
    });

    return this.findOne(group.id);
  }

  // Guruh yangilash
  async update(id: string, dto: UpdateGroupDto, actorId: string, actorRole: string) {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    if (dto.subjectId) {
      const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
      if (!subject) throw new BadRequestException('Fan topilmadi');
    }

    if (dto.teacherId) {
      const teacher = await this.userRepo.findOne({
        where: { id: dto.teacherId, role: Role.USTOZ },
      });
      if (!teacher) throw new BadRequestException('O\'qituvchi topilmadi');
    }

    if (dto.name && dto.name !== group.name) {
      const dup = await this.groupRepo.findOne({ where: { name: dto.name } });
      if (dup) throw new ConflictException('Bu nom allaqachon mavjud');
    }

    const updateData: Partial<Group> = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.subjectId) updateData.subjectId = dto.subjectId;
    if (dto.teacherId !== undefined) updateData.teacherId = dto.teacherId ?? null;
    if (dto.roomNumber !== undefined) updateData.roomNumber = dto.roomNumber ?? null;
    if (dto.monthlyPrice !== undefined) updateData.monthlyPrice = BigInt(dto.monthlyPrice);
    if (dto.maxStudents !== undefined) updateData.maxStudents = dto.maxStudents;
    if (dto.lessonDays !== undefined) updateData.lessonDays = dto.lessonDays;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Vaqt yangilash
    const startTime = dto.lessonStartTime ?? (group.lessonTime?.start);
    const endTime = dto.lessonEndTime ?? (group.lessonTime?.end);
    if (startTime && endTime) {
      updateData.lessonTime = { start: startTime, end: endTime };
    }

    await this.groupRepo.update(id, updateData);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'GROUP_UPDATED',
      entityName: 'groups',
      entityId: id,
      newValues: dto as Record<string, unknown>,
    });

    return this.findOne(id);
  }

  // Guruhni deaktivatsiya qilish (soft delete)
  async remove(id: string, actorId: string, actorRole: string) {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    await this.groupRepo.update(id, { isActive: false });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'GROUP_DEACTIVATED',
      entityName: 'groups',
      entityId: id,
    });

    return { message: `"${group.name}" guruhi deaktivatsiya qilindi` };
  }

  // O'qituvchi uchun ustoz ro'yxati
  async getTeachers() {
    return this.userRepo.find({
      where: { role: Role.USTOZ, isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      order: { lastName: 'ASC' },
    });
  }

  // Format: BigInt → number
  private formatGroup(g: Group) {
    return {
      ...g,
      monthlyPrice: Number(g.monthlyPrice),
      teacher: g.teacher
        ? {
            id: g.teacher.id,
            firstName: g.teacher.firstName,
            lastName: g.teacher.lastName,
            email: g.teacher.email,
          }
        : null,
    };
  }
}
