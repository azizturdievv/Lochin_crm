import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindManyOptions } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  ResetPasswordDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditLogService: AuditLogService,
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
    // Email tekshiruvi
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
      withDeleted: true,
    });

    if (existing) {
      throw new ConflictException('Bu email allaqachon ro\'yxatdan o\'tgan');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepository.create({
      firstName:  dto.firstName,
      lastName:   dto.lastName,
      middleName: dto.middleName ?? null,
      email:      dto.email,
      phone:      dto.phone ?? null,
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
}
