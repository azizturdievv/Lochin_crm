import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { Event } from '../../entities/event.entity';
import { EventParticipant, ParticipantPaymentStatus } from '../../entities/event-participant.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../../entities/notification.entity';
import {
  RegisterParticipantDto,
  UpdateParticipantDto,
  QueryParticipantDto,
} from './dto/event.dto';

@Injectable()
export class PermitService {
  private readonly logger = new Logger(PermitService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(EventParticipant)
    private participantRepo: Repository<EventParticipant>,
    private notifService: NotificationService,
    private auditLog: AuditLogService,
  ) {}

  // ─── RO'YXATDAN O'TKAZISH + ELEKTRON RUXSATNOMA ──────────────────────────
  async register(
    eventId: string,
    dto: RegisterParticipantDto,
    actorId: string,
    actorRole: string,
  ): Promise<EventParticipant> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Tadbir topilmadi');
    if (!event.isActive) throw new BadRequestException('Tadbir faol emas');

    // Ro'yxatdan o'tish muddati
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new BadRequestException('Ro\'yxatdan o\'tish muddati o\'tdi');
    }

    // Qayta ro'yxat
    const existing = await this.participantRepo.findOne({
      where: { eventId, studentId: dto.studentId },
    });
    if (existing) throw new ConflictException('Bu o\'quvchi allaqachon ro\'yxatdan o\'tgan');

    // Ishtirokchilar soni tekshiruvi
    if (event.maxParticipants) {
      const count = await this.participantRepo.count({ where: { eventId } });
      if (count >= event.maxParticipants) {
        throw new BadRequestException('Tadbir ishtirokchilar soni to\'ldi');
      }
    }

    // Elektron ruxsatnoma kodi (UUID)
    const permitCode = randomUUID();
    const permitQr   = await QRCode.toDataURL(permitCode, { width: 300, margin: 2 });

    const participant = this.participantRepo.create({
      eventId,
      studentId:     dto.studentId,
      phone:         dto.phone ?? null,
      school:        dto.school ?? null,
      grade:         dto.grade ?? null,
      age:           dto.age ?? null,
      // entryFee bigint ustuni pg drayveridan string sifatida qaytishi mumkin
      // — 0n bilan qattiq solishtirish shu holatda doim false bo'lardi
      paymentStatus: Number(event.entryFee) === 0
        ? ParticipantPaymentStatus.FREE
        : (dto.paymentStatus ?? ParticipantPaymentStatus.PENDING),
      permitCode,
      permitQr,
      permitVerified: false,
      registeredAt:   new Date(),
    });

    const saved = await this.participantRepo.save(participant);

    // Bildirishnoma (async)
    this.notifService.notify(
      dto.studentId,
      NotificationType.ANNOUNCEMENT,
      '🎟️ Tadbir ruxsatnomasi',
      `"${event.title}" tadbiriga ro'yxatdan o'tdingiz. Ruxsatnoma QR kodi yuborildi.`,
    ).catch(() => {});

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'PARTICIPANT_REGISTERED',
      entityName:'event_participants',
      entityId:  saved.id,
      newValues: { eventId, studentId: dto.studentId },
    });

    this.logger.log(`Ishtirokchi ro'yxatdan o'tdi: ${dto.studentId} → tadbir ${eventId}`);
    return this.findParticipantWithRelations(saved.id);
  }

  // ─── QR RUXSATNOMA VERIFIKATSIYASI ────────────────────────────────────────
  async verifyPermit(permitCode: string): Promise<{
    valid: boolean;
    participant: EventParticipant | null;
    message: string;
  }> {
    const participant = await this.participantRepo.findOne({
      where: { permitCode },
      relations: { student: true, event: true },
    });

    if (!participant) {
      return { valid: false, participant: null, message: 'Ruxsatnoma topilmadi' };
    }

    if (participant.permitVerified) {
      return {
        valid: false,
        participant,
        message: `Ruxsatnoma allaqachon tekshirilgan: ${participant.permitVerifiedAt?.toISOString()}`,
      };
    }

    if (participant.paymentStatus === ParticipantPaymentStatus.PENDING) {
      return { valid: false, participant, message: 'To\'lov kutilmoqda' };
    }

    // Tasdiqlash
    await this.participantRepo.update(participant.id, {
      permitVerified:   true,
      permitVerifiedAt: new Date(),
    });

    participant.permitVerified   = true;
    participant.permitVerifiedAt = new Date();

    return { valid: true, participant, message: 'Ruxsatnoma tasdiqlandi' };
  }

  // ─── ISHTIROKCHILAR RO'YXATI ──────────────────────────────────────────────
  async getParticipants(
    eventId: string,
    query: QueryParticipantDto,
  ): Promise<{ data: EventParticipant[]; total: number }> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Tadbir topilmadi');

    const qb = this.participantRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.student', 's')
      .where('p.event_id = :eventId', { eventId })
      .andWhere('p.deleted_at IS NULL');

    if (query.paymentStatus) {
      qb.andWhere('p.payment_status = :ps', { ps: query.paymentStatus });
    }
    if (query.permitVerified !== undefined) {
      qb.andWhere('p.permit_verified = :pv', { pv: query.permitVerified });
    }
    if (query.school) {
      qb.andWhere('p.school ILIKE :school', { school: `%${query.school}%` });
    }
    if (query.grade) {
      qb.andWhere('p.grade = :grade', { grade: query.grade });
    }
    if (query.search) {
      qb.andWhere(
        '(s.firstName ILIKE :q OR s.last_name ILIKE :q OR p.phone ILIKE :q)',
        { q: `%${query.search}%` },
      );
    }

    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;

    const [data, total] = await qb
      .orderBy('p.registered_at', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  // ─── TO'LOV HOLATI YANGILASH ──────────────────────────────────────────────
  async updateParticipant(
    eventId: string,
    participantId: string,
    dto: UpdateParticipantDto,
    actorId: string,
    actorRole: string,
  ): Promise<EventParticipant> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, eventId },
    });
    if (!participant) throw new NotFoundException('Ishtirokchi topilmadi');

    await this.participantRepo.update(participantId, {
      ...(dto.phone         !== undefined && { phone: dto.phone ?? null }),
      ...(dto.school        !== undefined && { school: dto.school ?? null }),
      ...(dto.grade         !== undefined && { grade: dto.grade ?? null }),
      ...(dto.age           !== undefined && { age: dto.age ?? null }),
      ...(dto.paymentStatus !== undefined && { paymentStatus: dto.paymentStatus }),
    });

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'PARTICIPANT_UPDATED',
      entityName:'event_participants',
      entityId:  participantId,
      newValues: dto as Record<string, unknown>,
    });

    return this.findParticipantWithRelations(participantId);
  }

  // ─── ISHTIROKCHINI O'CHIRISH ──────────────────────────────────────────────
  async removeParticipant(
    eventId: string,
    participantId: string,
    actorId: string,
    actorRole: string,
  ): Promise<{ message: string }> {
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, eventId },
    });
    if (!participant) throw new NotFoundException('Ishtirokchi topilmadi');

    if (participant.permitVerified) {
      throw new BadRequestException('Kirgan ishtirokchini o\'chirib bo\'lmaydi');
    }

    await this.participantRepo.softDelete(participantId);

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'PARTICIPANT_REMOVED',
      entityName:'event_participants',
      entityId:  participantId,
    });

    return { message: 'Ishtirokchi ro\'yxatdan chiqarildi' };
  }

  // ─── YORDAMCHI ────────────────────────────────────────────────────────────
  private findParticipantWithRelations(id: string): Promise<EventParticipant> {
    return this.participantRepo.findOneOrFail({
      where: { id },
      relations: { student: true, event: true },
    });
  }
}
