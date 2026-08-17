import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
  UseGuards, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { BlockWhenPaymentLocked } from '../../common/decorators/block-when-payment-locked.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../entities/user.entity';
import { MaterialType } from '../../entities/material.entity';
import { TestStatus } from '../../entities/test.entity';
import { SubjectsService } from './subjects.service';
import { MaterialsService } from './materials.service';
import { TestsService } from './tests.service';
import { HomeworkService } from './homework.service';
import { BaselineService } from './baseline.service';
import { MinioService } from './minio.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';
import { CreateMaterialDto, UpdateMaterialDto } from './dto/material.dto';
import {
  CreateTestDto, AddQuestionDto, CheckAnswerDto, SubmitTestDto,
  TimeExtensionRequestDto, UpdateTestStatusDto,
} from './dto/test.dto';
import { CreateHomeworkDto, GradeHomeworkDto } from './dto/homework.dto';
import { CreateBaselineDto } from './dto/baseline.dto';

const MEMORY_UPLOAD = { storage: memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } };

// ─── FANLAR CONTROLLERI ──────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/subjects')
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findAll(@Query('includeInactive') inc?: string) {
    return this.subjectsService.findAll(inc === 'true');
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSubjectDto, @CurrentUser() user: User) {
    return this.subjectsService.create(dto, user.id, user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubjectDto, @CurrentUser() user: User) {
    return this.subjectsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.subjectsService.remove(id, user.id, user.role);
  }
}

// ─── MATERIALLAR CONTROLLERI ─────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/materials')
export class MaterialsController {
  constructor(
    private readonly materialsService: MaterialsService,
    private readonly minioService: MinioService,
  ) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @BlockWhenPaymentLocked()
  findAll(
    @Query('groupId') groupId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('type') type?: MaterialType,
    @CurrentUser() user?: User,
  ) {
    return this.materialsService.findAll({ groupId, lessonId, type }, user!.id, user!.role);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  @BlockWhenPaymentLocked()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.materialsService.findOne(id);
  }

  // Fayl yuklash + material yaratish (multipart)
  @Post('upload')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @UseInterceptors(FileInterceptor('file', MEMORY_UPLOAD))
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateMaterialDto,
    @CurrentUser() user: User,
  ) {
    if (!file && dto.type !== MaterialType.LINK) {
      throw new BadRequestException('Fayl yuklanmadi');
    }

    let fileUrl: string | undefined;
    let fileSize: number | undefined;

    if (file) {
      const typeKey = dto.type as string;
      const valid = this.minioService.validateFile(file.mimetype, file.size, typeKey as 'pdf' | 'video' | 'audio' | 'image');
      if (!valid.valid) throw new BadRequestException(valid.error);

      const uploaded = await this.materialsService.uploadFile(file, dto.type, user.id);
      fileUrl = uploaded.url;
      fileSize = file.size;
    }

    return this.materialsService.create(dto, user.id, user.role, fileUrl, fileSize);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMaterialDto, @CurrentUser() user: User) {
    return this.materialsService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.materialsService.remove(id, user.id, user.role);
  }
}

// ─── TESTLAR CONTROLLERI ─────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findAll(
    @Query('subjectId') subjectId?: string,
    @Query('status') status?: TestStatus,
    @CurrentUser() user?: User,
  ) {
    return this.testsService.findAll({ subjectId, status }, user!.id, user!.role);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.testsService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTestDto, @CurrentUser() user: User) {
    return this.testsService.createTest(dto, user.id, user.role);
  }

  // Test zanjiri: draft → review → published
  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTestStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.testsService.updateStatus(id, dto, user.id, user.role);
  }

  // Savol qo'shish
  @Post(':id/questions')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.CREATED)
  addQuestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddQuestionDto,
    @CurrentUser() user: User,
  ) {
    return this.testsService.addQuestion(id, dto, user.id, user.role);
  }

  // Test boshlash
  @Post(':id/start')
  @Roles(Role.STUDENT)
  @BlockWhenPaymentLocked()
  @HttpCode(HttpStatus.OK)
  startTest(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.testsService.startTest(id, user.id);
  }

  // Bitta savolni darhol tekshirish (Duolingo uslubi — ball yozmaydi)
  @Post('check-answer')
  @Roles(Role.STUDENT)
  @BlockWhenPaymentLocked()
  @HttpCode(HttpStatus.OK)
  checkAnswer(@Body() dto: CheckAnswerDto, @CurrentUser() user: User) {
    return this.testsService.checkAnswer(dto, user.id);
  }

  // Javob yuborish
  @Post('submit')
  @Roles(Role.STUDENT)
  @BlockWhenPaymentLocked()
  @HttpCode(HttpStatus.OK)
  submit(@Body() dto: SubmitTestDto, @CurrentUser() user: User) {
    return this.testsService.submitTest(dto, user.id);
  }

  // Test natijalari (ustoz/manager ko'radi)
  @Get(':id/results')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getResults(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.testsService.getResults(id, user.id, user.role);
  }

  // O'quvchi natijalari
  @Get('student/:studentId/results')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  getStudentResults(@Param('studentId', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.testsService.getStudentResults(id, user.id, user.role);
  }

  // Vaqt uzaytirish so'rovi (o'quvchi)
  @Post('time-extension/request')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  requestExtension(@Body() dto: TimeExtensionRequestDto, @CurrentUser() user: User) {
    return this.testsService.requestTimeExtension(dto, user.id);
  }

  // Kutilayotgan so'rovlar ro'yxati (bildirishnoma panelida "1 bosish" uchun)
  @Get('time-extension/pending')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getPendingExtensions() {
    return this.testsService.getPendingExtensions();
  }

  // O'quvchi — o'z so'rovi holatini tekshirish (TestRunner polling)
  @Get('time-extension/my-status/:testResultId')
  @Roles(Role.STUDENT)
  getMyExtensionStatus(
    @Param('testResultId', ParseUUIDPipe) testResultId: string,
    @CurrentUser() user: User,
  ) {
    return this.testsService.getMyExtensionStatus(testResultId, user.id);
  }

  // Vaqt uzaytirish tasdiqlash/rad etish (ustoz — 1 bosish)
  @Patch('time-extension/:id/review')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  reviewExtension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('approved') approved: boolean,
    @CurrentUser() user: User,
  ) {
    return this.testsService.reviewExtension(id, approved, user.id, user.role);
  }
}

// ─── VAZIFALAR CONTROLLERI ───────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/homework')
export class HomeworkController {
  constructor(
    private readonly homeworkService: HomeworkService,
    private readonly minioService: MinioService,
  ) {}

  @Get('group/:groupId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findByGroup(@Param('groupId', ParseUUIDPipe) groupId: string, @CurrentUser() user: User) {
    return this.homeworkService.findByGroup(groupId, user.id, user.role);
  }

  // Vazifa yaratishda dars tanlash uchun — guruhning so'nggi darslari
  @Get('lessons/:groupId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findLessons(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.homeworkService.findLessonsByGroup(groupId);
  }

  @Get(':id/submissions')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getSubmissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.homeworkService.getSubmissions(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateHomeworkDto, @CurrentUser() user: User) {
    return this.homeworkService.create(dto, user.id, user.role);
  }

  // Vazifa topshirish — JSON matn
  @Post(':id/submit')
  @Roles(Role.STUDENT)
  @BlockWhenPaymentLocked()
  @HttpCode(HttpStatus.OK)
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('content') content: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.homeworkService.submit(id, user.id, content, []);
  }

  // Vazifa topshirish — fayl bilan (multipart)
  @Post(':id/submit/file')
  @Roles(Role.STUDENT)
  @BlockWhenPaymentLocked()
  @UseInterceptors(FileInterceptor('file', MEMORY_UPLOAD))
  @HttpCode(HttpStatus.OK)
  async submitFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('content') content: string | undefined,
    @CurrentUser() user: User,
  ) {
    let fileUrls: string[] = [];
    if (file) {
      const r = await this.minioService.uploadBuffer(file.buffer, file.originalname, file.mimetype, `homework/${id}/${user.id}`);
      fileUrls = [r.url];
    }
    return this.homeworkService.submit(id, user.id, content, fileUrls);
  }

  // Baholash
  @Post('grade')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @HttpCode(HttpStatus.OK)
  grade(@Body() dto: GradeHomeworkDto, @CurrentUser() user: User) {
    return this.homeworkService.grade(dto, user.id, user.role);
  }
}

// ─── BASELINE CONTROLLERI ─────────────────────────────────────────────────────
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/baseline')
export class BaselineController {
  constructor(
    private readonly baselineService: BaselineService,
    private readonly minioService: MinioService,
  ) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findAll(
    @Query('studentId') studentId?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.baselineService.findAll({ studentId, subjectId });
  }

  @Get('student/:studentId')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ, Role.STUDENT)
  findByStudent(
    @Param('studentId', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.baselineService.findByStudent(id, user.id, user.role);
  }

  // Baholash uchun guruh o'quvchilarini tanlash (faqat xodimlar)
  @Get('group/:groupId/students')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  getGroupStudents(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.baselineService.getGroupStudents(groupId);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.baselineService.findOne(id);
  }

  // Yaratish (audio/fayl bilan)
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MANAGER, Role.USTOZ)
  @UseInterceptors(FileInterceptor('file', MEMORY_UPLOAD))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateBaselineDto,
    @CurrentUser() user: User,
  ) {
    let fileUrl: string | undefined;
    let audioUrl: string | undefined;

    if (file) {
      const uploaded = await this.minioService.uploadBuffer(
        file.buffer, file.originalname, file.mimetype,
        `baseline/${dto.studentId}/${dto.subjectId}`,
      );
      if (file.mimetype.startsWith('audio/')) {
        audioUrl = uploaded.url;
      } else {
        fileUrl = uploaded.url;
      }
    }

    return this.baselineService.create(dto, user.id, user.role, audioUrl, fileUrl);
  }

  // Muhrlash — faqat SA
  @Patch(':id/seal')
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  seal(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.baselineService.seal(id, user.id);
  }
}
