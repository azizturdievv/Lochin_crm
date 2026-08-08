import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Book } from '../../entities/book.entity';
import { BookTest } from '../../entities/book-test.entity';
import { PointsAction } from '../../entities/points-log.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AiService, BookQuestion } from './ai.service';
import { PointsService } from './points.service';
import { BadgeService } from './badge.service';
import { CreateBookDto, AssignBookDto, SubmitBookTestDto } from './dto/gamification.dto';

const PASS_THRESHOLD = 80;    // 80% → o'tdi
const BOOK_PASS_POINTS = 50;  // 80%+ → +50 ball

@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book)
    private bookRepo: Repository<Book>,
    @InjectRepository(BookTest)
    private testRepo: Repository<BookTest>,
    private ai: AiService,
    private pointsService: PointsService,
    private badgeService: BadgeService,
    private auditLog: AuditLogService,
  ) {}

  // ─── KITOB QO'SHISH (SA) ──────────────────────────────────────────────────
  async create(dto: CreateBookDto, actorId: string, actorRole: string): Promise<Book> {
    const book = this.bookRepo.create({
      title: dto.title,
      author: dto.author ?? null,
      coverUrl: dto.coverUrl ?? null,
      fileUrl: dto.fileUrl ?? null,
      description: dto.description ?? null,
      assignedById: actorId,
      isActive: true,
    });
    await this.bookRepo.save(book);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'BOOK_CREATED',
      entityName: 'books',
      entityId: book.id,
      newValues: { title: dto.title },
    });

    return book;
  }

  // ─── OYGA TAYINLASH (SA) ───────────────────────────────────────────────────
  async assign(bookId: string, dto: AssignBookDto, actorId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Kitob topilmadi');

    // Bir oyda maksimal 2 ta kitob
    const monthCount = await this.bookRepo.count({
      where: { assignedMonth: dto.month, isActive: true },
    });
    if (monthCount >= 2) {
      throw new BadRequestException(`${dto.month} oyiga allaqachon 2 ta kitob tayinlangan`);
    }

    await this.bookRepo.update(bookId, {
      assignedMonth: dto.month,
      assignedById: actorId,
    });

    return (await this.bookRepo.findOne({ where: { id: bookId } }))!;
  }

  // ─── KITOBLAR RO'YXATI ────────────────────────────────────────────────────
  async findAll(month?: string): Promise<Book[]> {
    const where: FindOptionsWhere<Book> = { isActive: true };
    if (month) where.assignedMonth = month;
    return this.bookRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  // ─── JORIY OY KITOBLARI ───────────────────────────────────────────────────
  async getCurrentBooks(): Promise<Book[]> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return this.findAll(month);
  }

  // ─── AI TEST YARATISH (SA) ─────────────────────────────────────────────────
  async generateTest(bookId: string, actorId: string, actorRole: string): Promise<{ bookId: string; questions: BookQuestion[] }> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Kitob topilmadi');

    const questions = await this.ai.generateBookQuestions(
      book.title,
      book.description ?? '',
      10,
    );

    // Yaratilgan savollarni saqlaymiz (foydalanuvchisiz — template sifatida)
    // Har foydalanuvchi test boshlaganda nusxa olinadi
    // Kitoб entity ga savollarni qo'shish o'rniga alohida saqlaymiz
    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'BOOK_TEST_GENERATED',
      entityName: 'books',
      entityId: bookId,
    });

    return { bookId, questions };
  }

  // ─── TEST BOSHLASH ─────────────────────────────────────────────────────────
  async startTest(bookId: string, userId: string): Promise<BookTest> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Kitob topilmadi');

    // Allaqachon o'tilganmi
    const existing = await this.testRepo.findOne({
      where: { bookId, userId, passed: true },
    });
    if (existing) {
      throw new ConflictException('Bu kitob testini allaqachon muvaffaqiyatli topshirgansiz');
    }

    // Aktiv test bormi (completedAt bo'yicha filtr shart emas — TypeORM
    // undefined qiymatli kalitlarni WHERE'dan chetlab o'tadi, keyingi qatorda
    // JS darajasida tekshiriladi)
    const active = await this.testRepo.findOne({
      where: { bookId, userId },
    });
    if (active?.completedAt === null) {
      return active; // Mavjud testni davom ettirish
    }

    // AI yordamida savollar yaratish
    const questions = await this.ai.generateBookQuestions(
      book.title,
      book.description ?? '',
      10,
    );

    const test = this.testRepo.create({
      bookId,
      userId,
      questions,
      score: null,
      passed: false,
      completedAt: null,
    });

    await this.testRepo.save(test);
    return test;
  }

  // ─── TEST TOPSHIRISH ───────────────────────────────────────────────────────
  async submitTest(testId: string, dto: SubmitBookTestDto, userId: string): Promise<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    pointsEarned: number;
  }> {
    const test = await this.testRepo.findOne({ where: { id: testId, userId } });
    if (!test) throw new NotFoundException('Test topilmadi');
    if (test.completedAt) throw new ConflictException('Bu test allaqachon topshirilgan');

    // Ball hisoblash
    let correct = 0;
    const total = test.questions.length;

    for (let i = 0; i < total; i++) {
      const question = test.questions[i];
      const userAnswer = dto.answers[String(i)];
      if (userAnswer === question.correctAnswer) {
        correct++;
      }
    }

    const score = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
    const passed = score >= PASS_THRESHOLD;
    let pointsEarned = 0;

    await this.testRepo.update(testId, {
      score,
      passed,
      completedAt: new Date(),
    });

    // 80%+ → +50 ball
    if (passed) {
      await this.pointsService.award({
        userId,
        action: PointsAction.BOOK_PASSED,
        points: BOOK_PASS_POINTS,
        description: `Kitob testi: ${test.bookId} — ${score}%`,
        referenceId: testId,
        referenceType: 'book_test',
      });
      pointsEarned = BOOK_PASS_POINTS;

      // Badge tekshirish
      this.badgeService.checkAndAward(userId).catch(() => {});
    }

    return { score, passed, correctCount: correct, totalQuestions: total, pointsEarned };
  }

  // ─── KITOB STATISTIKASI ────────────────────────────────────────────────────
  async getStats(bookId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Kitob topilmadi');

    const tests = await this.testRepo.find({ where: { bookId } });
    const completed = tests.filter((t) => t.completedAt);
    const passed = completed.filter((t) => t.passed);
    const avgScore = completed.length
      ? Math.round(completed.reduce((s, t) => s + Number(t.score ?? 0), 0) / completed.length * 10) / 10
      : 0;

    return {
      bookId,
      title: book.title,
      totalAttempts: tests.length,
      completed: completed.length,
      passed: passed.length,
      passRate: completed.length > 0 ? Math.round((passed.length / completed.length) * 100) : 0,
      avgScore,
    };
  }

  // ─── FOYDALANUVCHI KITOB TARIXI ───────────────────────────────────────────
  async getUserTests(userId: string) {
    return this.testRepo.find({
      where: { userId },
      relations: { book: true },
      order: { createdAt: 'DESC' },
    });
  }
}
