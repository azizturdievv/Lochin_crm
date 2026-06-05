import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VocabularyWord } from '../../entities/vocabulary-word.entity';
import { PointsAction } from '../../entities/points-log.entity';
import { AiService } from './ai.service';
import { PointsService } from './points.service';
import { BadgeService } from './badge.service';
import { AddWordDto, SubmitVocabTestDto } from './dto/gamification.dto';

const WEEKLY_TEST_SIZE = 10;       // Haftalik testda nechta so'z
const MASTERY_THRESHOLD = 3;       // 3 ta to'g'ri → mastered
const VOCAB_TEST_POINTS = 5;       // Haftalik test uchun har to'g'ri javob

@Injectable()
export class VocabularyService {
  constructor(
    @InjectRepository(VocabularyWord)
    private wordRepo: Repository<VocabularyWord>,
    private ai: AiService,
    private pointsService: PointsService,
    private badgeService: BadgeService,
  ) {}

  // ─── SO'Z QO'SHISH ────────────────────────────────────────────────────────
  async addWord(dto: AddWordDto, userId: string): Promise<VocabularyWord> {
    // Takroriy so'z tekshirish
    const existing = await this.wordRepo.findOne({
      where: { studentId: userId, word: dto.word.trim().toLowerCase() },
    });
    if (existing) throw new ConflictException('Bu so\'z allaqachon lug\'atda bor');

    const word = this.wordRepo.create({
      studentId: userId,
      word: dto.word.trim().toLowerCase(),
      language: dto.language ?? 'uz',
      userDefinition: dto.userDefinition ?? null,
      aiDefinition: null,
      exampleSentence: null,
      mastered: false,
      correctCount: 0,
      wrongCount: 0,
    });

    await this.wordRepo.save(word);

    // AI ta'rifini orqa fonda olish
    this.generateDefinition(word.id, word.word, word.language).catch(() => {});

    return word;
  }

  // ─── AI TA'RIF YARATISH (yoki yangilash) ──────────────────────────────────
  async generateDefinition(wordId: string, wordText: string, language: string): Promise<VocabularyWord> {
    const { definition, exampleSentence } = await this.ai.generateWordDefinition(wordText, language);

    await this.wordRepo.update(wordId, {
      aiDefinition: definition,
      exampleSentence,
    });

    return (await this.wordRepo.findOne({ where: { id: wordId } }))!;
  }

  // ─── FOYDALANUVCHI LUG'ATI ────────────────────────────────────────────────
  async getWords(
    userId: string,
    opts: { language?: string; mastered?: boolean; page?: number; limit?: number },
  ) {
    const qb = this.wordRepo
      .createQueryBuilder('w')
      .where('w.student_id = :uid', { uid: userId })
      .andWhere('w.deleted_at IS NULL');

    if (opts.language) qb.andWhere('w.language = :lang', { lang: opts.language });
    if (opts.mastered !== undefined) qb.andWhere('w.mastered = :m', { m: opts.mastered });

    const limit = opts.limit ?? 20;
    const page = opts.page ?? 1;

    const [items, total] = await qb
      .orderBy('w.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit };
  }

  // ─── HAFTALIK TEST OLISH ───────────────────────────────────────────────────
  async getWeeklyTest(userId: string): Promise<{
    testWords: Array<{ wordId: string; word: string; options: string[] }>;
    totalWords: number;
  }> {
    // Eng ko'p xato qilingan yoki hali o'rganilmagan so'zlar
    const unmastered = await this.wordRepo.find({
      where: { studentId: userId, mastered: false },
      order: { wrongCount: 'DESC', lastTestedAt: 'ASC' },
      take: WEEKLY_TEST_SIZE * 3, // Variant uchun ko'proq olish
    });

    if (unmastered.length < 4) {
      return { testWords: [], totalWords: unmastered.length };
    }

    const testWords = unmastered.slice(0, WEEKLY_TEST_SIZE);
    const allWords = unmastered; // Variant uchun

    // Har so'z uchun 4 ta variant (1 to'g'ri + 3 boshqa so'zlarning ta'riflari)
    const testItems = testWords.map((w) => {
      const correct = w.aiDefinition ?? w.userDefinition ?? w.word;
      const others = allWords
        .filter((other) => other.id !== w.id && (other.aiDefinition ?? other.userDefinition))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((o) => o.aiDefinition ?? o.userDefinition ?? '');

      const options = shuffle([correct, ...others]);
      return {
        wordId: w.id,
        word: w.word,
        options,
        // correctAnswer ni klientga yubormaymiz
      };
    });

    return { testWords: testItems, totalWords: unmastered.length };
  }

  // ─── HAFTALIK TEST TOPSHIRISH ─────────────────────────────────────────────
  async submitWeeklyTest(dto: SubmitVocabTestDto, userId: string): Promise<{
    correctCount: number;
    totalWords: number;
    pointsEarned: number;
    masteredWords: string[];
  }> {
    let correct = 0;
    const masteredWords: string[] = [];

    for (const [wordId, givenDefinition] of Object.entries(dto.answers)) {
      const word = await this.wordRepo.findOne({
        where: { id: wordId, studentId: userId },
      });
      if (!word) continue;

      const correctDef = word.aiDefinition ?? word.userDefinition ?? '';
      const isCorrect = correctDef === givenDefinition;

      if (isCorrect) {
        correct++;
        const newCorrectCount = word.correctCount + 1;
        const nowMastered = !word.mastered && newCorrectCount >= MASTERY_THRESHOLD;

        await this.wordRepo.update(wordId, {
          correctCount: newCorrectCount,
          lastTestedAt: new Date(),
          mastered: nowMastered || word.mastered,
        });

        if (nowMastered) {
          masteredWords.push(word.word);
        }
      } else {
        await this.wordRepo.update(wordId, {
          wrongCount: word.wrongCount + 1,
          lastTestedAt: new Date(),
        });
      }
    }

    // Har to'g'ri javob uchun +5 ball
    let pointsEarned = 0;
    if (correct > 0) {
      const totalPoints = correct * VOCAB_TEST_POINTS;
      await this.pointsService.award({
        userId,
        action: PointsAction.MANUAL,
        points: totalPoints,
        description: `Haftalik lug'at testi: ${correct} to'g'ri javob`,
        referenceType: 'vocab_test',
      });
      pointsEarned = totalPoints;

      // Badge tekshirish
      this.badgeService.checkAndAward(userId).catch(() => {});
    }

    return {
      correctCount: correct,
      totalWords: Object.keys(dto.answers).length,
      pointsEarned,
      masteredWords,
    };
  }

  // ─── SO'Z STATISTIKASI ────────────────────────────────────────────────────
  async getUserStats(userId: string) {
    const total = await this.wordRepo.count({ where: { studentId: userId } });
    const mastered = await this.wordRepo.count({ where: { studentId: userId, mastered: true } });

    return {
      total,
      mastered,
      inProgress: total - mastered,
      masteryRate: total > 0 ? Math.round((mastered / total) * 100) : 0,
    };
  }

  // ─── SO'Z O'CHIRISH ───────────────────────────────────────────────────────
  async removeWord(wordId: string, userId: string): Promise<void> {
    const word = await this.wordRepo.findOne({ where: { id: wordId, studentId: userId } });
    if (!word) throw new NotFoundException('So\'z topilmadi');
    await this.wordRepo.softDelete(wordId);
  }
}

// Tasodifiy aralash
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
