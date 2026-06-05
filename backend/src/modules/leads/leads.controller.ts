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
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { MoveStageDto } from './dto/move-stage.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { QueryLeadDto, ConversionQueryDto } from './dto/query-lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // ─── PIPELINE (KANBAN) ────────────────────────────────────────────────────
  @Get('pipeline')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getPipeline(@CurrentUser() user: User) {
    return this.leadsService.getPipeline(user.id, user.role);
  }

  // ─── KONVERSIYA TAHLILI ───────────────────────────────────────────────────
  @Get('conversion')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getConversion(@Query() query: ConversionQueryDto) {
    return this.leadsService.getConversionAnalysis(query);
  }

  // ─── LID RO'YXATI ─────────────────────────────────────────────────────────
  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findAll(@Query() query: QueryLeadDto, @CurrentUser() user: User) {
    return this.leadsService.findAll(query, user.id, user.role);
  }

  // ─── YANGI LID YARATISH ───────────────────────────────────────────────────
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: User) {
    return this.leadsService.create(dto, user.id, user.role);
  }

  // ─── BITTA LID ────────────────────────────────────────────────────────────
  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.leadsService.findOne(id, user.id, user.role);
  }

  // ─── LID YANGILASH ────────────────────────────────────────────────────────
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: User,
  ) {
    return this.leadsService.update(id, dto, user.id, user.role);
  }

  // ─── BOSQICH O'ZGARTIRISH ─────────────────────────────────────────────────
  @Patch(':id/stage')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  moveStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveStageDto,
    @CurrentUser() user: User,
  ) {
    return this.leadsService.moveStage(id, dto, user.id, user.role);
  }

  // ─── IZOH QO'SHISH ────────────────────────────────────────────────────────
  @Post(':id/notes')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddNoteDto,
    @CurrentUser() user: User,
  ) {
    return this.leadsService.addNote(id, dto, user.id, user.role);
  }

  // ─── LID O'CHIRISH ────────────────────────────────────────────────────────
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.leadsService.remove(id, user.id, user.role);
  }
}
