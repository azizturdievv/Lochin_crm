import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { SpellingError } from '../../entities/spelling-error.entity';
import { Message } from '../../entities/message.entity';
import { User } from '../../entities/user.entity';
import { PointsLog, PointsAction } from '../../entities/points-log.entity';
import { Role } from '../../common/enums/role.enum';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export type SpellingCheckResult = {
  errors: Array<{
    original:    string;
    suggestions: string[];
    context:     string;
  }>;
  qualityScore:  number;   // 0-100
  isClean:       boolean;
  exerciseSets?: string[]; // o'quvchi uchun mashq gaplari
};

@Injectable()
export class SpellingService {
  private readonly logger = new Logger(SpellingService.name);

  private get apiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  }

  constructor(
    @InjectRepository(SpellingError)
    private errorRepo: Repository<SpellingError>,
    @InjectRepository(Message)
    private messageRepo: Repository<Message>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PointsLog)
    private pointsRepo: Repository<PointsLog>,
    private dataSource: DataSource,
  ) {}

  // ─── XABARNI TEKSHIRISH VA SAQLASH ────────────────────────────────────────
  async checkAndSave(
    text: string,
    senderId: string,
    senderRole: string,
    messageId?: string,
  ): Promise<SpellingCheckResult> {
    if (!text?.trim()) return { errors: [], qualityScore: 100, isClean: true };

    const result = await this.analyzeWithAI(text, senderRole === Role.STUDENT);

    if (result.errors.length === 0) {
      // Xatosiz xabar — xodimga +2 ball
      if (senderRole === Role.USTOZ || senderRole === Role.MANAGER) {
        await this.addPoints(senderId, PointsAction.SPELLING_CORRECT, 2,
          'Xatosiz xabar');
      } else if (senderRole === Role.STUDENT) {
        await this.addPoints(senderId, PointsAction.CORRECT_MESSAGE, 3,
          'Xatosiz xabar (+3)');
      }
      return result;
    }

    // Xatolarni saqlash + jazo ballari (xodimlar uchun)
    await this.dataSource.transaction(async (em) => {
      for (const err of result.errors) {
        const entity = em.create(SpellingError, {
          messageId:    messageId ?? null,
          senderId,
          originalText: err.original,
          suggestions:  err.suggestions,
          context:      err.context,
          wasCorrected: false,
          checkedAt:    new Date(),
        });
        await em.save(entity);
      }

      // Message.spellingErrors sonini yangilash
      if (messageId) {
        await em.update(Message, messageId, {
          spellingErrors: result.errors.length,
        });
      }

      // Xodim uchun ball jazo: xato soni × 3
      if (senderRole === Role.USTOZ || senderRole === Role.MANAGER) {
        await em.save(em.create(PointsLog, {
          userId:      senderId,
          action:      PointsAction.SPELLING_ERROR,
          points:      -(result.errors.length * 3),
          description: `Imlo xatosi: ${result.errors.map((e) => e.original).join(', ')}`,
        }));

        // User.totalPoints yangilash
        const user = await em.findOne(User, { where: { id: senderId } });
        if (user) {
          const newTotal = Math.max(0, user.totalPoints - result.errors.length * 3);
          await em.update(User, senderId, { totalPoints: newTotal });
        }
      }
    });

    return result;
  }

  // ─── O'QUVCHI XATONI TUZATDI ─────────────────────────────────────────────
  async markCorrected(errorId: string, studentId: string): Promise<{ points: number }> {
    const error = await this.errorRepo.findOne({
      where: { id: errorId, senderId: studentId },
    });
    if (!error || error.wasCorrected) return { points: 0 };

    await this.dataSource.transaction(async (em) => {
      await em.update(SpellingError, errorId, {
        wasCorrected: true,
        correctedAt:  new Date(),
      });
      // O'quvchi o'zi tuzatsa +5 ball
      await em.save(em.create(PointsLog, {
        userId:      studentId,
        action:      PointsAction.SELF_CORRECT,
        points:      5,
        description: `O'zi tuzatdi: "${error.originalText}" → "${error.suggestions[0] ?? '?'}"`,
        referenceId: errorId,
        referenceType: 'spelling_error',
      }));
      const user = await em.findOne(User, { where: { id: studentId } });
      if (user) {
        await em.update(User, studentId, { totalPoints: user.totalPoints + 5 });
      }
    });

    return { points: 5 };
  }

  // ─── FOYDALANUVCHI IMLO XATOLARI ──────────────────────────────────────────
  async getUserErrors(
    userId: string,
    dateFrom?: Date,
    limit = 20,
  ): Promise<SpellingError[]> {
    const qb = this.errorRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.message', 'm')
      .where('e.sender_id = :userId', { userId })
      .andWhere('e.deleted_at IS NULL');

    if (dateFrom) qb.andWhere('e.checked_at >= :from', { from: dateFrom });

    return qb.orderBy('e.checked_at', 'DESC').take(limit).getMany();
  }

  // ─── BARCHA XODIM IMLO STATISTIKASI (SA uchun) ────────────────────────────
  async getStaffSpellingStats(
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Array<{
    userId:     string;
    firstName:  string;
    lastName:   string;
    role:       string;
    errorCount: number;
    topErrors:  string[];
    trend:      number; // o'tgan davr bilan solishtirish %
  }>> {
    const rows = await this.errorRepo
      .createQueryBuilder('e')
      .select('e.sender_id', 'userId')
      .addSelect('COUNT(*)', 'errorCount')
      .addSelect('array_agg(e.original_text ORDER BY e.checked_at DESC)', 'allErrors')
      .where('e.checked_at BETWEEN :from AND :to', { from: dateFrom, to: dateTo })
      .andWhere('e.deleted_at IS NULL')
      .groupBy('e.sender_id')
      .orderBy('"errorCount"', 'DESC')
      .getRawMany<{ userId: string; errorCount: string; allErrors: string[] }>();

    // Avvalgi davr uchun
    const prevDiff  = dateTo.getTime() - dateFrom.getTime();
    const prevFrom  = new Date(dateFrom.getTime() - prevDiff);
    const prevTo    = dateFrom;

    const prevRows  = await this.errorRepo
      .createQueryBuilder('e')
      .select('e.sender_id', 'userId')
      .addSelect('COUNT(*)', 'prevCount')
      .where('e.checked_at BETWEEN :from AND :to', { from: prevFrom, to: prevTo })
      .groupBy('e.sender_id')
      .getRawMany<{ userId: string; prevCount: string }>();

    const prevMap = new Map(prevRows.map((r) => [r.userId, Number(r.prevCount)]));

    // Foydalanuvchi ma'lumotlarini qo'shish
    const userIds = rows.map((r) => r.userId);
    const users   = userIds.length
      ? await this.userRepo.findBy({ id: In(userIds) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows
      .filter((r) => {
        const u = userMap.get(r.userId);
        return u && (u.role === Role.USTOZ || u.role === Role.MANAGER);
      })
      .map((r) => {
        const user      = userMap.get(r.userId)!;
        const curr      = Number(r.errorCount);
        const prev      = prevMap.get(r.userId) ?? 0;
        const trend     = prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);
        // Eng ko'p uchraydigan xatolar (top 5, unikal)
        const unique    = [...new Set(r.allErrors ?? [])].slice(0, 5);
        return {
          userId:     r.userId,
          firstName:  user.firstName,
          lastName:   user.lastName,
          role:       user.role,
          errorCount: curr,
          topErrors:  unique,
          trend,
        };
      });
  }

  // ─── MULOQOT SIFATI TAHLILI (SA / Manager uchun) ──────────────────────────
  async analyzeConversationQuality(
    userId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<{
    qualityScore:    number;
    totalMessages:   number;
    errorsCount:     number;
    avgErrorPerMsg:  number;
    flaggedMessages: number;
    topMistakes:     string[];
    aiInsight:       string;
  }> {
    const [messages, errors] = await Promise.all([
      this.messageRepo
        .createQueryBuilder('m')
        .where('m.sender_id = :userId', { userId })
        .andWhere('m.created_at BETWEEN :from AND :to', { from: dateFrom, to: dateTo })
        .andWhere('m.type = :type', { type: 'text' })
        .andWhere('m.is_deleted = false')
        .getCount(),

      this.errorRepo
        .createQueryBuilder('e')
        .select('e.original_text', 'original')
        .where('e.sender_id = :userId', { userId })
        .andWhere('e.checked_at BETWEEN :from AND :to', { from: dateFrom, to: dateTo })
        .getRawMany<{ original: string }>(),
    ]);

    const errorsCount    = errors.length;
    const totalMessages  = messages;
    const avgErrorPerMsg = totalMessages > 0
      ? Math.round((errorsCount / totalMessages) * 100) / 100
      : 0;

    // Sifat balli: 100 — (xato_darajasi × 30)
    const errorRate  = totalMessages > 0 ? errorsCount / totalMessages : 0;
    const qualityScore = Math.max(0, Math.round(100 - errorRate * 30 * 100));

    const topMistakes = [...new Set(errors.map((e) => e.original))].slice(0, 5);

    const flaggedMessages = await this.messageRepo.count({
      where: { senderId: userId },
    });

    // AI tahlili (qisqa)
    const aiInsight = await this.getAiQualityInsight(
      qualityScore, errorsCount, totalMessages, topMistakes,
    );

    return {
      qualityScore,
      totalMessages,
      errorsCount,
      avgErrorPerMsg,
      flaggedMessages: 0, // moderationFlag bo'lganlar
      topMistakes,
      aiInsight,
    };
  }

  // ─── AI TAHLIL (OpenAI) ────────────────────────────────────────────────────
  private async analyzeWithAI(
    text: string,
    includeExercises: boolean,
  ): Promise<SpellingCheckResult> {
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY sozlanmagan — imlo tekshiruvi o\'tkazildi');
      return { errors: [], qualityScore: 100, isClean: true };
    }

    const sysPrompt = `Siz O'zbek va Rus tili imlo tekshiruvchisisiz.
Berilgan matnda imlo va grammatik xatolarni toping.
JSON formatda javob bering (boshqa hech narsa yozmang):
{
  "errors": [
    {
      "original": "xato so'z/ibora",
      "suggestions": ["to'g'ri variant 1", "to'g'ri variant 2"],
      "context": "xato joylashgan gap"
    }
  ],
  "qualityScore": 0-100,
  ${includeExercises ? '"exerciseSets": ["To\'g\'ri so\'z ishlatilgan mashq gap 1", "mashq gap 2", "mashq gap 3"],' : ''}
  "isClean": true/false
}
Agar xato yo'q bo'lsa errors=[], isClean=true.`;

    try {
      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model:       'gpt-4o-mini',
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user',   content: text },
          ],
          temperature:  0.1,
          max_tokens:   800,
        }),
      });

      if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);

      const data = await resp.json() as {
        choices: Array<{ message: { content: string } }>;
      };
      const raw = data.choices[0]?.message?.content ?? '{}';
      return JSON.parse(raw) as SpellingCheckResult;
    } catch (err) {
      this.logger.error(`AI imlo tahlil xato: ${err}`);
      return { errors: [], qualityScore: 100, isClean: true };
    }
  }

  // ─── AI MULOQOT SIFATI IZOHI ──────────────────────────────────────────────
  private async getAiQualityInsight(
    score:       number,
    errors:      number,
    messages:    number,
    topMistakes: string[],
  ): Promise<string> {
    if (!this.apiKey || messages === 0) {
      return score >= 80
        ? 'Muloqot sifati yaxshi darajada.'
        : 'Imlo xatolarini kamaytirish tavsiya etiladi.';
    }

    try {
      const prompt = `Xodim muloqot sifati: ball ${score}/100, ${messages} ta xabar, ${errors} ta xato.
Eng ko'p xatolar: ${topMistakes.join(', ') || 'yo\'q'}.
2 jumlada O'zbek tilida qisqa tavsiya ber.`;

      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model:      'gpt-4o-mini',
          messages:   [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.4,
        }),
      });

      if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
      const data = await resp.json() as {
        choices: Array<{ message: { content: string } }>;
      };
      return data.choices[0]?.message?.content?.trim() ?? '';
    } catch {
      return score >= 80
        ? 'Muloqot sifati yaxshi darajada.'
        : 'Imlo xatolarini kamaytirish tavsiya etiladi.';
    }
  }

  // ─── YORDAMCHI: BALL QO'SHISH ─────────────────────────────────────────────
  private async addPoints(userId: string, action: PointsAction, points: number, desc: string) {
    try {
      const log = this.pointsRepo.create({ userId, action, points, description: desc });
      await this.pointsRepo.save(log);
      await this.userRepo.increment({ id: userId }, 'totalPoints', points);
    } catch (err) {
      this.logger.error(`Ball qo'shish xato (${userId}): ${err}`);
    }
  }
}
