import { Test as NestTest, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { TestsService } from './tests.service';
import { Test, TestStatus, TestDifficulty } from '../../entities/test.entity';
import { TestQuestion } from '../../entities/test-question.entity';
import { TestResult } from '../../entities/test-result.entity';
import { TestTimeExtension, ExtensionStatus } from '../../entities/test-time-extension.entity';
import { Enrollment } from '../../entities/enrollment.entity';
import { Notification } from '../../entities/notification.entity';
import { PointsLog } from '../../entities/points-log.entity';
import { User } from '../../entities/user.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../../common/enums/role.enum';
import { SubmitTestDto } from './dto/test.dto';

// Mock repository factory — har bir test izolyatsiya uchun yangi nusxa
function makeRepo() {
  const qb: any = {
    innerJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return {
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn().mockImplementation(async (data: any) => {
      if (Array.isArray(data)) return data;
      return { id: 'mock-id', ...data };
    }),
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    findBy: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
    increment: jest.fn().mockResolvedValue({}),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
}

describe('TestsService', () => {
  let service: TestsService;
  let testRepo: ReturnType<typeof makeRepo>;
  let questionRepo: ReturnType<typeof makeRepo>;
  let resultRepo: ReturnType<typeof makeRepo>;
  let extensionRepo: ReturnType<typeof makeRepo>;
  let enrollmentRepo: ReturnType<typeof makeRepo>;
  let notifRepo: ReturnType<typeof makeRepo>;
  let pointsRepo: ReturnType<typeof makeRepo>;
  let userRepo: ReturnType<typeof makeRepo>;
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    testRepo = makeRepo();
    questionRepo = makeRepo();
    resultRepo = makeRepo();
    extensionRepo = makeRepo();
    enrollmentRepo = makeRepo();
    notifRepo = makeRepo();
    pointsRepo = makeRepo();
    userRepo = makeRepo();
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await NestTest.createTestingModule({
      providers: [
        TestsService,
        { provide: getRepositoryToken(Test), useValue: testRepo },
        { provide: getRepositoryToken(TestQuestion), useValue: questionRepo },
        { provide: getRepositoryToken(TestResult), useValue: resultRepo },
        { provide: getRepositoryToken(TestTimeExtension), useValue: extensionRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(PointsLog), useValue: pointsRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get<TestsService>(TestsService);
  });

  // ─── TEST YARATISH ─────────────────────────────────────────────────────────
  describe('createTest', () => {
    it('DRAFT statusida yaratiladi', async () => {
      await service.createTest(
        { title: 'Ingliz tili 1', subjectId: 'sub-1' } as any,
        'actor-id',
        Role.SUPER_ADMIN,
      );

      expect(testRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: TestStatus.DRAFT }),
      );
      expect(testRepo.save).toHaveBeenCalled();
    });

    it('standart qiymatlar bilan yaratiladi (totalQuestions=30, questionsToShow=10)', async () => {
      await service.createTest(
        { title: 'Test', subjectId: 'sub-1' } as any,
        'actor-id',
        Role.USTOZ,
      );

      expect(testRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalQuestions: 30,
          questionsToShow: 10,
          timeLimitMinutes: 30,
          scoreMethod: 'best',
          maxAttempts: 3,
          isBaseline: false,
        }),
      );
    });

    it('audit log yoziladi', async () => {
      await service.createTest(
        { title: 'T', subjectId: 's' } as any,
        'actor-id',
        Role.MANAGER,
      );

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TEST_CREATED', entityName: 'tests' }),
      );
    });
  });

  // ─── SAVOL QO'SHISH ────────────────────────────────────────────────────────
  describe('addQuestion', () => {
    const draftTest = {
      id: 'test-1',
      status: TestStatus.DRAFT,
      createdById: 'ustoz-id',
    };

    const questionDto = {
      question: 'Fransiya poytaxti qaysi?',
      options: [
        { id: 'a', text: 'Paris' },
        { id: 'b', text: 'London' },
      ],
      correctAnswer: 'a',
      difficulty: TestDifficulty.EASY,
    };

    it('draft testga savol muvaffaqiyatli qo\'shiladi', async () => {
      testRepo.findOne.mockResolvedValue(draftTest);
      questionRepo.count.mockResolvedValue(5);

      await service.addQuestion('test-1', questionDto as any, 'ustoz-id', Role.USTOZ);

      expect(questionRepo.save).toHaveBeenCalled();
      expect(questionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          correctAnswer: 'a',
          difficulty: TestDifficulty.EASY,
        }),
      );
    });

    it('test topilmasa NotFoundException', async () => {
      testRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addQuestion('no-test', questionDto as any, 'ustoz-id', Role.USTOZ),
      ).rejects.toThrow(NotFoundException);
    });

    it('nashr qilingan testga savol qo\'shib bo\'lmaydi', async () => {
      testRepo.findOne.mockResolvedValue({ ...draftTest, status: TestStatus.PUBLISHED });

      await expect(
        service.addQuestion('test-1', questionDto as any, 'ustoz-id', Role.USTOZ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ustoz boshqa ustoz testiga savol qo\'sha olmaydi', async () => {
      testRepo.findOne.mockResolvedValue({ ...draftTest, createdById: 'other-ustoz' });

      await expect(
        service.addQuestion('test-1', questionDto as any, 'my-ustoz', Role.USTOZ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('correctAnswer opsiyalar ichida bo\'lmasa BadRequestException', async () => {
      testRepo.findOne.mockResolvedValue(draftTest);
      const wrongDto = { ...questionDto, correctAnswer: 'c' };

      await expect(
        service.addQuestion('test-1', wrongDto as any, 'ustoz-id', Role.USTOZ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── TEST ZANJIRI: DRAFT → REVIEW → PUBLISHED ─────────────────────────────
  describe('updateStatus', () => {
    const draftTest = {
      id: 'test-1',
      status: TestStatus.DRAFT,
      createdById: 'ustoz-id',
      questionsToShow: 5,
    };

    beforeEach(() => {
      // Ikkinchi findOne (return updated) ni ham sozlash
      testRepo.findOne.mockResolvedValue(draftTest);
    });

    it('super_admin istalgan holatga o\'tkaza oladi', async () => {
      questionRepo.count.mockResolvedValue(10);

      await service.updateStatus(
        'test-1',
        { status: 'published' } as any,
        'sa-id',
        Role.SUPER_ADMIN,
      );

      expect(testRepo.update).toHaveBeenCalledWith(
        'test-1',
        expect.objectContaining({ status: 'published' }),
      );
    });

    it('ustoz o\'z testini DRAFT → review yuboradi', async () => {
      questionRepo.count.mockResolvedValue(10);

      await service.updateStatus(
        'test-1',
        { status: 'review' } as any,
        'ustoz-id',
        Role.USTOZ,
      );

      expect(testRepo.update).toHaveBeenCalledWith(
        'test-1',
        expect.objectContaining({ status: 'review' }),
      );
    });

    it('ustoz boshqa ustoz testini review ga yubora olmaydi', async () => {
      testRepo.findOne.mockResolvedValue({ ...draftTest, createdById: 'other-ustoz' });

      await expect(
        service.updateStatus('test-1', { status: 'review' } as any, 'my-ustoz', Role.USTOZ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ustoz DRAFT bo\'lmagan testni review ga yubora olmaydi', async () => {
      testRepo.findOne.mockResolvedValue({
        ...draftTest,
        status: TestStatus.REVIEW,
        createdById: 'ustoz-id',
      });

      await expect(
        service.updateStatus('test-1', { status: 'review' } as any, 'ustoz-id', Role.USTOZ),
      ).rejects.toThrow(BadRequestException);
    });

    it('ustoz published holatni to\'g\'ridan-to\'g\'ri o\'rnata olmaydi', async () => {
      await expect(
        service.updateStatus('test-1', { status: 'published' } as any, 'ustoz-id', Role.USTOZ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('review ga yuborishda savollar yetarli bo\'lmasa BadRequestException', async () => {
      questionRepo.count.mockResolvedValue(3); // questionsToShow = 5, lekin 3 ta savol bor

      await expect(
        service.updateStatus('test-1', { status: 'review' } as any, 'ustoz-id', Role.USTOZ),
      ).rejects.toThrow(BadRequestException);
    });

    it('test topilmasa NotFoundException', async () => {
      testRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('no-test', { status: 'review' } as any, 'sa-id', Role.SUPER_ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('audit log yoziladi', async () => {
      questionRepo.count.mockResolvedValue(10);

      await service.updateStatus(
        'test-1',
        { status: 'review' } as any,
        'ustoz-id',
        Role.USTOZ,
      );

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TEST_STATUS_CHANGED' }),
      );
    });
  });

  // ─── TEST BOSHLASH ─────────────────────────────────────────────────────────
  describe('startTest', () => {
    // 1 easy, 1 medium, 1 hard — questionsToShow=3 uchun 1:1:1 nisbat
    const mockQuestions = [
      {
        id: 'q1', question: 'Q1',
        options: [{ id: 'a', text: 'A' }],
        imageUrl: null, difficulty: TestDifficulty.EASY, points: 1, correctAnswer: 'a',
      },
      {
        id: 'q2', question: 'Q2',
        options: [{ id: 'b', text: 'B' }],
        imageUrl: null, difficulty: TestDifficulty.MEDIUM, points: 1, correctAnswer: 'b',
      },
      {
        id: 'q3', question: 'Q3',
        options: [{ id: 'c', text: 'C' }],
        imageUrl: null, difficulty: TestDifficulty.HARD, points: 1, correctAnswer: 'c',
      },
    ];

    const publishedTest = {
      id: 'test-1',
      status: TestStatus.PUBLISHED,
      subjectId: 'sub-1',
      timeLimitMinutes: 30,
      questionsToShow: 3,
      maxAttempts: 3,
      isBaseline: false,
    };

    beforeEach(() => {
      testRepo.findOne.mockResolvedValue(publishedTest);
      resultRepo.count.mockResolvedValue(0);
      enrollmentRepo._qb.getOne.mockResolvedValue({ id: 'enroll-1' });
      extensionRepo.findOne.mockResolvedValue(null);
      questionRepo.find.mockResolvedValue(mockQuestions);
      resultRepo.create.mockReturnValue({ id: 'result-uuid', startedAt: new Date(), totalPoints: 3 });
      resultRepo.save.mockResolvedValue({ id: 'result-uuid', startedAt: new Date() });
    });

    it('test muvaffaqiyatli boshlanadi', async () => {
      const result = await service.startTest('test-1', 'student-1');

      expect(result).toMatchObject({
        testResultId: 'result-uuid',
        timeLimitMinutes: 30,
        questionsCount: 3,
      });
      expect(result.questions).toHaveLength(3);
    });

    it('nashr qilinmagan test uchun BadRequestException', async () => {
      testRepo.findOne.mockResolvedValue({ ...publishedTest, status: TestStatus.DRAFT });

      await expect(service.startTest('test-1', 'student-1')).rejects.toThrow(BadRequestException);
    });

    it('maksimal urinish tugagan bo\'lsa BadRequestException', async () => {
      resultRepo.count.mockResolvedValue(3); // maxAttempts = 3

      await expect(service.startTest('test-1', 'student-1')).rejects.toThrow(BadRequestException);
    });

    it('guruhga yozilmagan o\'quvchi non-baseline testda ForbiddenException', async () => {
      enrollmentRepo._qb.getOne.mockResolvedValue(null);

      await expect(service.startTest('test-1', 'student-1')).rejects.toThrow(ForbiddenException);
    });

    it('baseline testda enrollment tekshirilmaydi', async () => {
      testRepo.findOne.mockResolvedValue({ ...publishedTest, isBaseline: true });
      enrollmentRepo._qb.getOne.mockResolvedValue(null);

      // Xato bo'lmasligi kerak
      const result = await service.startTest('test-1', 'student-1');
      expect(result).toHaveProperty('testResultId');
    });

    it('tasdiqlangan extension vaqtga qo\'shiladi', async () => {
      extensionRepo.findOne.mockResolvedValue({
        extraMinutes: 10,
        status: ExtensionStatus.APPROVED,
      });

      const result = await service.startTest('test-1', 'student-1');

      expect(result.timeLimitMinutes).toBe(40); // 30 + 10
    });

    it('qaytarilgan savollarda correctAnswer yo\'q', async () => {
      const result = await service.startTest('test-1', 'student-1');

      for (const q of result.questions) {
        expect(q).not.toHaveProperty('correctAnswer');
      }
    });
  });

  // ─── JAVOB YUBORISH ────────────────────────────────────────────────────────
  describe('submitTest', () => {
    let mockResult: any;

    const threeQuestions = [
      { id: 'q1', testId: 'test-1', correctAnswer: 'a', points: 1 },
      { id: 'q2', testId: 'test-1', correctAnswer: 'b', points: 1 },
      { id: 'q3', testId: 'test-1', correctAnswer: 'c', points: 1 },
    ];

    beforeEach(() => {
      mockResult = {
        id: 'result-1',
        testId: 'test-1',
        studentId: 'student-1',
        finishedAt: null,
        startedAt: new Date(Date.now() - 60_000), // 60 soniya oldin boshlangan
        test: {
          id: 'test-1',
          timeLimitMinutes: 30,
          questionsToShow: 3,
          title: 'Ingliz tili 1',
          scoreMethod: 'best',
        },
      };

      resultRepo.findOne.mockResolvedValue(mockResult);
      questionRepo.findBy.mockResolvedValue(threeQuestions);
      pointsRepo.create.mockReturnValue({ points: 20 });
    });

    it('to\'g\'ri ball hisoblanadi (2/3 = 66.7%)', async () => {
      const result = await service.submitTest(
        { testResultId: 'result-1', answers: { q1: 'a', q2: 'b', q3: 'WRONG' } },
        'student-1',
      );

      expect(result.score).toBe(66.7);
      expect(result.earnedPoints).toBe(2);
      expect(result.totalPoints).toBe(3);
    });

    it('100% natija → +20 ball beriladi', async () => {
      const result = await service.submitTest(
        { testResultId: 'result-1', answers: { q1: 'a', q2: 'b', q3: 'c' } },
        'student-1',
      );

      expect(result.score).toBe(100);
      expect(result.pointsEarned).toBe(20);
      expect(pointsRepo.save).toHaveBeenCalled();
      expect(userRepo.increment).toHaveBeenCalledWith(
        { id: 'student-1' },
        'totalPoints',
        20,
      );
    });

    it('80% natijada ball berilmaydi', async () => {
      // 10 savol, 8 ta to'g'ri = 80%
      const tenQ = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`, testId: 'test-1', correctAnswer: `ans${i}`, points: 1,
      }));
      questionRepo.findBy.mockResolvedValue(tenQ);
      resultRepo.findOne.mockResolvedValue({
        ...mockResult,
        test: { ...mockResult.test, questionsToShow: 10 },
      });

      const answers: Record<string, string> = {};
      tenQ.forEach((q, i) => { answers[q.id] = i < 8 ? q.correctAnswer : 'WRONG'; });

      const result = await service.submitTest({ testResultId: 'result-1', answers }, 'student-1');

      expect(result.score).toBe(80);
      expect(result.pointsEarned).toBe(0);
      expect(pointsRepo.save).not.toHaveBeenCalled();
    });

    it('test natijasi topilmasa NotFoundException', async () => {
      resultRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitTest({ testResultId: 'no-result', answers: {} }, 'student-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('allaqachon yakunlangan test ConflictException', async () => {
      resultRepo.findOne.mockResolvedValue({ ...mockResult, finishedAt: new Date() });

      await expect(
        service.submitTest({ testResultId: 'result-1', answers: {} }, 'student-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('vaqt o\'tib ketgan bo\'lsa BadRequestException', async () => {
      // 30 daqiqa + 5 tolerans = 35 daqiqa. 36 daqiqa oldin boshlangan.
      resultRepo.findOne.mockResolvedValue({
        ...mockResult,
        startedAt: new Date(Date.now() - 36 * 60 * 1000),
      });

      await expect(
        service.submitTest({ testResultId: 'result-1', answers: {} }, 'student-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('daraja to\'g\'ri aniqlanadi: Oson (<60%), O\'rta (60-79%), Qiyin (≥80%)', async () => {
      // 0/3 = 0% → Oson daraja
      const r1 = await service.submitTest(
        { testResultId: 'result-1', answers: { q1: 'WRONG', q2: 'WRONG', q3: 'WRONG' } },
        'student-1',
      );
      expect(r1.level).toBe('Oson daraja');

      // 2/3 = 66.7% → O'rta daraja
      const r2 = await service.submitTest(
        { testResultId: 'result-1', answers: { q1: 'a', q2: 'b', q3: 'WRONG' } },
        'student-1',
      );
      expect(r2.level).toBe("O'rta daraja");

      // 3/3 = 100% → Qiyin daraja
      const r3 = await service.submitTest(
        { testResultId: 'result-1', answers: { q1: 'a', q2: 'b', q3: 'c' } },
        'student-1',
      );
      expect(r3.level).toBe('Qiyin daraja');
    });

    it('finishedAt va timeSpentSeconds saqlanadi', async () => {
      await service.submitTest(
        { testResultId: 'result-1', answers: { q1: 'a', q2: 'b', q3: 'c' } },
        'student-1',
      );

      expect(resultRepo.update).toHaveBeenCalledWith(
        'result-1',
        expect.objectContaining({
          finishedAt: expect.any(Date),
          timeSpentSeconds: expect.any(Number),
        }),
      );
    });

    // ─── ANTI-CHEAT ──────────────────────────────────────────────────────────

    it('anti-cheat: juda tez yakunlansa cheatingFlag=true (5s < min 24s)', async () => {
      // 3 savol × 8 soniya = 24 soniya talab qilinadi
      resultRepo.findOne.mockResolvedValue({
        ...mockResult,
        startedAt: new Date(Date.now() - 5_000), // faqat 5 soniya
      });

      const result = await service.submitTest(
        { testResultId: 'result-1', answers: { q1: 'a', q2: 'b', q3: 'c' } },
        'student-1',
      );

      expect(result.cheatingFlag).toBe(true);
    });

    it('anti-cheat: 30%+ savol < 2 soniyada javoblansa cheatingFlag=true', async () => {
      // 10 savoldan 4 tasi 1 soniyada (40% > 30% chegarasi)
      const tenQ = Array.from({ length: 10 }, (_, i) => ({
        id: `q${i}`, testId: 'test-1', correctAnswer: `ans${i}`, points: 1,
      }));
      questionRepo.findBy.mockResolvedValue(tenQ);
      resultRepo.findOne.mockResolvedValue({
        ...mockResult,
        test: { ...mockResult.test, questionsToShow: 10 },
      });

      const answers: Record<string, string> = {};
      tenQ.forEach((q) => { answers[q.id] = q.correctAnswer; });

      const questionTimes: Record<string, number> = {};
      tenQ.forEach((q, i) => { questionTimes[q.id] = i < 4 ? 1 : 20; }); // 4 ta 1 soniyada

      const result = await service.submitTest(
        { testResultId: 'result-1', answers, questionTimes },
        'student-1',
      );

      expect(result.cheatingFlag).toBe(true);
    });

    it('anti-cheat: normal vaqtda cheatingFlag=false', async () => {
      // 3 savol, har biri 20 soniyada → jami 60s > min 24s, birorta ham 2s dan kam emas
      const result = await service.submitTest(
        {
          testResultId: 'result-1',
          answers: { q1: 'a', q2: 'b', q3: 'c' },
          questionTimes: { q1: 20, q2: 20, q3: 20 },
        },
        'student-1',
      );

      expect(result.cheatingFlag).toBe(false);
    });
  });

  // ─── VAQT UZAYTIRISH SO'ROVI ───────────────────────────────────────────────
  describe('requestTimeExtension', () => {
    beforeEach(() => {
      testRepo.findOne.mockResolvedValue({ id: 'test-1', title: 'Ingliz tili 1' });
      extensionRepo.findOne.mockResolvedValue(null);
      userRepo.find.mockResolvedValue([{ id: 'teacher-1' }, { id: 'manager-1' }]);
      userRepo.findOne.mockResolvedValue({ firstName: 'Ali', lastName: 'Karimov' });
      extensionRepo.create.mockReturnValue({ id: 'ext-1', extraMinutes: 10 });
    });

    it('so\'rov muvaffaqiyatli yaratiladi', async () => {
      const result = await service.requestTimeExtension(
        { testId: 'test-1', extraMinutes: 10, reason: 'Sababli' } as any,
        'student-1',
      );

      expect(extensionRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('message');
      expect(notifRepo.save).toHaveBeenCalled();
    });

    it('test topilmasa NotFoundException', async () => {
      testRepo.findOne.mockResolvedValue(null);

      await expect(
        service.requestTimeExtension(
          { testId: 'no-test', extraMinutes: 5 } as any,
          'student-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('takroriy so\'rov ConflictException', async () => {
      extensionRepo.findOne.mockResolvedValue({ id: 'existing-ext', status: 'pending' });

      await expect(
        service.requestTimeExtension(
          { testId: 'test-1', extraMinutes: 5 } as any,
          'student-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── VAQT UZAYTIRISH TASDIQLASH/RAD ETISH ─────────────────────────────────
  describe('reviewExtension', () => {
    const pendingExt = { id: 'ext-1', status: ExtensionStatus.PENDING };

    it('extension tasdiqlanadi', async () => {
      extensionRepo.findOne.mockResolvedValue(pendingExt);

      const result = await service.reviewExtension('ext-1', true, 'actor-id', Role.USTOZ);

      expect(extensionRepo.update).toHaveBeenCalledWith(
        'ext-1',
        expect.objectContaining({ status: ExtensionStatus.APPROVED }),
      );
      expect(result.message).toContain('tasdiqlandi');
    });

    it('extension rad etiladi', async () => {
      extensionRepo.findOne.mockResolvedValue(pendingExt);

      const result = await service.reviewExtension('ext-1', false, 'actor-id', Role.USTOZ);

      expect(extensionRepo.update).toHaveBeenCalledWith(
        'ext-1',
        expect.objectContaining({ status: ExtensionStatus.REJECTED }),
      );
      expect(result.message).toBe('Rad etildi');
    });

    it('so\'rov topilmasa NotFoundException', async () => {
      extensionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reviewExtension('no-ext', true, 'actor-id', Role.USTOZ),
      ).rejects.toThrow(NotFoundException);
    });

    it('allaqachon ko\'rib chiqilgan so\'rov BadRequestException', async () => {
      extensionRepo.findOne.mockResolvedValue({
        id: 'ext-1',
        status: ExtensionStatus.APPROVED,
      });

      await expect(
        service.reviewExtension('ext-1', true, 'actor-id', Role.USTOZ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── O'QUVCHI NATIJALARI ───────────────────────────────────────────────────
  describe('getStudentResults', () => {
    it('o\'quvchi o\'z natijalarini ko\'radi', async () => {
      resultRepo.find.mockResolvedValue([{ id: 'r1', score: 80 }]);

      const result = await service.getStudentResults('student-1', 'student-1', Role.STUDENT);

      expect(resultRepo.find).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('o\'quvchi boshqa o\'quvchi natijasini ko\'rolmaydi', async () => {
      await expect(
        service.getStudentResults('other-student', 'my-id', Role.STUDENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('manager istalgan o\'quvchi natijasini ko\'radi', async () => {
      resultRepo.find.mockResolvedValue([{ id: 'r1', score: 90 }]);

      const result = await service.getStudentResults('any-student', 'manager-id', Role.MANAGER);

      expect(result).toHaveLength(1);
    });
  });

  // ─── SubmitTestDto VALIDATSIYA ─────────────────────────────────────────────
  describe('SubmitTestDto — class-validator', () => {
    it('to\'g\'ri DTO validatsiyadan o\'tadi', async () => {
      const dto = plainToInstance(SubmitTestDto, {
        testResultId: 'some-uuid',
        answers: { q1: 'a', q2: 'b' },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('answers array bo\'lsa @IsObject() xato qaytaradi', async () => {
      const dto = plainToInstance(SubmitTestDto, {
        testResultId: 'some-uuid',
        answers: ['a', 'b'], // array — noto'g'ri
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'answers')).toBe(true);
    });

    it('testResultId yo\'q bo\'lsa xato', async () => {
      const dto = plainToInstance(SubmitTestDto, {
        answers: { q1: 'a' },
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'testResultId')).toBe(true);
    });

    it('questionTimes string bo\'lsa @IsObject() xato qaytaradi', async () => {
      const dto = plainToInstance(SubmitTestDto, {
        testResultId: 'uuid',
        answers: { q1: 'a' },
        questionTimes: 'string-emas-object', // noto'g'ri
      });

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'questionTimes')).toBe(true);
    });

    it('ixtiyoriy maydonlar yo\'q bo\'lsa ham o\'tadi', async () => {
      const dto = plainToInstance(SubmitTestDto, {
        testResultId: 'uuid',
        answers: {},
        // startedAt va questionTimes yo'q
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
