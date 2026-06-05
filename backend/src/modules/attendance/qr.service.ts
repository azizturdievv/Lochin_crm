import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { Lesson, LessonStatus } from '../../entities/lesson.entity';

// QR payload tuzilmasi
export interface QrPayload {
  lessonId: string;
  date: string;       // YYYY-MM-DD
  token: string;      // HMAC imzo (xavfsizlik)
  expiresAt: string;  // ISO timestamp
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  private readonly secret: string;

  constructor(
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    private configService: ConfigService,
  ) {
    this.secret = this.configService.get<string>('JWT_SECRET', 'qr-secret-key');
  }

  // QR payload generatsiya + HMAC imzo
  buildPayload(lessonId: string): QrPayload {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    // 24 soat amal qiladi
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // HMAC-SHA256 token: lessonId + date imzolangan
    const token = crypto
      .createHmac('sha256', this.secret)
      .update(`${lessonId}:${date}:${expiresAt}`)
      .digest('hex')
      .slice(0, 32);

    return { lessonId, date, token, expiresAt };
  }

  // QR payload ni tekshirish
  verifyPayload(raw: string): { valid: boolean; payload?: QrPayload; error?: string } {
    try {
      const payload: QrPayload = JSON.parse(raw);

      if (!payload.lessonId || !payload.date || !payload.token || !payload.expiresAt) {
        return { valid: false, error: 'QR kod noto\'g\'ri formatda' };
      }

      // Muddati tekshirish
      if (new Date(payload.expiresAt) < new Date()) {
        return { valid: false, error: 'QR kod muddati o\'tgan (24 soat)' };
      }

      // HMAC imzoni tekshirish
      const expectedToken = crypto
        .createHmac('sha256', this.secret)
        .update(`${payload.lessonId}:${payload.date}:${payload.expiresAt}`)
        .digest('hex')
        .slice(0, 32);

      if (!crypto.timingSafeEqual(Buffer.from(payload.token), Buffer.from(expectedToken))) {
        return { valid: false, error: 'QR kod o\'zgartirilgan yoki soxta' };
      }

      return { valid: true, payload };
    } catch {
      return { valid: false, error: 'QR kod o\'qib bo\'lmadi' };
    }
  }

  // QR PNG image generatsiya (base64)
  async generateQrImage(payload: QrPayload): Promise<string> {
    const data = JSON.stringify(payload);
    return QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 2,
      color: { dark: '#1a1a2e', light: '#ffffff' },
    });
  }

  // Dars uchun QR yaratish va DB ga saqlash
  async generateForLesson(lesson: Lesson): Promise<string> {
    const payload = this.buildPayload(lesson.id);
    const qrPayloadJson = JSON.stringify(payload);

    const expiresAt = new Date(payload.expiresAt);
    await this.lessonRepo.update(lesson.id, {
      qrCode: qrPayloadJson,
      qrExpiresAt: expiresAt,
    });

    return qrPayloadJson;
  }

  // Cron: har 24 soatda ertangi darslar uchun QR yangilash
  @Cron('0 0 * * *', { name: 'qr-refresh', timeZone: 'Asia/Tashkent' })
  async refreshAllQrCodes() {
    this.logger.log('QR kodlar yangilanmoqda...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const lessons = await this.lessonRepo.find({
      where: {
        lessonDate: new Date(tomorrowStr) as unknown as Date,
        status: LessonStatus.SCHEDULED,
      },
    });

    for (const lesson of lessons) {
      await this.generateForLesson(lesson);
    }

    this.logger.log(`${lessons.length} ta dars QR kodi yangilandi`);
  }

  // Bugungi darslar QR ni ham yangilash (server restart uchun)
  @Cron('1 0 * * *', { name: 'qr-today-refresh', timeZone: 'Asia/Tashkent' })
  async refreshTodayQrCodes() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const lessons = await this.lessonRepo.find({
      where: {
        lessonDate: new Date(todayStr) as unknown as Date,
        status: LessonStatus.SCHEDULED,
      },
    });

    for (const lesson of lessons) {
      await this.generateForLesson(lesson);
    }

    this.logger.log(`Bugun: ${lessons.length} ta QR yangilandi`);
  }
}
