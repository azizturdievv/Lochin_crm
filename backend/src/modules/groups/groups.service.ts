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
import { ChatRoom, ChatRoomType } from '../../entities/chat-room.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
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
    @InjectRepository(ChatRoom)
    private chatRoomRepo: Repository<ChatRoom>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
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
    } else if (actorRole === Role.STUDENT) {
      // O'quvchi faqat o'zi qatnashadigan (aktiv) guruhlarni ko'radi
      qb.innerJoin(
        'enrollments',
        'enr',
        'enr.group_id = g.id AND enr.student_id = :sid AND enr.status = :estatus AND enr.deleted_at IS NULL',
        { sid: actorId, estatus: EnrollmentStatus.ACTIVE },
      );
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

  // Guruhdagi o'quvchilar ro'yxati
  async getStudents(groupId: string) {
    const group = await this.groupRepo.findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const enrollments = await this.enrollmentRepo
      .createQueryBuilder('e')
      .withDeleted() // arxivlangan (soft-deleted) o'quvchi ismi ham ko'rinishi uchun
      .leftJoinAndSelect('e.student', 'student')
      .where('e.deleted_at IS NULL')
      .andWhere('e.group_id = :groupId', { groupId })
      .andWhere('e.status = :status', { status: EnrollmentStatus.ACTIVE })
      .orderBy('e.enrolled_at', 'ASC')
      .getMany();

    return enrollments.map((e) => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      phone: e.student.phone,
      enrolledAt: e.enrolledAt,
      discountPercent: Number(e.discountPercent),
    }));
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

    // Guruh uchun avtomatik chat xonasi yaratish
    await this.ensureGroupChatRoom(group.id, group.name, teacher ?? null);

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

    // Ustoz o'zgarganda chat xonasi a'zolarini sinxronizatsiya
    if (dto.teacherId !== undefined && dto.teacherId !== group.teacherId) {
      await this.syncGroupChatRoomTeacher(id, group.teacherId, dto.teacherId ?? null);
    }

    // Guruh nomi o'zgarganda chat xona nomini ham yangilash
    if (dto.name && dto.name !== group.name) {
      await this.chatRoomRepo.update(
        { groupId: id, type: ChatRoomType.GROUP_CLASS },
        { name: `${dto.name} sinfxonasi` },
      );
    }

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

  // ─── CHAT XONA SINXRONIZATSIYA ────────────────────────────────────────────

  // Guruh uchun chat xonasi mavjud bo'lmasa yaratish
  async ensureGroupChatRoom(groupId: string, groupName: string, teacher: User | null) {
    const existing = await this.chatRoomRepo.findOne({
      where: { groupId, type: ChatRoomType.GROUP_CLASS },
      relations: { members: true },
    });
    if (existing) return existing;

    const room = this.chatRoomRepo.create({
      type: ChatRoomType.GROUP_CLASS,
      name: `${groupName} sinfxonasi`,
      groupId,
      isActive: true,
      members: teacher ? [teacher] : [],
    });
    await this.chatRoomRepo.save(room);
    return room;
  }

  // Ustoz o'zgarganda chat xonasi a'zolarini yangilash
  private async syncGroupChatRoomTeacher(
    groupId: string,
    oldTeacherId: string | null,
    newTeacherId: string | null,
  ) {
    const room = await this.chatRoomRepo.findOne({
      where: { groupId, type: ChatRoomType.GROUP_CLASS },
      relations: { members: true },
    });
    if (!room) return;

    if (oldTeacherId) {
      room.members = room.members.filter((m) => m.id !== oldTeacherId);
    }
    if (newTeacherId) {
      const teacher = await this.userRepo.findOne({ where: { id: newTeacherId } });
      if (teacher && !room.members.some((m) => m.id === newTeacherId)) {
        room.members.push(teacher);
      }
    }
    await this.chatRoomRepo.save(room);
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
