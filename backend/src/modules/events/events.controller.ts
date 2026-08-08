import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { EventsService } from './events.service';
import { PermitService } from './permit.service';
import { CompetitionService } from './competition.service';
import { CertificateService } from './certificate.service';
import {
  CreateEventDto,
  UpdateEventDto,
  QueryEventDto,
  RegisterParticipantDto,
  UpdateParticipantDto,
  QueryParticipantDto,
  CreateQuestionDto,
  BulkCreateQuestionsDto,
  SubmitAnswersDto,
  GenerateCertificatesDto,
} from './dto/event.dto';

@Controller('api/v1/events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly permitService: PermitService,
    private readonly competitionService: CompetitionService,
    private readonly certificateService: CertificateService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // TADBIRLAR CRUD
  // ══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.create(dto, user.id, user.role);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findAll(
    @Query() query: QueryEventDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.findAll(query, user.id, user.role);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.eventsService.remove(id, user.id, user.role);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RO'YXAT VA RUXSATNOMA (PERMIT)
  // ══════════════════════════════════════════════════════════════════════════

  // O'quvchi/ustoz o'zini-o'zi ro'yxatdan o'tkazadi (frontend "Ro'yxatdan
  // o'tish" tugmasi shu yerni chaqiradi — studentId har doim joriy
  // foydalanuvchidan olinadi, boshqa birovni ro'yxatga qo'yib bo'lmaydi)
  @Post(':id/register')
  @Roles(Role.STUDENT, Role.USTOZ)
  @HttpCode(HttpStatus.CREATED)
  selfRegister(
    @Param('id', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.permitService.register(eventId, { studentId: user.id }, user.id, user.role);
  }

  // Ishtirokchini SA/manager ro'yxatdan o'tkazadi (qo'lda, telefon/maktab/sinf bilan)
  @Post(':id/participants')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  register(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: RegisterParticipantDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.permitService.register(eventId, dto, user.id, user.role);
  }

  // Ishtirokchilar ro'yxati (telefon, to'lov holati, maktab, sinf, yosh)
  @Get(':id/participants')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getParticipants(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Query() query: QueryParticipantDto,
  ) {
    return this.permitService.getParticipants(eventId, query);
  }

  // Ishtirokchi ma'lumotlarini yangilash (to'lov holati va h.k.)
  @Patch(':id/participants/:participantId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  updateParticipant(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: UpdateParticipantDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.permitService.updateParticipant(eventId, participantId, dto, user.id, user.role);
  }

  // Ishtirokchini o'chirish
  @Delete(':id/participants/:participantId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  removeParticipant(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.permitService.removeParticipant(eventId, participantId, user.id, user.role);
  }

  // QR ruxsatnoma verifikatsiyasi (kirish joyida skanerlash)
  @Post('permit/verify')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  verifyPermit(@Body('permitCode') permitCode: string) {
    return this.permitService.verifyPermit(permitCode);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ONLAYN MUSOBAQA
  // ══════════════════════════════════════════════════════════════════════════

  // Savollar qo'shish
  @Post(':id/questions')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  addQuestion(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.competitionService.addQuestion(eventId, dto, user.id, user.role);
  }

  // Ko'p savolni birdan qo'shish
  @Post(':id/questions/bulk')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  bulkAddQuestions(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: BulkCreateQuestionsDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.competitionService.bulkAddQuestions(eventId, dto, user.id, user.role);
  }

  // Savollar ro'yxati (admin — to'liq, to'g'ri javoblar ko'rinadi)
  @Get(':id/questions')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  listQuestions(@Param('id', ParseUUIDPipe) eventId: string) {
    return this.competitionService.listQuestions(eventId);
  }

  // Savolni o'chirish
  @Delete(':id/questions/:questionId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  removeQuestion(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.competitionService.removeQuestion(eventId, questionId, user.id, user.role);
  }

  // Musobaqani boshlash
  @Post(':id/competition/start')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  startCompetition(
    @Param('id', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.competitionService.start(eventId, user.id, user.role);
  }

  // Ishtirokchiga random savollar (to'g'ri javobsiz)
  @Get(':id/competition/questions/:participantId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.STUDENT)
  getCompetitionQuestions(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
  ) {
    return this.competitionService.getQuestions(eventId, participantId);
  }

  // Javoblarni yuborish
  @Post(':id/competition/submit/:participantId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  submitAnswers(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Body() dto: SubmitAnswersDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.competitionService.submitAnswers(eventId, participantId, dto, user.id);
  }

  // Jonli natijalar
  @Get(':id/competition/leaderboard')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getLeaderboard(@Param('id', ParseUUIDPipe) eventId: string) {
    return this.competitionService.getLeaderboard(eventId);
  }

  // Musobaqani yakunlash
  @Post(':id/competition/finish')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  finishCompetition(
    @Param('id', ParseUUIDPipe) eventId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.competitionService.finish(eventId, user.id, user.role);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SERTIFIKAT / DIPLOM
  // ══════════════════════════════════════════════════════════════════════════

  // Tadbir uchun barcha sertifikatlar yaratish
  @Post(':id/certificates/generate')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  generateCertificates(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: GenerateCertificatesDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.certificateService.generateForEvent(
      eventId,
      dto.sendNotification ?? true,
      user.id,
      user.role,
    );
  }

  // Sertifikat verifikatsiya (QR skanerlash)
  @Get('certificates/verify/:code')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  verifyCertificate(@Param('code') code: string) {
    return this.certificateService.verify(code);
  }

  // O'quvchi sertifikatlari — student o'zgasinikini so'rasa taqiqlanadi
  @Get('certificates/student/:studentId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getStudentCertificates(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    if (user.role === Role.STUDENT && studentId !== user.id) {
      throw new ForbiddenException('Faqat o\'z sertifikatlaringizni ko\'rishingiz mumkin');
    }
    return this.certificateService.findByStudent(studentId);
  }

  // Tadbir uchun barcha sertifikatlar (admin ro'yxati)
  @Get(':id/certificates')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER)
  getEventCertificates(@Param('id', ParseUUIDPipe) eventId: string) {
    return this.certificateService.findByEvent(eventId);
  }
}
