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
      rank: number;
      participantId: string;
      studentName: string;
      score: number | null;
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
      .orderBy('p.score', 'DESC', 'NULLS LAST')
      .addOrderBy('p.registered_at', 'ASC')
      .getMany();

    const submissions = await this.submissionRepo.find({
      where: { eventId },
      select: { participantId: true, submittedAt: true },
    });
    const subMap = new Map(submissions.map((s) => [s.participantId, s.submittedAt]));

    const ranked = participants.map((p, i) => ({
      rank:          i + 1,
      participantId: p.id,
      studentName:   `${p.student.firstName} ${p.student.lastName}`,
      score:         p.score !== null ? Number(p.score) : null,
      submittedAt:   subMap.get(p.id) ?? null,
    }));

    return {
      participants:    ranked,
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

    // Ishtirokchilarni natijalarga qarab saralash
    const participants = await this.participantRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.student', 's')
      .where('p.event_id = :eventId', { eventId })
      .andWhere('p.score IS NOT NULL')
      .andWhere('p.deleted_at IS NULL')
      .orderBy('p.score', 'DESC')
      .getMany();

    await this.dataSource.transaction(async (em) => {
      // O'rinlarni belgilash
      for (let i = 0; i < participants.length; i++) {
        await em.update(EventParticipant, participants[i].id, { place: i + 1 });
      }

      // Natijalar xulosasi
      const winners = participants.slice(0, 3).map((p, i) => ({
        place:  i + 1,
        name:   `${p.student.firstName} ${p.student.lastName}`,
        score:  Number(p.score),
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
