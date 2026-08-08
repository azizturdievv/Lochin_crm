import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import { Lesson, LessonStatus } from '../../entities/lesson.entity';
import { Group } from '../../entities/group.entity';
import { User } from '../../entities/user.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { QrService } from '../attendance/qr.service';
import { ScheduleSettingsService } from '../schedule-settings/schedule-settings.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import {
  WeekQueryDto,
  FreeSlotsQueryDto,
  ConflictCheckDto,
  AnalysisQueryDto,
} from './dto/query-schedule.dto';

// Mahalliy sana qatorini (YYYY-MM-DD) hisoblaydi — toISOString() UTC'ga
// o'giradi va UTC+5 kabi mintaqalarda sanani bir kun orqaga surib yuboradi
// (server host UTC+5'da ishlaydi — natijada hafta/kun hisob-kitobi bir kun siljib,
// darslar butunlay noto'g'ri kun katakchasida "yo'qolib" ketardi).
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Hafta boshini (Dushanba) hisoblash
function getWeekStart(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay(); // 0=Yak, 1=Dush...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Hafta kunlari ro'yxati (7 ta)
function getWeekDays(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return toLocalDateStr(d);
  });
}

// Vaqt oralig'i to'qnashuvini tekshirish
function timesOverlap(
  s1: string, e1: string,
  s2: string, e2: string,
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2);
}

// Dars davomiyligini soatda hisoblash
function durationHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    private dataSource: DataSource,
    private auditLog: AuditLogService,
    private qrService: QrService,
    private scheduleSettingsService: ScheduleSettingsService,
  ) {}

  // ─── HAFTALIK JADVAL ─────────────────────────────────────────────────────
  async getWeekSchedule(query: WeekQueryDto, actorId: string, actorRole: string) {
    const weekStart = getWeekStart(query.weekStart);
    const weekDays = getWeekDays(weekStart);
    const [dateFrom, dateTo] = [weekDays[0], weekDays[6]];

    const rooms = await this.scheduleSettingsService.getRooms(true);
    const timeSlots = await this.scheduleSettingsService.getTimeSlots(true);

    const qb = this.lessonRepo
      .createQueryBuilder('l')
      .innerJoin('l.group', 'g')
      .innerJoin('g.subject', 's')
      .innerJoin('l.teacher', 't')
      .where('l.lesson_date BETWEEN :from AND :to', {
        from: dateFrom,
        to: dateTo,
      })
      .andWhere('l.status != :cancelled', { cancelled: LessonStatus.CANCELLED })
      .select([
        'l.id', 'l.lessonDate', 'l.startTime', 'l.endTime',
        'l.roomNumber', 'l.status', 'l.topic', 'l.qrExpiresAt',
        'g.id', 'g.name', 'g.currentStudents', 'g.maxStudents',
        's.id', 's.name',
        't.id', 't.firstName', 't.lastName',
      ]);

    // Ustoz faqat o'z darslarini ko'radi
    if (actorRole === Role.USTOZ) {
      qb.andWhere('l.teacher_id = :tid', { tid: actorId });
    }

    if (query.teacherId) qb.andWhere('l.teacher_id = :tid', { tid: query.teacherId });
    if (query.groupId) qb.andWhere('l.group_id = :gid', { gid: query.groupId });
    if (query.roomNumber) qb.andWhere('l.room_number = :room', { room: query.roomNumber });
    if (query.subjectId) qb.andWhere('g.subject_id = :sid', { sid: query.subjectId });

    const lessons = await qb.orderBy('l.lesson_date', 'ASC').addOrderBy('l.start_time', 'ASC').getMany();

    // Grid tuzilmasi: { kun: { xona: [darslar] } }
    const grid: Record<string, Record<string, Lesson[]>> = {};
    const roomStats: Record<string, number> = {};

    for (const day of weekDays) {
      grid[day] = {};
      for (const room of rooms) {
        grid[day][room.number] = [];
      }
    }

    for (const lesson of lessons) {
      const day = new Date(lesson.lessonDate).toISOString().slice(0, 10);
      const room = lesson.roomNumber ?? 'unassigned';
      if (!grid[day]) grid[day] = {};
      if (!grid[day][room]) grid[day][room] = [];
      grid[day][room].push(lesson);

      // Xona band soatlari
      if (lesson.roomNumber) {
        const hrs = durationHours(lesson.startTime, lesson.endTime);
        roomStats[lesson.roomNumber] = (roomStats[lesson.roomNumber] ?? 0) + hrs;
      }
    }

    // Bo'sh slotlar soni
    const totalSlots = 7 * timeSlots.length * rooms.length; // hafta × para × xona
    const busySlots = lessons.length;

    return {
      weekStart: weekDays[0],
      weekEnd: weekDays[6],
      weekDays,
      grid,
      rooms,
      timeSlots,
      summary: {
        totalLessons: lessons.length,
        freeSlots: totalSlots - busySlots,
        roomUsage: rooms.map((r) => ({
          room: r.number,
          capacity: r.capacity,
          bookedHours: roomStats[r.number] ?? 0,
          utilization: Math.round(((roomStats[r.number] ?? 0) / 56) * 100), // 56=7kun×8soat
        })),
      },
    };
  }

  // ─── DARS YARATISH ────────────────────────────────────────────────────────
  async createLesson(dto: CreateLessonDto, actorId: string, actorRole: string) {
    const group = await this.groupRepo.findOne({
      where: { id: dto.groupId, isActive: true },
      relations: { subject: true },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const teacher = await this.userRepo.findOne({
      where: { id: dto.teacherId, isActive: true },
    });
    if (!teacher) throw new NotFoundException('O\'qituvchi topilmadi');

    const rooms = await this.scheduleSettingsService.getRooms(true);
    const room = rooms.find((r) => r.number === dto.roomNumber);
    if (!room) {
      throw new BadRequestException(`Xona ${dto.roomNumber} mavjud emas. Mavjud: ${rooms.map((r) => r.number).join(', ')}`);
    }

    // O'quvchilar soni xona sigimidan oshmasligi
    if (group.currentStudents > room.capacity) {
      throw new BadRequestException(
        `Guruhda ${group.currentStudents} ta o'quvchi bor, xona ${room.number} faqat ${room.capacity} ta sig'adi`,
      );
    }

    // To'qnashuv tekshirish
    await this.checkConflicts({
      lessonDate: dto.lessonDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      roomNumber: dto.roomNumber,
      teacherId: dto.teacherId,
    });

    const duration = durationHours(dto.startTime, dto.endTime);

    if (dto.recurring) {
      return this.createRecurringLessons(dto, actorId, actorRole, duration);
    }

    return this.saveSingleLesson(dto, actorId, actorRole, duration);
  }

  // ─── DARS YANGILASH (DRAG & DROP) ─────────────────────────────────────────
  async updateLesson(id: string, dto: UpdateLessonDto, actorId: string, actorRole: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id },
      relations: { group: true },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    if (actorRole === Role.USTOZ && lesson.teacherId !== actorId) {
      throw new ForbiddenException('Bu dars sizniki emas');
    }

    // Vaqt yoki xona o'zgarsa — to'qnashuv tekshirish
    const newStartTime = dto.startTime ?? lesson.startTime;
    const newEndTime = dto.endTime ?? lesson.endTime;
    const newRoom = dto.roomNumber ?? lesson.roomNumber!;
    const newTeacherId = dto.teacherId ?? lesson.teacherId;
    const newDate = dto.lessonDate ?? new Date(lesson.lessonDate).toISOString().slice(0, 10);

    const timeOrRoomChanged =
      dto.startTime || dto.endTime || dto.roomNumber || dto.lessonDate || dto.teacherId;

    if (timeOrRoomChanged) {
      // groupId endi ham beriladi — ilgari dars sudrab ko'chirilganda (drag &
      // drop) xona sig'imi umuman tekshirilmasdi, faqat yangi dars yaratishda
      // tekshirilardi
      await this.checkConflicts({
        lessonDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        roomNumber: newRoom,
        teacherId: newTeacherId,
        excludeLessonId: id,
        groupId: lesson.groupId,
      });
    }

    const oldValues = {
      lessonDate: lesson.lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      roomNumber: lesson.roomNumber,
    };

    const duration = durationHours(newStartTime, newEndTime);

    await this.lessonRepo.update(id, {
      ...(dto.teacherId && { teacherId: dto.teacherId }),
      ...(dto.lessonDate && { lessonDate: new Date(dto.lessonDate) }),
      ...(dto.startTime && { startTime: dto.startTime }),
      ...(dto.endTime && { endTime: dto.endTime }),
      ...(dto.roomNumber && { roomNumber: dto.roomNumber }),
      ...(dto.topic !== undefined && { topic: dto.topic }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.status && { status: dto.status }),
      durationHours: duration,
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LESSON_UPDATED',
      entityName: 'lessons',
      entityId: id,
      oldValues,
      newValues: dto as Record<string, unknown>,
    });

    return this.lessonRepo.findOne({
      where: { id },
      relations: { group: { subject: true }, teacher: true },
    });
  }

  // ─── DARS O'CHIRISH (SOFT) ────────────────────────────────────────────────
  async deleteLesson(id: string, actorId: string, actorRole: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    if (actorRole === Role.USTOZ) {
      throw new ForbiddenException('Darsni faqat manager yoki admin o\'chira oladi');
    }

    await this.lessonRepo.update(id, { status: LessonStatus.CANCELLED });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LESSON_CANCELLED',
      entityName: 'lessons',
      entityId: id,
      newValues: { status: 'cancelled' },
    });

    return { message: 'Dars bekor qilindi' };
  }

  // ─── BITTA DARS ───────────────────────────────────────────────────────────
  async findOne(id: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id },
      relations: { group: { subject: true }, teacher: true },
    });
    if (!lesson) throw new NotFoundException('Dars topilmadi');
    return lesson;
  }

  // ─── O'QITUVCHI JADVALI ───────────────────────────────────────────────────
  async getTeacherSchedule(teacherId: string, weekStart?: string) {
    const days = getWeekDays(getWeekStart(weekStart));
    const [from, to] = [days[0], days[6]];

    return this.lessonRepo
      .createQueryBuilder('l')
      .innerJoin('l.group', 'g')
      .innerJoin('g.subject', 's')
      .where('l.teacher_id = :tid', { tid: teacherId })
      .andWhere('l.lesson_date BETWEEN :from AND :to', { from, to })
      .andWhere('l.status != :cancelled', { cancelled: LessonStatus.CANCELLED })
      .select([
        'l.id', 'l.lessonDate', 'l.startTime', 'l.endTime', 'l.roomNumber', 'l.status',
        'g.id', 'g.name',
        's.id', 's.name',
      ])
      .orderBy('l.lesson_date', 'ASC')
      .addOrderBy('l.start_time', 'ASC')
      .getMany();
  }

  // ─── BO'SH SLOTLAR ────────────────────────────────────────────────────────
  async getFreeSlots(query: FreeSlotsQueryDto) {
    const date = query.date ?? toLocalDateStr(new Date());
    const minCap = Number(query.minCapacity ?? 1);
    const rooms = await this.scheduleSettingsService.getRooms(true);
    const timeSlots = await this.scheduleSettingsService.getTimeSlots(true);

    const busyLessons = await this.lessonRepo.find({
      where: {
        lessonDate: new Date(date) as unknown as Date,
        status: LessonStatus.SCHEDULED,
      },
      select: { startTime: true, endTime: true, roomNumber: true },
    });

    const freeSlots: {
      room: string;
      capacity: number;
      slot: { start: string; end: string };
      isFree: boolean;
    }[] = [];

    for (const room of rooms) {
      if (room.capacity < minCap) continue;

      for (const slot of timeSlots) {
        const isBusy = busyLessons.some(
          (l) =>
            l.roomNumber === room.number &&
            timesOverlap(slot.startTime, slot.endTime, l.startTime, l.endTime),
        );

        freeSlots.push({
          room: room.number,
          capacity: room.capacity,
          slot: { start: slot.startTime, end: slot.endTime },
          isFree: !isBusy,
        });
      }
    }

    const free = freeSlots.filter((s) => s.isFree);
    const busy = freeSlots.filter((s) => !s.isFree);

    return {
      date,
      totalSlots: freeSlots.length,
      freeCount: free.length,
      busyCount: busy.length,
      freeSlots: free,
      busySlots: busy,
    };
  }

  // ─── TO'QNASHUV TEKSHIRISH ────────────────────────────────────────────────
  async checkConflict(dto: ConflictCheckDto) {
    const conflicts = await this.findConflicts(dto);
    return {
      hasConflict:
        conflicts.roomConflict !== null ||
        conflicts.teacherConflict !== null ||
        conflicts.capacityConflict !== null,
      ...conflicts,
    };
  }

  // ─── GURUHLAR RO'YXATI ────────────────────────────────────────────────────
  async findGroups(subjectId?: string, isActive?: boolean) {
    const qb = this.groupRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.subject', 's')
      .leftJoinAndSelect('g.teacher', 't')
      .where('g.deleted_at IS NULL');

    if (subjectId) qb.andWhere('g.subject_id = :subjectId', { subjectId });
    if (isActive !== undefined) qb.andWhere('g.is_active = :isActive', { isActive });

    return qb
      .orderBy('s.sort_order', 'ASC')
      .addOrderBy('g.name', 'ASC')
      .select([
        'g.id', 'g.name', 'g.subjectId', 'g.teacherId',
        'g.roomNumber', 'g.maxStudents', 'g.currentStudents',
        'g.lessonDays', 'g.lessonTime', 'g.monthlyPrice',
        'g.isActive', 'g.startedAt',
        's.id', 's.name',
        't.id', 't.firstName', 't.lastName',
      ])
      .getMany();
  }

  // ─── DAROMAD TAHLILI ──────────────────────────────────────────────────────
  async getAnalysis(query: AnalysisQueryDto) {
    const now = new Date();
    const month =
      query.month ??
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = toLocalDateStr(new Date(year, monthNum - 1, 1));
    const monthEnd = toLocalDateStr(new Date(year, monthNum, 0));

    // Xona bo'yicha darslar soni va soat
    const roomStats = await this.lessonRepo.query(
      `SELECT
        room_number AS room,
        COUNT(*) AS lesson_count,
        SUM(duration_hours) AS total_hours,
        COUNT(DISTINCT group_id) AS group_count
       FROM lessons
       WHERE lesson_date BETWEEN $1 AND $2
         AND status != 'cancelled'
       GROUP BY room_number
       ORDER BY total_hours DESC`,
      [monthStart, monthEnd],
    );

    // Fan bo'yicha tushum (to'lovlar)
    const subjectRevenue = await this.paymentRepo.query(
      `SELECT
        s.name AS subject,
        COUNT(DISTINCT p.student_id) AS students,
        SUM(p.amount) AS revenue
       FROM payments p
       INNER JOIN enrollments e ON e.student_id = p.student_id
       INNER JOIN groups g ON g.id = e.group_id
       INNER JOIN subjects s ON s.id = g.subject_id
       WHERE p.payment_month = $1
         AND p.status = 'completed'
         AND p.deleted_at IS NULL
       GROUP BY s.name
       ORDER BY revenue DESC`,
      [month],
    );

    // O'qituvchi bo'yicha darslar
    const teacherStats = await this.lessonRepo.query(
      `SELECT
        u."firstName" AS first_name, u.last_name,
        COUNT(l.id) AS lesson_count,
        SUM(l.duration_hours) AS total_hours,
        COUNT(DISTINCT l.group_id) AS group_count
       FROM lessons l
       INNER JOIN users u ON u.id = l.teacher_id
       WHERE l.lesson_date BETWEEN $1 AND $2
         AND l.status != 'cancelled'
       GROUP BY u.id, u."firstName", u.last_name
       ORDER BY total_hours DESC`,
      [monthStart, monthEnd],
    );

    // Guruh to'ldirganlik darajasi
    const groupFill = await this.groupRepo.query(
      `SELECT
        g.name, g.current_students, g.max_students,
        ROUND(g.current_students::numeric / NULLIF(g.max_students, 0) * 100, 1) AS fill_percent,
        s.name AS subject
       FROM groups g
       LEFT JOIN subjects s ON s.id = g.subject_id
       WHERE g.is_active = true
       ORDER BY fill_percent DESC`,
    );

    return {
      month,
      roomStats: roomStats.map((r: Record<string, unknown>) => ({
        room: r.room,
        lessonCount: Number(r.lesson_count),
        totalHours: Number(r.total_hours),
        groupCount: Number(r.group_count),
        utilizationPercent: Math.round((Number(r.total_hours) / 56) * 100),
      })),
      subjectRevenue: subjectRevenue.map((s: Record<string, unknown>) => ({
        subject: s.subject,
        students: Number(s.students),
        revenue: Number(s.revenue),
      })),
      teacherStats: teacherStats.map((t: Record<string, unknown>) => ({
        name: `${t.first_name} ${t.last_name}`,
        lessonCount: Number(t.lesson_count),
        totalHours: Number(t.total_hours),
        groupCount: Number(t.group_count),
      })),
      groupFill: groupFill.map((g: Record<string, unknown>) => ({
        name: g.name,
        subject: g.subject,
        currentStudents: Number(g.current_students),
        maxStudents: Number(g.max_students),
        fillPercent: Number(g.fill_percent),
      })),
    };
  }

  // Xonalar/paralar ro'yxati endi ScheduleSettingsService orqali (DB-backed)

  // ─── ICHKI YORDAMCHILAR ───────────────────────────────────────────────────

  private async checkConflicts(dto: Omit<ConflictCheckDto, never>) {
    const conflicts = await this.findConflicts(dto);
    if (conflicts.roomConflict) {
      throw new ConflictException(
        `Xona ${dto.roomNumber} bu vaqtda band: "${conflicts.roomConflict.group?.name}" guruhi ${dto.startTime}–${dto.endTime}`,
      );
    }
    if (conflicts.teacherConflict) {
      throw new ConflictException(
        `O'qituvchi bu vaqtda band: "${conflicts.teacherConflict.group?.name}" guruhi ${dto.startTime}–${dto.endTime}`,
      );
    }
    if (conflicts.capacityConflict) {
      const { enrolledCount, roomCapacity } = conflicts.capacityConflict;
      throw new ConflictException(
        `Guruhda ${enrolledCount} ta o'quvchi bor, xona ${dto.roomNumber} faqat ${roomCapacity} ta sig'adi`,
      );
    }
  }

  private async findConflicts(dto: {
    lessonDate: string;
    startTime: string;
    endTime: string;
    roomNumber: string;
    teacherId: string;
    excludeLessonId?: string;
    groupId?: string;
  }) {
    const date = new Date(dto.lessonDate);

    const existing = await this.lessonRepo
      .createQueryBuilder('l')
      .innerJoin('l.group', 'g')
      .where('l.lesson_date = :date', { date })
      .andWhere('l.status != :cancelled', { cancelled: LessonStatus.CANCELLED })
      .select(['l.id', 'l.startTime', 'l.endTime', 'l.roomNumber', 'l.teacherId', 'g.id', 'g.name'])
      .getMany();

    const relevant = existing.filter((l) => l.id !== dto.excludeLessonId);

    const roomConflict =
      relevant.find(
        (l) =>
          l.roomNumber === dto.roomNumber &&
          timesOverlap(dto.startTime, dto.endTime, l.startTime, l.endTime),
      ) ?? null;

    const teacherConflict =
      relevant.find(
        (l) =>
          l.teacherId === dto.teacherId &&
          timesOverlap(dto.startTime, dto.endTime, l.startTime, l.endTime),
      ) ?? null;

    // Sig'im to'qnashuvi — guruhdagi o'quvchilar soni xona sig'imidan oshsa
    // (masalan dars sudrab boshqa, kichikroq xonaga tashlansa). Ilgari faqat
    // yangi dars YARATISHDA tekshirilardi — sudrab ko'chirishda (drag & drop)
    // hech qanday tekshiruv yo'q edi.
    let capacityConflict: { enrolledCount: number; roomCapacity: number } | null = null;
    if (dto.groupId) {
      const rooms = await this.scheduleSettingsService.getRooms(true);
      const room = rooms.find((r) => r.number === dto.roomNumber);
      if (room) {
        const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
        if (group && group.currentStudents > room.capacity) {
          capacityConflict = { enrolledCount: group.currentStudents, roomCapacity: room.capacity };
        }
      }
    }

    return { roomConflict, teacherConflict, capacityConflict };
  }

  private async saveSingleLesson(
    dto: CreateLessonDto,
    actorId: string,
    actorRole: string,
    duration: number,
  ) {
    const lesson = this.lessonRepo.create({
      groupId: dto.groupId,
      teacherId: dto.teacherId,
      lessonDate: new Date(dto.lessonDate),
      startTime: dto.startTime,
      endTime: dto.endTime,
      roomNumber: dto.roomNumber,
      status: LessonStatus.SCHEDULED,
      topic: dto.topic ?? null,
      notes: dto.notes ?? null,
      durationHours: duration,
    });

    await this.lessonRepo.save(lesson);

    // QR kod generatsiya
    await this.qrService.generateForLesson(lesson);

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'LESSON_CREATED',
      entityName: 'lessons',
      entityId: lesson.id,
      newValues: {
        groupId: dto.groupId,
        date: dto.lessonDate,
        startTime: dto.startTime,
        roomNumber: dto.roomNumber,
      },
    });

    return this.lessonRepo.findOne({
      where: { id: lesson.id },
      relations: { group: { subject: true }, teacher: true },
    });
  }

  // Takroriy darslar (har hafta bir xil vaqtda)
  private async createRecurringLessons(
    dto: CreateLessonDto,
    actorId: string,
    actorRole: string,
    duration: number,
  ) {
    const weeks = dto.recurringWeeks ?? 12;
    const baseDate = new Date(dto.lessonDate);
    const created: Lesson[] = [];
    const skipped: string[] = [];

    for (let w = 0; w < weeks; w++) {
      const lessonDate = new Date(baseDate);
      lessonDate.setDate(baseDate.getDate() + w * 7);
      const dateStr = lessonDate.toISOString().slice(0, 10);

      // To'qnashuvni tekshirish — bo'lsa o'tkazib yuborish
      const { roomConflict, teacherConflict } = await this.findConflicts({
        lessonDate: dateStr,
        startTime: dto.startTime,
        endTime: dto.endTime,
        roomNumber: dto.roomNumber,
        teacherId: dto.teacherId,
      });

      if (roomConflict || teacherConflict) {
        skipped.push(dateStr);
        continue;
      }

      const lesson = this.lessonRepo.create({
        groupId: dto.groupId,
        teacherId: dto.teacherId,
        lessonDate: lessonDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        roomNumber: dto.roomNumber,
        status: LessonStatus.SCHEDULED,
        topic: dto.topic ?? null,
        notes: dto.notes ?? null,
        durationHours: duration,
      });

      await this.lessonRepo.save(lesson);
      await this.qrService.generateForLesson(lesson);
      created.push(lesson);
    }

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'RECURRING_LESSONS_CREATED',
      entityName: 'lessons',
      newValues: {
        groupId: dto.groupId,
        created: created.length,
        skipped: skipped.length,
      },
    });

    return {
      message: `${created.length} ta dars yaratildi, ${skipped.length} ta o'tkazib yuborildi (to'qnashuv)`,
      created: created.length,
      skipped,
      lessons: created,
    };
  }
}
