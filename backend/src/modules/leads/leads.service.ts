import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Lead, LeadStage, LeadSource } from '../../entities/lead.entity';
import { LeadNote } from '../../entities/lead-note.entity';
import { User } from '../../entities/user.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { MoveStageDto } from './dto/move-stage.dto';
import { AddNoteDto } from './dto/add-note.dto';
import { QueryLeadDto, ConversionQueryDto } from './dto/query-lead.dto';

// Bosqich tartib raqami (oldinga harakat faqat)
const STAGE_ORDER: Record<LeadStage, number> = {
  [LeadStage.NEW]: 1,
  [LeadStage.IN_TALK]: 2,
  [LeadStage.WAITING]: 3,
  [LeadStage.TRIAL]: 4,
  [LeadStage.ENROLLED]: 5,
  [LeadStage.LOST]: 0, // istalgan bosqichdan yo'qotish mumkin
};

// Manba nomlaari (O'zbek)
const SOURCE_LABELS: Record<LeadSource, string> = {
  [LeadSource.INSTAGRAM]: 'Instagram DM',
  [LeadSource.TELEGRAM]: 'Telegram',
  [LeadSource.PHONE]: 'Qo\'ng\'iroq',
  [LeadSource.WEBSITE]: 'Veb-sayt',
  [LeadSource.WHATSAPP]: 'WhatsApp',
  [LeadSource.WALKIN]: 'Walk-in',
  [LeadSource.REFERRAL]: 'Referral',
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private leadRepo: Repository<Lead>,
    @InjectRepository(LeadNote)
    private noteRepo: Repository<LeadNote>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private auditLog: AuditLogService,
  ) {}

  // ─── LID YARATISH ─────────────────────────────────────────────────────────
  async create(dto: CreateLeadDto, actorId: string, actorRole: string) {
    // Telefon raqami bo'yicha takrorni tekshirish
    const existing = await this.leadRepo.findOne({
      where: { phone: dto.phone },
    });

    if (existing && existing.stage !== LeadStage.LOST) {
      throw new BadRequestException(
        `Bu telefon raqami allaqachon tizimda mavjud (bosqich: ${existing.stage})`,
      );
    }

    const lead = this.leadRepo.create({
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email ?? null,
      source: dto.source ?? null,
      interestedSubject: dto.interestedSubject ?? null,
      stage: LeadStage.NEW,
      assignedToId: dto.assignedToId ?? null,
      notes: dto.notes ?? null,
      lostReason: null,
      firstContactAt: new Date(),
      alert15minSent: false,
      trialDate: null,
    });

    await this.leadRepo.save(lead);

    // Birinchi izoh (manba va kanal)
    if (dto.notes || dto.source || dto.channelUsername) {
      const noteContent = [
        dto.notes,
        dto.source ? `Manba: ${SOURCE_LABELS[dto.source] ?? dto.source}` : null,
        dto.channelUsername ? `Kanal: ${dto.channelUsername}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      await this.noteRepo.save(
        this.noteRepo.create({
          leadId: lead.id,
          createdById: actorId,
          content: noteContent,
          stageFrom: null,
          stageTo: LeadStage.NEW,
        }),
      );
    }

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LEAD_CREATED',
      entityName: 'leads',
      entityId: lead.id,
      newValues: { fullName: dto.fullName, phone: dto.phone, source: dto.source },
    });

    return this.findOne(lead.id, actorId, actorRole);
  }

  // ─── LID RO'YXATI (raw SQL — TypeORM property mapping muammoidan qochish) ─
  async findAll(query: QueryLeadDto, actorId: string, actorRole: string) {
    const { page = 1, limit = 20, sortOrder = 'DESC' } = query;

    const params: unknown[] = [];
    const conditions: string[] = ['l.deleted_at IS NULL'];

    const p = () => { params.push(arguments[0]); return `$${params.length}`; };

    const addParam = (val: unknown): string => {
      params.push(val);
      return `$${params.length}`;
    };

    if (actorRole === Role.MANAGER) {
      const ph = addParam(actorId);
      conditions.push(`(l.assigned_to = ${ph} OR l.assigned_to IS NULL)`);
    }
    if (query.stage)        conditions.push(`l.stage = ${addParam(query.stage)}`);
    if (query.source)       conditions.push(`l.source = ${addParam(query.source)}`);
    if (query.assignedToId) conditions.push(`l.assigned_to = ${addParam(query.assignedToId)}`);
    if (query.dateFrom)     conditions.push(`l.created_at >= ${addParam(new Date(query.dateFrom))}`);
    if (query.dateTo)       conditions.push(`l.created_at <= ${addParam(new Date(query.dateTo))}`);

    if (query.search) {
      const ph = addParam(`%${query.search}%`);
      conditions.push(`(l.full_name ILIKE ${ph} OR l.phone ILIKE ${ph} OR l.email ILIKE ${ph})`);
    }

    if (query.alertOnly) {
      const ph = addParam(new Date(Date.now() - 15 * 60 * 1000));
      conditions.push(`(l.stage = 'new' AND l.first_contact_at <= ${ph} AND l.alert_15min_sent = false)`);
    }

    const where = conditions.join(' AND ');
    const dir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const countRaw = await this.leadRepo.query(
      `SELECT COUNT(*) AS total FROM leads l WHERE ${where}`, params,
    );
    const total = parseInt(countRaw[0]?.total ?? '0');

    const limitPh = addParam(limit);
    const offsetPh = addParam((page - 1) * limit);

    const rows = await this.leadRepo.query(
      `SELECT l.*, u."firstName" AS assigned_first, u.last_name AS assigned_last
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE ${where}
       ORDER BY l.created_at ${dir}
       LIMIT ${limitPh} OFFSET ${offsetPh}`,
      params,
    );

    const data = rows.map((row: Record<string, unknown>) => ({
      id: row.id, fullName: row.full_name, phone: row.phone, email: row.email,
      source: row.source, stage: row.stage, interestedSubject: row.interested_subject,
      firstContactAt: row.first_contact_at, alert15minSent: row.alert_15min_sent,
      trialDate: row.trial_date, createdAt: row.created_at, lostReason: row.lost_reason,
      assignedTo: row.assigned_first
        ? { firstName: row.assigned_first, lastName: row.assigned_last }
        : null,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── BITTA LID ────────────────────────────────────────────────────────────
  async findOne(id: string, actorId: string, actorRole: string) {
    const lead = await this.leadRepo.findOne({
      where: { id },
      relations: { assignedTo: true },
    });

    if (!lead) throw new NotFoundException('Lid topilmadi');

    // Manager: faqat o'ziga tayinlangan yoki tayinsiz lidlarni ko'radi
    if (actorRole === Role.MANAGER &&
        lead.assignedToId &&
        lead.assignedToId !== actorId) {
      throw new ForbiddenException('Bu lid sizga tayinlanmagan');
    }

    const notes = await this.noteRepo.find({
      where: { leadId: id },
      relations: { createdBy: true },
      order: { createdAt: 'DESC' },
    });

    // Faoliyat tarixi: barcha stage o'zgarishlari
    const stageHistory = notes
      .filter((n) => n.stageFrom !== null || n.stageTo !== null)
      .map((n) => ({
        from: n.stageFrom,
        to: n.stageTo,
        comment: n.content,
        by: n.createdBy ? `${n.createdBy.firstName} ${n.createdBy.lastName}` : '',
        at: n.createdAt,
      }));

    return { ...lead, notes, stageHistory };
  }

  // ─── LID YANGILASH ────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateLeadDto, actorId: string, actorRole: string) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lid topilmadi');

    await this.checkAccess(lead, actorId, actorRole);

    const oldValues = {
      fullName: lead.fullName,
      phone: lead.phone,
      assignedToId: lead.assignedToId,
    };

    await this.leadRepo.update(id, {
      ...(dto.fullName && { fullName: dto.fullName }),
      ...(dto.phone && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email ?? null }),
      ...(dto.source !== undefined && { source: dto.source ?? null }),
      ...(dto.interestedSubject !== undefined && { interestedSubject: dto.interestedSubject ?? null }),
      ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId ?? null }),
      ...(dto.trialDate !== undefined && { trialDate: dto.trialDate ? new Date(dto.trialDate) : null }),
      ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LEAD_UPDATED',
      entityName: 'leads',
      entityId: id,
      oldValues,
      newValues: dto as Record<string, unknown>,
    });

    return this.findOne(id, actorId, actorRole);
  }

  // ─── BOSQICH O'ZGARTIRISH (PIPELINE) ─────────────────────────────────────
  async moveStage(id: string, dto: MoveStageDto, actorId: string, actorRole: string) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lid topilmadi');

    await this.checkAccess(lead, actorId, actorRole);

    if (lead.stage === dto.stage) {
      throw new BadRequestException(`Lid allaqachon "${dto.stage}" bosqichida`);
    }

    // Yo'qotish cheksiz istalgan bosqichdan bo'lishi mumkin
    // Boshqa bosqichlarda faqat oldinga harakat
    if (dto.stage !== LeadStage.LOST) {
      const currentOrder = STAGE_ORDER[lead.stage];
      const newOrder = STAGE_ORDER[dto.stage];
      if (newOrder < currentOrder) {
        throw new BadRequestException(
          `Bosqich orqaga qaytarilmaydi. Hozir: "${lead.stage}", so'ralgan: "${dto.stage}"`,
        );
      }
    }

    // Yo'qotildi — sabab majburiy
    if (dto.stage === LeadStage.LOST && !dto.lostReason) {
      throw new BadRequestException('Yo\'qotish sababi kiritilishi shart');
    }

    const oldStage = lead.stage;

    await this.leadRepo.update(id, {
      stage: dto.stage,
      ...(dto.stage === LeadStage.LOST && { lostReason: dto.lostReason }),
      ...(dto.stage === LeadStage.ENROLLED && { enrolledAt: new Date() }),
      ...(dto.trialDate && { trialDate: new Date(dto.trialDate) }),
    });

    // Faoliyat tarixiga yozish
    const noteContent =
      dto.comment ||
      (dto.stage === LeadStage.LOST
        ? `Yo'qotildi. Sabab: ${dto.lostReason}`
        : `Bosqich o'zgartirildi: ${oldStage} → ${dto.stage}`);

    await this.noteRepo.save(
      this.noteRepo.create({
        leadId: id,
        createdById: actorId,
        content: noteContent,
        stageFrom: oldStage,
        stageTo: dto.stage,
      }),
    );

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LEAD_STAGE_CHANGED',
      entityName: 'leads',
      entityId: id,
      oldValues: { stage: oldStage },
      newValues: { stage: dto.stage, lostReason: dto.lostReason },
    });

    return this.findOne(id, actorId, actorRole);
  }

  // ─── IZOH QO'SHISH ────────────────────────────────────────────────────────
  async addNote(id: string, dto: AddNoteDto, actorId: string, actorRole: string) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lid topilmadi');

    await this.checkAccess(lead, actorId, actorRole);

    const note = await this.noteRepo.save(
      this.noteRepo.create({
        leadId: id,
        createdById: actorId,
        content: dto.content,
        stageFrom: null,
        stageTo: null,
      }),
    );

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LEAD_NOTE_ADDED',
      entityName: 'lead_notes',
      entityId: note.id,
    });

    return note;
  }

  // ─── PIPELINE (KANBAN) KO'RINISH ──────────────────────────────────────────
  async getPipeline(actorId: string, actorRole: string) {
    const qb = this.leadRepo
      .createQueryBuilder('l')
      .leftJoin('l.assignedTo', 'a')
      .where('l.deleted_at IS NULL')
      .andWhere('l.stage NOT IN (:...ended)', {
        ended: [LeadStage.ENROLLED, LeadStage.LOST],
      })
      .addSelect([
        'l.id', 'l.fullName', 'l.phone', 'l.source', 'l.stage',
        'l.interestedSubject', 'l.createdAt', 'l.trialDate',
        'l.firstContactAt', 'l.alert15minSent',
        'a.id', 'a.firstName', 'a.lastName',
      ])
      .orderBy('l.created_at', 'DESC');

    if (actorRole === Role.MANAGER) {
      qb.andWhere('(l.assigned_to = :aid OR l.assigned_to IS NULL)', { aid: actorId });
    }

    const leads = await qb.getMany();

    // Bosqich bo'yicha guruhlash
    const pipeline: Record<string, { leads: Lead[]; count: number }> = {
      [LeadStage.NEW]: { leads: [], count: 0 },
      [LeadStage.IN_TALK]: { leads: [], count: 0 },
      [LeadStage.WAITING]: { leads: [], count: 0 },
      [LeadStage.TRIAL]: { leads: [], count: 0 },
    };

    for (const lead of leads) {
      if (pipeline[lead.stage]) {
        pipeline[lead.stage].leads.push(lead);
        pipeline[lead.stage].count++;
      }
    }

    // 15 daqiqa qoidasi: vaqtida javob olmaganlar
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const overdueCount = pipeline[LeadStage.NEW].leads.filter(
      (l) => l.firstContactAt && new Date(l.firstContactAt) <= cutoff && !l.alert15minSent,
    ).length;

    return {
      pipeline,
      overdueAlerts: overdueCount,
      stageLabels: {
        [LeadStage.NEW]: 'Yangi',
        [LeadStage.IN_TALK]: 'Suhbatda',
        [LeadStage.WAITING]: 'Kutmoqda',
        [LeadStage.TRIAL]: 'Sinov darsi',
      },
    };
  }

  // ─── KONVERSIYA TAHLILI ───────────────────────────────────────────────────
  async getConversionAnalysis(query: ConversionQueryDto) {
    const now = new Date();
    const year = query.year ?? String(now.getFullYear());
    const dateFrom = query.month
      ? `${query.month}-01`
      : `${year}-01-01`;
    const dateTo = query.month
      ? new Date(Number(query.month.split('-')[0]), Number(query.month.split('-')[1]), 0)
          .toISOString()
          .slice(0, 10)
      : `${year}-12-31`;

    // Umumiy statistika
    const overallRaw = await this.leadRepo.query(
      `SELECT
        stage,
        COUNT(*) AS count
       FROM leads
       WHERE created_at BETWEEN $1 AND $2
         AND deleted_at IS NULL
       GROUP BY stage`,
      [dateFrom, dateTo],
    );

    const stageCounts: Record<string, number> = {};
    let totalLeads = 0;
    for (const row of overallRaw) {
      stageCounts[row.stage] = Number(row.count);
      totalLeads += Number(row.count);
    }

    const enrolledCount = stageCounts[LeadStage.ENROLLED] ?? 0;
    const lostCount = stageCounts[LeadStage.LOST] ?? 0;
    const conversionRate = totalLeads > 0
      ? Math.round((enrolledCount / totalLeads) * 100 * 10) / 10
      : 0;

    // Manba bo'yicha tahlil
    const sourceRaw = await this.leadRepo.query(
      `SELECT
        source,
        COUNT(*) AS total,
        SUM(CASE WHEN stage = 'enrolled' THEN 1 ELSE 0 END) AS enrolled,
        SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END) AS lost
       FROM leads
       WHERE created_at BETWEEN $1 AND $2
         AND deleted_at IS NULL
       GROUP BY source
       ORDER BY total DESC`,
      [dateFrom, dateTo],
    );

    const bySource = sourceRaw.map((row: Record<string, unknown>) => {
      const total = Number(row.total);
      const enrolled = Number(row.enrolled);
      return {
        source: row.source as string,
        sourceLabel: row.source ? SOURCE_LABELS[row.source as LeadSource] ?? String(row.source) : 'Noma\'lum',
        total,
        enrolled,
        lost: Number(row.lost),
        conversionRate: total > 0 ? Math.round((enrolled / total) * 100 * 10) / 10 : 0,
      };
    });

    // Manager bo'yicha tahlil
    const managerRaw = await this.leadRepo.query(
      `SELECT
        u."firstName", u.last_name,
        COUNT(l.id) AS total,
        SUM(CASE WHEN l.stage = 'enrolled' THEN 1 ELSE 0 END) AS enrolled,
        SUM(CASE WHEN l.stage = 'lost' THEN 1 ELSE 0 END) AS lost,
        AVG(CASE
          WHEN l.stage = 'enrolled'
          THEN EXTRACT(EPOCH FROM (l.updated_at - l.created_at))/3600
          END) AS avg_hours_to_enroll
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.created_at BETWEEN $1 AND $2
         AND l.deleted_at IS NULL
       GROUP BY u.id, u."firstName", u.last_name
       ORDER BY enrolled DESC`,
      [dateFrom, dateTo],
    );

    const byManager = managerRaw.map((row: Record<string, unknown>) => {
      const total = Number(row.total);
      const enrolled = Number(row.enrolled);
      return {
        name: row.firstName ? `${row.firstName} ${row.last_name}` : 'Tayinlanmagan',
        total,
        enrolled,
        lost: Number(row.lost),
        conversionRate: total > 0 ? Math.round((enrolled / total) * 100 * 10) / 10 : 0,
        avgHoursToEnroll: row.avg_hours_to_enroll
          ? Math.round(Number(row.avg_hours_to_enroll) * 10) / 10
          : null,
      };
    });

    // Oylik trend (so'nggi 6 oy)
    const monthlyTrend = await this.leadRepo.query(
      `SELECT
        TO_CHAR(created_at, 'YYYY-MM') AS month,
        COUNT(*) AS total,
        SUM(CASE WHEN stage = 'enrolled' THEN 1 ELSE 0 END) AS enrolled
       FROM leads
       WHERE created_at >= NOW() - INTERVAL '6 months'
         AND deleted_at IS NULL
       GROUP BY month
       ORDER BY month ASC`,
    );

    return {
      period: { from: dateFrom, to: dateTo },
      overall: {
        totalLeads,
        enrolled: enrolledCount,
        lost: lostCount,
        inProgress: totalLeads - enrolledCount - lostCount,
        conversionRate,
        stageCounts,
      },
      bySource,
      byManager,
      monthlyTrend: monthlyTrend.map((r: Record<string, unknown>) => ({
        month: r.month,
        total: Number(r.total),
        enrolled: Number(r.enrolled),
        conversionRate:
          Number(r.total) > 0
            ? Math.round((Number(r.enrolled) / Number(r.total)) * 100 * 10) / 10
            : 0,
      })),
    };
  }

  // ─── O'CHIRISH (SOFT) ─────────────────────────────────────────────────────
  async remove(id: string, actorId: string, actorRole: string) {
    const lead = await this.leadRepo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lid topilmadi');

    await this.leadRepo.softDelete(id);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LEAD_DELETED',
      entityName: 'leads',
      entityId: id,
    });

    return { message: 'Lid o\'chirildi' };
  }

  // ─── CRON: 15 DAQIQA QOIDASI ─────────────────────────────────────────────
  @Cron('* * * * *', { name: 'lead-15min-alert', timeZone: 'Asia/Tashkent' })
  async check15MinRule() {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);

    // 15 daqiqa o'tgan, lekin alert yuborilmagan yangi lidlar
    const overdueLeads = await this.leadRepo
      .createQueryBuilder('l')
      .where('l.stage = :stage', { stage: LeadStage.NEW })
      .andWhere('l.first_contact_at <= :cutoff', { cutoff })
      .andWhere('l.alert_15min_sent = false')
      .andWhere('l.deleted_at IS NULL')
      .getMany();

    if (!overdueLeads.length) return;

    const superAdmins = await this.userRepo.find({
      where: { role: Role.SUPER_ADMIN, isActive: true },
      select: { id: true },
    });

    const notifications: Notification[] = [];

    for (const lead of overdueLeads) {
      for (const sa of superAdmins) {
        notifications.push(
          this.notificationRepo.create({
            userId: sa.id,
            type: NotificationType.SYSTEM,
            title: '⚠️ 15 daqiqa qoidasi: javobsiz lid',
            body: `${lead.fullName} (${lead.phone}) — ${SOURCE_LABELS[lead.source as LeadSource] ?? 'Noma\'lum manba'} — ${Math.round((Date.now() - new Date(lead.firstContactAt!).getTime()) / 60000)} daqiqa javob yo\'q`,
            data: { leadId: lead.id, phone: lead.phone, source: lead.source },
            pushSent: false,
            smsSent: false,
            telegramSent: false,
          }),
        );
      }
    }

    if (notifications.length) {
      await this.notificationRepo.save(notifications);
    }

    // Alert yuborganlarga belgi qo'yish
    const overdueIds = overdueLeads.map((l) => l.id);
    await this.leadRepo
      .createQueryBuilder()
      .update(Lead)
      .set({ alert15minSent: true })
      .where('id IN (:...ids)', { ids: overdueIds })
      .execute();

    this.logger.warn(`15 daqiqa qoidasi: ${overdueLeads.length} ta lidge SA alert yuborildi`);
  }

  // ─── ICHKI YORDAMCHI ──────────────────────────────────────────────────────
  private async checkAccess(lead: Lead, actorId: string, actorRole: string) {
    if (actorRole === Role.SUPER_ADMIN) return;
    if (actorRole === Role.MANAGER) {
      if (lead.assignedToId && lead.assignedToId !== actorId) {
        throw new ForbiddenException('Bu lid sizga tayinlanmagan');
      }
      return;
    }
    throw new ForbiddenException('Ruxsat yo\'q');
  }
}
