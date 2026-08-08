import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Event, CompetitionStatus } from '../../entities/event.entity';
import { EventParticipant, ParticipantPaymentStatus } from '../../entities/event-participant.entity';
import { EventQuestion } from '../../entities/event-question.entity';
import { EventSubmission } from '../../entities/event-submission.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../../common/enums/role.enum';
import { CreateQuestionDto, BulkCreateQuestionsDto, SubmitAnswersDto } from './dto/event.dto';

@Injectable()
export class CompetitionService {
  private readonly logger = new Logger(CompetitionService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(EventParticipant)
    private participantRepo: Repository<EventParticipant>,
    @InjectRepository(EventQuestion)
    private questionRepo: Repository<EventQuestion>,
    @InjectRepository(EventSubmission)
    private submissionRepo: Repository<EventSubmission>,
    private dataSource: DataSource,
    private auditLog: AuditLogService,
  ) {}

  // ─── SAVOL QO'SHISH ───────────────────────────────────────────────────────
  async addQuestion(
    eventId: string,
    dto: CreateQuestionDto,
    actorId: string,
    actorRole: string,
  ): Promise<EventQuestion> {
    const event = await this.requireEvent(eventId);

    if (event.competitionStatus !== CompetitionStatus.NOT_STARTED) {
      throw new BadRequestException('Boshlangan yoki tugagan musobaqaga savol qo\'shib bo\'lmaydi');
    }

    // Javob varianti to'g'riligini tekshirish
    const validIds = dto.options.map((o) => o.id);
    if (!validIds.includes(dto.correctAnswer)) {
      throw new BadRequestException('correctAnswer options ichida bo\'lishi shart');
    }

    const question = this.questionRepo.create({
      eventId,
      question:      dto.question,
      options:       dto.options,
      correctAnswer: dto.correctAnswer,
      points:        dto.points ?? 1,
      sortOrder:     dto.sortOrder ?? 0,
    });

    const saved = await this.questionRepo.save(question);

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'QUESTION_ADDED',
      entityName:'event_questions',
      entityId:  saved.id,
      newValues: { eventId },
    });

    return saved;
  }

  // ─── SAVOLLARNI BO'LISHTIRIB QO'SHISH ────────────────────────────────────
  async bulkAddQuestions(
    eventId: string,
    dto: BulkCreateQuestionsDto,
    actorId: string,
    actorRole: string,
  ): Promise<EventQuestion[]> {
    const event = await this.requireEvent(eventId);

    if (event.competitionStatus !== CompetitionStatus.NOT_STARTED) {
      throw new BadRequestException('Boshlangan musobaqaga savol qo\'shib bo\'lmaydi');
    }

    for (const q of dto.questions) {
      const validIds = q.options.map((o) => o.id);
      if (!validIds.includes(q.correctAnswer)) {
        throw new BadRequestException(`"${q.question.slice(0, 30)}..." savolida correctAnswer noto'g'ri`);
      }
    }

    const questions = dto.questions.map((q, i) =>
      this.questionRepo.create({
        eventId,
        question:      q.question,
        options:       q.options,
        correctAnswer: q.correctAnswer,
        points:        q.points ?? 1,
        sortOrder:     q.sortOrder ?? i,
      }),
    );

    const saved = await this.questionRepo.save(questions);

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'QUESTIONS_BULK_ADDED',
      entityName:'event_questions',
      entityId:  eventId,
      newValues: { count: saved.length },
    });

    return saved;
  }

  // ─── MUSOBAQANI BOSHLASH ──────────────────────────────────────────────────
  async start(eventId: string, actorId: string, actorRole: string): Promise<Event> {
    const event = await this.requireEvent(eventId);

    if (!event.isOnline) {
      throw new BadRequestException('Faqat onlayn musobaqalar boshlanadi');
    }
    if (event.competitionStatus !== CompetitionStatus.NOT_STARTED) {
      throw new BadRequestException('Musobaqa allaqachon boshlangan yoki tugagan');
    }

    const qCount = await this.questionRepo.count({ where: { eventId } });
    if (qCount === 0) {
      throw new BadRequestException('Savollar yo\'q. Avval savol qo\'shing');
    }

    await this.eventRepo.update(eventId, {
      competitionStatus: CompetitionStatus.ONGOING,
    });

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'COMPETITION_STARTED',
      entityName:'events',
      entityId:  eventId,
    });

    this.logger.log(`Musobaqa boshlandi: ${event.title}`);
    return this.requireEvent(eventId);
  }

  // ─── ISHTIROKCHIGA RANDOM SAVOLLAR ────────────────────────────────────────
  // Javoblar ko'rsatilmaydi (anti-cheat)
  async getQuestions(
    eventId: string,
    participantId: string,
  ): Promise<{
    questions: Omit<EventQuestion, 'correctAnswer'>[];
    timeLimit: number;
    startedAt: string;
  }> {
    const event = await this.requireEvent(eventId);

    if (event.competitionStatus !== CompetitionStatus.ONGOING) {
      throw new BadRequestException('Musobaqa hali boshlanmagan yoki tugagan');
    }

    // Ro'yxatdan o'tganmi?
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, eventId },
    });
    if (!participant) throw new ForbiddenException('Siz bu musobaqaga ro\'yxatdan o\'tmagansiz');
    if (participant.paymentStatus === ParticipantPaymentStatus.PENDING) {
      throw new ForbiddenException('To\'lov tasdiqlanmagan');
    }

    // Allaqachon javob yuborganmi?
    const existing = await this.submissionRepo.findOne({
      where: { eventId, participantId },
    });
    if (existing?.submittedAt) {
      throw new BadRequestException('Allaqachon javob yuborgansiz');
    }

    const allQuestions = await this.questionRepo.find({ where: { eventId } });

    // Fisher-Yates aralashtirish
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(event.questionCount, shuffled.length));

    // correctAnswer ni olib tashlaymiz
    const sanitized = selected.map(({ correctAnswer: _c, ...q }) => q);

    return {
      questions:  sanitized as Omit<EventQuestion, 'correctAnswer'>[],
      timeLimit:  event.timeLimit,
      startedAt:  new Date().toISOString(),
    };
  }

  // ─── JAVOBLARNI QABUL QILISH VA BAHOLASH ─────────────────────────────────
  async submitAnswers(
    eventId: string,
    participantId: string,
    dto: SubmitAnswersDto,
    actorId: string,
  ): Promise<{ score: number; totalPoints: number; correctCount: number }> {
    const event = await this.requireEvent(eventId);

    if (event.competitionStatus !== CompetitionStatus.ONGOING) {
      throw new BadRequestException('Musobaqa aktiv emas');
    }

    const participant = await this.participantRepo.findOne({
      where: { id: participantId, eventId },
    });
    if (!participant) throw new ForbiddenException('Ishtirokchi topilmadi');

    const existingSub = await this.submissionRepo.findOne({
      where: { eventId, participantId },
    });
    if (existingSub?.submittedAt) {
      throw new BadRequestException('Javoblar allaqachon yuborilgan');
    }

    // Savollarni olib baholash
    const questions = await this.questionRepo.find({ where: { eventId } });
    const qMap = new Map(questions.map((q) => [q.id, q]));

    let score        = 0;
    let totalPoints  = 0;
    let correctCount = 0;

    for (const ans of dto.answers) {
      const q = qMap.get(ans.questionId);
      if (!q) continue;
      totalPoints += q.points;
      if (ans.answer === q.correctAnswer) {
        score += q.points;
        correctCount++;
      }
    }

    await this.dataSource.transaction(async (em) => {
      if (existingSub) {
        await em.update(EventSubmission, existingSub.id, {
          answers:     dto.answers,
          score,
          submittedAt: new Date(),
          timeTaken:   dto.timeTaken ?? null,
        });
      } else {
        const sub = em.create(EventSubmission, {
          eventId,
          participantId,
          answers:     dto.answers,
          score,
          submittedAt: new Date(),
          timeTaken:   dto.timeTaken ?? null,
        });
        await em.save(sub);
      }

      await em.update(EventParticipant, participantId, { score });
    });

    this.logger.log(`Javob qabul qilindi: participant=${participantId}, score=${score}/${totalPoints}`);
    return { score, totalPoints, correctCount };
  }

  // ─── JONLI NATIJALAR (leaderboard) ────────────────────────────────────────
  async getLeaderboard(eventId: string): Promise<{
    participants: Array<{
      rank: number | null;
      participantId: string;
      studentName: string;
      score: number | null;
      timeTaken: number | null;
      submittedAt: Date | null;
    }>;
    totalSubmitted: number;
    totalRegistered: number;
  }> {
    await this.requireEvent(eventId);

    const participants = await this.participantRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.student', 's')
      .where('p.event_id = :eventId', { eventId })
      .andWhere('p.deleted_at IS NULL')
      .getMany();

    const submissions = await this.submissionRepo.find({
      where: { eventId },
      select: { participantId: true, submittedAt: true, timeTaken: true },
    });
    const subMap = new Map(submissions.map((s) => [s.participantId, s]));

    // Ball qo'ygan va qo'ymagan ishtirokchilarni ajratamiz — ball yo'q bo'lsa
    // hali reytingda emas (rank: null), oxirida ko'rsatiladi
    const withScore = participants.filter((p) => p.score !== null);
    const withoutScore = participants.filter((p) => p.score === null);

    const placeById = this.computeRanking(
      withScore.map((p) => ({
        id:        p.id,
        score:     Number(p.score),
        timeTaken: subMap.get(p.id)?.timeTaken ?? null,
      })),
    );

    const rankedWithScore = [...withScore]
      .sort((a, b) => (placeById.get(a.id) ?? 0) - (placeById.get(b.id) ?? 0))
      .map((p) => ({
        rank:          placeById.get(p.id) ?? null,
        participantId: p.id,
        studentName:   `${p.student.firstName} ${p.student.lastName}`,
        score:         Number(p.score),
        timeTaken:     subMap.get(p.id)?.timeTaken ?? null,
        submittedAt:   subMap.get(p.id)?.submittedAt ?? null,
      }));

    const rankedWithoutScore = withoutScore.map((p) => ({
      rank:          null,
      participantId: p.id,
      studentName:   `${p.student.firstName} ${p.student.lastName}`,
      score:         null,
      timeTaken:     null,
      submittedAt:   null,
    }));

    return {
      participants:    [...rankedWithScore, ...rankedWithoutScore],
      totalSubmitted:  submissions.filter((s) => s.submittedAt).length,
      totalRegistered: participants.length,
    };
  }

  // ─── MUSOBAQANI YAKUNLASH ─────────────────────────────────────────────────
  async finish(eventId: string, actorId: string, actorRole: string): Promise<Event> {
    const event = await this.requireEvent(eventId);

    if (event.competitionStatus !== CompetitionStatus.ONGOING) {
      throw new BadRequestException('Musobaqa aktiv emas');
    }

    const participants = await this.participantRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.student', 's')
      .where('p.event_id = :eventId', { eventId })
      .andWhere('p.score IS NOT NULL')
      .andWhere('p.deleted_at IS NULL')
      .getMany();

    const submissions = await this.submissionRepo.find({
      where: { eventId },
      select: { participantId: true, timeTaken: true },
    });
    const timeById = new Map(submissions.map((s) => [s.participantId, s.timeTaken]));

    // Reyting: ball bo'yicha kamayish, teng bo'lsa sarflangan vaqt bo'yicha
    // o'sish (tezroq — yuqori o'rin). Teng ball VA teng vaqt — bir xil o'rin.
    const placeById = this.computeRanking(
      participants.map((p) => ({
        id:        p.id,
        score:     Number(p.score),
        timeTaken: timeById.get(p.id) ?? null,
      })),
    );

    const sortedParticipants = [...participants].sort(
      (a, b) => (placeById.get(a.id) ?? 0) - (placeById.get(b.id) ?? 0),
    );

    await this.dataSource.transaction(async (em) => {
      for (const p of participants) {
        await em.update(EventParticipant, p.id, { place: placeById.get(p.id) ?? null });
      }

      // Natijalar xulosasi — 1-3 o'ringa TUSHGAN HAMMA ishtirokchi (teng
      // ball+vaqt bo'lsa bir nechtasi bir xil o'rinni egallashi mumkin —
      // eski kod .slice(0,3) bilan bunday holatda birini o'zboshimchalik
      // bilan tashlab yuborardi)
      const winners = sortedParticipants
        .filter((p) => (placeById.get(p.id) ?? Infinity) <= 3)
        .map((p) => ({
          place:     placeById.get(p.id)!,
          name:      `${p.student.firstName} ${p.student.lastName}`,
          score:     Number(p.score),
          timeTaken: timeById.get(p.id) ?? null,
        }));

      await em.update(Event, eventId, {
        competitionStatus: CompetitionStatus.FINISHED,
        results: {
          winners,
          totalParticipants: participants.length,
          finishedAt: new Date().toISOString(),
        },
      });
    });

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'COMPETITION_FINISHED',
      entityName:'events',
      entityId:  eventId,
      newValues: { participantCount: participants.length },
    });

    this.logger.log(`Musobaqa yakunlandi: ${event.title}, ${participants.length} ishtirokchi`);
    return this.requireEvent(eventId);
  }

  // ─── YORDAMCHI: musobaqa reytingi ─────────────────────────────────────────
  // Standart musobaqa reytingi ("1,2,2,4"): ball bo'yicha kamayish, teng
  // bo'lsa sarflangan vaqt bo'yicha o'sish (tezroq yaxshi); vaqt yozilmagan
  // bo'lsa eng sekin deb hisoblanadi. Ball VA vaqt bo'yicha aynan teng
  // bo'lganlar bir xil o'rinni egallaydi, keyingisi ular sonini hisobga olib
  // sakraydi (masalan ikki kishi 2-o'rinda bo'lsa, keyingisi 4-o'rin bo'ladi).
  private computeRanking(
    entries: { id: string; score: number; timeTaken: number | null }[],
  ): Map<string, number> {
    const TIME_INF = Number.MAX_SAFE_INTEGER;
    const sorted = [...entries].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.timeTaken ?? TIME_INF) - (b.timeTaken ?? TIME_INF);
    });

    const placeById = new Map<string, number>();
    let lastScore: number | null = null;
    let lastTime: number | null = null;
    let lastPlace = 0;

    sorted.forEach((entry, i) => {
      const tied = i > 0 && entry.score === lastScore && entry.timeTaken === lastTime;
      const place = tied ? lastPlace : i + 1;
      placeById.set(entry.id, place);
      lastScore = entry.score;
      lastTime = entry.timeTaken;
      lastPlace = place;
    });

    return placeById;
  }

  // ─── SAVOLLAR RO'YXATI (admin uchun, to'liq) ──────────────────────────────
  async listQuestions(eventId: string): Promise<EventQuestion[]> {
    await this.requireEvent(eventId);
    return this.questionRepo.find({
      where: { eventId },
      order: { sortOrder: 'ASC' },
    });
  }

  // ─── SAVOLNI O'CHIRISH ────────────────────────────────────────────────────
  async removeQuestion(
    eventId: string,
    questionId: string,
    actorId: string,
    actorRole: string,
  ): Promise<{ message: string }> {
    const event = await this.requireEvent(eventId);

    if (event.competitionStatus !== CompetitionStatus.NOT_STARTED) {
      throw new BadRequestException('Boshlangan musobaqadan savol o\'chirib bo\'lmaydi');
    }

    const question = await this.questionRepo.findOne({ where: { id: questionId, eventId } });
    if (!question) throw new NotFoundException('Savol topilmadi');

    await this.questionRepo.softDelete(questionId);

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'QUESTION_REMOVED',
      entityName:'event_questions',
      entityId:  questionId,
    });

    return { message: 'Savol o\'chirildi' };
  }

  // ─── YORDAMCHI ────────────────────────────────────────────────────────────
  private async requireEvent(eventId: string): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Tadbir topilmadi');
    return event;
  }
}
