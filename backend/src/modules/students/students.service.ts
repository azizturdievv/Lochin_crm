import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, ILike, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { Payment } from '../../entities/payment.entity';
import { Attendance } from '../../entities/attendance.entity';
import { TestResult } from '../../entities/test-result.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { ChatRoom, ChatRoomType } from '../../entities/chat-room.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { QueryStudentDto } from './dto/query-student.dto';
import { EnrollStudentDto, UpdateEnrollmentDto } from './dto/enroll-student.dto';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Parent)
    private parentRepository: Repository<Parent>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(TestResult)
    private testResultRepository: Repository<TestResult>,
    @InjectRepository(PointsLog)
    private pointsLogRepository: Repository<PointsLog>,
    @InjectRepository(ChatRoom)
    private chatRoomRepo: Repository<ChatRoom>,
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateStudentDto, actorId: string, actorRole: string) {
    // Email berilgan bo'lsa takrorlanmasligini tekshirish
    if (dto.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
        withDeleted: true,
      });
      if (existing) {
        throw new ConflictException('Bu email allaqachon ro\'yxatdan o\'tgan');
      }
    }

    // Username: berilmagan bo'lsa avtomatik generatsiya
    const username = dto.username
      ? await this.validateAndReserveUsername(dto.username)
      : await this.generateUsername(dto.firstName);

    const generatedPassword = dto.password ? undefined : this.generateRandomPassword();
    const passwordHash = await bcrypt.hash(dto.password ?? generatedPassword!, 12);

    // Ko'p guruh: groupIds ustuvor, groupId fallback
    const allGroupIds = dto.groupIds?.length
      ? dto.groupIds
      : dto.groupId
      ? [dto.groupId]
      : [];

    // Transaction: user + parents + enrollments
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const student = queryRunner.manager.create(User, {
        firstName:      dto.firstName,
        lastName:       dto.lastName,
        middleName:     dto.middleName     || null,
        username,
        email:          dto.email          || null,
        phone:          dto.phone          || null,
        passwordHash,
        role:           Role.STUDENT,
        telegramChatId: dto.telegramChatId || null,
        isActive:       true,
        birthDate:      dto.birthDate ? new Date(dto.birthDate) : null,
        address:        dto.address        || null,
        schoolName:     dto.schoolName     || null,
        schoolGrade:    dto.schoolGrade    ?? null,
        referralSource: dto.referralSource || null,
        referralPerson: dto.referralPerson || null,
        notes:          dto.notes          || null,
      });

      await queryRunner.manager.save(student);

      // Ota-onalar saqlash
      if (dto.parents?.length) {
        const parents = dto.parents.map((p) =>
          queryRunner.manager.create(Parent, {
            studentId: student.id,
            fullName: p.fullName,
            phone: p.phone,
            phone2: p.phone2 ?? null,
            relation: p.relation ?? null,
            telegramChatId: p.telegramChatId ?? null,
            isPrimary: p.isPrimary ?? false,
          }),
        );
        await queryRunner.manager.save(parents);
      }

      // Bir yoki bir nechta guruhga yozish
      for (const gid of allGroupIds) {
        const group = await queryRunner.manager.findOne(Group, {
          where: { id: gid, isActive: true },
        });
        if (!group || group.currentStudents >= group.maxStudents) continue;

        const enrollment = queryRunner.manager.create(Enrollment, {
          studentId:         student.id,
          groupId:           gid,
          status:            EnrollmentStatus.ACTIVE,
          enrolledAt:        dto.enrollmentDate ? new Date(dto.enrollmentDate) : new Date(),
          discountPercent:   0,
          referralStudentId: dto.referralStudentId ?? null,
        });
        await queryRunner.manager.save(enrollment);
        await queryRunner.manager.increment(Group, { id: gid }, 'currentStudents', 1);
      }

      await queryRunner.commitTransaction();

      // Guruh chat xonalariga qo'shish (transaction tashqarida)
      for (const gid of allGroupIds) {
        await this.addStudentToGroupChatRoom(student.id, gid).catch(() => {});
      }

      await this.auditLogService.log({
        userId: actorId,
        userRole: actorRole,
        action: 'STUDENT_CREATED',
        entityName: 'users',
        entityId: student.id,
        newValues: { username, email: student.email, firstName: student.firstName, lastName: student.lastName },
      });

      const result = await this.findOne(student.id, actorId, actorRole);
      return generatedPassword ? { ...result, generatedPassword } : result;
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      const pgErr = err as { code?: string; detail?: string };
      if (pgErr?.code === '23505') {
        if (pgErr?.detail?.includes('phone')) {
          throw new ConflictException("Bu telefon raqam allaqachon ro'yxatda bor");
        }
        if (pgErr?.detail?.includes('email')) {
          throw new ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
        }
        if (pgErr?.detail?.includes('username')) {
          throw new ConflictException("Bu username allaqachon band");
        }
        throw new ConflictException("Bu ma'lumot allaqachon mavjud");
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Username unikal ekanligini tekshirish
  private async validateAndReserveUsername(username: string): Promise<string> {
    const exists = await this.userRepository.findOne({ where: { username } });
    if (exists) {
      throw new ConflictException(`"${username}" username allaqachon band`);
    }
    return username;
  }

  // Parol berilmaganda: 8 xonali tasodifiy raqamli parol
  private generateRandomPassword(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  // Username avtomatik generatsiya: jasur_001
  private async generateUsername(firstName: string): Promise<string> {
    const base = firstName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'user';
    for (let i = 1; i <= 999; i++) {
      const candidate = `${base}_${String(i).padStart(3, '0')}`;
      const exists = await this.userRepository.findOne({ where: { username: candidate } });
      if (!exists) return candidate;
    }
    throw new BadRequestException('Username generatsiya qilishda xatolik');
  }

  async findAll(query: QueryStudentDto, actorId: string, actorRole: string) {
    const { page = 1, limit = 20, search, groupId, subjectId, isActive, hasDebt, sortBy = 'createdAt', sortOrder = 'DESC' } = query;

    const qb = this.userRepository
      .createQueryBuilder('u')
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.deleted_at IS NULL');

    // Ustoz: faqat o'z guruhidagi o'quvchilar
    if (actorRole === Role.USTOZ) {
      qb.innerJoin(
        'enrollments',
        'e',
        'e.student_id = u.id AND e.status = :status',
        { status: EnrollmentStatus.ACTIVE },
      ).innerJoin(
        'groups',
        'g',
        'g.id = e.group_id AND g.teacher_id = :teacherId',
        { teacherId: actorId },
      );
    }

    // O'quvchi: faqat o'zi
    if (actorRole === Role.STUDENT) {
      qb.andWhere('u.id = :studentId', { studentId: actorId });
    }

    if (search) {
      qb.andWhere(
        '(u.firstName ILIKE :s OR u.last_name ILIKE :s OR u.email ILIKE :s OR u.phone ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    if (groupId) {
      qb.innerJoin(
        'enrollments',
        'ef',
        'ef.student_id = u.id AND ef.group_id = :groupId AND ef.status = :es',
        { groupId, es: EnrollmentStatus.ACTIVE },
      );
    }

    if (subjectId) {
      qb.innerJoin('enrollments', 'es2', 'es2.student_id = u.id AND es2.status = :est', { est: EnrollmentStatus.ACTIVE })
        .innerJoin('groups', 'gs', 'gs.id = es2.group_id AND gs.subject_id = :subjectId', { subjectId });
    }

    if (isActive !== undefined) {
      qb.andWhere('u.is_active = :isActive', { isActive });
    }

    // Qarzdorlar: to'lovi yo'q o'quvchilar (joriy oy)
    if (hasDebt) {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.student_id = u.id
          AND p.payment_month = :month
          AND p.status = 'completed'
          AND p.deleted_at IS NULL
        )`,
        { month: currentMonth },
      );
    }

    const allowedSortFields: Record<string, string> = {
      createdAt: 'u.created_at',
      firstName: 'u.firstName',
      lastName: 'u.last_name',
      totalPoints: 'u.total_points',
    };
    const sortField = allowedSortFields[sortBy] ?? 'u.created_at';

    qb.orderBy(sortField, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'u.id',
        'u.firstName',
        'u.lastName',
        'u.middleName',
        'u.email',
        'u.username',
        'u.phone',
        'u.avatarUrl',
        'u.isActive',
        'u.totalPoints',
        'u.createdAt',
      ]);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, actorId: string, actorRole: string) {
    // RBAC: o'quvchi faqat o'zini ko'radi
    if (actorRole === Role.STUDENT && id !== actorId) {
      throw new ForbiddenException('Faqat o\'z ma\'lumotlaringizni ko\'ra olasiz');
    }

    const student = await this.userRepository.findOne({
      where: { id, role: Role.STUDENT },
    });

    if (!student) {
      throw new NotFoundException('O\'quvchi topilmadi');
    }

    // Ustoz: faqat o'z guruhidagi o'quvchini ko'radi
    if (actorRole === Role.USTOZ) {
      await this.checkTeacherAccess(actorId, id);
    }

    // Ota-onalar
    const parents = await this.parentRepository.find({
      where: { studentId: id },
      order: { isPrimary: 'DESC' },
    });

    // Faol guruhlar
    const enrollments = await this.enrollmentRepository.find({
      where: { studentId: id, status: EnrollmentStatus.ACTIVE },
      relations: { group: { subject: true } },
      order: { enrolledAt: 'DESC' },
    });

    // Parolni yashirish
    const { passwordHash, twoFaSecret, ...studentData } = student;

    return { ...studentData, parents, enrollments };
  }

  async update(id: string, dto: UpdateStudentDto, actorId: string, actorRole: string) {
    const student = await this.userRepository.findOne({
      where: { id, role: Role.STUDENT },
    });

    if (!student) {
      throw new NotFoundException('O\'quvchi topilmadi');
    }

    // Email o'zgartirilsa takrorlanmasligini tekshirish
    if (dto.email && dto.email !== student.email) {
      const existing = await this.userRepository.findOne({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Bu email allaqachon ishlatilmoqda');
      }
    }

    const oldValues = {
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      isActive: student.isActive,
    };

    await this.userRepository.update(id, {
      ...(dto.firstName && { firstName: dto.firstName }),
      ...(dto.lastName && { lastName: dto.lastName }),
      ...(dto.middleName !== undefined && { middleName: dto.middleName }),
      ...(dto.email && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.telegramChatId !== undefined && { telegramChatId: dto.telegramChatId }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.schoolName !== undefined && { schoolName: dto.schoolName }),
      ...(dto.schoolGrade !== undefined && { schoolGrade: dto.schoolGrade }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });

    await this.auditLogService.log({
      userId: actorId,
      userRole: actorRole,
      action: 'STUDENT_UPDATED',
      entityName: 'users',
      entityId: id,
      oldValues,
      newValues: dto as Record<string, unknown>,
    });

    return this.findOne(id, actorId, actorRole);
  }

  async remove(id: string, actorId: string, actorRole: string) {
    const student = await this.userRepository.findOne({
      where: { id, role: Role.STUDENT },
    });

    if (!student) {
      throw new NotFoundException('O\'quvchi topilmadi');
    }

    // Soft delete
    await this.userRepository.softDelete(id);

    await this.auditLogService.log({
      userId: actorId,
      userRole: actorRole,
      action: 'STUDENT_DELETED',
      entityName: 'users',
      entityId: id,
      oldValues: { email: student.email, firstName: student.firstName },
    });

    return { message: 'O\'quvchi arxivlandi' };
  }

  // O'quvchini guruhga yozish
  async enroll(studentId: string, dto: EnrollStudentDto, actorId: string, actorRole: string) {
    const student = await this.userRepository.findOne({
      where: { id: studentId, role: Role.STUDENT, isActive: true },
    });

    if (!student) {
      throw new NotFoundException('O\'quvchi topilmadi');
    }

    const group = await this.groupRepository.findOne({
      where: { id: dto.groupId, isActive: true },
      relations: { subject: true },
    });

    if (!group) {
      throw new NotFoundException('Guruh topilmadi');
    }

    // Allaqachon yozilganligini tekshirish
    const existing = await this.enrollmentRepository.findOne({
      where: { studentId, groupId: dto.groupId },
    });

    if (existing && existing.status === EnrollmentStatus.ACTIVE) {
      throw new ConflictException('O\'quvchi bu guruhda allaqachon o\'qiydi');
    }

    // Guruhda joy bormi?
    if (group.currentStudents >= group.maxStudents) {
      throw new BadRequestException(`Guruhda joy yo'q (${group.maxStudents}/${group.maxStudents})`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let enrollment: Enrollment;

      if (existing) {
        // Qayta faollashtirish
        await queryRunner.manager.update(Enrollment, existing.id, {
          status: EnrollmentStatus.ACTIVE,
          enrolledAt: dto.enrolledAt ? new Date(dto.enrolledAt) : new Date(),
          discountPercent: dto.discountPercent ?? 0,
        });
        enrollment = { ...existing, status: EnrollmentStatus.ACTIVE } as Enrollment;
      } else {
        enrollment = queryRunner.manager.create(Enrollment, {
          studentId,
          groupId: dto.groupId,
          status: EnrollmentStatus.ACTIVE,
          enrolledAt: dto.enrolledAt ? new Date(dto.enrolledAt) : new Date(),
          discountPercent: dto.discountPercent ?? 0,
          referralStudentId: dto.referralStudentId ?? null,
        });
        await queryRunner.manager.save(enrollment);
      }

      // Guruh o'quvchi sonini yangilash
      await queryRunner.manager.increment(Group, { id: dto.groupId }, 'currentStudents', 1);

      await queryRunner.commitTransaction();

      // Guruh chat xonasiga qo'shish
      await this.addStudentToGroupChatRoom(studentId, dto.groupId).catch(() => {});

      await this.auditLogService.log({
        userId: actorId,
        userRole: actorRole,
        action: 'STUDENT_ENROLLED',
        entityName: 'enrollments',
        entityId: enrollment.id,
        newValues: { studentId, groupId: dto.groupId, subject: group.subject?.name },
      });

      return { message: `O'quvchi "${group.name}" guruhiga yozildi`, enrollment };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Guruhdan chiqarish
  async unenroll(studentId: string, enrollmentId: string, actorId: string, actorRole: string) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { id: enrollmentId, studentId },
      relations: { group: true },
    });

    if (!enrollment) {
      throw new NotFoundException('Yozuv topilmadi');
    }

    if (enrollment.status !== EnrollmentStatus.ACTIVE) {
      throw new BadRequestException('Bu yozuv allaqachon faol emas');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(Enrollment, enrollmentId, {
        status: EnrollmentStatus.DROPPED,
      });

      // Guruh o'quvchi sonini kamaytirish
      await queryRunner.manager.decrement(
        Group,
        { id: enrollment.groupId },
        'currentStudents',
        1,
      );

      await queryRunner.commitTransaction();

      // Guruh chat xonasidan chiqarish
      await this.removeStudentFromGroupChatRoom(studentId, enrollment.groupId).catch(() => {});

      await this.auditLogService.log({
        userId: actorId,
        userRole: actorRole,
        action: 'STUDENT_UNENROLLED',
        entityName: 'enrollments',
        entityId: enrollmentId,
        newValues: { studentId, groupId: enrollment.groupId },
      });

      return { message: 'O\'quvchi guruhdan chiqarildi' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // O'quvchi progressi (dashboard uchun)
  async getProgress(studentId: string, actorId: string, actorRole: string) {
    // O'quvchi faqat o'zini ko'radi
    if (actorRole === Role.STUDENT && studentId !== actorId) {
      throw new ForbiddenException('Faqat o\'z progressingizni ko\'ra olasiz');
    }

    const student = await this.userRepository.findOne({
      where: { id: studentId, role: Role.STUDENT },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        totalPoints: true,
        createdAt: true,
      },
    });

    if (!student) {
      throw new NotFoundException('O\'quvchi topilmadi');
    }

    // So'nggi 30 kunlik davomat
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [attendanceStats, testStats, paymentStats, recentPoints, enrollments] =
      await Promise.all([
        // Davomat statistikasi
        this.attendanceRepository
          .createQueryBuilder('a')
          .innerJoin('a.lesson', 'l')
          .where('a.student_id = :id', { id: studentId })
          .andWhere('l.lesson_date >= :from', { from: thirtyDaysAgo })
          .select([
            'COUNT(*) AS total',
            "SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present",
            "SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late",
            "SUM(CASE WHEN a.status IN ('absent','unexcused') THEN 1 ELSE 0 END) AS absent",
          ])
          .getRawOne(),

        // Test natijalari (so'nggi 10 ta)
        this.testResultRepository.find({
          where: { studentId },
          relations: { test: { subject: true } },
          order: { createdAt: 'DESC' },
          take: 10,
        }),

        // To'lov holati (joriy oy)
        this.paymentRepository
          .createQueryBuilder('p')
          .where('p.student_id = :id', { id: studentId })
          .andWhere('p.deleted_at IS NULL')
          .select([
            'SUM(p.amount) AS totalPaid',
            'COUNT(*) AS paymentCount',
            'MAX(p.created_at) AS lastPaymentAt',
          ])
          .getRawOne(),

        // So'nggi 10 ta ball harakati
        this.pointsLogRepository.find({
          where: { userId: studentId },
          order: { createdAt: 'DESC' },
          take: 10,
        }),

        // Faol guruhlar
        this.enrollmentRepository.find({
          where: { studentId, status: EnrollmentStatus.ACTIVE },
          relations: { group: { subject: true } },
        }),
      ]);

    const total = parseInt(attendanceStats?.total ?? '0');
    const present = parseInt(attendanceStats?.present ?? '0');
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

    const avgScore =
      testStats.length > 0
        ? Math.round(
            testStats.reduce((sum, r) => sum + Number(r.score), 0) / testStats.length,
          )
        : 0;

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        totalPoints: student.totalPoints,
        memberSince: student.createdAt,
      },
      attendance: {
        last30Days: {
          total,
          present,
          late: parseInt(attendanceStats?.late ?? '0'),
          absent: parseInt(attendanceStats?.absent ?? '0'),
          rate: attendanceRate,
        },
      },
      tests: {
        recent: testStats,
        avgScore,
      },
      payments: {
        totalPaid: paymentStats?.totalpaid ?? 0,
        paymentCount: parseInt(paymentStats?.paymentcount ?? '0'),
        lastPaymentAt: paymentStats?.lastpaymentat ?? null,
      },
      recentPoints,
      enrollments,
    };
  }

  // Ota-onalarni olish
  async getParents(studentId: string) {
    const student = await this.userRepository.findOne({
      where: { id: studentId, role: Role.STUDENT },
    });

    if (!student) {
      throw new NotFoundException('O\'quvchi topilmadi');
    }

    return this.parentRepository.find({
      where: { studentId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  // Ustoz o'z guruhiga kirish huquqini tekshirish
  private async checkTeacherAccess(teacherId: string, studentId: string) {
    const enrollment = await this.enrollmentRepository
      .createQueryBuilder('e')
      .innerJoin('groups', 'g', 'g.id = e.group_id AND g.teacher_id = :teacherId', { teacherId })
      .where('e.student_id = :studentId', { studentId })
      .andWhere('e.status = :status', { status: EnrollmentStatus.ACTIVE })
      .getOne();

    if (!enrollment) {
      throw new ForbiddenException('Bu o\'quvchi sizning guruhingizda emas');
    }
  }

  // ─── CHAT XONA SINXRONIZATSIYA ────────────────────────────────────────────

  // Guruh chat xonasiga o'quvchini qo'shish
  private async addStudentToGroupChatRoom(studentId: string, groupId: string): Promise<void> {
    const room = await this.chatRoomRepo.findOne({
      where: { groupId, type: ChatRoomType.GROUP_CLASS },
      relations: { members: true },
    });
    if (!room) return;

    if (room.members.some((m) => m.id === studentId)) return;

    const student = await this.userRepository.findOne({ where: { id: studentId } });
    if (!student) return;

    room.members.push(student);
    await this.chatRoomRepo.save(room);
  }

  // Guruh chat xonasidan o'quvchini chiqarish
  private async removeStudentFromGroupChatRoom(studentId: string, groupId: string): Promise<void> {
    const room = await this.chatRoomRepo.findOne({
      where: { groupId, type: ChatRoomType.GROUP_CLASS },
      relations: { members: true },
    });
    if (!room) return;

    room.members = room.members.filter((m) => m.id !== studentId);
    await this.chatRoomRepo.save(room);
  }
}
