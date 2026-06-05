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
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateStudentDto, actorId: string, actorRole: string) {
    // Email takrorlanmasligini tekshirish
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
      withDeleted: true,
    });

    if (existing) {
      throw new ConflictException('Bu email allaqachon ro\'yxatdan o\'tgan');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Transaction: user + parents bir vaqtda saqlanadi
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const student = queryRunner.manager.create(User, {
        firstName:      dto.firstName,
        lastName:       dto.lastName,
        middleName:     dto.middleName     || null,
        email:          dto.email,
        // Bo'sh string → null (unique constraint xatosini oldini oladi)
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

      // Guruhga darhol yozish (ixtiyoriy)
      if (dto.groupId) {
        const group = await queryRunner.manager.findOne(Group, {
          where: { id: dto.groupId, isActive: true },
        });
        if (group && group.currentStudents < group.maxStudents) {
          const enrollment = queryRunner.manager.create(Enrollment, {
            studentId:       student.id,
            groupId:         dto.groupId,
            status:          EnrollmentStatus.ACTIVE,
            enrolledAt:      dto.enrollmentDate ? new Date(dto.enrollmentDate) : new Date(),
            discountPercent: 0,
            referralStudentId: dto.referralStudentId ?? null,
          });
          await queryRunner.manager.save(enrollment);
          await queryRunner.manager.increment(Group, { id: dto.groupId }, 'currentStudents', 1);
        }
      }

      await queryRunner.commitTransaction();

      await this.auditLogService.log({
        userId: actorId,
        userRole: actorRole,
        action: 'STUDENT_CREATED',
        entityName: 'users',
        entityId: student.id,
        newValues: { email: student.email, firstName: student.firstName, lastName: student.lastName },
      });

      return this.findOne(student.id, actorId, actorRole);
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      // PostgreSQL unique constraint (23505) — 500 o'rniga 409 qaytarish
      const pgErr = err as { code?: string; detail?: string };
      if (pgErr?.code === '23505') {
        if (pgErr?.detail?.includes('phone')) {
          throw new ConflictException("Bu telefon raqam allaqachon ro'yxatda bor");
        }
        if (pgErr?.detail?.includes('email')) {
          throw new ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
        }
        throw new ConflictException("Bu ma'lumot allaqachon mavjud");
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
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
        '(u.first_name ILIKE :s OR u.last_name ILIKE :s OR u.email ILIKE :s OR u.phone ILIKE :s)',
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
      firstName: 'u.first_name',
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
}
