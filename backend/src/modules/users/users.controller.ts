import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  ResetPasswordDto,
  UpdateProfileDto,
  ChangeOwnPasswordDto,
} from './dto/users.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

const AVATAR_UPLOAD = { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } };

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── PROFIL ENDPOINTLARI (barcha rollar) ────────────────────────────────────

  // O'z profilini olish
  @Get('me/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getMyProfile(@CurrentUser() user: User) {
    return this.usersService.getMyProfile(user.id, user.role);
  }

  // O'z profilini yangilash
  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: User) {
    return this.usersService.updateProfile(user.id, dto);
  }

  // Avatar yuklash
  @Post('avatar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @UseInterceptors(FileInterceptor('avatar', AVATAR_UPLOAD))
  @HttpCode(HttpStatus.OK)
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: User) {
    return this.usersService.uploadAvatar(user.id, file);
  }

  // Parol o'zgartirish
  @Post('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  changePassword(@Body() dto: ChangeOwnPasswordDto, @CurrentUser() user: User) {
    return this.usersService.changeOwnPassword(user.id, dto);
  }

  // ─── ADMIN ENDPOINTLARI ──────────────────────────────────────────────────────

  // Xodimlar ro'yxati
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  // Bir xodim
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // Yangi xodim — faqat SA
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: User) {
    return this.usersService.create(dto, user.id, user.role);
  }

  // Ma'lumot yangilash — faqat SA
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.update(id, dto, user.id, user.role);
  }

  // Faollashtirish / o'chirish — faqat SA
  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.usersService.toggleActive(id, user.id, user.role);
  }

  // Parol tiklash — faqat SA
  @Post(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.resetPassword(id, dto, user.id, user.role);
  }

  // Soft delete — faqat SA
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.usersService.remove(id, user.id, user.role);
  }
}
