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
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
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
    private auditLog: AuditLogService,
  ) {}

  // ─── TEST YARATISH (DRAFT) ────────────────────────────────────────────────
  async createTest(dto: CreateTestDto, actorId: string, actorRole: string) {
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
      createdById: actorId,
      status: TestStatus.DRAFT,
    });

    await this.testRepo.save(test);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'TEST_CREATED',
      entityName: 'tests',
      entityId: test.id,
      newValues: { title: dto.title, subjectId: dto.subjectId },
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
      // SA barcha o'zgarishlarni qila oladi
    } else if (actorRole === Role.MANAGER) {
      // Manager: draft/review → published, yoki → review
      if (!['review', 'published', 'archived'].includes(dto.status)) {
        throw new BadRequestException('Manager faqat review/published/archived holat o\'rnata oladi');
      }
    } else if (actorRole === Role.USTOZ) {
      // Ustoz faqat o'z testini draft → review yuboradi
      if (dto.status !== 'review') throw new ForbiddenException('Ustoz faqat ko\'rib chiqishga yubora oladi');
      if (test.status !== TestStatus.DRAFT) throw new BadRequestException('Faqat draft testni ko\'rib chiqishga yuborish mumkin');
      if (test.createdById !== actorId) throw new ForbiddenException('Bu test sizniki emas');
    } else {
      throw new ForbiddenException('Bu amalni bajarish uchun ruxsat yo\'q');
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
      startedAt: new Date(),
      cheatingFlag: false,
    });

    await this.resultRepo.save(result);

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

    // Ball hisoblash
    let earnedPoints = 0;
    const checkedAnswers: Record<string, boolean> = {};

    for (const [qId, answer] of Object.entries(dto.answers)) {
      const question = questionMap.get(qId);
      if (!question) continue;
      const correct = question.correctAnswer === answer;
      if (correct) earnedPoints += question.points;
      checkedAnswers[qId] = correct;
    }

    const totalPoints = questions.slice(0, test.questionsToShow).reduce((s, q) => s + q.points, 0);
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

    const results = await this.resultRepo.find({
      where: { testId },
      relations: { student: true },
      order: { score: 'DESC' },
    });

    // Score method bo'yicha har o'quvchi uchun hisobga olinadigan natijani aniqlash
    const studentBest = new Map<string, TestResult>();

    if (test.scoreMethod === 'average') {
      // O'rtacha: barcha urinishlarni guruhlab, sun'iy "o'rtacha ball"li natija yasaymiz
      const byStudent = new Map<string, TestResult[]>();
      for (const r of results) {
        if (!byStudent.has(r.studentId)) byStudent.set(r.studentId, []);
        byStudent.get(r.studentId)!.push(r);
      }
      for (const [studentId, attempts] of byStudent) {
        const avgScore = attempts.reduce((s, r) => s + Number(r.score), 0) / attempts.length;
        studentBest.set(studentId, { ...attempts[0], score: Math.round(avgScore * 10) / 10 } as TestResult);
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

    const stats = {
      total: studentBest.size,
      avgScore: results.length
        ? Math.round(results.reduce((s, r) => s + Number(r.score), 0) / results.length * 10) / 10
        : 0,
      cheatingFlags: results.filter((r) => r.cheatingFlag).length,
      levelDistribution: {
        easy: [...studentBest.values()].filter((r) => Number(r.score) < 60).length,
        medium: [...studentBest.values()].filter((r) => Number(r.score) >= 60 && Number(r.score) < 80).length,
        hard: [...studentBest.values()].filter((r) => Number(r.score) >= 80).length,
      },
    };

    return { test: { id: test.id, title: test.title, scoreMethod: test.scoreMethod }, stats, results };
  }

  // ─── O'QUVCHI NATIJALARI ──────────────────────────────────────────────────
  async getStudentResults(studentId: string, requesterId: string, requesterRole: string) {
    if (requesterRole === Role.STUDENT && studentId !== requesterId) {
      throw new ForbiddenException('Faqat o\'z natijalaringizni ko\'ra olasiz');
    }

    return this.resultRepo.find({
      where: { studentId },
      relations: { test: { subject: true } },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── TEST RO'YXATI ────────────────────────────────────────────────────────
  async findAll(query: { subjectId?: string; status?: TestStatus }, actorId: string, actorRole: string) {
    const qb = this.testRepo.createQueryBuilder('t')
      .innerJoin('t.subject', 's')
      .leftJoin('t.createdBy', 'creator')
      .addSelect(['t.id','t.title','t.status','t.timeLimitMinutes','t.maxAttempts',
                  't.scoreMethod','t.questionsToShow','t.totalQuestions','t.isBaseline','t.createdAt',
                  's.id','s.name','creator.firstName','creator.lastName']);

    if (actorRole === Role.USTOZ) {
      qb.where('t.created_by = :uid', { uid: actorId });
    }
    if (query.subjectId) qb.andWhere('t.subject_id = :sid', { sid: query.subjectId });
    if (query.status) qb.andWhere('t.status = :st', { st: query.status });

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
      // decimal ustun pg orqali satr sifatida qaytadi — frontend .toFixed() ishlatadi
      const myResult = bestOrLatest ? { ...bestOrLatest, score: Number(bestOrLatest.score) } : null;
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
      relations: { subject: true },
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
