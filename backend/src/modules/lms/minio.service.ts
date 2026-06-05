import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as crypto from 'crypto';
import * as path from 'path';

// Ruxsat etilgan fayl turlari
const ALLOWED_MIME: Record<string, string[]> = {
  pdf:   ['application/pdf'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

// Maksimal fayl hajmlari (baytda)
const MAX_SIZES: Record<string, number> = {
  pdf:   50 * 1024 * 1024,   // 50 MB
  video: 500 * 1024 * 1024,  // 500 MB
  audio: 50 * 1024 * 1024,   // 50 MB
  image: 10 * 1024 * 1024,   // 10 MB
};

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly port: number;
  private readonly useSSL: boolean;

  constructor(private configService: ConfigService) {
    this.endpoint = configService.get('MINIO_ENDPOINT', 'localhost');
    this.port = parseInt(configService.get('MINIO_PORT', '9000'));
    this.useSSL = configService.get('MINIO_USE_SSL', 'false') === 'true';
    this.bucket = configService.get('MINIO_BUCKET', 'ilm-crm');

    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: configService.get('MINIO_ACCESS_KEY', 'minio'),
      secretKey: configService.get('MINIO_SECRET_KEY', 'minio123'),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`MinIO bucket yaratildi: ${this.bucket}`);
      } else {
        this.logger.log(`MinIO ulandi: ${this.bucket}`);
      }
    } catch (err) {
      this.logger.warn(`MinIO ulanmadi (offline rejim): ${(err as Error).message}`);
    }
  }

  // Buffer dan yuklash (server-side upload)
  async uploadBuffer(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    folder: string,
  ): Promise<{ url: string; objectName: string; size: number }> {
    const ext = path.extname(originalName).toLowerCase();
    const uniqueName = `${folder}/${crypto.randomUUID()}${ext}`;

    await this.client.putObject(this.bucket, uniqueName, buffer, buffer.length, {
      'Content-Type': mimeType,
    });

    const url = this.buildUrl(uniqueName);
    return { url, objectName: uniqueName, size: buffer.length };
  }

  // Presigned URL (frontend to'g'ridan-to'g'ri yuklashi uchun)
  async presignedPutUrl(
    objectName: string,
    mimeType: string,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.client.presignedPutObject(this.bucket, objectName, expirySeconds);
  }

  // Presigned GET URL (vaqtincha kirish uchun)
  async presignedGetUrl(objectName: string, expirySeconds = 86400): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectName, expirySeconds);
  }

  // Faylni o'chirish
  async deleteObject(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectName);
    } catch (err) {
      this.logger.warn(`MinIO delete xatosi: ${objectName}: ${(err as Error).message}`);
    }
  }

  // Fayl turi va hajmini tekshirish
  validateFile(
    mimeType: string,
    fileSize: number,
    expectedType: keyof typeof ALLOWED_MIME,
  ): { valid: boolean; error?: string } {
    const allowed = ALLOWED_MIME[expectedType] ?? [];
    if (!allowed.includes(mimeType)) {
      return { valid: false, error: `Noto'g'ri fayl turi. Ruxsat: ${allowed.join(', ')}` };
    }
    const maxSize = MAX_SIZES[expectedType] ?? 50 * 1024 * 1024;
    if (fileSize > maxSize) {
      return { valid: false, error: `Fayl hajmi ${Math.round(maxSize / 1024 / 1024)} MB dan oshmasligi kerak` };
    }
    return { valid: true };
  }

  private buildUrl(objectName: string): string {
    const proto = this.useSSL ? 'https' : 'http';
    return `${proto}://${this.endpoint}:${this.port}/${this.bucket}/${objectName}`;
  }
}
