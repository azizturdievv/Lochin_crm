import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Test, TestStatus, TestDifficulty } from '../../entities/test.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { TestResult } from '../../entities/test-result.entity';
import { TestTimeExtension, ExtensionStatus } from '../../entities/test-time-extension.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { PointsLog, PointsAction } from '../../entities/points-log.entity';
import { User } from '../../entities/user.entity';
import { Subject } from '../../entities/subject.entity';
import { Group } from '../../entities/group.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { TestProctorGateway } from './test-proctor.gateway';
import {
  CreateTestDto,
  AddQuestionDto,
  CheckAnswerDto,
  SubmitTestDto,
  TimeExtensionRequestDto,
  UpdateTestStatusDto,
} from './dto/test.dto';

// 3:5:2 nisbat: oson:o'rta:qiyin
const DIFFICULTY_RATIO = { easy: 3, medium: 5, hard: 2 };

// Test zanjiri: bosqichlar ketma-ket o'tiladi, birortasi chetlab o'tilmaydi
// (SA uchun ham) — aks holda review bosqichidagi savol-soni tekshiruvi chetlab o'tiladi
const TEST_STATUS_TRANSITIONS: Record<TestStatus, TestStatus[]> = {
  [TestStatus.DRAFT]:     [TestStatus.REVIEW],
  [TestStatus.REVIEW]:    [TestStatus.PUBLISHED],
  [TestStatus.PUBLISHED]: [TestStatus.ARCHIVED],
  [TestStatus.ARCHIVED]:  [],
};

const TEST_STATUS_LABELS: Record<TestStatus, string> = {
  [TestStatus.DRAFT]:     'qoralama',
  [TestStatus.REVIEW]:    'tekshiruvda',
  [TestStatus.PUBLISHED]: 'nashr',
  [TestStatus.ARCHIVED]:  'arxiv',
};

// Anti-cheat: har savol uchun minimal vaqt (soniyada)
const MIN_SECONDS_PER_QUESTION = 8;

// Test zonatiruvchi uchun minimal umumiy vaqt (questionsToShow × 8 soniya)
function minExpectedSeconds(questionsCount: number): number {
  return questionsCount * MIN_SECONDS_PER_QUESTION;
}

// Random shuffle (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Difficulty bo'yicha N ta tasodifiy savol tanlash
function pickByDifficulty(
  questions: TestQuestion[],
  total: number,
): TestQuestion[] {
  const byDifficulty: Record<TestDifficulty, TestQuestion[]> = {
    [TestDifficulty.EASY]: [],
    [TestDifficulty.MEDIUM]: [],
    [TestDifficulty.HARD]: [],
  };

  for (const q of questions) {
    byDifficulty[q.difficulty].push(q);
  }

  const sum = DIFFICULTY_RATIO.easy + DIFFICULTY_RATIO.medium + DIFFICULTY_RATIO.hard;
  const easy = Math.round((DIFFICULTY_RATIO.easy / sum) * total);
  const hard = Math.round((DIFFICULTY_RATIO.hard / sum) * total);
  const medium = total - easy - hard;

  const picked = [
    ...shuffle(byDifficulty[TestDifficulty.EASY]).slice(0, easy),
    ...shuffle(byDifficulty[TestDifficulty.MEDIUM]).slice(0, medium),
    ...shuffle(byDifficulty[TestDifficulty.HARD]).slice(0, hard),
  ];

  // Yetarli savollar bo'lmasa qolganlari bilan to'ldirish
  if (picked.length < total) {
    const used = new Set(picked.map((q) => q.id));
    const remaining = questions.filter((q) => !used.has(q.id));
    picked.push(...shuffle(remaining).slice(0, total - picked.length));
  }

  return shuffle(picked);
}

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test)
    private testRepo: Repository<Test>,
    @InjectRepository(TestQuestion)
    private questionRepo: Repository<TestQuestion>,
    @InjectRepository(TestResult)
    private resultRepo: Repository<TestResult>,
    @InjectRepository(TestTimeExtension)
    private extensionRepo: Repository<TestTimeExtension>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(PointsLog)
    private pointsRepo: Repository<PointsLog>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    private auditLog: AuditLogService,
    private proctorGateway: TestProctorGateway,
  ) {}

  // ─── TEST YARATISH (DRAFT) ────────────────────────────────────────────────
  async createTest(dto: CreateTestDto, actorId: string, actorRole: string) {
    const subject = await this.subjectRepo.findOne({ where: { id: dto.subjectId } });
    if (!subject) throw new NotFoundException('Fan topilmadi');
    if (!subject.isActive) {
      throw new BadRequestException('Nofaol fan uchun test yaratib bo\'lmaydi');
    }

    // Guruhlar shu fanga tegishli ekanligini tekshirish — boshqa fan
    // guruhi tasodifan tayinlanib qolmasligi uchun
    let targetGroupIds: string[] = [];
    if (dto.groupIds?.length) {
      const groups = await this.groupRepo.find({
        where: { id: In(dto.groupIds), subjectId: dto.subjectId },
      });
      if (groups.length !== dto.groupIds.length) {
        throw new BadRequestException('Ba\'zi guruhlar topilmadi yoki bu fanga tegishli emas');
      }
      targetGroupIds = groups.map((g) => g.id);
    }

    const test = this.testRepo.create({
      title: dto.title,
      subjectId: dto.subjectId,
      description: dto.description ?? null,
      totalQuestions: dto.totalQuestions ?? 30,
      questionsToShow: dto.questionsToShow ?? 10,
      timeLimitMinutes: dto.timeLimitMinutes ?? 30,
      scoreMethod: dto.scoreMethod ?? 'best',
      maxAttempts: dto.maxAttempts ?? 3,
      isBaseline: dto.isBaseline ?? false,
      level: dto.level ?? null,
      resultsAutoVisible: dto.resultsAutoVisible ?? true,
      createdById: actorId,
      status: TestStatus.DRAFT,
    });

    await this.testRepo.save(test);

    if (targetGroupIds.length) {
      await this.testRepo
        .createQueryBuilder()
        .relation(Test, 'visibleGroups')
        .of(test.id)
        .add(targetGroupIds);
    }

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'TEST_CREATED',
      entityName: 'tests',
      entityId: test.id,
      newValues: { title: dto.title, subjectId: dto.subjectId, level: dto.level, groupIds: targetGroupIds },
    });

    return test;
  }

  // ─── SAVOL QO'SHISH ───────────────────────────────────────────────────────
  async addQuestion(testId: string, dto: AddQuestionDto, actorId: string, actorRole: string) {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test topilmadi');

    if (test.status !== TestStatus.DRAFT) {
      throw new BadRequestException('Nashr qilingan yoki ko\'rib chiqilayotgan testga savol qo\'shib bo\'lmaydi');
    }

    if (actorRole === Role.USTOZ && test.createdById !== actorId) {
      throw new ForbiddenException('Bu test sizniki emas');
    }

    // correctAnswer opsiyalar ichida borligini tekshirish
    const optionIds = dto.options.map((o) => o.id);
    if (!optionIds.includes(dto.correctAnswer)) {
      throw new BadRequestException('To\'g\'ri javob opsiyalar ichida bo\'lishi kerak');
    }

    const count = await this.questionRepo.count({ where: { testId } });
    const question = this.questionRepo.create({
      testId,
      question: dto.question,
      options: dto.options,
      correctAnswer: dto.correctAnswer,
      difficulty: dto.difficulty,
      points: dto.points ?? 1,
      imageUrl: dto.imageUrl ?? null,
      topic: dto.topic ?? null,
      sortOrder: count,
    });

    await this.questionRepo.save(question);
    return question;
  }

  // ─── TEST ZANJIRI: DRAFT → REVIEW → PUBLISHED ────────────────────────────
  async updateStatus(
    testId: string,
    dto: UpdateTestStatusDto,
    actorId: string,
    actorRole: string,
  ) {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test topilmadi');

    // RBAC: test zanjiri
    if (actorRole === Role.SUPER_ADMIN) {
      // SA istalgan maqsad-holatga ruxsatli — lekin quyidagi zanjir
      // tekshiruvi bosqichlarni chetlab o'tishga baribir yo'l qo'ymaydi
    } else if (actorRole === Role.MANAGER) {
      // Manager: draft/review → published, yoki → review
      if (!['review', 'published', 'archived'].includes(dto.status)) {
        throw new BadRequestException('Manager faqat review/published/archived holat o\'rnata oladi');
      }
    } else if (actorRole === Role.USTOZ) {
      // Ustoz faqat o'z testini draft → review yuboradi
      if (dto.status !== 'review') throw new ForbiddenException('Ustoz faqat ko\'rib chiqishga yubora oladi');
      if (test.createdById !== actorId) throw new ForbiddenException('Bu test sizniki emas');
    } else {
      throw new ForbiddenException('Bu amalni bajarish uchun ruxsat yo\'q');
    }

    // Zanjir: bosqichlar ketma-ket o'tiladi — SA ham chetlab o'ta olmaydi
    // (aks holda quyidagi savol-soni tekshiruvi review bosqichini chetlab
    // o'tib to'g'ridan-to'g'ri published qilinganda ishlamay qolardi)
    const allowedNext = TEST_STATUS_TRANSITIONS[test.status] ?? [];
    if (!allowedNext.includes(dto.status as TestStatus)) {
      throw new BadRequestException(
        `"${TEST_STATUS_LABELS[test.status]}" holatidan to'g'ridan-to'g'ri "${TEST_STATUS_LABELS[dto.status as TestStatus]}"ga o'tib bo'lmaydi`,
      );
    }

    // Ko'rib chiqishga yuborishda savollar soni tekshirish
    if (dto.status === 'review') {
      const questionCount = await this.questionRepo.count({ where: { testId } });
      if (questionCount < test.questionsToShow) {
        throw new BadRequestException(
          `Test kamida ${test.questionsToShow} ta savolga ega bo'lishi kerak (hozir: ${questionCount})`,
        );
      }
    }

    const oldStatus = test.status;
    await this.testRepo.update(testId, { status: dto.status as TestStatus });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'TEST_STATUS_CHANGED',
      entityName: 'tests',
      entityId: testId,
      oldValues: { status: oldStatus },
      newValues: { status: dto.status, comment: dto.comment },
    });

    return this.testRepo.findOne({ where: { id: testId } });
  }

  // ─── TEST BOSHLASH ────────────────────────────────────────────────────────
  async startTest(testId: string, studentId: string) {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test topilmadi');

    if (test.status !== TestStatus.PUBLISHED) {
      throw new BadRequestException('Bu test hali nashr qilinmagan');
    }

    // Urinishlar sonini tekshirish
    const attempts = await this.resultRepo.count({ where: { testId, studentId } });
    if (attempts >= test.maxAttempts) {
      throw new BadRequestException(`Maksimal urinishlar soni (${test.maxAttempts}) tugadi`);
    }

    // O'quvchi faniga yozilganligini tekshirish
    const enrolled = await this.enrollmentRepo
      .createQueryBuilder('e')
      .innerJoin('groups', 'g', 'g.id = e.group_id AND g.subject_id = :sid', { sid: test.subjectId })
      .where('e.student_id = :studentId', { studentId })
      .andWhere('e.status = :status', { status: EnrollmentStatus.ACTIVE })
      .getOne();

    if (!enrolled && !test.isBaseline) {
      throw new ForbiddenException('Siz bu test fani bo\'yicha guruhga yozilmagansiz');
    }

    // Vaqt uzaytirish tekshirish (tasdiqlangan so'rov bor bo'lsa)
    const extension = await this.extensionRepo.findOne({
      where: { testId, studentId, status: ExtensionStatus.APPROVED },
    });

    const totalMinutes = test.timeLimitMinutes + (extension?.extraMinutes ?? 0);

    // Savollarni random tanlash (3:5:2 nisbat)
    const allQuestions = await this.questionRepo.find({ where: { testId } });
    const selected = pickByDifficulty(allQuestions, test.questionsToShow);

    // Test natijasini boshlash
    const result = this.resultRepo.create({
      testId,
      studentId,
      attemptNumber: attempts + 1,
      score: 0,
      totalPoints: selected.reduce((s, q) => s + q.points, 0),
      earnedPoints: 0,
      answers: {},
      selectedQuestionIds: selected.map((q) => q.id),
      startedAt: new Date(),
      cheatingFlag: false,
    });

    try {
      await this.resultRepo.save(result);
    } catch (err) {
      // Ikki tenglashuvchi so'rov bir vaqtda shu urinish raqamini yaratmoqchi
      // bo'lsa (check-then-act poyga holati) — DB unique cheklovi buni ushlaydi
      if ((err as { code?: string }).code === '23505') {
        throw new BadRequestException(`Maksimal urinishlar soni (${test.maxAttempts}) tugadi`);
      }
      throw err;
    }

    // Faqat savol matni va opsiyalar (to'g'ri javob YO'Q)
    const questions = selected.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      imageUrl: q.imageUrl,
      difficulty: q.difficulty,
    }));

    return {
      testResultId: result.id,
      timeLimitMinutes: totalMinutes,
      questionsCount: selected.length,
      questions: shuffle(questions),
      startedAt: result.startedAt,
    };
  }

  // ─── BITTA SAVOLNI DARHOL TEKSHIRISH (Duolingo uslubi) ───────────────────
  // Ball yozmaydi/oshirmaydi — faqat to'g'ri/xato ko'rsatadi. Javob darhol
  // result.answers'ga yoziladi — shu bilan "peek" (qayta-qayta sinab ko'rish)
  // oldini oladi va yakuniy submitTest() uchun ma'lumot manbai bo'ladi.
  async checkAnswer(dto: CheckAnswerDto, studentId: string) {
    const result = await this.resultRepo.findOne({ where: { id: dto.testResultId, studentId } });
    if (!result) throw new NotFoundException('Test natijasi topilmadi');
    if (result.finishedAt) throw new ConflictException('Bu test allaqachon yakunlangan');

    const existing = (result.answers ?? {}) as Record<string, string>;
    if (existing[dto.questionId] !== undefined) {
      throw new ConflictException('Bu savol allaqachon tekshirilgan');
    }

    // Savol aynan shu urinishda ko'rsatilgan to'plamga tegishli bo'lishi shart —
    // aks holda API orqali testning butun savollar havzasidan (ko'rsatilmagan
    // savollar ham) javob yuborib, ballni sun'iy oshirish mumkin bo'lar edi
    if (!(result.selectedQuestionIds ?? []).includes(dto.questionId)) {
      throw new NotFoundException('Savol topilmadi');
    }

    const question = await this.questionRepo.findOne({
      where: { id: dto.questionId, testId: result.testId },
    });
    if (!question) throw new NotFoundException('Savol topilmadi');

    const correct = question.correctAnswer === dto.answer;

    await this.resultRepo.update(result.id, {
      answers: { ...existing, [dto.questionId]: dto.answer },
    });

    return { correct, correctAnswer: question.correctAnswer };
  }

  // ─── TEST JAVOBLARINI YUBORISH ────────────────────────────────────────────
  async submitTest(dto: SubmitTestDto, studentId: string) {
    const result = await this.resultRepo.findOne({
      where: { id: dto.testResultId, studentId },
      relations: { test: true },
    });

    if (!result) throw new NotFoundException('Test natijasi topilmadi');
    if (result.finishedAt) throw new ConflictException('Bu test allaqachon yakunlangan');

    const test = result.test;
    const now = new Date();
    const timeSpentSeconds = Math.round((now.getTime() - result.startedAt.getTime()) / 1000);

    // Shu urinishga tasdiqlangan vaqt uzaytirish bormi
    const extension = await this.extensionRepo.findOne({
      where: { testResultId: result.id, status: ExtensionStatus.APPROVED },
    });

    // Vaqt limitini tekshirish (5 daqiqa qo'shimcha tolerans + tasdiqlangan uzaytirish)
    const maxAllowedSeconds = (test.timeLimitMinutes + 5 + (extension?.extraMinutes ?? 0)) * 60;
    if (timeSpentSeconds > maxAllowedSeconds) {
      throw new BadRequestException('Test vaqti tugagan');
    }

    // Savollarni olish (faqat ushbu testga tegishli)
    const questionIds = Object.keys(dto.answers);
    const questions = await this.questionRepo.findBy({ testId: result.testId });
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const selectedIds = result.selectedQuestionIds ?? [];

    // Ball hisoblash — faqat shu urinishda ko'rsatilgan savollar to'plami hisobga
    // olinadi (API orqali to'g'ridan-to'g'ri, ko'rsatilmagan savolga javob yuborib
    // ballni sun'iy oshirish oldini olish uchun)
    let earnedPoints = 0;
    const checkedAnswers: Record<string, boolean> = {};

    for (const [qId, answer] of Object.entries(dto.answers)) {
      if (!selectedIds.includes(qId)) continue;
      const question = questionMap.get(qId);
      if (!question) continue;
      const correct = question.correctAnswer === answer;
      if (correct) earnedPoints += question.points;
      checkedAnswers[qId] = correct;
    }

    // Maxraj — aynan shu urinishda ko'rsatilgan savollar to'plamining ball
    // yig'indisi (testning butun savollar havzasidan emas)
    const totalPoints = selectedIds.reduce((s, qId) => s + (questionMap.get(qId)?.points ?? 0), 0);
    const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100 * 10) / 10 : 0;

    // Anti-cheat tekshirish
    const cheatingFlag = this.detectCheating({
      timeSpentSeconds,
      questionsCount: questionIds.length,
      questionTimes: dto.questionTimes,
    });

    await this.resultRepo.update(result.id, {
      answers: dto.answers,
      score,
      earnedPoints,
      finishedAt: now,
      timeSpentSeconds,
      cheatingFlag,
    });

    // Ball tizimi: 90%+ → +20 ball
    if (score >= 90) {
      await this.pointsRepo.save(
        this.pointsRepo.create({
          userId: studentId,
          action: PointsAction.TEST_HIGH_SCORE,
          points: 20,
          description: `Test natijasi ${score}%: "${test.title}"`,
          referenceId: result.id,
          referenceType: 'test_result',
        }),
      );
      await this.userRepo.increment({ id: studentId }, 'totalPoints', 20);
    }

    // Qiyinlik darajasini aniqlash
    const level = score < 60 ? 'Oson daraja' : score < 80 ? 'O\'rta daraja' : 'Qiyin daraja';

    return {
      resultId: result.id,
      score,
      earnedPoints,
      totalPoints,
      timeSpentSeconds,
      level,
      cheatingFlag,
      checkedAnswers: Object.fromEntries(
        Object.entries(checkedAnswers).map(([id, correct]) => [
          id,
          { correct, correctAnswer: questionMap.get(id)?.correctAnswer },
        ]),
      ),
      pointsEarned: score >= 90 ? 20 : 0,
    };
  }

  // ─── VAQT UZAYTIRISH SO'ROVI ──────────────────────────────────────────────
  async requestTimeExtension(dto: TimeExtensionRequestDto, studentId: string) {
    const test = await this.testRepo.findOne({ where: { id: dto.testId } });
    if (!test) throw new NotFoundException('Test topilmadi');

    // So'rov aynan shu (ishlab turgan) urinishga tegishli bo'lishi shart
    const result = await this.resultRepo.findOne({
      where: { id: dto.testResultId, studentId, testId: dto.testId },
    });
    if (!result) throw new NotFoundException('Test urinishi topilmadi');
    if (result.finishedAt) throw new BadRequestException('Bu urinish allaqachon yakunlangan');

    // Shu urinish uchun ko'rib chiqilmagan so'rov bormi — faqat shu urinish doirasida
    const existing = await this.extensionRepo.findOne({
      where: {
        testResultId: dto.testResultId,
        status: In([ExtensionStatus.PENDING, ExtensionStatus.APPROVED]),
      },
    });

    if (existing) {
      throw new ConflictException('Bu urinish uchun allaqachon so\'rov yuborilgan');
    }

    const extension = this.extensionRepo.create({
      testId: dto.testId,
      testResultId: dto.testResultId,
      studentId,
      extraMinutes: dto.extraMinutes,
      reason: dto.reason ?? null,
      status: ExtensionStatus.PENDING,
    });

    await this.extensionRepo.save(extension);

    // O'qituvchi va managerlarga bildirishnoma
    const notifTargets = await this.userRepo.find({
      where: [{ role: Role.USTOZ }, { role: Role.MANAGER }],
      select: { id: true },
    });

    const student = await this.userRepo.findOne({
      where: { id: studentId },
      select: { firstName: true, lastName: true },
    });

    await this.notifRepo.save(
      notifTargets.map((u) =>
        this.notifRepo.create({
          userId: u.id,
          type: NotificationType.TEST,
          title: '⏱ Vaqt uzaytirish so\'rovi',
          body: `${student?.firstName} ${student?.lastName}: "${test.title}" uchun +${dto.extraMinutes} daqiqa so'radi`,
          data: { extensionId: extension.id, testId: dto.testId, studentId },
          pushSent: false, smsSent: false, telegramSent: false,
        }),
      ),
    );

    return { message: 'So\'rov yuborildi. Ustoz bir bosish bilan tasdiqlaydi.', extension };
  }

  // ─── VAQT UZAYTIRISH TASDIQLASH/RAD ETISH (1 bosish) ────────────────────
  async reviewExtension(
    extensionId: string,
    approved: boolean,
    actorId: string,
    actorRole: string,
  ) {
    const extension = await this.extensionRepo.findOne({ where: { id: extensionId } });
    if (!extension) throw new NotFoundException('So\'rov topilmadi');

    if (extension.status !== ExtensionStatus.PENDING) {
      throw new BadRequestException('Bu so\'rov allaqachon ko\'rib chiqilgan');
    }

    await this.extensionRepo.update(extensionId, {
      status: approved ? ExtensionStatus.APPROVED : ExtensionStatus.REJECTED,
      reviewedById: actorId,
      reviewedAt: new Date(),
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: approved ? 'TIME_EXTENSION_APPROVED' : 'TIME_EXTENSION_REJECTED',
      entityName: 'test_time_extensions',
      entityId: extensionId,
    });

    return { message: approved ? '✅ Vaqt uzaytirish tasdiqlandi' : 'Rad etildi' };
  }

  // ─── KUTILAYOTGAN SO'ROVLAR RO'YXATI (ustoz/manager/SA) ──────────────────
  async getPendingExtensions() {
    const extensions = await this.extensionRepo.find({
      where: { status: ExtensionStatus.PENDING },
      relations: { test: true, student: true },
      order: { createdAt: 'ASC' },
    });

    return extensions.map((e) => ({
      id: e.id,
      testId: e.testId,
      testTitle: e.test.title,
      studentId: e.studentId,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      extraMinutes: e.extraMinutes,
      reason: e.reason,
      createdAt: e.createdAt,
    }));
  }

  // ─── O'QUVCHI — O'Z SO'ROVI HOLATI (TestRunner polling uchun) ────────────
  async getMyExtensionStatus(testResultId: string, studentId: string) {
    const extension = await this.extensionRepo.findOne({
      where: { testResultId, studentId },
      order: { createdAt: 'DESC' },
    });

    if (!extension) return { status: null, extraMinutes: null };
    return { status: extension.status, extraMinutes: extension.extraMinutes };
  }

  // ─── TEST NATIJALARI ──────────────────────────────────────────────────────
  async getResults(testId: string, actorId: string, actorRole: string) {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test topilmadi');

    if (actorRole === Role.USTOZ && test.createdById !== actorId) {
      throw new ForbiddenException('Bu test sizniki emas');
    }

    // `score` decimal ustun — pg drayveri string qaytaradi (raqamli
    // solishtirish va frontendga qaytarish uchun bu yerdayoq Number()ga
    // o'raladi, aks holda pastdagi "eng yaxshi" solishtiruv ham satr sifatida
    // — masalan "9.5" > "10.0" — noto'g'ri natija berardi)
    //
    // Talaba keyinchalik arxivlangan (o'qishni tashlab ketgan) bo'lsa ham,
    // o'sha paytdagi natijasida ismi ko'rinishda qolishi kerak. TypeORM
    // JOIN orqali yuklangan bog'liq entity uchun "deleted_at IS NULL"ni
    // avtomatik qo'shib qo'yadi — bu hatto qo'lda join sharti berilganda
    // ham, hatto .withDeleted() chaqirilganda ham chetlab o'tilmaydi
    // (faqat ASOSIY entity uchun ishlaydi). Shuning uchun talabalarni
    // alohida so'rov bilan (arxivlanganlarini ham qo'shib) olib, qo'lda
    // biriktiramiz — bu yerda .withDeleted() ishonchli ishlaydi.
    const rawResults = await this.resultRepo.find({
      where: { testId },
      order: { score: 'DESC' },
    });

    const studentIds = [...new Set(rawResults.map((r) => r.studentId))];
    const students = studentIds.length
      ? await this.userRepo.createQueryBuilder('u').withDeleted().where('u.id IN (:...ids)', { ids: studentIds }).getMany()
      : [];
    const studentMap = new Map(students.map((s) => [s.id, s]));

    const results = rawResults.map((r) => {
      const student = studentMap.get(r.studentId) ?? null;
      return {
        ...r,
        score: Number(r.score),
        student: student ? { firstName: student.firstName, lastName: student.lastName } : null,
        studentArchived: !!student?.deletedAt,
      };
    });

    // Score method bo'yicha har o'quvchi uchun hisobga olinadigan natijani aniqlash
    const studentBest = new Map<string, (typeof results)[number]>();

    if (test.scoreMethod === 'average') {
      // O'rtacha: barcha urinishlarni guruhlab, sun'iy "o'rtacha ball"li natija yasaymiz
      const byStudent = new Map<string, (typeof results)[number][]>();
      for (const r of results) {
        if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
        byStudent.get(r.studentId)!.push(r);
      }
      for (const [studentId, attempts] of byStudent) {
        const avgScore = attempts.reduce((s, r) => s + r.score, 0) / attempts.length;
        studentBest.set(studentId, { ...attempts[0], score: Math.round(avgScore * 10) / 10 } as (typeof results)[number]);
      }
    } else {
      for (const r of results) {
        const current = studentBest.get(r.studentId);
        if (!current) { studentBest.set(r.studentId, r); continue; }

        if (test.scoreMethod === 'best' && r.score > current.score) {
          studentBest.set(r.studentId, r);
        } else if (test.scoreMethod === 'last' &&
                   new Date(r.startedAt) > new Date(current.startedAt)) {
          studentBest.set(r.studentId, r);
        }
      }
    }

    // Barcha statistika BIR XIL to'plamdan (har o'quvchining shu test uchun
    // hisobga olinadigan yagona natijasi) hisoblanadi — avval avgScore barcha
    // urinishlar bo'yicha, total/levelDistribution esa faqat hisobga
    // olinadigan urinish bo'yicha edi (bitta javobda ikki xil usul)
    const counted = [...studentBest.values()];
    const stats = {
      total: counted.length,
      avgScore: counted.length
        ? Math.round(counted.reduce((s, r) => s + Number(r.score), 0) / counted.length * 10) / 10
        : 0,
      cheatingFlags: results.filter((r) => r.cheatingFlag).length,
      levelDistribution: {
        easy: counted.filter((r) => Number(r.score) < 60).length,
        medium: counted.filter((r) => Number(r.score) >= 60 && Number(r.score) < 80).length,
        hard: counted.filter((r) => Number(r.score) >= 80).length,
      },
    };

    return {
      test: {
        id: test.id,
        title: test.title,
        scoreMethod: test.scoreMethod,
        resultsAutoVisible: test.resultsAutoVisible,
        resultsReleasedAt: test.resultsReleasedAt,
      },
      stats,
      results,
    };
  }

  // ─── BITTA URINISH — SAVOL-SAVOL BATAFSIL ─────────────────────────────────
  // Har savol bo'yicha: o'quvchi qaysi variantni tanladi, to'g'ri javob
  // qaysi edi, to'g'ri/xato — natijalar oynasida "batafsil" ko'rish uchun
  async getResultDetail(resultId: string, actorId: string, actorRole: string) {
    // Student uchun izoh: getResults()dagi bilan bir xil sabab — arxivlangan
    // talabaning ismi ham ko'rinishi kerak, shuning uchun alohida so'rov
    // bilan (.withDeleted()) olinadi, join orqali emas
    const result = await this.resultRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.test', 'test')
      .where('r.id = :resultId', { resultId })
      .getOne();

    if (!result) throw new NotFoundException('Natija topilmadi');

    if (actorRole === Role.STUDENT) {
      if (result.studentId !== actorId) {
        throw new ForbiddenException('Faqat o\'z natijangizni ko\'ra olasiz');
      }
      // Nazorat ishi rejimi: natijalar hali ochilmagan bo'lsa, o'quvchi
      // frontendni chetlab o'tib to'g'ridan-to'g'ri API chaqirsa ham ko'ra olmaydi
      if (!result.test.resultsAutoVisible && !result.test.resultsReleasedAt) {
        throw new ForbiddenException('Natijalar hali e\'lon qilinmagan');
      }
    } else if (actorRole === Role.USTOZ) {
      if (result.test.createdById !== actorId) {
        throw new ForbiddenException('Bu test sizniki emas');
      }
    }
    // SA/Manager — cheklovsiz

    const student = await this.userRepo
      .createQueryBuilder('u')
      .withDeleted()
      .where('u.id = :sid', { sid: result.studentId })
      .getOne();

    // Eski urinishlarda (selectedQuestionIds mexanizmi qo'shilishidan oldingi)
    // bu ustun bo'sh bo'lishi mumkin — bunday holda javob berilgan savollar
    // to'plamiga tayanamiz (faqat ko'rsatish uchun, ball hisoblashda emas)
    const selectedIds = result.selectedQuestionIds?.length
      ? result.selectedQuestionIds
      : Object.keys(result.answers ?? {});
    const questions = selectedIds.length
      ? await this.questionRepo.findBy({ id: In(selectedIds) })
      : [];
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // selectedQuestionIds tartibi — o'quvchiga aynan shu tartibda ko'rsatilgan edi
    const breakdown = selectedIds
      .map((qId) => questionMap.get(qId))
      .filter((q): q is TestQuestion => !!q)
      .map((q) => {
        const studentAnswer = result.answers?.[q.id] ?? null;
        return {
          id: q.id,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          points: q.points,
          topic: q.topic,
          correctAnswer: q.correctAnswer,
          studentAnswer,
          isCorrect: studentAnswer !== null && studentAnswer === q.correctAnswer,
        };
      });

    return {
      result: {
        id: result.id,
        score: Number(result.score),
        earnedPoints: result.earnedPoints,
        totalPoints: result.totalPoints,
        attemptNumber: result.attemptNumber,
        student: student
          ? { firstName: student.firstName, lastName: student.lastName, archived: !!student.deletedAt }
          : null,
      },
      questions: breakdown,
    };
  }

  // ─── SAVOL/MAVZU TAHLILI — guruh eng ko'p qaysi mavzuda xato qiladi ───────
  async getQuestionAnalysis(testId: string, actorId: string, actorRole: string) {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test topilmadi');

    if (actorRole === Role.USTOZ && test.createdById !== actorId) {
      throw new ForbiddenException('Bu test sizniki emas');
    }

    const questions = await this.questionRepo.find({ where: { testId } });

    // Har o'quvchining ENG SO'NGGI tugallangan urinishi — hozirgi bilim
    // darajasini eng yaxshi aks ettiradi (bir nechta urinish bo'lsa,
    // avvalgi xatolar takrorlanib statistikani buzmasligi uchun)
    const allResults = await this.resultRepo.find({
      where: { testId },
      order: { startedAt: 'DESC' },
    });
    const latestPerStudent = new Map<string, TestResult>();
    for (const r of allResults) {
      if (!r.finishedAt) continue;
      if (!latestPerStudent.has(r.studentId)) latestPerStudent.set(r.studentId, r);
    }

    const stats = new Map<string, {
      question: TestQuestion; shown: number; correct: number; wrong: number; unanswered: number;
    }>();
    for (const q of questions) {
      stats.set(q.id, { question: q, shown: 0, correct: 0, wrong: 0, unanswered: 0 });
    }

    for (const result of latestPerStudent.values()) {
      const selected = result.selectedQuestionIds?.length
        ? result.selectedQuestionIds
        : Object.keys(result.answers ?? {});
      for (const qId of selected) {
        const s = stats.get(qId);
        if (!s) continue;
        s.shown++;
        const answer = result.answers?.[qId];
        if (answer === undefined) { s.unanswered++; continue; }
        if (answer === s.question.correctAnswer) s.correct++;
        else s.wrong++;
      }
    }

    const questionStats = [...stats.values()]
      .filter((s) => s.shown > 0)
      .map((s) => ({
        id: s.question.id,
        question: s.question.question,
        topic: s.question.topic,
        difficulty: s.question.difficulty,
        shown: s.shown,
        correct: s.correct,
        wrong: s.wrong,
        unanswered: s.unanswered,
        wrongRate: Math.round((s.wrong / s.shown) * 100),
      }))
      .sort((a, b) => b.wrongRate - a.wrongRate);

    // Mavzu bo'yicha yig'indi — teg qo'yilmagan savollar "Belgilanmagan"ga tushadi
    const byTopic = new Map<string, { shown: number; correct: number; wrong: number }>();
    for (const qs of questionStats) {
      const key = qs.topic ?? 'Belgilanmagan';
      if (!byTopic.has(key)) byTopic.set(key, { shown: 0, correct: 0, wrong: 0 });
      const t = byTopic.get(key)!;
      t.shown += qs.shown;
      t.correct += qs.correct;
      t.wrong += qs.wrong;
    }
    const topicStats = [...byTopic.entries()]
      .map(([topic, t]) => ({
        topic, ...t,
        wrongRate: t.shown > 0 ? Math.round((t.wrong / t.shown) * 100) : 0,
      }))
      .sort((a, b) => b.wrongRate - a.wrongRate);

    return {
      studentsCounted: latestPerStudent.size,
      topics: topicStats,
      questions: questionStats,
    };
  }

  // ─── NAZORAT ISHI: TAB/OYNA ALMASHTIRISH SIGNALI ──────────────────────────
  // O'quvchi test davomida boshqa tab/oynaga o'tsa (masalan AI chatbotdan
  // javob izlash uchun) chaqiriladi. Faqat tugallanmagan, o'ziga tegishli
  // urinish uchun ishlaydi
  async recordTabSwitch(resultId: string, studentId: string): Promise<{ tabSwitchCount: number }> {
    const result = await this.resultRepo.findOne({
      where: { id: resultId, studentId },
      relations: { test: true },
    });
    if (!result) throw new NotFoundException('Test urinishi topilmadi');
    if (result.finishedAt) {
      // Urinish allaqachon tugagan — signal keraksiz, xato tashlamaymiz
      // (frontend'da event tartibsiz kelib qolishi mumkin)
      return { tabSwitchCount: result.tabSwitchCount };
    }

    const tabSwitchCount = result.tabSwitchCount + 1;
    await this.resultRepo.update(resultId, { tabSwitchCount });

    const student = await this.userRepo.findOne({
      where: { id: studentId },
      select: { firstName: true, lastName: true },
    });
    const studentName = student ? `${student.firstName} ${student.lastName}` : "O'quvchi";

    // Jonli signal — shu paytda "Natijalar" oynasini ochib turganlarga darhol
    this.proctorGateway.alertTabSwitch(result.testId, {
      resultId, studentId, studentName, tabSwitchCount,
    });

    // Doimiy bildirishnoma — ustoz/manager keyinroq ochib ko'rsa ham qolsin
    // (vaqt uzaytirish so'rovidagi bilan bir xil auditoriya konvensiyasi)
    const notifTargets = await this.userRepo.find({
      where: [{ role: Role.USTOZ }, { role: Role.MANAGER }],
      select: { id: true },
    });
    await this.notifRepo.save(
      notifTargets.map((u) =>
        this.notifRepo.create({
          userId: u.id,
          type: NotificationType.TEST,
          title: '⚠️ Nazorat ishida boshqa joyga chiqdi',
          body: `${studentName}: "${result.test.title}" testida ${tabSwitchCount}-marta boshqa tab/oynaga chiqdi`,
          data: { testId: result.testId, resultId, studentId, tabSwitchCount },
          pushSent: false, smsSent: false, telegramSent: false,
        }),
      ),
    );

    return { tabSwitchCount };
  }

  // ─── NAZORAT ISHI: NATIJALARNI OCHISH ─────────────────────────────────────
  async releaseResults(testId: string, actorId: string, actorRole: string): Promise<{ message: string }> {
    const test = await this.testRepo.findOne({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test topilmadi');

    if (actorRole === Role.USTOZ && test.createdById !== actorId) {
      throw new ForbiddenException('Bu test sizniki emas');
    }

    await this.testRepo.update(testId, { resultsReleasedAt: new Date() });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'TEST_RESULTS_RELEASED',
      entityName: 'tests',
      entityId: testId,
    });

    return { message: `"${test.title}" natijalari o'quvchilarga ochildi` };
  }

  // ─── O'QUVCHI NATIJALARI ──────────────────────────────────────────────────
  async getStudentResults(studentId: string, requesterId: string, requesterRole: string) {
    if (requesterRole === Role.STUDENT && studentId !== requesterId) {
      throw new ForbiddenException('Faqat o\'z natijalaringizni ko\'ra olasiz');
    }

    const results = await this.resultRepo.find({
      where: { studentId },
      relations: { test: { subject: true } },
      order: { createdAt: 'DESC' },
    });

    return results.map((r) => ({ ...r, score: Number(r.score) }));
  }

  // ─── TEST RO'YXATI ────────────────────────────────────────────────────────
  async findAll(query: { subjectId?: string; status?: TestStatus }, actorId: string, actorRole: string) {
    const qb = this.testRepo.createQueryBuilder('t')
      .innerJoin('t.subject', 's')
      .leftJoin('t.createdBy', 'creator')
      .addSelect(['t.id','t.title','t.status','t.timeLimitMinutes','t.maxAttempts',
                  't.scoreMethod','t.questionsToShow','t.totalQuestions','t.isBaseline','t.level','t.createdAt',
                  't.resultsAutoVisible','t.resultsReleasedAt',
                  's.id','s.name','creator.firstName','creator.lastName']);

    if (actorRole === Role.USTOZ) {
      qb.where('t.created_by = :uid', { uid: actorId });
    }
    if (query.subjectId) qb.andWhere('t.subject_id = :sid', { sid: query.subjectId });

    if (actorRole === Role.STUDENT) {
      // O'quvchiga status query'dan qat'iy nazar FAQAT nashr qilingan
      // testlar ko'rinadi — draft/review savollar sizib chiqmasligi uchun
      qb.andWhere('t.status = :pubStatus', { pubStatus: TestStatus.PUBLISHED });

      // Guruh bo'yicha ko'rinish: test hech qanday guruhga cheklanmagan
      // bo'lsa (eski xatti-harakat) YOKI o'quvchi shu testga tayinlangan
      // guruhlardan biriga faol yozilgan bo'lsa — ko'rinadi
      const activeEnrollments = await this.enrollmentRepo.find({
        where: { studentId: actorId, status: EnrollmentStatus.ACTIVE },
        select: { groupId: true },
      });
      const myGroupIds = activeEnrollments.map((e) => e.groupId);

      if (myGroupIds.length > 0) {
        qb.andWhere(
          `(NOT EXISTS (SELECT 1 FROM test_group_visibility tgv WHERE tgv.test_id = t.id)
            OR EXISTS (SELECT 1 FROM test_group_visibility tgv2 WHERE tgv2.test_id = t.id AND tgv2.group_id IN (:...myGroupIds)))`,
          { myGroupIds },
        );
      } else {
        qb.andWhere(
          `NOT EXISTS (SELECT 1 FROM test_group_visibility tgv WHERE tgv.test_id = t.id)`,
        );
      }
    } else if (query.status) {
      qb.andWhere('t.status = :st', { st: query.status });
    }

    const tests = await qb.orderBy('t.created_at', 'DESC').getMany();

    if (actorRole !== Role.STUDENT || tests.length === 0) return tests;

    // Talaba uchun — o'z natijalari va qolgan urinishlar sonini biriktiramiz
    const testIds = tests.map((t) => t.id);
    const myResults = await this.resultRepo.find({
      where: { studentId: actorId, testId: In(testIds) },
      order: { createdAt: 'DESC' },
    });

    const byTest = new Map<string, TestResult[]>();
    for (const r of myResults) {
      if (!byTest.has(r.testId)) byTest.set(r.testId, []);
      byTest.get(r.testId)!.push(r);
    }

    return tests.map((t) => {
      const attempts = byTest.get(t.id) ?? [];
      const best = attempts.reduce<TestResult | null>(
        (b, r) => (!b || Number(r.score) > Number(b.score) ? r : b), null,
      );
      const bestOrLatest = t.scoreMethod === 'best' ? best : (attempts[0] ?? null);
      // Nazorat ishi rejimi: natijalar hali ochilmagan bo'lsa, ball va boshqa
      // fosh qiluvchi maydonlar o'quvchiga yuborilmaydi — faqat "tugatgan"
      // fakti (attemptsLeft to'g'ri hisoblanishi uchun)
      const resultsHidden = bestOrLatest && !t.resultsAutoVisible && !t.resultsReleasedAt;
      // decimal ustun pg orqali satr sifatida qaytadi — frontend .toFixed() ishlatadi
      const myResult = !bestOrLatest
        ? null
        : resultsHidden
          ? { id: bestOrLatest.id, finishedAt: bestOrLatest.finishedAt, resultsHidden: true as const }
          : { ...bestOrLatest, score: Number(bestOrLatest.score) };
      return {
        ...t,
        myResult,
        myAttemptsLeft: Math.max(0, t.maxAttempts - attempts.length),
      };
    });
  }

  async findOne(id: string) {
    const test = await this.testRepo.findOne({
      where: { id },
      relations: { subject: true, visibleGroups: true },
    });
    if (!test) throw new NotFoundException('Test topilmadi');

    const questionCount = await this.questionRepo.count({ where: { testId: id } });
    const questions = await this.questionRepo.find({
      where: { testId: id },
      order: { difficulty: 'ASC', sortOrder: 'ASC' },
    });

    return { ...test, questionCount, questions };
  }

  // ─── AI ANTI-CHEAT ────────────────────────────────────────────────────────
  private detectCheating(data: {
    timeSpentSeconds: number;
    questionsCount: number;
    questionTimes?: Record<string, number>;
  }): boolean {
    const minExpected = minExpectedSeconds(data.questionsCount);

    // Juda tez tugatilgan
    if (data.timeSpentSeconds < minExpected) {
      return true;
    }

    if (!data.questionTimes) return false;

    // Biron savol uchun 0 yoki 1 soniyadan kam vaqt
    const suspiciouslyFast = Object.values(data.questionTimes).filter(
      (t) => t < 2,
    );

    if (suspiciouslyFast.length > data.questionsCount * 0.3) {
      return true; // 30%+ savol 2 soniyadan kam
    }

    return false;
  }
}
