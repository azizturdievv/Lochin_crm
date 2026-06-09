import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatRoom, ChatRoomType } from '../../entities/chat-room.entity';
import { Message, MessageType } from '../../entities/message.entity';
import { VideoMessage } from '../../entities/video-message.entity';
import { User } from '../../entities/user.entity';
import { Group } from '../../entities/group.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ModerationService, ModerationLevel } from './moderation.service';
import { CreateRoomDto } from './dto/chat.dto';

type SendMessagePayload = {
  roomId: string;
  senderId: string;
  content?: string;
  type?: MessageType;
  fileUrl?: string;
  fileSize?: number;
  durationSeconds?: number;
};

type SendResult = {
  message?: Message;
  blocked: boolean;
  reason?: string;
  warning?: string;
};

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private roomRepo: Repository<ChatRoom>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    @InjectRepository(VideoMessage)
    private videoRepo: Repository<VideoMessage>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    private moderation: ModerationService,
    private auditLog: AuditLogService,
  ) {}

  // ─── XONA YARATISH ────────────────────────────────────────────────────────
  async createRoom(dto: CreateRoomDto, actorId: string, actorRole: string): Promise<ChatRoom> {
    // Shaxsiy chat: mavjud bo'lsa topish
    if (dto.type === ChatRoomType.PRIVATE && dto.targetUserId) {
      // O'quvchi boshqa o'quvchi bilan: faqat bir xil guruhda bo'lsa ruxsat
      if (actorRole === Role.STUDENT) {
        const targetUser = await this.userRepo.findOne({
          where: { id: dto.targetUserId },
          select: { role: true },
        });
        if (targetUser?.role === Role.STUDENT) {
          const actorEnrollments = await this.enrollmentRepo.find({
            where: { studentId: actorId, status: EnrollmentStatus.ACTIVE },
            select: { groupId: true },
          });
          const actorGroupIds = actorEnrollments.map((e) => e.groupId);

          const sharedGroup = actorGroupIds.length
            ? await this.enrollmentRepo.findOne({
                where: { studentId: dto.targetUserId, groupId: In(actorGroupIds), status: EnrollmentStatus.ACTIVE },
              })
            : null;

          if (!sharedGroup) {
            throw new ForbiddenException('Faqat bir xil guruhda o\'qiydigan o\'quvchilar bilan chat ochish mumkin');
          }
        }
      }

      const existing = await this.findPrivateRoom(actorId, dto.targetUserId);
      if (existing) return existing;

      const room = this.roomRepo.create({ type: ChatRoomType.PRIVATE, name: null, isActive: true });
      await this.roomRepo.save(room);

      const members = await this.userRepo.findBy({ id: In([actorId, dto.targetUserId]) });
      room.members = members;
      await this.roomRepo.save(room);
      return room;
    }

    // Guruh sinfxonasi: guruh bo'yicha barcha a'zolarni qo'shish
    if (dto.type === ChatRoomType.GROUP_CLASS && dto.groupId) {
      const existing = await this.roomRepo.findOne({
        where: { type: ChatRoomType.GROUP_CLASS, groupId: dto.groupId },
        relations: { members: true },
      });
      if (existing) return existing;

      const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
      if (!group) throw new NotFoundException('Guruh topilmadi');

      const room = this.roomRepo.create({
        type: ChatRoomType.GROUP_CLASS,
        name: `${group.name} sinfxonasi`,
        groupId: dto.groupId,
        isActive: true,
      });
      await this.roomRepo.save(room);

      // Guruh o'qituvchisi va o'quvchilari
      const enrollments = await this.enrollmentRepo.find({
        where: { groupId: dto.groupId, status: EnrollmentStatus.ACTIVE },
        select: { studentId: true },
      });
      const studentIds = enrollments.map((e) => e.studentId);
      const memberIds = [...new Set([...(group.teacherId ? [group.teacherId] : []), ...studentIds])];

      room.members = await this.userRepo.findBy({ id: In(memberIds) });
      await this.roomRepo.save(room);
      return room;
    }

    // E'lonlar xonasi
    if (dto.type === ChatRoomType.ANNOUNCEMENTS) {
      if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.MANAGER) {
        throw new ForbiddenException('E\'lonlar xonasini faqat SA/Manager yaratadi');
      }
      const room = this.roomRepo.create({
        type: ChatRoomType.ANNOUNCEMENTS,
        name: dto.name ?? "E'lonlar",
        isActive: true,
      });
      await this.roomRepo.save(room);

      if (dto.memberIds?.length) {
        room.members = await this.userRepo.findBy({ id: In(dto.memberIds) });
        await this.roomRepo.save(room);
      }
      return room;
    }

    // Ota-ona ↔ Ustoz
    if (dto.type === ChatRoomType.PARENT_TEACHER && dto.targetUserId) {
      const existing = await this.findPrivateRoom(actorId, dto.targetUserId);
      if (existing) return existing;

      const room = this.roomRepo.create({
        type: ChatRoomType.PARENT_TEACHER,
        name: null,
        isActive: true,
      });
      await this.roomRepo.save(room);
      room.members = await this.userRepo.findBy({ id: In([actorId, dto.targetUserId]) });
      await this.roomRepo.save(room);
      return room;
    }

    throw new BadRequestException('Noto\'g\'ri xona turi yoki parametrlar');
  }

  // ─── FOYDALANUVCHI XONALARI ───────────────────────────────────────────────
  async getUserRooms(userId: string, actorRole: string): Promise<ChatRoom[]> {
    // SA: barcha xonalar (kuzatuv uchun)
    if (actorRole === Role.SUPER_ADMIN) {
      return this.roomRepo.find({
        where: { isActive: true },
        relations: { members: true },
        order: { lastMessageAt: 'DESC' },
        take: 100,
      });
    }

    // Manager: faqat e'lonlar va guruh sinfxonalari
    if (actorRole === Role.MANAGER) {
      return this.roomRepo.find({
        where: [
          { isActive: true, type: ChatRoomType.ANNOUNCEMENTS },
          { isActive: true, type: ChatRoomType.GROUP_CLASS },
        ],
        relations: { members: true },
        order: { lastMessageAt: 'DESC' },
      });
    }

    // Ustoz, student, ota-ona: faqat o'zi a'zo bo'lgan xonalar
    return this.roomRepo
      .createQueryBuilder('r')
      .innerJoin('r.members', 'm', 'm.id = :uid', { uid: userId })
      .leftJoinAndSelect('r.members', 'members')
      .where('r.is_active = true')
      .orderBy('r.last_message_at', 'DESC')
      .getMany();
  }

  // SA uchun barcha xonalar (pagination bilan)
  async getAllRooms(page = 1, limit = 50): Promise<{ items: ChatRoom[]; total: number }> {
    const [items, total] = await this.roomRepo.findAndCount({
      where: { isActive: true },
      relations: { members: true },
      order: { lastMessageAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total };
  }

  async getUserRoomIds(userId: string, actorRole: string): Promise<string[]> {
    const rooms = await this.getUserRooms(userId, actorRole);
    return rooms.map((r) => r.id);
  }

  // ─── RUXSATNI TEKSHIRISH ──────────────────────────────────────────────────
  async checkRoomAccess(roomId: string, userId: string, actorRole: string): Promise<boolean> {
    // SA: barcha xonalarga kirish — audit log
    if (actorRole === Role.SUPER_ADMIN) {
      await this.auditLog.log({
        userId,
        userRole: actorRole,
        action: 'SA_CHAT_ROOM_READ',
        entityName: 'chat_rooms',
        entityId: roomId,
        newValues: { roomId, readAt: new Date().toISOString() },
      });
      return true;
    }

    // Manager faqat e'lonlar va guruh sinfxonalari
    if (actorRole === Role.MANAGER) {
      const room = await this.roomRepo.findOne({
        where: { id: roomId },
        select: { type: true },
      });
      return room?.type === ChatRoomType.ANNOUNCEMENTS || room?.type === ChatRoomType.GROUP_CLASS;
    }

    const room = await this.roomRepo
      .createQueryBuilder('r')
      .innerJoin('r.members', 'm', 'm.id = :uid', { uid: userId })
      .where('r.id = :rid', { rid: roomId })
      .getOne();

    return !!room;
  }

  // E'lonlar xonasiga yozish ruxsati
  async canWriteToRoom(roomId: string, userId: string, actorRole: string): Promise<boolean> {
    if (actorRole === Role.SUPER_ADMIN) return true;

    const room = await this.roomRepo.findOne({ where: { id: roomId } });
    if (!room) return false;

    // E'lonlar xonasiga faqat SA/Manager yozadi
    if (room.type === ChatRoomType.ANNOUNCEMENTS) {
      return actorRole === Role.MANAGER;
    }

    // Manager faqat guruh sinfxonasiga yoza oladi
    if (actorRole === Role.MANAGER) {
      return room.type === ChatRoomType.GROUP_CLASS;
    }

    return this.checkRoomAccess(roomId, userId, actorRole);
  }

  // ─── XABAR YUBORISH ───────────────────────────────────────────────────────
  async sendMessage(payload: SendMessagePayload): Promise<SendResult> {
    const room = await this.roomRepo.findOne({ where: { id: payload.roomId } });
    if (!room) return { blocked: true, reason: 'Xona topilmadi' };

    // Yozish ruxsatini tekshirish
    const sender = await this.userRepo.findOne({
      where: { id: payload.senderId },
      select: { role: true },
    });
    if (!sender) return { blocked: true, reason: 'Foydalanuvchi topilmadi' };

    const canWrite = await this.canWriteToRoom(payload.roomId, payload.senderId, sender.role);
    if (!canWrite) return { blocked: true, reason: 'Bu xonaga yozish ruxsati yo\'q' };

    // Matn moderatsiya
    if (payload.content && (payload.type ?? MessageType.TEXT) === MessageType.TEXT) {
      const modResult = this.moderation.moderate(payload.content, payload.senderId);

      if (modResult.level === ModerationLevel.BLOCKED) {
        await this.auditLog.log({
          userId: payload.senderId,
          userRole: sender.role,
          action: 'CHAT_MESSAGE_BLOCKED',
          entityName: 'messages',
          newValues: { roomId: payload.roomId, reason: modResult.reason },
        });
        return { blocked: true, reason: modResult.reason };
      }

      const msg = await this.saveAndReturn(payload, modResult.level === ModerationLevel.WARNING ? (modResult.reason ?? null) : null);
      return {
        message: msg,
        blocked: false,
        warning: modResult.level === ModerationLevel.WARNING ? modResult.reason : undefined,
      };
    }

    const msg = await this.saveAndReturn(payload, null);
    return { message: msg, blocked: false };
  }

  private async saveAndReturn(payload: SendMessagePayload, moderationFlag: string | null): Promise<Message> {
    const message = this.messageRepo.create({
      roomId: payload.roomId,
      senderId: payload.senderId,
      type: payload.type ?? MessageType.TEXT,
      content: payload.content ?? null,
      fileUrl: payload.fileUrl ?? null,
      fileSize: payload.fileSize ?? null,
      durationSeconds: payload.durationSeconds ?? null,
      moderationFlag,
      isDeleted: false,
      readBy: [payload.senderId],
    });

    await this.messageRepo.save(message);

    // Xona lastMessageAt ni yangilash
    await this.roomRepo.update(payload.roomId, { lastMessageAt: new Date() });

    return (await this.messageRepo.findOne({
      where: { id: message.id },
      relations: { sender: true },
    }))!;
  }

  // ─── XABARLAR RO'YXATI (pagination) ──────────────────────────────────────
  async getMessages(
    roomId: string,
    userId: string,
    page = 1,
    limit = 30,
    before?: string,
  ): Promise<{ items: Message[]; total: number; hasMore: boolean }> {
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.sender', 'sender')
      .where('m.room_id = :roomId', { roomId })
      .andWhere('m.is_deleted = false');

    if (before) {
      const refMsg = await this.messageRepo.findOne({ where: { id: before } });
      if (refMsg) qb.andWhere('m.created_at < :before', { before: refMsg.createdAt });
    }

    const total = await qb.getCount();
    const items = await qb
      .orderBy('m.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items: items.reverse(), total, hasMore: total > page * limit };
  }

  // ─── O'QILDI ──────────────────────────────────────────────────────────────
  async markAsRead(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message || message.readBy.includes(userId)) return;

    await this.messageRepo.update(messageId, {
      readBy: [...message.readBy, userId],
    });
  }

  // ─── XABAR O'CHIRISH (soft) ───────────────────────────────────────────────
  async deleteMessage(messageId: string, userId: string, actorRole: string): Promise<boolean> {
    const message = await this.messageRepo.findOne({ where: { id: messageId } });
    if (!message) return false;

    // Faqat yozgan kishi yoki SA/Manager o'chira oladi
    if (message.senderId !== userId && actorRole !== Role.SUPER_ADMIN && actorRole !== Role.MANAGER) {
      return false;
    }

    await this.messageRepo.update(messageId, { isDeleted: true });
    return true;
  }

  // ─── A'ZO QO'SHISH/O'CHIRISH ──────────────────────────────────────────────
  async addMember(roomId: string, userId: string, actorRole: string): Promise<void> {
    if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.MANAGER) {
      throw new ForbiddenException('A\'zo qo\'shish uchun SA/Manager kerak');
    }
    const room = await this.roomRepo.findOne({ where: { id: roomId }, relations: { members: true } });
    if (!room) throw new NotFoundException('Xona topilmadi');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    if (!room.members.some((m) => m.id === userId)) {
      room.members.push(user);
      await this.roomRepo.save(room);
    }
  }

  async removeMember(roomId: string, userId: string, actorRole: string): Promise<void> {
    if (actorRole !== Role.SUPER_ADMIN && actorRole !== Role.MANAGER) {
      throw new ForbiddenException('A\'zo o\'chirish uchun SA/Manager kerak');
    }
    const room = await this.roomRepo.findOne({ where: { id: roomId }, relations: { members: true } });
    if (!room) throw new NotFoundException('Xona topilmadi');

    room.members = room.members.filter((m) => m.id !== userId);
    await this.roomRepo.save(room);
  }

  // ─── VIDEO XABAR (Circle) ─────────────────────────────────────────────────
  async saveVideoMessage(opts: {
    senderId: string;
    videoUrl: string;
    thumbnailUrl?: string;
    durationSeconds: number;
    roomId?: string;
    recipientId?: string;
  }): Promise<VideoMessage> {
    if (opts.durationSeconds < 30 || opts.durationSeconds > 60) {
      throw new BadRequestException('Video xabar 30-60 soniya bo\'lishi kerak');
    }

    const vm = this.videoRepo.create({
      senderId: opts.senderId,
      videoUrl: opts.videoUrl,
      thumbnailUrl: opts.thumbnailUrl ?? null,
      durationSeconds: opts.durationSeconds,
      roomId: opts.roomId ?? null,
      recipientId: opts.recipientId ?? null,
      isViewed: false,
      viewedAt: null,
    });

    await this.videoRepo.save(vm);

    // Agar xona ko'rsatilgan bo'lsa, u yerga ham xabar sifatida qo'shish
    if (opts.roomId) {
      await this.messageRepo.save(
        this.messageRepo.create({
          roomId: opts.roomId,
          senderId: opts.senderId,
          type: MessageType.VIDEO_CIRCLE,
          fileUrl: opts.videoUrl,
          durationSeconds: opts.durationSeconds,
          content: null,
          isDeleted: false,
          readBy: [opts.senderId],
        }),
      );
      await this.roomRepo.update(opts.roomId, { lastMessageAt: new Date() });
    }

    return vm;
  }

  async markVideoViewed(videoId: string, userId: string): Promise<void> {
    const vm = await this.videoRepo.findOne({ where: { id: videoId } });
    if (!vm || vm.recipientId !== userId) return;

    await this.videoRepo.update(videoId, { isViewed: true, viewedAt: new Date() });
  }

  async getVideoMessages(userId: string): Promise<VideoMessage[]> {
    return this.videoRepo.find({
      where: [{ recipientId: userId }, { senderId: userId }],
      relations: { sender: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  // ─── YORDAMCHI ────────────────────────────────────────────────────────────
  private async findPrivateRoom(userId1: string, userId2: string): Promise<ChatRoom | null> {
    const rooms = await this.roomRepo
      .createQueryBuilder('r')
      .innerJoin('r.members', 'm1', 'm1.id = :u1', { u1: userId1 })
      .innerJoin('r.members', 'm2', 'm2.id = :u2', { u2: userId2 })
      .where('r.type IN (:...types)', { types: [ChatRoomType.PRIVATE, ChatRoomType.PARENT_TEACHER] })
      .andWhere('r.is_active = true')
      .getOne();
    return rooms ?? null;
  }

  async getRoom(roomId: string, userId: string, actorRole: string): Promise<ChatRoom> {
    const hasAccess = await this.checkRoomAccess(roomId, userId, actorRole);
    if (!hasAccess) throw new ForbiddenException('Bu xonaga kirish ruxsati yo\'q');

    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { members: true },
    });
    if (!room) throw new NotFoundException('Xona topilmadi');
    return room;
  }
}
