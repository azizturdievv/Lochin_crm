import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { ChatService } from './chat.service';
import { ModerationService } from './moderation.service';
import { CreateRoomDto, QueryMessagesDto, AddMemberDto, SendVideoMessageDto } from './dto/chat.dto';
import { MinioService } from '../lms/minio.service';

const UPLOAD_OPTS = {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly moderationService: ModerationService,
    private readonly minioService: MinioService,
  ) {}

  // ─── XONALAR ─────────────────────────────────────────────────────────────
  @Post('rooms')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  createRoom(@Body() dto: CreateRoomDto, @CurrentUser() user: User) {
    return this.chatService.createRoom(dto, user.id, user.role);
  }

  @Get('rooms')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getRooms(@CurrentUser() user: User) {
    return this.chatService.getUserRooms(user.id, user.role);
  }

  // SA uchun barcha xonalar (pagination bilan)
  @Get('rooms/all')
  @Roles(Role.SUPER_ADMIN)
  getAllRooms(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.chatService.getAllRooms(page, Math.min(limit, 100));
  }

  @Get('rooms/:id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getRoom(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chatService.getRoom(id, user.id, user.role);
  }

  @Post('rooms/:id/members')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  addMember(
    @Param('id', ParseUUIDPipe) roomId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    return this.chatService.addMember(roomId, dto.userId, user.role);
  }

  @Delete('rooms/:id/members/:userId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('id', ParseUUIDPipe) roomId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.chatService.removeMember(roomId, userId, user.role);
  }

  // ─── XABARLAR ────────────────────────────────────────────────────────────
  @Get('rooms/:id/messages')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  async getMessages(
    @Param('id', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('before') before?: string,
  ) {
    const hasAccess = await this.chatService.checkRoomAccess(roomId, user.id, user.role);
    if (!hasAccess) return { items: [], total: 0, hasMore: false };

    return this.chatService.getMessages(roomId, user.id, page, Math.min(limit, 100), before);
  }

  @Delete('messages/:id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  async deleteMessage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const deleted = await this.chatService.deleteMessage(id, user.id, user.role);
    return { deleted };
  }

  // ─── MEDIA YUKLASH ────────────────────────────────────────────────────────
  @Post('upload/image')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTS))
  @HttpCode(HttpStatus.CREATED)
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new Error('Fayl yuklanmadi');
    const validation = this.minioService.validateFile(file.mimetype, file.size, 'image');
    if (!validation.valid) return { error: validation.error };

    const result = await this.minioService.uploadBuffer(
      file.buffer, file.originalname, file.mimetype, `chat/${user.id}/images`,
    );
    return { url: result.url, size: file.size, mimeType: file.mimetype };
  }

  @Post('upload/audio')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTS))
  @HttpCode(HttpStatus.CREATED)
  async uploadAudio(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new Error('Fayl yuklanmadi');
    const validation = this.minioService.validateFile(file.mimetype, file.size, 'audio');
    if (!validation.valid) return { error: validation.error };

    const result = await this.minioService.uploadBuffer(
      file.buffer, file.originalname, file.mimetype, `chat/${user.id}/audio`,
    );
    return { url: result.url, size: file.size };
  }

  @Post('upload/file')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTS))
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new Error('Fayl yuklanmadi');
    if (file.size > 50 * 1024 * 1024) return { error: 'Maksimal fayl hajmi 50 MB' };

    const result = await this.minioService.uploadBuffer(
      file.buffer, file.originalname, file.mimetype, `chat/${user.id}/files`,
    );
    return { url: result.url, size: file.size, name: file.originalname };
  }

  // ─── VIDEO DOIRA (Circle) — 30-60 sek ───────────────────────────────────
  @Post('upload/video-circle')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @UseInterceptors(FileInterceptor('video', UPLOAD_OPTS))
  @HttpCode(HttpStatus.CREATED)
  async uploadVideoCircle(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: SendVideoMessageDto,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new Error('Video yuklanmadi');

    const validation = this.minioService.validateFile(file.mimetype, file.size, 'video');
    if (!validation.valid) return { error: validation.error };

    if (dto.durationSeconds < 30 || dto.durationSeconds > 60) {
      return { error: 'Video xabar 30-60 soniya bo\'lishi kerak' };
    }

    const result = await this.minioService.uploadBuffer(
      file.buffer, file.originalname, file.mimetype, `chat/${user.id}/video-circles`,
    );

    const vm = await this.chatService.saveVideoMessage({
      senderId: user.id,
      videoUrl: result.url,
      durationSeconds: dto.durationSeconds,
      roomId: dto.roomId,
      recipientId: dto.recipientId,
    });

    return vm;
  }

  @Get('video-messages')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getVideoMessages(@CurrentUser() user: User) {
    return this.chatService.getVideoMessages(user.id);
  }

  @Post('video-messages/:id/viewed')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  markVideoViewed(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.chatService.markVideoViewed(id, user.id);
  }

  // ─── AI MODERATSIYA SOZLAMALARI (SA) ──────────────────────────────────────
  @Post('moderation/blocklist')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  addToBlocklist(@Body('word') word: string) {
    this.moderationService.addToBlocklist(word);
    return { message: `"${word}" qora ro'yxatga qo'shildi` };
  }
}
