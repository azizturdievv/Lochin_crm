import { Injectable, Logger } from '@nestjs/common';

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

// Shaxsiy ma'lumot aniqlash pattern'lari
const PERSONAL_INFO_PATTERNS = [
  /\b9[0-9]{8}\b/g,                    // Telefon: 9XXXXXXXX
  /\+?998\s?[0-9]{2}\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2}/g, // O'zbekiston telefon
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
  /\b\d{14}\b/g,                        // Passport ID
];

// Og'ir haqorat so'zlari (BLOCKED — avtomatik blok)
const SEVERE_WORDS = new Set([
  // O'zbek haqoratlari (placeholder, real tizimda to'liq ro'yxat kerak)
  'ахмоқ', 'тентак', 'нодон', 'мўт', 'аблаҳ',
  'axmoq', 'tentak', 'nodon', 'ablah',
  // Rus haqoratlari (keng tarqalgan)
  'дурак', 'идиот', 'тупой', 'мразь', 'скотина',
  'durak', 'idiot',
]);

// Yengil ogohlantirishlar (WARNING)
const MILD_WORDS = new Set([
  'stupid', 'idiot', 'loser', 'noob',
  'бестолковый', 'бесполезный',
]);

// Spam aniqlash uchun foydalanuvchi yuborish tarixi
const userMessageHistory = new Map<string, { timestamps: number[]; lastContent: string; repeatCount: number }>();

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  // Asosiy moderatsiya funksiyasi
  moderate(content: string, senderId: string): ModerationResult {
    if (!content?.trim()) {
      return { level: ModerationLevel.CLEAN };
    }

    const lower = content.toLowerCase();

    // 1. Og'ir haqorat tekshirish (BLOCKED)
    for (const word of SEVERE_WORDS) {
      if (lower.includes(word)) {
        this.logger.warn(`Blok: foydalanuvchi ${senderId} haqorat ishlatdi: "${word}"`);
        return {
          level: ModerationLevel.BLOCKED,
          reason: `Haqoratli so'z aniqlandi. Xabar blok qilindi.`,
        };
      }
    }

    // 2. Yengil haqorat tekshirish (WARNING)
    for (const word of MILD_WORDS) {
      if (lower.includes(word)) {
        return {
          level: ModerationLevel.WARNING,
          reason: `Munosib bo'lmagan so'z ishlatildi. Iltimos, hurmat bilan muloqot qiling.`,
        };
      }
    }

    // 3. Shaxsiy ma'lumot tekshirish (WARNING)
    for (const pattern of PERSONAL_INFO_PATTERNS) {
      if (pattern.test(content)) {
        pattern.lastIndex = 0; // RegExp reset
        return {
          level: ModerationLevel.WARNING,
          reason: `Shaxsiy ma'lumot (telefon/email) chat orqali ulashish xavfsiz emas.`,
        };
      }
    }

    // 4. Spam tekshirish
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

      const json = (await res.json()) as any;
      const result = json.results?.[0];

      if (result?.flagged) {
        const categories = Object.entries(result.categories as Record<string, boolean>)
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
