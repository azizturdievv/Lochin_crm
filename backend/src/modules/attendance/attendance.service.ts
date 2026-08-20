import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Attendance, AttendanceStatus } from '../../entities/attendance.entity';
import { In } from 'typeorm';
import { Lesson, LessonStatus } from '../../entities/lesson.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { User } from '../../entities/user.entity';
import { Parent } from '../../entities/parent.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { QrService } from './qr.service';
import { QrScanDto } from './dto/qr-scan.dto';
import { OfflineSyncDto } from './dto/offline-sync.dto';
import { SubmitExcuseDto } from './dto/excuse.dto';
import { QueryAttendanceDto, ManualAttendanceDto } from './dto/query-attendance.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Parent)
    private parentRepo: Repository<Parent>,
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private dataSource: DataSource,
    private qrService: QrService,
    private auditLog: AuditLogService,
  ) {}

  // ─── QR SCAN ─────────────────────────────────────────────────────────────
  async scanQr(dto: QrScanDto, studentId: string) {
    const { valid, payload, error } = this.qrService.verifyPayload(dto.qrPayload);

    if (!valid || !payload) {
      throw new BadRequestException(error ?? 'QR kod yaroqsiz');
    }

    const lesson = await this.lessonRepo.findOne({
      where: { id: payload.lessonId },
      relations: { group: true },
    });

    if (!lesson) throw new NotFoundException('Dars topilmadi');
    if (lesson.status === LessonStatus.CANCELLED) {
      throw new BadRequestException('Bu dars bekor qilingan');
    }

    // O'quvchi bu darsga tegishlimi?
    const enrollment = await this.enrollmentRepo.findOne({
      where: { studentId, groupId: lesson.groupId, status: EnrollmentStatus.ACTIVE },
    });

    if (!enrollment) {
      throw new ForbiddenException('Siz bu guruhga yozilmagansiz');
    }

    // Allaqachon qayd etilganmi?
    const existing = await this.attendanceRepo.findOne({
      where: { lessonId: lesson.id, studentId },
    });

    if (existing && existing.status === AttendanceStatus.PRESENT) {
      return { message: 'Siz allaqachon belgilangansiiz', attendance: existing };
    }

    // Kechikishni hisoblash
    const now = new Date();
    const lessonStart = this.parseLessonTime(lesson.lessonDate, lesson.startTime);
    const lateMinutes = Math.max(0, Math.floor((now.getTime() - lessonStart.getTime()) / 60000));
    const status = lateMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

    const attendance = await this.saveOrUpdateAttendance({
      lessonId: lesson.id,
      studentId,
      status,
      lateMinutes: lateMinutes > 0 ? lateMinutes : null,
      scannedAt: now,
      syncedFromOffline: false,
    });

    await this.auditLog.log({
      userId: studentId,
      action: 'QR_SCAN',
      entityName: 'attendance',
      entityId: attendance.id,
      newValues: { lessonId: lesson.id, status, lateMinutes },
    });

    return {
      message: status === AttendanceStatus.LATE
        ? `✅ Siz ${lateMinutes} daqiqa kech qoldingiz`
        : '✅ Davomat muvaffaqiyatli qayd etildi',
      status,
      lateMinutes: lateMinutes > 0 ? lateMinutes : null,
      attendance,
    };
  }

  // ─── OFFLINE SINXRONIZATSIYA ───────────────────────────────────────────────
  async syncOffline(dto: OfflineSyncDto, actorId: string) {
    const results: { localId: string; status: 'saved' | 'skipped' | 'error'; reason?: string }[] = [];

    for (const record of dto.records) {
      try {
        // QR payload tekshirish (agar bor bo'lsa)
        if (record.qrPayload) {
          const { valid, error } = this.qrService.verifyPayload(record.qrPayload);
          if (!valid) {
            results.push({ localId: record.localId, status: 'skipped', reason: error });
            continue;
          }
        }

        // Mavjud yozuvni tekshirish (duplikat oldini olish)
        const existing = await this.attendanceRepo.findOne({
          where: { lessonId: record.lessonId, studentId: record.studentId },
        });

        if (existing && existing.status !== AttendanceStatus.ABSENT) {
          results.push({ localId: record.localId, status: 'skipped', reason: 'Allaqachon saqlangan' });
          continue;
        }

        await this.saveOrUpdateAttendance({
          lessonId: record.lessonId,
          studentId: record.studentId,
          status: record.status,
          lateMinutes: null,
          scannedAt: new Date(record.scannedAt),
          syncedFromOffline: true,
        });

        results.push({ localId: record.localId, status: 'saved' });
      } catch (err) {
        results.push({
          localId: record.localId,
          status: 'error',
          reason: err instanceof Error ? err.message : 'Noma\'lum xato',
        });
      }
    }

    const saved = results.filter((r) => r.status === 'saved').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const errors = results.filter((r) => r.status === 'error').length;

    await this.auditLog.log({
      userId: actorId,
      action: 'OFFLINE_SYNC',
      newValues: { total: dto.records.length, saved, skipped, errors },
    });

    return { message: `Sinxronizatsiya: ${saved} saqlandi, ${skipped} o'tkazib yuborildi, ${errors} xato`, results };
  }

  // ─── QOLNI BELGILASH (USTOZ / MANAGER) ───────────────────────────────────
  async markManual(dto: ManualAttendanceDto, actorId: string, actorRole: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: dto.lessonId },
      relations: { group: true },
    });

    if (!lesson) throw new NotFoundException('Dars topilmadi');

    // Ustoz faqat o'z darsini belgilaydi
    if (actorRole === Role.USTOZ && lesson.teacherId !== actorId) {
      throw new ForbiddenException('Bu dars sizning darslaringiz emas');
    }

    // O'quvchi guruhga yozilganligini tekshirish
    const enrollment = await this.enrollmentRepo.findOne({
      where: { studentId: dto.studentId, groupId: lesson.groupId, status: EnrollmentStatus.ACTIVE },
    });

    if (!enrollment) throw new BadRequestException('O\'quvchi bu guruhda emas');

    const attendance = await this.saveOrUpdateAttendance({
      lessonId: dto.lessonId,
      studentId: dto.studentId,
      status: dto.status,
      lateMinutes: dto.lateMinutes ?? null,
      scannedAt: null,
      syncedFromOffline: false,
      excuseReason: dto.excuseReason,
    });

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'ATTENDANCE_MANUAL',
      entityName: 'attendance',
      entityId: attendance.id,
      newValues: { lessonId: dto.lessonId, studentId: dto.studentId, status: dto.status },
    });

    return attendance;
  }

  // ─── OTA-ONA SABAB KIRITISHI ──────────────────────────────────────────────
  async submitExcuse(
    attendanceId: string,
    dto: SubmitExcuseDto,
    parentStudentId: string, // O'quvchi ID (ota-ona o'z farzandi uchun)
  ) {
    const attendance = await this.attendanceRepo.findOne({
      where: { id: attendanceId },
      relations: { lesson: true },
    });

    if (!attendance) throw new NotFoundException('Davomat yozuvi topilmadi');

    // Ota-ona faqat o'z farzandining yozuvini o'zgartira oladi
    if (attendance.studentId !== parentStudentId) {
      throw new ForbiddenException('Siz bu yozuvni o\'zgartira olmaysiz');
    }

    // Faqat sababsiz kelmagan bo'lsa sabab qo'shish mumkin
    if (attendance.status !== AttendanceStatus.ABSENT &&
        attendance.status !== AttendanceStatus.UNEXCUSED) {
      throw new BadRequestException('Faqat kelmagan darslar uchun sabab kiritiladi');
    }

    await this.attendanceRepo.update(attendanceId, {
      status: AttendanceStatus.EXCUSED,
      excuseReason: dto.reason,
      excuseByParent: true,
    });

    return { message: 'Sabab muvaffaqiyatli kiritildi', attendanceId };
  }

  // ─── BUGUNGI / TANLANGAN SANA DAVOMATI ───────────────────────────────────
  async getToday(actorId: string, actorRole: string, date?: string, groupId?: string) {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);

    // Darslar ro'yxatini raw SQL bilan olish (TypeORM addSelect muammosi)
    const params: unknown[] = [targetDate];
    let sql = `
      SELECT
        l.id, l.group_id AS "groupId", l.teacher_id AS "teacherId",
        l.lesson_date AS "lessonDate", l.start_time AS "startTime",
        l.end_time AS "endTime", l.status, l.qr_code AS "qrCode",
        l.qr_expires_at AS "qrExpiresAt",
        g.name AS "groupName",
        s.id AS "subjectId", s.name AS "subjectName",
        t."firstName" AS "teacherFirst", t.last_name AS "teacherLast"
      FROM lessons l
      INNER JOIN groups g ON g.id = l.group_id AND g.deleted_at IS NULL
      LEFT JOIN subjects s ON s.id = g.subject_id AND s.deleted_at IS NULL
      INNER JOIN users t ON t.id = l.teacher_id AND t.deleted_at IS NULL
      WHERE l.lesson_date = $1 AND l.deleted_at IS NULL`;

    if (actorRole === Role.USTOZ) {
      params.push(actorId);
      sql += ` AND l.teacher_id = $${params.length}`;
    }
    if (groupId) {
      params.push(groupId);
      sql += ` AND l.group_id = $${params.length}`;
    }
    sql += ' ORDER BY l.start_time ASC';

    const rows = (await this.lessonRepo.query(sql, params)) as Record<string, unknown>[];
    if (!rows.length) return [];

    // Har dars uchun: yozilgan o'quvchilar soni + davomat statistikasi
    return Promise.all(
      rows.map(async (row) => {
        const lessonId = row.id as string;
        const gId      = row.groupId as string;

        const [enrolledCount, attStats] = await Promise.all([
          this.enrollmentRepo.count({
            where: { groupId: gId, status: EnrollmentStatus.ACTIVE },
          }),
          this.attendanceRepo.query(
            `SELECT
              COALESCE(SUM(CASE WHEN status = 'present'   THEN 1 ELSE 0 END), 0)::int AS present,
              COALESCE(SUM(CASE WHEN status = 'late'      THEN 1 ELSE 0 END), 0)::int AS late,
              COALESCE(SUM(CASE WHEN status = 'absent'    THEN 1 ELSE 0 END), 0)::int AS absent,
              COALESCE(SUM(CASE WHEN status = 'excused'   THEN 1 ELSE 0 END), 0)::int AS excused,
              COALESCE(SUM(CASE WHEN status = 'unexcused' THEN 1 ELSE 0 END), 0)::int AS unexcused,
              COUNT(*)::int AS total_att
             FROM attendance WHERE lesson_id = $1 AND deleted_at IS NULL`,
            [lessonId],
          ),
        ]);

        const s         = (attStats[0] as Record<string, number>) ?? {};
        const present   = s.present   ?? 0;
        const late      = s.late      ?? 0;
        const excused   = s.excused   ?? 0;
        const unexcused = s.unexcused ?? 0;
        const absentRec = s.absent    ?? 0;
        const totalAtt  = s.total_att ?? 0;
        // Yozuvsiz o'quvchilar = kelmagan hisoblanadi
        const absent = absentRec + Math.max(0, enrolledCount - totalAtt);
        const rate   = enrolledCount > 0
          ? Math.round(((present + late) / enrolledCount) * 100)
          : 0;

        return {
          lesson: {
            id:          lessonId,
            groupId:     gId,
            group: {
              name:    (row.groupName    as string) ?? '',
              subject: {
                id:   (row.subjectId   as string) ?? '',
                name: (row.subjectName as string) ?? '',
              },
            },
            teacherId: row.teacherId as string,
            teacher: {
              firstName: (row.teacherFirst as string) ?? '',
              lastName:  (row.teacherLast  as string) ?? '',
            },
            lessonDate:  row.lessonDate,
            startTime:   (row.startTime  as string) ?? null,
            endTime:     (row.endTime    as string) ?? null,
            status:      row.status,
            qrCode:      row.qrCode      ?? null,
            qrExpiresAt: row.qrExpiresAt ?? null,
          },
          attendance: [] as [],
          stats: { total: enrolledCount, present, late, absent, excused, unexcused, rate },
        };
      }),
    );
  }

  // ─── DARS DAVOMATI (to'liq) ──────────────────────────────────────────────
  async getLessonAttendance(lessonId: string, actorId: string, actorRole: string) {
    const lesson = await this.lessonRepo.findOne({
      where: { id: lessonId },
      relations: { group: { subject: true }, teacher: true },
    });

    if (!lesson) throw new NotFoundException('Dars topilmadi');

    if (actorRole === Role.USTOZ && lesson.teacherId !== actorId) {
      throw new ForbiddenException('Bu dars sizniki emas');
    }

    // Ustoz keyinchalik arxivlangan (ishdan ketgan) bo'lsa ham, dars
    // davomatida ismi ko'rinishi kerak — TypeORM relation-join arxivlangan
    // yozuvni avtomatik chetlab o'tadi, shuning uchun alohida olinadi
    if (lesson.teacherId && !lesson.teacher) {
      const archivedTeacher = await this.userRepo
        .createQueryBuilder('u')
        .withDeleted()
        .where('u.id = :tid', { tid: lesson.teacherId })
        .getOne();
      if (archivedTeacher) lesson.teacher = archivedTeacher;
    }

    // Guruh o'quvchilari — faol yozuvlar
    const students = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', 'e.student_id = u.id AND e.group_id = :gid AND e.status = :es', {
        gid: lesson.groupId,
        es: EnrollmentStatus.ACTIVE,
      })
      .select(['u.id', 'u.firstName', 'u.lastName', 'u.phone'])
      .orderBy('u.last_name', 'ASC')
      .getMany();

    // Mavjud davomat yozuvlari
    const existingAtts = await this.attendanceRepo.find({ where: { lessonId } });
    const attMap       = new Map(existingAtts.map((a) => [a.studentId, a]));

    // Statistika
    const stats = {
      total:     students.length,
      present:   0, late:      0,
      absent:    0, excused:   0,
      unexcused: 0, rate:      0,
    };

    // Frontend AttendanceRecord formatida ro'yxat
    const attendance = students.map((student) => {
      const att    = attMap.get(student.id);
      const status = (att?.status ?? AttendanceStatus.ABSENT) as AttendanceStatus;

      if      (status === AttendanceStatus.PRESENT)   stats.present++;
      else if (status === AttendanceStatus.LATE)      stats.late++;
      else if (status === AttendanceStatus.EXCUSED)   stats.excused++;
      else if (status === AttendanceStatus.UNEXCUSED) stats.unexcused++;
      else                                            stats.absent++;

      return {
        id:             att?.id ?? '',
        lessonId,
        studentId:      student.id,
        student: {
          firstName: student.firstName,
          lastName:  student.lastName,
          phone:     student.phone ?? null,
        },
        status,
        lateMinutes:    att?.lateMinutes    ?? null,
        scannedAt:      att?.scannedAt      ? (att.scannedAt as unknown as Date).toISOString() : null,
        excuseReason:   att?.excuseReason   ?? null,
        excuseByParent: att?.excuseByParent ?? false,
        parentNotified: att?.parentNotified ?? false,
        createdAt:      att?.createdAt
          ? (att.createdAt as unknown as Date).toISOString()
          : new Date().toISOString(),
      };
    });

    if (stats.total > 0) {
      stats.rate = Math.round(((stats.present + stats.late) / stats.total) * 100);
    }

    return {
      lesson: {
        id:        lesson.id,
        groupId:   lesson.groupId,
        group: {
          name:    lesson.group?.name    ?? '',
          subject: {
            id:   lesson.group?.subject?.id   ?? '',
            name: lesson.group?.subject?.name ?? '',
          },
        },
        teacherId: lesson.teacherId,
        teacher: {
          firstName: lesson.teacher?.firstName ?? '',
          lastName:  lesson.teacher?.lastName  ?? '',
        },
        lessonDate:  lesson.lessonDate,
        startTime:   lesson.startTime,
        endTime:     lesson.endTime,
        status:      lesson.status,
        qrCode:      lesson.qrCode,
        qrExpiresAt: lesson.qrExpiresAt,
      },
      attendance,
      stats,
    };
  }

  // ─── O'QUVCHI TARIXI ──────────────────────────────────────────────────────
  async getStudentHistory(studentId: string, query: QueryAttendanceDto, actorId: string, actorRole: string) {
    if (actorRole === Role.STUDENT && studentId !== actorId) {
      throw new ForbiddenException('Faqat o\'z tarixingizni ko\'rasiz');
    }

    const { page = 1, limit = 50, dateFrom, dateTo } = query;

    // findAndCount bilan relations — addSelect muammosidan qochish uchun
    const where: Record<string, unknown> = { studentId };
    const [data, total] = await this.attendanceRepo.findAndCount({
      where,
      relations: { lesson: { group: { subject: true } } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Umumiy statistika — raw SQL
    const stats = await this.attendanceRepo.query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late,
        SUM(CASE WHEN status IN ('absent','unexcused') THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) AS excused
       FROM attendance WHERE student_id = $1`,
      [studentId],
    );

    const row = stats[0] ?? {};
    const totalCount = parseInt(row.total ?? '0');
    const presentCount = parseInt(row.present ?? '0');

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      overallStats: {
        total: totalCount,
        present: presentCount,
        late: parseInt(row.late ?? '0'),
        absent: parseInt(row.absent ?? '0'),
        excused: parseInt(row.excused ?? '0'),
        attendanceRate: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0,
      },
    };
  }

  // ─── QR GENERATSIYA / YANGILASH ───────────────────────────────────────────
  async getLessonQr(lessonId: string, actorId: string, actorRole: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    if (actorRole === Role.USTOZ && lesson.teacherId !== actorId) {
      throw new ForbiddenException('Bu dars sizniki emas');
    }

    // QR yo'q yoki muddati o'tgan bo'lsa yangisini yaratish
    if (!lesson.qrCode || !lesson.qrExpiresAt || lesson.qrExpiresAt < new Date()) {
      await this.qrService.generateForLesson(lesson);
      const updated = await this.lessonRepo.findOne({ where: { id: lessonId } });
      lesson.qrCode = updated!.qrCode;
      lesson.qrExpiresAt = updated!.qrExpiresAt;
    }

    const qrImage = await this.qrService.generateQrImage(JSON.parse(lesson.qrCode!));

    return {
      lessonId,
      qrPayload: lesson.qrCode,
      qrImage,      // base64 PNG — mobil app uchun
      expiresAt: lesson.qrExpiresAt,
    };
  }

  async refreshLessonQr(lessonId: string, actorId: string, actorRole: string) {
    const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Dars topilmadi');

    if (actorRole === Role.USTOZ && lesson.teacherId !== actorId) {
      throw new ForbiddenException('Bu dars sizniki emas');
    }

    const qrPayload = await this.qrService.generateForLesson(lesson);
    const qrImage = await this.qrService.generateQrImage(JSON.parse(qrPayload));

    await this.auditLog.log({
      userId: actorId,
      userRole: actorRole,
      action: 'QR_REFRESHED',
      entityName: 'lessons',
      entityId: lessonId,
    });

    return { message: 'QR kod yangilandi', qrPayload, qrImage };
  }

  // ─── CRON: D+15 QOIDASI ───────────────────────────────────────────────────
  // Har daqiqada ishlaydi — dars boshlanganidan 15 daqiqa o'tsa ota-onaga xabar
  @Cron('* * * * *', { name: 'd15-check', timeZone: 'Asia/Tashkent' })
  async checkD15Rule() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 15 daqiqa oldin boshlangan darslarni topish
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const fifteenMinAgoTime = `${String(fifteenMinAgo.getHours()).padStart(2, '0')}:${String(fifteenMinAgo.getMinutes()).padStart(2, '0')}`;

    const activeLessons = await this.lessonRepo
      .createQueryBuilder('l')
      .where('l.lesson_date = :today', { today })
      .andWhere('l.start_time = :startTime', { startTime: fifteenMinAgoTime })
      .andWhere('l.status = :status', { status: LessonStatus.SCHEDULED })
      .getMany();

    for (const lesson of activeLessons) {
      await this.notifyAbsentStudents(lesson);
    }
  }

  // ─── CRON: DARS BOSHIDA BARCHA O'QUVCHILARNI ABSENT BELGILASH ─────────────
  // Har soatda bir marta — yangi boshlanayotgan darslar uchun
  @Cron('0 * * * *', { name: 'lesson-start-mark', timeZone: 'Asia/Tashkent' })
  async markLessonStart() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const startingLessons = await this.lessonRepo
      .createQueryBuilder('l')
      .where('l.lesson_date = :today', { today })
      .andWhere('l.start_time = :time', { time: currentTime })
      .andWhere('l.status = :status', { status: LessonStatus.SCHEDULED })
      .getMany();

    for (const lesson of startingLessons) {
      await this.initializeLessonAttendance(lesson);
    }

    if (startingLessons.length > 0) {
      this.logger.log(`${startingLessons.length} ta dars davomati boshlandi`);
    }
  }

  // ─── ICHKI YORDAMCHILAR ───────────────────────────────────────────────────

  private async saveOrUpdateAttendance(data: {
    lessonId: string;
    studentId: string;
    status: AttendanceStatus;
    lateMinutes: number | null;
    scannedAt: Date | null;
    syncedFromOffline: boolean;
    excuseReason?: string;
  }): Promise<Attendance> {
    const existing = await this.attendanceRepo.findOne({
      where: { lessonId: data.lessonId, studentId: data.studentId },
    });

    if (existing) {
      await this.attendanceRepo.update(existing.id, {
        status: data.status,
        lateMinutes: data.lateMinutes,
        scannedAt: data.scannedAt,
        syncedFromOffline: data.syncedFromOffline,
        ...(data.excuseReason && { excuseReason: data.excuseReason }),
      });
      return { ...existing, status: data.status } as Attendance;
    }

    const attendance = this.attendanceRepo.create({
      lessonId: data.lessonId,
      studentId: data.studentId,
      status: data.status,
      lateMinutes: data.lateMinutes,
      scannedAt: data.scannedAt,
      syncedFromOffline: data.syncedFromOffline,
      parentNotified: false,
      excuseByParent: false,
      excuseReason: data.excuseReason ?? null,
    });

    return this.attendanceRepo.save(attendance);
  }

  // Dars boshlanganda barcha guruh o'quvchilarini ABSENT belgilash
  private async initializeLessonAttendance(lesson: Lesson) {
    const students = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', 'e.student_id = u.id AND e.group_id = :gid AND e.status = :es', {
        gid: lesson.groupId,
        es: EnrollmentStatus.ACTIVE,
      })
      .select(['u.id'])
      .getMany();

    const existingIds = new Set(
      (await this.attendanceRepo.find({ where: { lessonId: lesson.id }, select: { studentId: true } }))
        .map((a) => a.studentId),
    );

    const toCreate = students
      .filter((s) => !existingIds.has(s.id))
      .map((s) =>
        this.attendanceRepo.create({
          lessonId: lesson.id,
          studentId: s.id,
          status: AttendanceStatus.ABSENT,
          parentNotified: false,
          excuseByParent: false,
          lateMinutes: null,
          scannedAt: null,
          syncedFromOffline: false,
          excuseReason: null,
        }),
      );

    if (toCreate.length) {
      await this.attendanceRepo.save(toCreate);
    }
  }

  // D+15: kelmagan o'quvchilarning ota-onasiga xabar
  private async notifyAbsentStudents(lesson: Lesson) {
    // Kelmagan va xabardor qilinmagan o'quvchilar
    const absentList = await this.attendanceRepo.find({
      where: {
        lessonId: lesson.id,
        status: AttendanceStatus.ABSENT,
        parentNotified: false,
      },
    });

    if (!absentList.length) return;

    const notifications: Notification[] = [];
    const studentIds = absentList.map((a) => a.studentId);

    const parents = await this.parentRepo
      .createQueryBuilder('p')
      .where('p.student_id IN (:...ids)', { ids: studentIds })
      .getMany();

    const parentMap = new Map<string, Parent[]>();
    for (const parent of parents) {
      const list = parentMap.get(parent.studentId) ?? [];
      list.push(parent);
      parentMap.set(parent.studentId, list);
    }

    const students = await this.userRepo.findBy({ id: In([...new Set(studentIds)]) });
    const studentMap = new Map(students.map((s) => [s.id, s]));

    for (const absent of absentList) {
      const student = studentMap.get(absent.studentId);
      if (!student) continue;

      const studentParents = parentMap.get(absent.studentId) ?? [];
      const lessonTime = lesson.startTime.slice(0, 5);

      // O'quvchiga bildirishnoma
      notifications.push(
        this.notificationRepo.create({
          userId: absent.studentId,
          type: NotificationType.ATTENDANCE,
          title: '⚠️ Davomat belgilanmadi',
          body: `Bugun ${lessonTime} dagi darsga siz qatnashmadingiz. Agar sabab bo\'lsa, ota-onangiz orqali kiriting.`,
          pushSent: false,
          smsSent: false,
          telegramSent: false,
        }),
      );

      // Ota-onalarga xabar
      for (const parent of studentParents) {
        notifications.push(
          this.notificationRepo.create({
            userId: absent.studentId,
            type: NotificationType.ATTENDANCE,
            title: `⚠️ ${student.firstName} darsga kelmadi`,
            body: `${student.firstName} ${student.lastName} bugun ${lessonTime} dagi darsga qatnashmadi. Ota-ona: ${parent.fullName} (${parent.phone})`,
            pushSent: false,
            smsSent: false,
            telegramSent: false,
            data: { parentPhone: parent.phone, parentName: parent.fullName },
          }),
        );
      }
    }

    if (notifications.length) {
      await this.notificationRepo.save(notifications);
    }

    // parentNotified = true belgilash
    await this.attendanceRepo
      .createQueryBuilder()
      .update(Attendance)
      .set({ parentNotified: true })
      .where('lesson_id = :lid AND student_id IN (:...ids) AND status = :s', {
        lid: lesson.id,
        ids: studentIds,
        s: AttendanceStatus.ABSENT,
      })
      .execute();

    this.logger.log(`D+15: ${absentList.length} ta o'quvchining ota-onasiga xabar yuborildi (dars: ${lesson.id})`);
  }

  private parseLessonTime(lessonDate: Date, startTime: string): Date {
    const [hours, minutes] = startTime.split(':').map(Number);
    const result = new Date(lessonDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }
}
