import { Injectable, Logger } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';

export enum ModerationLevel {
  CLEAN = 'clean',
  WARNING = 'warning',
  BLOCKED = 'blocked',
}

export type ModerationResult = {
  level: ModerationLevel;
  reason?: string;
  cleanedText?: string;
};

// OpenAI /v1/moderations javob shakli
interface OpenAiModerationResponse {
  results?: Array<{
    flagged: boolean;
    categories: Record<string, boolean>;
  }>;
}

// Shaxsiy ma'lumot aniqlash pattern'lari
const PERSONAL_INFO_PATTERNS = [
  /\b9[0-9]{8}\b/g,                    // Telefon: 9XXXXXXXX
  /\+?998\s?[0-9]{2}\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2}/g, // O'zbekiston telefon
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
  /\b\d{14}\b/g,                        // Passport ID
];

// Tashqi havola aniqlash (http/https, www., t.me, tg://, keng tarqalgan domenlar)
const LINK_PATTERN = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(tg:\/\/[^\s]+)|([a-zA-Z0-9-]+\.(com|uz|ru|net|org|io|me)\b[^\s]*)/gi;

// Og'ir haqorat so'zlari (BLOCKED — avtomatik blok)
// Eslatma: bu qo'lda yozilgan ro'yxat — imlo xatosi, lotin/krill aralashmasi
// yoki yangi so'z ijodini (masalan harflarni raqamga almashtirish) aniqlay
// olmaydi. AI moderatsiya (OPENAI_API_KEY) shu bo'shliqni to'ldiradi — bu
// ro'yxat faqat AI ishlamaganda ishlaydigan zaxira sifatida qaraladi.
const SEVERE_WORDS = new Set([
  // O'zbek haqoratlari — lotin va krill, ikkalasi ham amalda ishlatiladi
  'ахмоқ', 'тентак', 'нодон', 'мўт', 'аблаҳ', 'лақма', 'бадбахт', 'жинни', 'семиз', 'кар-соқов',
  'axmoq', 'tentak', 'nodon', 'ablah', 'laqma', 'badbaxt', 'jinni', 'svoloch', 'padar lanat',
  // Rus haqoratlari (keng tarqalgan, O'zbekistonda ham ishlatiladi)
  'дурак', 'идиот', 'тупой', 'мразь', 'скотина', 'кретин', 'болван', 'придурок', 'гад', 'сволочь', 'ублюдок',
  'durak', 'idiot', 'kreten', 'boldon', 'pridurok',
  // Ingliz haqoratlari (aralash-tilli chatda uchraydi)
  'bastard', 'bitch', 'asshole', 'retard',
]);

// Yengil ogohlantirishlar (WARNING)
const MILD_WORDS = new Set([
  'stupid', 'idiot', 'loser', 'noob', 'dumb', 'lame', 'pathetic', 'moron',
  'бестолковый', 'бесполезный', 'дурачок', 'глупый', 'тупица',
  'ahmoqona', 'bema\'ni', 'nodonlik',
]);

// Spam aniqlash uchun foydalanuvchi yuborish tarixi
const userMessageHistory = new Map<string, { timestamps: number[]; lastContent: string; repeatCount: number }>();

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  // Asosiy moderatsiya funksiyasi
  async moderate(content: string, senderId: string, senderRole?: string): Promise<ModerationResult> {
    if (!content?.trim()) {
      return { level: ModerationLevel.CLEAN };
    }

    const lower = content.toLowerCase();

    // 0. Tashqi havola tekshirish — faqat Admin/Ustoz rasmiy havola joylay oladi
    const canPostLinks = senderRole === Role.SUPER_ADMIN || senderRole === Role.MANAGER || senderRole === Role.USTOZ;
    if (!canPostLinks) {
      LINK_PATTERN.lastIndex = 0;
      if (LINK_PATTERN.test(content)) {
        this.logger.warn(`Blok: foydalanuvchi ${senderId} tashqi havola yubordi`);
        return {
          level: ModerationLevel.BLOCKED,
          reason: 'Tashqi havolalar yuborish taqiqlangan. Faqat admin va ustoz rasmiy havola joylay oladi.',
        };
      }
    }

    // 1. Haqorat/zo'ravonlik tekshiruvi — OPENAI_API_KEY sozlangan bo'lsa haqiqiy AI
    // moderatsiya ishlatiladi (aniqroq, ko'p tilni tushunadi); aks holda yoki AI
    // chaqiruvi xato bersa, pastdagi so'zlar ro'yxatiga qaytamiz (hech qachon
    // moderatsiyasiz qoldirmaymiz)
    const aiResult = await this.moderateWithAi(content);
    if (aiResult) {
      if (aiResult.level === ModerationLevel.BLOCKED) {
        this.logger.warn(`AI blok: foydalanuvchi ${senderId} — ${aiResult.reason}`);
        return aiResult;
      }
    } else {
      // 1a. Og'ir haqorat tekshirish (BLOCKED) — AI sozlanmaganda zaxira
      for (const word of SEVERE_WORDS) {
        if (lower.includes(word)) {
          this.logger.warn(`Blok: foydalanuvchi ${senderId} haqorat ishlatdi: "${word}"`);
          return {
            level: ModerationLevel.BLOCKED,
            reason: `Haqoratli so'z aniqlandi. Xabar blok qilindi.`,
          };
        }
      }

      // 1b. Yengil haqorat tekshirish (WARNING) — AI sozlanmaganda zaxira
      for (const word of MILD_WORDS) {
        if (lower.includes(word)) {
          return {
            level: ModerationLevel.WARNING,
            reason: `Munosib bo'lmagan so'z ishlatildi. Iltimos, hurmat bilan muloqot qiling.`,
          };
        }
      }
    }

    // 2. Shaxsiy ma'lumot tekshirish (WARNING)
    for (const pattern of PERSONAL_INFO_PATTERNS) {
      if (pattern.test(content)) {
        pattern.lastIndex = 0; // RegExp reset
        return {
          level: ModerationLevel.WARNING,
          reason: `Shaxsiy ma'lumot (telefon/email) chat orqali ulashish xavfsiz emas.`,
        };
      }
    }

    // 3. Spam tekshirish
    const spamResult = this.checkSpam(content, senderId);
    if (spamResult) return spamResult;

    return { level: ModerationLevel.CLEAN };
  }

  // Spam: bitta xabarni qayta yuborish yoki juda tez yuborish
  private checkSpam(content: string, senderId: string): ModerationResult | null {
    const now = Date.now();
    const history = userMessageHistory.get(senderId) ?? {
      timestamps: [],
      lastContent: '',
      repeatCount: 0,
    };

    // Bir xil xabar takroran
    if (content === history.lastContent) {
      history.repeatCount++;
      if (history.repeatCount >= 3) {
        userMessageHistory.set(senderId, history);
        return {
          level: ModerationLevel.BLOCKED,
          reason: 'Spam aniqlandi: bir xil xabar qayta yuborilmoqda.',
        };
      }
    } else {
      history.repeatCount = 0;
    }

    // 10 soniyada 5 ta xabardan ko'p
    history.timestamps = history.timestamps.filter((t) => now - t < 10_000);
    history.timestamps.push(now);
    history.lastContent = content;

    if (history.timestamps.length > 5) {
      userMessageHistory.set(senderId, history);
      return {
        level: ModerationLevel.WARNING,
        reason: 'Juda tez xabar yuborilmoqda. Iltimos, sekinroq yuboring.',
      };
    }

    userMessageHistory.set(senderId, history);
    return null;
  }

  // AI moderatsiya (OpenAI) — opsional, konfiguratsiya bo'yicha
  async moderateWithAi(content: string): Promise<ModerationResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    try {
      const res = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: content }),
      });

      // res.ok tekshirilmasa, 429/401/500 kabi xato javoblar ham "clean"
      // deb noto'g'ri talqin qilinardi (fetch() faqat tarmoq xatosida reject
      // qiladi, HTTP xato kodida emas) — bu moderatsiyani sukut bo'yicha
      // "hammasi joyida" holatiga tushirib qo'yadi, aksincha bo'lishi kerak
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        this.logger.error(`OpenAI moderatsiya xatosi: HTTP ${res.status} — ${errBody.slice(0, 300)}`);
        return null;
      }

      const json = (await res.json()) as OpenAiModerationResponse;
      const result = json.results?.[0];

      if (!result) {
        this.logger.error(`OpenAI moderatsiya: kutilmagan javob shakli — ${JSON.stringify(json).slice(0, 300)}`);
        return null;
      }

      if (result.flagged) {
        const categories = Object.entries(result.categories)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ');

        return {
          level: ModerationLevel.BLOCKED,
          reason: `AI moderatsiya: ${categories}`,
        };
      }

      return { level: ModerationLevel.CLEAN };
    } catch (err) {
      this.logger.error(`OpenAI moderatsiya xatosi: ${err}`);
      return null;
    }
  }

  // So'z statistikasini yangilash (dinamik qora ro'yxat uchun)
  addToBlocklist(word: string) {
    SEVERE_WORDS.add(word.toLowerCase());
  }
}
