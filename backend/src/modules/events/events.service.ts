import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventType, CompetitionStatus } from '../../entities/event.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../../common/enums/role.enum';
import { CreateEventDto, UpdateEventDto, QueryEventDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
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
  async findAll(query: QueryEventDto): Promise<{ data: Event[]; total: number }> {
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

    const [data, total] = await qb
      .orderBy('e.event_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  // ─── BITTA ────────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: { createdBy: true },
    });
    if (!event) throw new NotFoundException('Tadbir topilmadi');
    return event;
  }

  // ─── YANGILASH ────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateEventDto, actorId: string, actorRole: string): Promise<Event> {
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
