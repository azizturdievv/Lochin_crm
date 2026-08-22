import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { randomUUID } from 'crypto';
import { LiveSession, LiveSessionStatus, LiveSessionType } from '../../entities/live-session.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Group } from '../../entities/group.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { LivekitService } from './livekit.service';
import { CreateLiveSessionDto, UpdateLiveSessionDto, CancelLiveSessionDto } from './dto/live-session.dto';

// Xona turiga qarab standart sig'im — aniq qiymat berilmasa ishlatiladi
const DEFAULT_MAX_PARTICIPANTS: Record<LiveSessionType, number> = {
  [LiveSessionType.TEACHER_STUDENT]: 30,
  [LiveSessionType.STAFF]: 50,
  [LiveSessionType.PARENT_CENTER]: 20,
  [LiveSessionType.COMPETITION]: 200,
  [LiveSessionType.SPORT_ROBO]: 40,
  [LiveSessionType.BROADCAST]: 200,
};

// Guruhsiz (umumiy) bo'lganda ham talabaga ko'rinadigan turlar — masalan
// butun markaz uchun jonli efir yoki musobaqa. Boshqa turlar (teacher_student,
// staff, parent_center) guruhsiz holda faqat xodimlarga ko'rinadi
const BROADLY_VISIBLE_WHEN_GROUPLESS = [
  LiveSessionType.BROADCAST,
  LiveSessionType.COMPETITION,
  LiveSessionType.SPORT_ROBO,
];

@Injectable()
export class LiveSessionsService {
  constructor(
    @InjectRepository(LiveSession)
    private sessionRepo: Repository<LiveSession>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    private livekit: LivekitService,
    private auditLog: AuditLogService,
  ) {}

  get videoConfigured(): boolean {
    return this.livekit.isConfigured;
  }

  // Xona turiga (teacher_student + guruh bo'lsa haqiqiy guruh sig'imiga) qarab
  // aqlli standart sig'im — aniq qiymat berilgan bo'lsa shu ustun turadi
  private async resolveMaxParticipants(
    type: LiveSessionType,
    groupId: string | null | undefined,
    override: number | undefined,
  ): Promise<number> {
    if (override != null) return override;
    if (type === LiveSessionType.TEACHER_STUDENT && groupId) {
      const group = await this.groupRepo.findOne({ where: { id: groupId } });
      if (group) return group.maxStudents;
    }
    return DEFAULT_MAX_PARTICIPANTS[type];
  }

  // ─── RO'YXAT (rol bo'yicha qamrovlangan) ──────────────────────────────────
  async findAll(actorId: string, actorRole: string) {
    const qb = this.sessionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.host', 'host')
      .leftJoinAndSelect('s.group', 'group')
      .orderBy('s.scheduledAt', 'ASC');

    if (actorRole === Role.USTOZ) {
      qb.andWhere('(s.hostId = :actorId OR group.teacherId = :actorId)', { actorId });
    } else if (actorRole === Role.STUDENT) {
      // O'z guruhiga tegishli sessiyalar + guruhsiz (umumiy) turlar. Bo'sh
      // massiv bilan "IN ()" SQL xatosiga yo'l qo'ymaslik uchun bo'sh
      // bo'lganda haqiqiy id bilan mos kelmaydigan qiymat qo'yiladi
      const groupIds = (
        await this.enrollmentRepo.find({
          where: { studentId: actorId, status: EnrollmentStatus.ACTIVE },
        })
      ).map((e) => e.groupId);

      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('s.groupId IN (:...groupIds)', { groupIds: groupIds.length ? groupIds : [''] })
            .orWhere('(s.groupId IS NULL AND s.type IN (:...broadTypes))', {
              broadTypes: BROADLY_VISIBLE_WHEN_GROUPLESS,
            });
        }),
      );
    }
    // SUPER_ADMIN / MANAGER — cheklovsiz, hammasini ko'radi

    return qb.getMany();
  }

  async findOne(id: string) {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: { host: true, group: true },
    });
    if (!session) throw new NotFoundException('Sessiya topilmadi');
    return session;
  }

  // ─── YARATISH / REJALASHTIRISH ────────────────────────────────────────────
  async create(dto: CreateLiveSessionDto, actorId: string, actorRole: string) {
    if (actorRole === Role.USTOZ && dto.groupId) {
      const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
      if (!group || group.teacherId !== actorId) {
        throw new ForbiddenException("Faqat o'z guruhingiz uchun dars rejalashtira olasiz");
      }
    }

    const session = this.sessionRepo.create({
      title: dto.title,
      type: dto.type,
      groupId: dto.groupId ?? null,
      hostId: actorId,
      scheduledAt: new Date(dto.scheduledAt),
      roomId: `live-${randomUUID()}`,
      status: LiveSessionStatus.SCHEDULED,
      maxParticipants: await this.resolveMaxParticipants(dto.type, dto.groupId, dto.maxParticipants),
      recordingEnabled: dto.recordingEnabled ?? false,
    });
    await this.sessionRepo.save(session);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'LIVE_SESSION_CREATED',
      entityName: 'live_sessions', entityId: session.id,
      newValues: { title: dto.title, type: dto.type, scheduledAt: dto.scheduledAt },
    });

    return this.findOne(session.id);
  }

  // ─── QO'SHILISH (Livekit token) ───────────────────────────────────────────
  async join(id: string, actorId: string, actorRole: string, displayName: string) {
    const session = await this.findOne(id);

    if (session.status === LiveSessionStatus.ENDED || session.status === LiveSessionStatus.CANCELLED) {
      throw new BadRequestException('Bu sessiya allaqachon yakunlangan');
    }

    const isHost = session.hostId === actorId;
    const isStaff = actorRole === Role.SUPER_ADMIN || actorRole === Role.MANAGER;

    if (!isHost && !isStaff) {
      if (actorRole === Role.STUDENT) {
        if (!session.groupId) throw new ForbiddenException("Sizga bu sessiyaga kirish ruxsati yo'q");
        const enrolled = await this.enrollmentRepo.findOne({
          where: { studentId: actorId, groupId: session.groupId, status: EnrollmentStatus.ACTIVE },
        });
        if (!enrolled) throw new ForbiddenException("Sizga bu sessiyaga kirish ruxsati yo'q");
      } else if (actorRole === Role.USTOZ) {
        if (session.groupId) {
          const group = await this.groupRepo.findOne({ where: { id: session.groupId } });
          if (!group || group.teacherId !== actorId) {
            throw new ForbiddenException("Sizga bu sessiyaga kirish ruxsati yo'q");
          }
        } else {
          throw new ForbiddenException("Sizga bu sessiyaga kirish ruxsati yo'q");
        }
      }
    }

    if (!isHost && session.status === LiveSessionStatus.SCHEDULED) {
      throw new BadRequestException("Dars hali boshlanmagan — ustoz boshlashini kuting");
    }

    // Livekit token'ni DB holatini o'zgartirishdan OLDIN olamiz — token
    // xatoga uchrasa (masalan, kalitlar sozlanmagan), sessiya noto'g'ri
    // "live" holatiga o'tib qolmasligi kerak
    const { token, url } = await this.livekit.createJoinToken({
      roomName: session.roomId!,
      identity: actorId,
      displayName,
      role: isHost || isStaff ? 'host' : 'participant',
    });

    if (isHost && session.status === LiveSessionStatus.SCHEDULED) {
      session.status = LiveSessionStatus.LIVE;
      session.startedAt = new Date();
      await this.sessionRepo.save(session);
    }

    return { token, url, session };
  }

  // ─── YAKUNLASH ─────────────────────────────────────────────────────────────
  async end(id: string, actorId: string, actorRole: string) {
    const session = await this.findOne(id);
    const isHost = session.hostId === actorId;
    const isStaff = actorRole === Role.SUPER_ADMIN || actorRole === Role.MANAGER;
    if (!isHost && !isStaff) throw new ForbiddenException("Faqat boshlovchi yoki menejer yakunlay oladi");

    session.status = LiveSessionStatus.ENDED;
    session.endedAt = new Date();
    await this.sessionRepo.save(session);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'LIVE_SESSION_ENDED',
      entityName: 'live_sessions', entityId: session.id,
    });

    return session;
  }

  // ─── TAHRIRLASH (faqat hali boshlanmagan sessiya) ─────────────────────────
  async update(id: string, dto: UpdateLiveSessionDto, actorId: string, actorRole: string) {
    const session = await this.findOne(id);
    const isHost = session.hostId === actorId;
    const isStaff = actorRole === Role.SUPER_ADMIN || actorRole === Role.MANAGER;
    if (!isHost && !isStaff) throw new ForbiddenException("Faqat boshlovchi yoki menejer tahrirlay oladi");

    if (session.status !== LiveSessionStatus.SCHEDULED) {
      throw new BadRequestException('Faqat rejalashtirilgan sessiyani tahrirlash mumkin');
    }

    const oldValues = {
      title: session.title, type: session.type, scheduledAt: session.scheduledAt,
      maxParticipants: session.maxParticipants, recordingEnabled: session.recordingEnabled,
    };

    if (dto.title !== undefined) session.title = dto.title;
    if (dto.type !== undefined) session.type = dto.type;
    if (dto.scheduledAt !== undefined) session.scheduledAt = new Date(dto.scheduledAt);
    if (dto.maxParticipants !== undefined) session.maxParticipants = dto.maxParticipants;
    if (dto.recordingEnabled !== undefined) session.recordingEnabled = dto.recordingEnabled;

    await this.sessionRepo.save(session);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'LIVE_SESSION_UPDATED',
      entityName: 'live_sessions', entityId: session.id,
      oldValues, newValues: dto as unknown as Record<string, unknown>,
    });

    return this.findOne(session.id);
  }

  // ─── BEKOR QILISH (faqat hali boshlanmagan sessiya) ───────────────────────
  async cancel(id: string, dto: CancelLiveSessionDto, actorId: string, actorRole: string) {
    const session = await this.findOne(id);
    const isHost = session.hostId === actorId;
    const isStaff = actorRole === Role.SUPER_ADMIN || actorRole === Role.MANAGER;
    if (!isHost && !isStaff) throw new ForbiddenException("Faqat boshlovchi yoki menejer bekor qila oladi");

    if (session.status !== LiveSessionStatus.SCHEDULED) {
      throw new BadRequestException(
        session.status === LiveSessionStatus.LIVE
          ? "Jonli ketayotgan sessiyani bekor qilib bo'lmaydi — avval yakunlang"
          : 'Faqat rejalashtirilgan sessiyani bekor qilish mumkin',
      );
    }

    session.status = LiveSessionStatus.CANCELLED;
    session.cancelReason = dto.reason ?? null;
    await this.sessionRepo.save(session);

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'LIVE_SESSION_CANCELLED',
      entityName: 'live_sessions', entityId: session.id,
      newValues: { reason: dto.reason ?? null },
    });

    return session;
  }
}
