import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import { Event, EventType, CompetitionStatus } from '../../entities/event.entity';
import { EventParticipant } from '../../entities/event-participant.entity';
import { Certificate, CertificateType } from '../../entities/certificate.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationType } from '../../entities/notification.entity';
import { MinioService } from '../lms/minio.service';

// O'rin → sertifikat turi
const PLACE_TO_CERT: Record<number, CertificateType> = {
  1: CertificateType.DIPLOMA,
  2: CertificateType.ACHIEVEMENT,
  3: CertificateType.ACHIEVEMENT,
};

// Tadbir turi → o'zbek nomi
const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.OLYMPIAD]: 'Olimpiada',
  [EventType.SPORT]:    'Sport musobaqasi',
  [EventType.ROBOTICS]: 'Robototexnika',
  [EventType.CHESS]:    'Shaxmat',
  [EventType.RUNNING]:  'Yugurish',
  [EventType.CULTURAL]: 'Madaniy tadbir',
  [EventType.OTHER]:    'Tadbir',
};

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @InjectRepository(Event)
    private eventRepo: Repository<Event>,
    @InjectRepository(EventParticipant)
    private participantRepo: Repository<EventParticipant>,
    @InjectRepository(Certificate)
    private certRepo: Repository<Certificate>,
    private minioService: MinioService,
    private notifService: NotificationService,
    private auditLog: AuditLogService,
  ) {}

  // ─── BARCHA ISHTIROKCHILAR UCHUN SERTIFIKAT ───────────────────────────────
  async generateForEvent(
    eventId: string,
    sendNotification: boolean,
    actorId: string,
    actorRole: string,
  ): Promise<{ generated: number; skipped: number }> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Tadbir topilmadi');

    if (event.isOnline && event.competitionStatus !== CompetitionStatus.FINISHED) {
      throw new BadRequestException(
        'Onlayn musobaqa sertifikatlari faqat musobaqa tugagandan keyin yaratiladi',
      );
    }

    const participants = await this.participantRepo.find({
      where: { eventId },
      relations: { student: true },
    });

    if (participants.length === 0) {
      throw new BadRequestException('Ishtirokchilar topilmadi');
    }

    let generated = 0;
    let skipped   = 0;

    for (const participant of participants) {
      // Allaqachon sertifikat bormi?
      const existing = await this.certRepo.findOne({
        where: { studentId: participant.studentId, eventId },
      });
      if (existing) { skipped++; continue; }

      try {
        await this.generateOne(participant, event, sendNotification);
        generated++;
      } catch (err) {
        this.logger.error(`Sertifikat xato (${participant.studentId}): ${err}`);
        skipped++;
      }
    }

    await this.auditLog.log({
      userId:    actorId,
      userRole:  actorRole,
      action:    'CERTIFICATES_GENERATED',
      entityName:'events',
      entityId:  eventId,
      newValues: { generated, skipped },
    });

    this.logger.log(`Sertifikatlar: ${generated} yaratildi, ${skipped} o'tkazildi — tadbir ${eventId}`);
    return { generated, skipped };
  }

  // ─── BITTA ISHTIROKCHI UCHUN ──────────────────────────────────────────────
  async generateOne(
    participant: EventParticipant,
    event: Event,
    sendNotification: boolean,
  ): Promise<Certificate> {
    const certType = participant.place
      ? (PLACE_TO_CERT[participant.place] ?? CertificateType.PARTICIPATION)
      : CertificateType.PARTICIPATION;

    const verificationCode = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 16);

    // PDF yaratish
    const pdfBuffer = await this.buildPdf({
      studentName:      `${participant.student.firstName} ${participant.student.lastName}`,
      eventTitle:       event.title,
      eventType:        event.type,
      eventDate:        event.eventDate,
      place:            participant.place,
      certType,
      verificationCode,
    });

    // MinIO ga yuklash
    const { url } = await this.minioService.uploadBuffer(
      pdfBuffer,
      `certificate-${verificationCode}.pdf`,
      'application/pdf',
      'certificates',
    );

    const certTitle = this.buildTitle(certType, event, participant.place);

    const cert = this.certRepo.create({
      studentId:        participant.studentId,
      type:             certType,
      title:            certTitle,
      eventId:          event.id,
      fileUrl:          url,
      verificationCode,
      issuedAt:         new Date(),
      isSent:           false,
    });

    const saved = await this.certRepo.save(cert);

    // Bildirishnoma (async)
    if (sendNotification) {
      this.notifService.notify(
        participant.studentId,
        NotificationType.ANNOUNCEMENT,
        '🏅 Sertifikat/Diplom tayyor',
        `"${event.title}" uchun ${certTitle} tayyorlandi. CRM ilovadan yuklab olishingiz mumkin.`,
      ).catch(() => {});

      await this.certRepo.update(saved.id, { isSent: true });
    }

    return saved;
  }

  // ─── SERTIFIKAT VERIFIKATSIYA ─────────────────────────────────────────────
  async verify(verificationCode: string): Promise<{
    valid: boolean;
    certificate: Certificate | null;
  }> {
    const cert = await this.certRepo.findOne({
      where: { verificationCode },
      relations: { student: true, event: true },
    });

    return { valid: !!cert, certificate: cert };
  }

  // ─── O'QUVCHI SERTIFIKATLARI ──────────────────────────────────────────────
  async findByStudent(studentId: string): Promise<Certificate[]> {
    return this.certRepo.find({
      where: { studentId },
      relations: { event: true },
      order: { issuedAt: 'DESC' },
    });
  }

  // ─── PDF YARATISH ──────────────────────────────────────────────────────────
  private async buildPdf(data: {
    studentName:      string;
    eventTitle:       string;
    eventType:        EventType;
    eventDate:        Date;
    place:            number | null;
    certType:         CertificateType;
    verificationCode: string;
  }): Promise<Buffer> {
    // Verifikatsiya QR
    const qrDataUrl = await QRCode.toDataURL(
      `verify:${data.verificationCode}`,
      { width: 120, margin: 1 },
    );
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrBuffer = Buffer.from(qrBase64, 'base64');

    return new Promise<Buffer>((resolve, reject) => {
      const doc    = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data',  (c) => chunks.push(c));
      doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const H = doc.page.height;

      // Fon
      doc.rect(0, 0, W, H).fill('#FAFDF7');
      doc.rect(20, 20, W - 40, H - 40).stroke('#2D6A4F').lineWidth(2);

      // Sarlavha
      const heading = data.certType === CertificateType.DIPLOMA ? 'DIPLOM' : 'SERTIFIKAT';
      doc.font('Helvetica-Bold').fontSize(36).fillColor('#1B4332')
        .text(heading, 0, 60, { align: 'center' });

      // Tadbir turi
      doc.font('Helvetica').fontSize(14).fillColor('#52796F')
        .text(EVENT_TYPE_LABELS[data.eventType], 0, 108, { align: 'center' });

      // Ajratgich chiziq
      doc.moveTo(100, 135).lineTo(W - 100, 135).stroke('#74C69D');

      // O'quvchi ismi
      doc.font('Helvetica-Bold').fontSize(26).fillColor('#1B4332')
        .text(data.studentName, 0, 155, { align: 'center' });

      // Asosiy matn
      const dateStr = new Date(data.eventDate).toLocaleDateString('uz-UZ', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

      let bodyText = `"${data.eventTitle}" tadbirida (${dateStr}) muvaffaqiyatli ishtirok etganligi uchun`;

      if (data.place) {
        const placeLabels: Record<number, string> = {
          1: '🥇 1-o\'rin',
          2: '🥈 2-o\'rin',
          3: '🥉 3-o\'rin',
        };
        const placeStr = placeLabels[data.place] ?? `${data.place}-o'rin`;
        bodyText = `"${data.eventTitle}" tadbirida (${dateStr})\n${placeStr} egasi sifatida`;
      }

      doc.font('Helvetica').fontSize(14).fillColor('#333333')
        .text(bodyText, 80, 210, { align: 'center', width: W - 160, lineGap: 6 });

      // Pastki chiziq
      doc.moveTo(100, H - 100).lineTo(W - 100, H - 100).stroke('#74C69D');

      // Verifikatsiya kodi
      doc.font('Helvetica').fontSize(10).fillColor('#6B8F71')
        .text(`Kod: ${data.verificationCode}`, 60, H - 85, { align: 'left' });

      // QR kodi
      doc.image(qrBuffer, W - 140, H - 130, { width: 90, height: 90 });
      doc.font('Helvetica').fontSize(8).fillColor('#6B8F71')
        .text('Scan for verify', W - 140, H - 38, { width: 90, align: 'center' });

      doc.end();
    });
  }

  // ─── SARLAVHA YARATISH ────────────────────────────────────────────────────
  private buildTitle(certType: CertificateType, event: Event, place: number | null): string {
    const typeName = EVENT_TYPE_LABELS[event.type];
    if (certType === CertificateType.DIPLOMA && place) {
      return `${place}-o'rin | ${typeName}: ${event.title}`;
    }
    if (certType === CertificateType.ACHIEVEMENT) {
      return `Yutuq sertifikati | ${typeName}: ${event.title}`;
    }
    return `Ishtirok sertifikati | ${typeName}: ${event.title}`;
  }
}
