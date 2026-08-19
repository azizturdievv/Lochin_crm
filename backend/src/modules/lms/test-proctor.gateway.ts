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
import { Test } from '../../entities/test.entity';
import { Role } from '../../common/enums/role.enum';

// Nazorat ishi paytida "Natijalar" oynasini ochib turgan ustoz/manager/SA
// shu namespace orqali jonli signal oladi: o'quvchi boshqa tab/oynaga
// chiqib ketsa — darhol xabar (bildirishnoma paneliga ham alohida yoziladi,
// bu yerdagi signal esa faqat o'sha lahzada ekranni ochib turganlar uchun)
@WebSocketGateway({
  namespace: '/test-proctor',
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class TestProctorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TestProctorGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Test)
    private readonly testRepo: Repository<Test>,
  ) {}

  async handleConnection(client: Socket) {
    const user = await this.authenticate(client);
    if (!user) {
      client.emit('error', { message: 'Token yaroqsiz yoki muddati o\'tgan' });
      client.disconnect();
      return;
    }
    client.data.user = user;
    this.logger.log(`Nazoratchi ulandi: ${user.firstName} [${user.role}] (${client.id})`);
  }

  handleDisconnect(_client: Socket) {}

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
        select: { id: true, firstName: true, lastName: true, role: true },
      });
    } catch {
      return null;
    }
  }

  // ─── XODIM "NATIJALAR" OYNASINI OCHDI — shu test xonasiga qo'shiladi ─────
  @SubscribeMessage('watch_test')
  async handleWatchTest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { testId: string },
  ) {
    const user: User = client.data.user;
    if (!user || !payload?.testId) return;

    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.MANAGER) {
      const test = await this.testRepo.findOne({ where: { id: payload.testId } });
      if (!test || test.createdById !== user.id) {
        client.emit('error', { message: 'Bu testni kuzatish huquqi yo\'q' });
        return;
      }
    }

    await client.join(`test:${payload.testId}`);
    this.logger.log(`${user.firstName} testni kuzatmoqda: ${payload.testId} (${client.id})`);
  }

  @SubscribeMessage('unwatch_test')
  handleUnwatchTest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { testId: string },
  ) {
    if (!payload?.testId) return;
    client.leave(`test:${payload.testId}`);
  }

  // ─── SERVER TARAFIDAN: o'quvchi chiqib ketganda chaqiriladi ─────────────
  // Bu — asosiy oqim (natija saqlash + bildirishnoma) allaqachon muvaffaqiyatli
  // bo'lgandan KEYIN chaqiriladigan qo'shimcha, "best-effort" signal. Shu
  // sababli hech qanday xato bu yerdan tashqariga chiqmasligi kerak — aks
  // holda faqat jonli signal muvaffaqiyatsiz bo'lgani uchun o'quvchiga 500
  // xatosi qaytib ketishi mumkin edi (aynan shu sabab bilan avval bo'lgan)
  alertTabSwitch(testId: string, data: {
    resultId: string; studentId: string; studentName: string; tabSwitchCount: number;
  }): void {
    try {
      this.server?.to(`test:${testId}`).emit('tab_switch_alert', data);
    } catch (err) {
      this.logger.warn(`Jonli signal yuborilmadi (natija baribir saqlandi): ${err}`);
    }
  }
}
