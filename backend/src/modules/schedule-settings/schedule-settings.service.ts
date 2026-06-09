import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleTimeSlot } from '../../entities/schedule-time-slot.entity';
import { Room } from '../../entities/room.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  CreateTimeSlotDto, UpdateTimeSlotDto,
  CreateRoomDto,     UpdateRoomDto,
} from './dto/schedule-settings.dto';

@Injectable()
export class ScheduleSettingsService {
  constructor(
    @InjectRepository(ScheduleTimeSlot)
    private slotRepo: Repository<ScheduleTimeSlot>,
    @InjectRepository(Room)
    private roomRepo: Repository<Room>,
    private auditLog: AuditLogService,
  ) {}

  // ─── PARALAR ──────────────────────────────────────────────────────────────

  async getTimeSlots(onlyActive = false) {
    return this.slotRepo.find({
      where: onlyActive ? { isActive: true } : {},
      order: { orderIndex: 'ASC', startTime: 'ASC' },
    });
  }

  async createTimeSlot(dto: CreateTimeSlotDto, actorId: string) {
    const slot = this.slotRepo.create({
      name:       dto.name,
      startTime:  dto.startTime,
      endTime:    dto.endTime,
      isActive:   dto.isActive ?? true,
      orderIndex: dto.orderIndex ?? 0,
    });
    await this.slotRepo.save(slot);

    await this.auditLog.log({
      userId: actorId,
      action: 'TIME_SLOT_CREATE',
      entityName: 'schedule_time_slots',
      entityId: slot.id,
      newValues: dto as unknown as Record<string, unknown>,
    });

    return slot;
  }

  async updateTimeSlot(id: string, dto: UpdateTimeSlotDto, actorId: string) {
    const slot = await this.slotRepo.findOne({ where: { id } });
    if (!slot) throw new NotFoundException('Para topilmadi');

    const old = { ...slot };
    Object.assign(slot, dto);
    await this.slotRepo.save(slot);

    await this.auditLog.log({
      userId: actorId,
      action: 'TIME_SLOT_UPDATE',
      entityName: 'schedule_time_slots',
      entityId: id,
      oldValues: old as unknown as Record<string, unknown>,
      newValues: dto as unknown as Record<string, unknown>,
    });

    return slot;
  }

  async deleteTimeSlot(id: string, actorId: string) {
    const slot = await this.slotRepo.findOne({ where: { id } });
    if (!slot) throw new NotFoundException('Para topilmadi');

    await this.slotRepo.softDelete(id);

    await this.auditLog.log({
      userId: actorId,
      action: 'TIME_SLOT_DELETE',
      entityName: 'schedule_time_slots',
      entityId: id,
    });

    return { message: "Para o'chirildi", id };
  }

  // ─── XONALAR ──────────────────────────────────────────────────────────────

  async getRooms(onlyActive = false) {
    return this.roomRepo.find({
      where: onlyActive ? { isActive: true } : {},
      order: { orderIndex: 'ASC', number: 'ASC' },
    });
  }

  async createRoom(dto: CreateRoomDto, actorId: string) {
    const exists = await this.roomRepo.findOne({ where: { number: dto.number } });
    if (exists) throw new ConflictException(`Xona ${dto.number} allaqachon mavjud`);

    const room = this.roomRepo.create({
      name:       dto.name,
      number:     dto.number,
      capacity:   dto.capacity ?? 20,
      isActive:   dto.isActive ?? true,
      orderIndex: dto.orderIndex ?? 0,
    });
    await this.roomRepo.save(room);

    await this.auditLog.log({
      userId: actorId,
      action: 'ROOM_CREATE',
      entityName: 'rooms',
      entityId: room.id,
      newValues: dto as unknown as Record<string, unknown>,
    });

    return room;
  }

  async updateRoom(id: string, dto: UpdateRoomDto, actorId: string) {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Xona topilmadi');

    // Nomer o'zgarganda takrorlanishni tekshir
    if (dto.number && dto.number !== room.number) {
      const dup = await this.roomRepo.findOne({ where: { number: dto.number } });
      if (dup) throw new ConflictException(`Xona ${dto.number} allaqachon mavjud`);
    }

    const old = { ...room };
    Object.assign(room, dto);
    await this.roomRepo.save(room);

    await this.auditLog.log({
      userId: actorId,
      action: 'ROOM_UPDATE',
      entityName: 'rooms',
      entityId: id,
      oldValues: old as unknown as Record<string, unknown>,
      newValues: dto as unknown as Record<string, unknown>,
    });

    return room;
  }

  async deleteRoom(id: string, actorId: string) {
    const room = await this.roomRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Xona topilmadi');

    await this.roomRepo.softDelete(id);

    await this.auditLog.log({
      userId: actorId,
      action: 'ROOM_DELETE',
      entityName: 'rooms',
      entityId: id,
    });

    return { message: "Xona o'chirildi", id };
  }
}
