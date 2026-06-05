import { Injectable, Logger } from '@nestjs/common';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export type BookQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  private get apiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  }

  // ─── KITOB UCHUN TEST SAVOLLARI YARATISH ──────────────────────────────────
  async generateBookQuestions(
    title: string,
    description: string,
    count = 10,
  ): Promise<BookQuestion[]> {
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY sozlanmagan — mock savollar qaytarilmoqda');
      return this.mockBookQuestions(title, count);
    }

    const prompt = `Siz o'qituvchisiz. "${title}" kitobiga ${count} ta test savoli yarating.
Kitob haqida: ${description ?? 'tavsif berilmagan'}

Har bir savol uchun:
- 4 ta variant (A, B, C, D)
- Bitta to'g'ri javob

JSON formatda qaytaring:
[
  {
    "question": "Savol matni?",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": "A) ..."
  }
]

Faqat JSON qaytaring, boshqa matn yo'q.`;

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content ?? '[]';
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed.slice(0, count) : this.mockBookQuestions(title, count);
    } catch (err) {
      this.logger.error(`AI kitob savol yaratishda xato: ${err}`);
      return this.mockBookQuestions(title, count);
    }
  }

  // ─── SO'Z TA'RIFI YARATISH ─────────────────────────────────────────────────
  async generateWordDefinition(
    word: string,
    language = 'uz',
  ): Promise<{ definition: string; exampleSentence: string }> {
    if (!this.apiKey) {
      return {
        definition: `"${word}" so'zining ta'rifi (AI sozlanmagan)`,
        exampleSentence: `"${word}" so'zi jumlada ishlatildi.`,
      };
    }

    const langName: Record<string, string> = {
      uz: "o'zbek",
      en: 'ingliz',
      ru: 'rus',
    };

    const prompt = `"${word}" so'zini ${langName[language] ?? language} tilida tushuntiring.

Qisqa va aniq:
1. Ta'rif (1-2 jumla)
2. Misol jumla

JSON formatda:
{
  "definition": "...",
  "exampleSentence": "..."
}

Faqat JSON.`;

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 300,
        }),
      });

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content ?? '{}';
      return JSON.parse(content);
    } catch (err) {
      this.logger.error(`AI ta'rif yaratishda xato (${word}): ${err}`);
      return {
        definition: `"${word}" — ta'rif olishda xato yuz berdi.`,
        exampleSentence: '',
      };
    }
  }

  // ─── MATN IMLO TEKSHIRISH ──────────────────────────────────────────────────
  async checkSpelling(text: string): Promise<{ errorCount: number; corrections: string[] }> {
    if (!this.apiKey) {
      return { errorCount: 0, corrections: [] };
    }

    const prompt = `Bu matndagi imlo xatolarini aniqlang: "${text}"

JSON:
{
  "errorCount": 0,
  "corrections": ["xato so'z → to'g'ri so'z"]
}

Faqat JSON.`;

    try {
      const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 200,
        }),
      });

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content ?? '{"errorCount":0,"corrections":[]}';
      return JSON.parse(content);
    } catch {
      return { errorCount: 0, corrections: [] };
    }
  }

  // Mock savollar (API yo'q bo'lsa)
  private mockBookQuestions(title: string, count: number): BookQuestion[] {
    return Array.from({ length: count }, (_, i) => ({
      question: `"${title}" kitobiga oid ${i + 1}-savol`,
      options: ['A) 1-javob', 'B) 2-javob', 'C) 3-javob', 'D) 4-javob'],
      correctAnswer: 'A) 1-javob',
    }));
  }
}
