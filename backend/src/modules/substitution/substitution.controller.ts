import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { SubstitutionService } from './substitution.service';
import {
  CreateSubstitutionDto,
  CompleteSubstitutionDto,
  QuerySubstitutionDto,
} from './dto/substitution.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/substitutions')
export class SubstitutionController {
  constructor(private readonly substitutionService: SubstitutionService) {}

  // ─── O'RINBOSAR TAYINLASH (SA, Manager) ──────────────────────────────────
  // TZ: POST /api/v1/substitutions — 5 qadam avtomatik bajariladi
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSubstitutionDto, @CurrentUser() user: User) {
    return this.substitutionService.create(dto, user.id, user.role);
  }

  // ─── BARCHA O'RINBOSARLAR RO'YXATI (SA, Manager) ─────────────────────────
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findAll(@Query() query: QuerySubstitutionDto) {
    return this.substitutionService.findAll(query);
  }

  // ─── DARS BO'YICHA O'RINBOSAR ─────────────────────────────────────────────
  // TZ: GET /api/v1/substitutions/lesson/:lessonId
  @Get('lesson/:lessonId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findByLesson(@Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.substitutionService.findByLesson(lessonId);
  }

  // ─── USTOZ BO'YICHA O'RINBOSARLAR ─────────────────────────────────────────
  // TZ: GET /api/v1/substitutions/teacher/:teacherId
  // Ustoz faqat o'z ma'lumotlarini ko'radi
  @Get('teacher/:teacherId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findByTeacher(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query() query: QuerySubstitutionDto,
    @CurrentUser() user: User,
  ) {
    return this.substitutionService.findByTeacher(teacherId, query, user.id, user.role);
  }

  // ─── MENING O'RINBOSARLARIM ────────────────────────────────────────────────
  @Get('my')
  @Roles(Role.USTOZ)
  getMySubstitutions(@Query() query: QuerySubstitutionDto, @CurrentUser() user: User) {
    return this.substitutionService.findByTeacher(user.id, query, user.id, user.role);
  }

  // ─── DARSNI YAKUNLASH (o'rinbosar, SA, Manager) ───────────────────────────
  // TZ: PATCH /api/v1/substitutions/:id/complete
  @Patch(':id/complete')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteSubstitutionDto,
    @CurrentUser() user: User,
  ) {
    return this.substitutionService.complete(id, dto, user.id, user.role);
  }

  // ─── BEKOR QILISH (SA, Manager) ───────────────────────────────────────────
  // TZ: DELETE /api/v1/substitutions/:id
  // Maosh teskari qaytariladi (transaction)
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.substitutionService.cancel(id, user.id, user.role);
  }
}
