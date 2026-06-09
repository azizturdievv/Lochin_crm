import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Attendance, AttendanceStatus } from '../../entities/attendance.entity';
import { Payment } from '../../entities/payment.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { Group } from '../../entities/group.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MinioService } from '../lms/minio.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangeOwnPasswordDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Enrollment)
    private enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(PointsLog)
    private pointsLogRepository: Repository<PointsLog>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    private auditLogService: AuditLogService,
    private minioService: MinioService,
  ) {}

  // Xodimlar ro'yxati (manager va ustoz rollari)
  async findAll(query: QueryUserDto) {
    const { search, role, isActive, page = 1, limit = 20 } = query;

    const where: FindManyOptions<User>['where'] = {
      // Faqat xodim rollari
      ...(role ? { role } : { role: Role.MANAGER }),
    };

    // isActive filtri berilgan bo'lsa qo'shamiz, aks holda barchasini ko'rsatamiz
    if (isActive !== undefined) {
      (where as Record<string, unknown>).isActive = isActive;
    }

    // Agar rol filtri yo'q bo'lsa manager + ustoz ikkalasini olamiz
    let qb = this.userRepository
      .createQueryBuilder('u')
      .where('u.deleted_at IS NULL');

    if (role) {
      qb = qb.andWhere('u.role = :role', { role });
    } else {
      qb = qb.andWhere('u.role IN (:...roles)', {
        roles: [Role.MANAGER, Role.USTOZ],
      });
    }

    if (isActive !== undefined) {
      qb = qb.andWhere('u.is_active = :isActive', { isActive });
    }

    if (search) {
      qb = qb.andWhere(
        '(LOWER(u.first_name) LIKE :s OR LOWER(u.last_name) LIKE :s OR LOWER(u.email) LIKE :s OR u.phone LIKE :s)',
        { s: `%${search.toLowerCase()}%` },
      );
    }

    const total = await qb.getCount();

    const users = await qb
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        'u.id', 'u.firstName', 'u.lastName', 'u.middleName',
        'u.email', 'u.phone', 'u.role', 'u.isActive',
        'u.avatarUrl', 'u.lastLoginAt', 'u.totalPoints',
        'u.twoFaEnabled', 'u.createdAt',
      ])
      .getMany();

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Bir xodim ma'lumoti
  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true, middleName: true,
        email: true, phone: true, role: true, isActive: true,
        avatarUrl: true, lastLoginAt: true, totalPoints: true,
        twoFaEnabled: true, createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Xodim topilmadi');
    }

    return user;
  }

  // Yangi xodim qo'shish
  async create(dto: CreateUserDto, actorId: string, actorRole: string) {
    // Email takrorlanmasligini tekshirish
    if (dto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email.toLowerCase().trim() },
        withDeleted: true,
      });
      if (existingEmail) {
        throw new ConflictException('Bu email allaqachon ro\'yxatdan o\'tgan');
      }
    }

    // Telefon takrorlanmasligini tekshirish
    if (dto.phone) {
      const existingPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
        withDeleted: true,
      });
      if (existingPhone) {
        throw new ConflictException('Bu telefon raqam allaqachon ro\'yxatdan o\'tgan');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Username avtomatik generatsiya: firstName.lower + random 3 raqam
    const baseUsername = dto.firstName
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .slice(0, 10);
    const randomSuffix = String(Math.floor(Math.random() * 900) + 100);
    let username = `${baseUsername}_${randomSuffix}`;

    // Username takrorlanmasligini tekshirish
    const usernameExists = await this.userRepository.findOne({ where: { username } });
    if (usernameExists) {
      username = `${baseUsername}_${Date.now().toString().slice(-4)}`;
    }

    const user = this.userRepository.create({
      firstName:  dto.firstName,
      lastName:   dto.lastName,
      middleName: dto.middleName ?? null,
      email:      dto.email ? dto.email.toLowerCase().trim() : null,
      phone:      dto.phone ?? null,
      username,
      passwordHash,
      role:       dto.role,
      isActive:   true,
    });

    await this.userRepository.save(user);

    await this.auditLogService.log({
      userId:     actorId,
      userRole:   actorRole,
      action:     'CREATE_STAFF',
      entityName: 'users',
      entityId:   user.id,
      newValues:  { email: user.email, role: user.role },
    });

    const { passwordHash: _, ...result } = user as User & { passwordHash: string };
    return result;
  }

  // Xodim ma'lumotlarini yangilash
  async update(id: string, dto: UpdateUserDto, actorId: string, actorRole: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Xodim topilmadi');
    }

    // super_admin ni boshqa manager yangilay olmaydi
    if (user.role === Role.SUPER_ADMIN && actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin ma\'lumotlarini faqat Super Admin o\'zgartira oladi');
    }

    const oldValues = { role: user.role, isActive: user.isActive };

    await this.userRepository.update(id, {
      ...(dto.firstName   && { firstName:   dto.firstName }),
      ...(dto.lastName    && { lastName:    dto.lastName }),
      ...(dto.middleName !== undefined && { middleName: dto.middleName }),
      ...(dto.phone      !== undefined && { phone:      dto.phone ?? null }),
      ...(dto.role        && { role:        dto.role }),
    });

    await this.auditLogService.log({
      userId:     actorId,
      userRole:   actorRole,
      action:     'UPDATE_STAFF',
      entityName: 'users',
      entityId:   id,
      oldValues,
      newValues:  dto as unknown as Record<string, unknown>,
    });

    return this.findOne(id);
  }

  // Faollashtirish / o'chirish (soft toggle)
  async toggleActive(id: string, actorId: string, actorRole: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Xodim topilmadi');
    }

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin hisobini o\'chirish mumkin emas');
    }

    const newStatus = !user.isActive;

    await this.userRepository.update(id, { isActive: newStatus });

    await this.auditLogService.log({
      userId:     actorId,
      userRole:   actorRole,
      action:     newStatus ? 'ACTIVATE_STAFF' : 'DEACTIVATE_STAFF',
      entityName: 'users',
      entityId:   id,
      oldValues:  { isActive: user.isActive },
      newValues:  { isActive: newStatus },
    });

    return { id, isActive: newStatus, message: newStatus ? 'Faollashtirildi' : 'O\'chirildi' };
  }

  // Soft delete
  async remove(id: string, actorId: string, actorRole: string) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Xodim topilmadi');
    }

    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('Super Admin hisobini o\'chirish mumkin emas');
    }

    await this.userRepository.softDelete(id);

    await this.auditLogService.log({
      userId:     actorId,
      userRole:   actorRole,
      action:     'DELETE_STAFF',
      entityName: 'users',
      entityId:   id,
      oldValues:  { email: user.email, role: user.role },
    });

    return { message: 'Xodim o\'chirildi (arxivlandi)' };
  }

  // ─── PROFIL ENDPOINTLARI ────────────────────────────────────────────────────

  // O'z profilini olish (rol bo'yicha boyitilgan)
  async getMyProfile(userId: string, userRole: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true, firstName: true, lastName: true, middleName: true,
        email: true, username: true, phone: true, role: true,
        isActive: true, avatarUrl: true, totalPoints: true,
        birthDate: true, address: true, schoolName: true,
        schoolGrade: true, referralSource: true, referralPerson: true,
        telegramChatId: true, twoFaEnabled: true, createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const base = { ...user };

    // O'quvchi uchun qo'shimcha ma'lumotlar
    if (userRole === Role.STUDENT) {
      const enrollments = await this.enrollmentRepository.find({
        where: { studentId: userId, status: EnrollmentStatus.ACTIVE },
        relations: { group: { subject: true } },
        order: { enrolledAt: 'DESC' },
      });

      // Har fan bo'yicha davomat foizi
      const attendanceByGroup: Record<string, { total: number; present: number; rate: number }> = {};
      for (const enrollment of enrollments) {
        const stats = await this.attendanceRepository
          .createQueryBuilder('a')
          .innerJoin('a.lesson', 'l')
          .where('a.student_id = :uid', { uid: userId })
          .andWhere('l.group_id = :gid', { gid: enrollment.groupId })
          .select([
            'COUNT(*) AS total',
            `SUM(CASE WHEN a.status IN ('present','late') THEN 1 ELSE 0 END) AS present`,
          ])
          .getRawOne();

        const total = parseInt(stats?.total ?? '0');
        const present = parseInt(stats?.present ?? '0');
        attendanceByGroup[enrollment.groupId] = {
          total,
          present,
          rate: total > 0 ? Math.round((present / total) * 100) : 0,
        };
      }

      // To'lov holati
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const payments = await this.paymentRepository
        .createQueryBuilder('p')
        .where('p.student_id = :uid', { uid: userId })
        .andWhere('p.deleted_at IS NULL')
        .select(['SUM(p.amount) AS totalPaid', 'MAX(p.created_at) AS lastPaymentAt'])
        .getRawOne();

      const paidThisMonth = await this.paymentRepository
        .createQueryBuilder('p')
        .where('p.student_id = :uid', { uid: userId })
        .andWhere('p.payment_month = :month', { month: currentMonth })
        .andWhere("p.status = 'completed'")
        .andWhere('p.deleted_at IS NULL')
        .getCount();

      // Oxirgi 10 ta ball harakati
      const recentPoints = await this.pointsLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 10,
      });

      return {
        ...base,
        enrollments: enrollments.map(e => ({
          id: e.id,
          groupId: e.groupId,
          groupName: e.group?.name,
          subjectName: e.group?.subject?.name,
          enrolledAt: e.enrolledAt,
          discountPercent: e.discountPercent,
          attendance: attendanceByGroup[e.groupId] ?? { total: 0, present: 0, rate: 0 },
        })),
        payments: {
          totalPaid: parseFloat(payments?.totalpaid ?? '0'),
          lastPaymentAt: payments?.lastpaymentat ?? null,
          paidThisMonth: paidThisMonth > 0,
        },
        recentPoints,
      };
    }

    // Ustoz uchun qo'shimcha ma'lumotlar
    if (userRole === Role.USTOZ) {
      const groups = await this.groupRepository.find({
        where: { teacherId: userId, isActive: true },
        relations: { subject: true },
        order: { createdAt: 'DESC' },
      });

      const recentPoints = await this.pointsLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 20,
      });

      const monthlyPoints = recentPoints
        .filter(p => {
          const d = new Date(p.createdAt);
          const now = new Date();
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, p) => sum + p.points, 0);

      return {
        ...base,
        groups: groups.map(g => ({
          id: g.id,
          name: g.name,
          subjectName: g.subject?.name,
          currentStudents: g.currentStudents,
          maxStudents: g.maxStudents,
        })),
        monthlyPoints,
        recentPoints: recentPoints.slice(0, 10),
      };
    }

    // Manager / super_admin
    return base;
  }

  // O'z profilini yangilash
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    // Username takrorlanmasligini tekshirish
    if (dto.username && dto.username !== user.username) {
      const exists = await this.userRepository.findOne({ where: { username: dto.username } });
      if (exists) throw new ConflictException(`"${dto.username}" username allaqachon band`);
    }

    // Email takrorlanmasligini tekshirish
    if (dto.email && dto.email !== user.email) {
      const exists = await this.userRepository.findOne({ where: { email: dto.email } });
      if (exists) throw new ConflictException('Bu email allaqachon ishlatilmoqda');
    }

    await this.userRepository.update(userId, {
      ...(dto.firstName   !== undefined && { firstName:   dto.firstName }),
      ...(dto.lastName    !== undefined && { lastName:    dto.lastName }),
      ...(dto.middleName  !== undefined && { middleName:  dto.middleName }),
      ...(dto.phone       !== undefined && { phone:       dto.phone || null }),
      ...(dto.address     !== undefined && { address:     dto.address }),
      ...(dto.birthDate   !== undefined && { birthDate:   dto.birthDate ? new Date(dto.birthDate) : null }),
      ...(dto.username    !== undefined && { username:    dto.username }),
      ...(dto.email       !== undefined && { email:       dto.email || null }),
      ...(dto.telegramUsername !== undefined && { telegramChatId: dto.telegramUsername }),
    });

    await this.auditLogService.log({
      userId,
      action: 'PROFILE_UPDATED',
      entityName: 'users',
      entityId: userId,
      newValues: dto as unknown as Record<string, unknown>,
    });

    return this.getMyProfile(userId, user.role);
  }

  // Avatar yuklash
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    const validation = this.minioService.validateFile(file.mimetype, file.size, 'image');
    if (!validation.valid) throw new BadRequestException(validation.error);

    // 2MB limit
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Avatar hajmi 2MB dan oshmasligi kerak');
    }

    const { url } = await this.minioService.uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
      'avatars',
    );

    await this.userRepository.update(userId, { avatarUrl: url });

    await this.auditLogService.log({
      userId,
      action: 'AVATAR_UPDATED',
      entityName: 'users',
      entityId: userId,
    });

    return { avatarUrl: url };
  }

  // O'z parolini o'zgartirish
  async changeOwnPassword(userId: string, dto: ChangeOwnPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const isValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Eski parol noto\'g\'ri');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.update(userId, { passwordHash });

    await this.auditLogService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entityName: 'users',
      entityId: userId,
    });

    return { message: 'Parol muvaffaqiyatli o\'zgartirildi' };
  }

  // Parol tiklash (faqat SA)
  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actorId: string,
    actorRole: string,
  ) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('Xodim topilmadi');
    }

    // Manager o'z parolini tiklay olmaydi — faqat SA
    if (actorRole !== Role.SUPER_ADMIN && actorId !== id) {
      throw new ForbiddenException('Parolni faqat Super Admin tiklashi mumkin');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.userRepository.update(id, {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    await this.auditLogService.log({
      userId:     actorId,
      userRole:   actorRole,
      action:     'RESET_PASSWORD',
      entityName: 'users',
      entityId:   id,
    });

    return { message: 'Parol muvaffaqiyatli tiklandi' };
  }

  // Foydalanuvchi qidirish (chat uchun: username yoki ism bo'yicha)
  async searchUsers(q: string, actorId: string, actorRole: string) {
    if (!q || q.trim().length < 2) return [];
    const query = `%${q.trim().toLowerCase()}%`;

    const qb = this.userRepository
      .createQueryBuilder('u')
      .select(['u.id', 'u.firstName', 'u.lastName', 'u.username', 'u.role', 'u.avatarUrl'])
      .where('u.deleted_at IS NULL')
      .andWhere('u.is_active = true')
      .andWhere('u.id != :actorId', { actorId })
      .andWhere(
        '(LOWER(u.username) LIKE :q OR LOWER(u.first_name) LIKE :q OR LOWER(u.last_name) LIKE :q)',
        { q: query },
      )
      .orderBy('u.first_name', 'ASC')
      .limit(20);

    // O'quvchi faqat o'z guruhi a'zolari va ustozi bilan chat qila oladi
    if (actorRole === Role.STUDENT) {
      const enrollments = await this.enrollmentRepository.find({
        where: { studentId: actorId, status: EnrollmentStatus.ACTIVE },
        select: { groupId: true },
      });
      const groupIds = enrollments.map((e) => e.groupId);
      if (!groupIds.length) return [];

      const groups = await this.groupRepository.find({
        where: { id: In(groupIds) },
        select: { id: true, teacherId: true },
      });
      const teacherIds = groups.map((g) => g.teacherId).filter((id): id is string => !!id);

      const sameGroupEnrollments = await this.enrollmentRepository.find({
        where: { groupId: In(groupIds), status: EnrollmentStatus.ACTIVE },
        select: { studentId: true },
      });
      const sameGroupStudentIds = sameGroupEnrollments
        .map((e) => e.studentId)
        .filter((id) => id !== actorId);

      const allowedIds = [...new Set([...sameGroupStudentIds, ...teacherIds])];
      if (!allowedIds.length) return [];

      qb.andWhere('u.id IN (:...allowedIds)', { allowedIds });
    }

    return qb.getMany();
  }
}
