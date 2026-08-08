import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Server, Socket } from 'socket.io';
import { User } from '../../entities/user.entity';
import { MessageType } from '../../entities/message.entity';
import { ChatService } from './chat.service';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── ULANISH ──────────────────────────────────────────────────────────────
  async handleConnection(client: Socket) {
    const user = await this.authenticate(client);

    if (!user) {
      client.emit('error', { message: 'Token yaroqsiz yoki muddati o\'tgan' });
      client.disconnect();
      return;
    }

    client.data.user = user;
    this.logger.log(`Chat ulandi: ${user.firstName} [${user.role}] (${client.id})`);

    // Foydalanuvchining barcha xonalariga avtomatik qo'shish
    const roomIds = await this.chatService.getUserRoomIds(user.id, user.role);
    for (const roomId of roomIds) {
      await client.join(roomId);
    }

    client.emit('connected', {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      rooms: roomIds,
    });
  }

  // ─── UZILISH ──────────────────────────────────────────────────────────────
  handleDisconnect(client: Socket) {
    const user: User | undefined = client.data.user;
    if (user) {
      this.logger.log(`Chat uzildi: ${user.firstName} (${client.id})`);
    }
  }

  // ─── JWT TEKSHIRISH ────────────────────────────────────────────────────────
  private async authenticate(client: Socket): Promise<User | null> {
    try {
      const token: string | undefined =
        client.handshake.auth?.token ??
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

      if (!token) return null;

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify<{ sub: string }>(token, { secret });

      return this.userRepo.findOne({
        where: { id: payload.sub, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
    } catch {
      return null;
    }
  }

  // Payload dan roomId ni olish (string yoki { roomId } object bo'lishi mumkin)
  private extractRoomId(payload: unknown): string {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'roomId' in payload) {
      return (payload as { roomId: string }).roomId;
    }
    return '';
  }

  // ─── XONAGA QO'SHILISH ────────────────────────────────────────────────────
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { roomId: string },
  ) {
    const user: User = client.data.user;
    if (!user) return;

    const roomId = this.extractRoomId(payload);
    if (!roomId) return;

    const hasAccess = await this.chatService.checkRoomAccess(roomId, user.id, user.role);
    if (!hasAccess) {
      client.emit('error', { message: 'Bu xonaga kirish ruxsati yo\'q' });
      return;
    }

    await client.join(roomId);
    client.emit('joined_room', { roomId });

    // Oxirgi 50 xabarni yuborish (tarix)
    const history = await this.chatService.getMessages(roomId, user.id, 1, 50);
    client.emit('room_history', { roomId, ...history });
  }

  // ─── XONADAN CHIQISH ──────────────────────────────────────────────────────
  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { roomId: string },
  ) {
    const roomId = this.extractRoomId(payload);
    if (!roomId) return;
    client.leave(roomId);
    client.emit('left_room', { roomId });
  }

  // ─── XABAR YUBORISH ───────────────────────────────────────────────────────
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      content?: string;
      type?: MessageType;
      fileUrl?: string;
      fileSize?: number;
      durationSeconds?: number;
    },
  ) {
    const user: User = client.data.user;
    if (!user || !payload.roomId) return;

    const result = await this.chatService.sendMessage({
      roomId: payload.roomId,
      senderId: user.id,
      content: payload.content,
      type: payload.type,
      fileUrl: payload.fileUrl,
      fileSize: payload.fileSize,
      durationSeconds: payload.durationSeconds,
    });

    if (result.blocked) {
      client.emit('message_blocked', {
        message: result.reason ?? 'Xabar moderatsiya tomonidan bloklandi',
      });
      return;
    }

    if (result.warning) {
      client.emit('message_warning', { message: result.warning });
    }

    // Xonaga broadcast (yuboruvchi ham oladi)
    this.server.to(payload.roomId).emit('new_message', result.message);
  }

  // ─── YOZMOQDA... ─────────────────────────────────────────────────────────
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { roomId: string },
  ) {
    const user: User = client.data.user;
    if (!user) return;

    const roomId = this.extractRoomId(payload);
    if (!roomId) return;

    client.to(roomId).emit('user_typing', {
      userId: user.id,
      name: user.firstName,
      roomId,
    });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { roomId: string },
  ) {
    const user: User = client.data.user;
    if (!user) return;

    const roomId = this.extractRoomId(payload);
    if (!roomId) return;

    client.to(roomId).emit('user_stop_typing', { userId: user.id, roomId });
  }

  // ─── O'QILDI ─────────────────────────────────────────────────────────────
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; messageId: string },
  ) {
    const user: User = client.data.user;
    if (!user) return;

    await this.chatService.markAsRead(payload.messageId, user.id);
    client.to(payload.roomId).emit('message_read', {
      messageId: payload.messageId,
      userId: user.id,
    });
  }

  // ─── XABAR O'CHIRISH ──────────────────────────────────────────────────────
  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; messageId: string },
  ) {
    const user: User = client.data.user;
    if (!user) return;

    const deleted = await this.chatService.deleteMessage(payload.messageId, user.id, user.role);
    if (deleted) {
      this.server.to(payload.roomId).emit('message_deleted', { messageId: payload.messageId });
    }
  }

  // ─── SERVER TARAFIDAN XABAR YUBORISH (bildirishnomalar uchun) ─────────────
  broadcastToRoom(roomId: string, event: string, data: unknown): void {
    this.server?.to(roomId).emit(event, data);
  }
}
