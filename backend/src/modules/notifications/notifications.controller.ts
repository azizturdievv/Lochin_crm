import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { NotificationType } from '../../entities/notification.entity';
import { NotificationService } from './notification.service';
import { TriggerService } from './trigger.service';
import { BotService } from './bot.service';
import { TelegramService } from './channels/telegram.service';
import type { TelegramUpdate } from './channels/telegram.service';
import {
  SendNotificationDto,
  RegisterFcmTokenDto,
  SetupWebhookDto,
} from './dto/send-notification.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(
    private readonly notifService: NotificationService,
    private readonly triggerService: TriggerService,
    private readonly botService: BotService,
    private readonly telegramService: TelegramService,
  ) {}

  // ─── FOYDALANUVCHI BILDIRISHNOMALARI ──────────────────────────────────────
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getMyNotifications(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notifService.getByUser(user.id, page, Math.min(limit, 100));
  }

  @Patch(':id/read')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  markRead(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.notifService.markRead(id, user.id);
  }

  @Patch('read-all')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  markAllRead(@CurrentUser() user: User) {
    return this.notifService.markAllRead(user.id);
  }

  // ─── FCM TOKEN SAQLASH ────────────────────────────────────────────────────
  @Post('fcm-token')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  registerFcmToken(@Body() dto: RegisterFcmTokenDto, @CurrentUser() user: User) {
    return this.notifService.registerFcmToken(user.id, dto.fcmToken);
  }

  // ─── QOLQO'L YUBORISH (SA) ────────────────────────────────────────────────
  @Post('send')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async sendManual(@Body() dto: SendNotificationDto) {
    if (dto.userIds?.length) {
      await this.notifService.broadcast(
        dto.userIds,
        dto.type,
        dto.title,
        dto.body,
        { skipSms: dto.skipSms, skipTelegram: dto.skipTelegram, skipPush: dto.skipPush },
      );
      return { message: `${dto.userIds.length} ta foydalanuvchiga yuborildi` };
    }

    if (dto.targetRole) {
      await this.notifService.broadcastByRole(
        dto.targetRole,
        dto.type,
        dto.title,
        dto.body,
      );
      return { message: `${dto.targetRole} rolga yuborildi` };
    }

    return { message: 'userIds yoki targetRole kerak' };
  }

  // ─── FAVQULODDA XABAR (SA) ───────────────────────────────────────────────
  @Post('emergency')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async sendEmergency(
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('targetRole') targetRole?: Role,
    @Body('userIds') userIds?: string[],
  ) {
    await this.triggerService.triggerEmergency({ title, body, targetRole, targetUserIds: userIds });
    return { message: 'Favqulodda xabar yuborildi' };
  }

  // ─── CRON TRIGGER QO'LDA ISHGA TUSHIRISH (SA) ────────────────────────────
  @Post('trigger/payment-reminder')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async triggerPaymentReminder() {
    await this.triggerService.triggerPaymentReminder();
    return { message: "To'lov eslatmasi yuborildi" };
  }

  @Post('trigger/birthday')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async triggerBirthday() {
    await this.triggerService.triggerBirthday();
    return { message: "Tug'ilgan kun yuborildi" };
  }

  // ─── TELEGRAM WEBHOOK (PUBLIC — JWT kerak emas) ───────────────────────────
  @Post('telegram/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  async telegramWebhook(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    // Secret token tekshirish — TELEGRAM_WEBHOOK_SECRET sozlanmagan bo'lsa ham
    // so'rov rad etiladi (fail-closed): aks holda bu endpoint hech qanday
    // tasdiqlashsiz ochiq bo'lib qolardi, Telegram'dan kelgan taqlid qilingan
    // so'rovlar orqali botga arbitrar buyruq yuborish imkonini berardi
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected || secretToken !== expected) {
      return { ok: false };
    }

    // Asinxron qayta ishlash (Telegram 5 soniyada javob kutadi)
    this.botService.processUpdate(update).catch((err) => {
      console.error('Bot update xato:', err);
    });

    return { ok: true };
  }

  // ─── WEBHOOK SOZLASH (SA) ────────────────────────────────────────────────
  @Post('telegram/setup-webhook')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  setupWebhook(@Body() dto: SetupWebhookDto) {
    return this.telegramService.setWebhook(dto.webhookUrl, dto.secretToken);
  }

  @Post('telegram/delete-webhook')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  deleteWebhook() {
    return this.telegramService.deleteWebhook();
  }

  // ─── BOT TEST (SA) ────────────────────────────────────────────────────────
  @Get('telegram/bot-info')
  @Roles(Role.SUPER_ADMIN)
  getBotInfo() {
    return this.telegramService.getMe();
  }
}
