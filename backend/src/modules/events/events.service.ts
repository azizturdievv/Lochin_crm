import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Event, EventType, CompetitionStatus } from '../../entities/event.entity';
import { EventParticipant } from '../../entities/event-participant.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../../common/enums/role.enum';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(EventParticipant)
    private participantRepo: Repository<EventParticipant>,
    private auditLog: AuditLogService,
  ) {}

  // ─── TADBIR YARATISH ──────────────────────────────────────────────────────
  async create(dto: CreateEventDto, actorId: string, actorRole: string): Promise<Event> {
    const event = this.eventRepo.create({
      title:                dto.title,
      type:                 dto.type,
      description:          dto.description ?? null,
      eventDate:            new Date(dto.eventDate),
      startTime:            dto.startTime ?? null,
      location:             dto.location ?? null,
      createdById:          actorId,
      maxParticipants:      dto.maxParticipants ?? null,
      registrationDeadline: dto.registrationDeadline ? new Date(dto.registrationDeadline) : null,
      entryFee:             dto.entryFee ? BigInt(Math.round(dto.entryFee)) : 0n,
      isOnline:             dto.isOnline ?? false,
      questionCount:        dto.questionCount ?? 10,
      timeLimit:            dto.timeLimit ?? 60,
      competitionStatus:    CompetitionStatus.NOT_STARTED,
      isActive:             true,
    });

    const saved = await this.eventRepo.save(event);

    await this.auditLog.log({
      userId:     actorId,
      userRole:   actorRole,
      action:     'EVENT_CREATED',
      entityName: 'events',
      entityId:   saved.id,
      newValues:  { title: saved.title, type: saved.type },
    });

    this.logger.log(`Tadbir yaratildi: ${saved.title} (${saved.type})`);
    return saved;
  }

  // ─── RO'YXAT ──────────────────────────────────────────────────────────────
  async findAll(query: QueryEventDto, userId?: string, userRole?: string) {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.createdBy', 'u')
      .where('e.deleted_at IS NULL');

    if (query.type)     qb.andWhere('e.type = :type', { type: query.type });
    if (query.isOnline !== undefined) qb.andWhere('e.is_online = :online', { online: query.isOnline });
    if (query.isActive !== undefined) qb.andWhere('e.is_active = :active', { active: query.isActive });
    if (query.dateFrom) qb.andWhere('e.event_date >= :from', { from: query.dateFrom });
    if (query.dateTo)   qb.andWhere('e.event_date <= :to',   { to: query.dateTo });

    const page  = query.page  ?? 1;
    const limit = query.limit ?? 20;

    const [events, total] = await qb
      .orderBy('e.event_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    if (events.length === 0) return { data: [], total };

    const eventIds = events.map((e) => e.id);

    // Har bir tadbir uchun ishtirokchilar soni
    const counts = await this.participantRepo
      .createQueryBuilder('p')
      .select('p.event_id', 'eventId')
      .addSelect('COUNT(*)', 'count')
      .where('p.event_id IN (:...ids)', { ids: eventIds })
      .andWhere('p.deleted_at IS NULL')
      .groupBy('p.event_id')
      .getRawMany<{ eventId: string; count: string }>();
    const countByEvent = new Map(counts.map((c) => [c.eventId, Number(c.count)]));

    // Joriy foydalanuvchining ishtiroki — faqat o'quvchi uchun ma'noli
    let myParticipationByEvent = new Map<string, EventParticipant>();
    if (userId && userRole === Role.STUDENT) {
      const mine = await this.participantRepo.find({
        where: { eventId: In(eventIds), studentId: userId },
      });
      myParticipationByEvent = new Map(mine.map((p) => [p.eventId, p]));
    }

    const data = events.map((e) =>
      this.toResponse(
        e,
        countByEvent.get(e.id) ?? 0,
        myParticipationByEvent.get(e.id) ?? null,
      ),
    );

    return { data, total };
  }

  // ─── BITTA ────────────────────────────────────────────────────────────────
  async findOne(id: string, userId?: string, userRole?: string) {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: { createdBy: true },
    });
    if (!event) throw new NotFoundException('Tadbir topilmadi');

    const participantsCount = await this.participantRepo.count({
      where: { eventId: id },
    });

    let myParticipation: EventParticipant | null = null;
    if (userId && userRole === Role.STUDENT) {
      myParticipation = await this.participantRepo.findOne({
        where: { eventId: id, studentId: userId },
      });
    }

    return this.toResponse(event, participantsCount, myParticipation);
  }

  // ─── YORDAMCHI: xom entity → frontend kontrakti ──────────────────────────
  // Entity'da yo'q, lekin frontendga kerak bo'lgan hisoblanadigan maydonlar:
  // status (event_date/is_active/competition_status'dan chiqariladi),
  // hasFee/feeAmount (entry_fee'dan), participantsCount, myParticipation.
  private toResponse(
    event: Event,
    participantsCount: number,
    myParticipation: EventParticipant | null,
  ) {
    return {
      id:                   event.id,
      title:                event.title,
      type:                 event.type,
      description:          event.description,
      eventDate:            event.eventDate,
      startTime:            event.startTime,
      location:             event.location,
      maxParticipants:      event.maxParticipants,
      registrationDeadline: event.registrationDeadline,
      hasFee:               Number(event.entryFee) > 0,
      feeAmount:            Number(event.entryFee) || null,
      isOnline:             event.isOnline,
      questionCount:        event.questionCount,
      timeLimit:            event.timeLimit,
      competitionStatus:    event.competitionStatus,
      results:              event.results,
      status:               this.computeStatus(event),
      participantsCount,
      myParticipation,
      createdBy:            event.createdById,
      organizer:            event.createdBy
        ? { firstName: event.createdBy.firstName, lastName: event.createdBy.lastName }
        : undefined,
      createdAt:            event.createdAt,
    };
  }

  // Entityda alohida "status" ustuni yo'q — is_active, event_date va (onlayn
  // tadbirlar uchun) competition_status asosida chiqariladi.
  private computeStatus(event: Event): 'upcoming' | 'ongoing' | 'completed' | 'cancelled' {
    if (!event.isActive) return 'cancelled';
    if (event.isOnline && event.competitionStatus === CompetitionStatus.ONGOING) return 'ongoing';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(event.eventDate);
    eventDay.setHours(0, 0, 0, 0);

    if (eventDay.getTime() === today.getTime()) return 'ongoing';
    if (eventDay.getTime() > today.getTime()) return 'upcoming';
    return 'completed';
  }

  // ─── YANGILASH ────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateEventDto, actorId: string, actorRole: string) {
    const event = await this.findOne(id);

    if (event.competitionStatus === CompetitionStatus.ONGOING) {
      throw new BadRequestException('Jarayondagi musobaqani o\'zgartirib bo\'lmaydi');
    }

    const patch: Partial<Event> = {};
    if (dto.title        !== undefined) patch.title        = dto.title;
    if (dto.description  !== undefined) patch.description  = dto.description ?? null;
    if (dto.eventDate    !== undefined) patch.eventDate    = new Date(dto.eventDate);
    if (dto.startTime    !== undefined) patch.startTime    = dto.startTime ?? null;
    if (dto.location     !== undefined) patch.location     = dto.location ?? null;
    if (dto.maxParticipants !== undefined) patch.maxParticipants = dto.maxParticipants ?? null;
    if (dto.registrationDeadline !== undefined) {
      patch.registrationDeadline = dto.registrationDeadline ? new Date(dto.registrationDeadline) : null;
    }
    if (dto.entryFee     !== undefined) patch.entryFee    = BigInt(Math.round(dto.entryFee));
    if (dto.isActive     !== undefined) patch.isActive    = dto.isActive;
    if (dto.questionCount !== undefined) patch.questionCount = dto.questionCount;
    if (dto.timeLimit    !== undefined) patch.timeLimit   = dto.timeLimit;

    await this.eventRepo.update(id, patch as Record<string, unknown>);

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'EVENT_UPDATED',
      entityName:'events',
      entityId:  id,
      newValues: patch as Record<string, unknown>,
    });

    return this.findOne(id);
  }

  // ─── O'CHIRISH ────────────────────────────────────────────────────────────
  async remove(id: string, actorId: string, actorRole: string): Promise<{ message: string }> {
    if (actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Faqat Super Admin tadbir o\'chira oladi');
    }

    const event = await this.findOne(id);

    if (event.competitionStatus === CompetitionStatus.ONGOING) {
      throw new BadRequestException('Jarayondagi musobaqani o\'chirib bo\'lmaydi');
    }

    await this.eventRepo.softDelete(id);

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'EVENT_DELETED',
      entityName:'events',
      entityId:  id,
      oldValues: { title: event.title },
    });

    return { message: 'Tadbir o\'chirildi' };
  }
}
