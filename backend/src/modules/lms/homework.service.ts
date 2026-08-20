import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Homework } from '../../entities/homework.entity';
import { HomeworkSubmission, SubmissionStatus } from '../../entities/homework-submission.entity';
import { Lesson } from '../../entities/lesson.entity';
import { Group } from '../../entities/group.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { User } from '../../entities/user.entity';
import { PointsLog, PointsAction } from '../../entities/points-log.entity';
import { Notification, NotificationType } from '../../entities/notification.entity';
import { Role } from '../../common/enums/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MinioService } from './minio.service';
import { CreateHomeworkDto, GradeHomeworkDto } from './dto/homework.dto';

// Streak mukofotlari
const STREAK_REWARDS: Record<number, number> = {
  7: 10,   // 7 kunlik streak → +10 ball
  14: 20,  // 14 kunlik streak → +20 ball
  30: 50,  // 30 kunlik streak → +50 ball
};

@Injectable()
export class HomeworkService {
  constructor(
    @InjectRepository(Homework)
    private homeworkRepo: Repository<Homework>,
    @InjectRepository(HomeworkSubmission)
    private submissionRepo: Repository<HomeworkSubmission>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(PointsLog)
    private pointsRepo: Repository<PointsLog>,
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    @InjectRepository(Lesson)
    private lessonRepo: Repository<Lesson>,
    @InjectRepository(Group)
    private groupRepo: Repository<Group>,
    private minioService: MinioService,
    private auditLog: AuditLogService,
  ) {}

  // ─── GURUH DARSLARI (vazifa yaratishda tanlash uchun) ─────────────────────
  async findLessonsByGroup(groupId: string) {
    return this.lessonRepo.find({
      where: { groupId },
      order: { lessonDate: 'DESC' },
      take: 20,
      select: { id: true, lessonDate: true, startTime: true, endTime: true, topic: true },
    });
  }

  // ─── VAZIFA YARATISH (USTOZ) ──────────────────────────────────────────────
  async create(dto: CreateHomeworkDto, actorId: string, actorRole: string) {
    const group = await this.groupRepo.findOne({ where: { id: dto.groupId } });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!group.isActive) {
      throw new BadRequestException('Nofaol guruh uchun vazifa yaratib bo\'lmaydi');
    }

    const homework = this.homeworkRepo.create({
      lessonId: dto.lessonId,
      groupId: dto.groupId,
      title: dto.title,
      description: dto.description ?? null,
      dueDate: new Date(dto.dueDate),
      maxScore: dto.maxScore ?? 100,
      attachmentUrls: [],
    });

    await this.homeworkRepo.save(homework);

    // Guruh o'quvchilariga bildirishnoma
    const students = await this.userRepo.query(
      `SELECT u.id FROM users u
       INNER JOIN enrollments e ON e.student_id = u.id
       WHERE e.group_id = $1 AND e.status = 'active'`,
      [dto.groupId],
    );

    if (students.length) {
      await this.notifRepo.save(
        students.map((s: { id: string }) =>
          this.notifRepo.create({
            userId: s.id,
            type: NotificationType.HOMEWORK,
            title: '📚 Yangi vazifa',
            body: `"${dto.title}" — muddat: ${new Date(dto.dueDate).toLocaleDateString('uz-UZ')}`,
            data: { homeworkId: homework.id },
            pushSent: false, smsSent: false, telegramSent: false,
          }),
        ),
      );
    }

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'HOMEWORK_CREATED',
      entityName: 'homework', entityId: homework.id,
      newValues: { title: dto.title, groupId: dto.groupId, dueDate: dto.dueDate },
    });

    return homework;
  }

  // ─── VAZIFA TOPSHIRISH (O'QUVCHI) ─────────────────────────────────────────
  async submit(
    homeworkId: string,
    studentId: string,
    content?: string,
    fileUrls: string[] = [],
  ) {
    const homework = await this.homeworkRepo.findOne({ where: { id: homeworkId } });
    if (!homework) throw new NotFoundException('Vazifa topilmadi');

    // O'quvchi guruhda ekanini tekshirish
    const enrolled = await this.enrollmentRepo.findOne({
      where: { studentId, groupId: homework.groupId, status: EnrollmentStatus.ACTIVE },
    });
    if (!enrolled) throw new ForbiddenException('Siz bu guruhga yozilmagansiz');

    // Takror topshirish tekshirish
    const existing = await this.submissionRepo.findOne({
      where: { homeworkId, studentId },
    });

    const now = new Date();
    // `due_date` — sana-only ustun, pg drayveri uni mahalliy vaqt yarim
    // tuniga aylantiradi (server: Asia/Samarkand). To'g'ridan-to'g'ri shu
    // instantga solishtirilsa, muddat kunining o'zi ham "kech" hisoblanib
    // qolardi — kesim mahalliy kunning OXIRI (keyingi kun yarim tuni)
    // bo'lishi kerak, boshi emas.
    const dueDateEnd = new Date(homework.dueDate);
    dueDateEnd.setDate(dueDateEnd.getDate() + 1);
    const isLate = now > dueDateEnd;
    const onTime = !isLate;

    if (existing) {
      // Qayta topshirish (resubmit)
      if (existing.status === SubmissionStatus.GRADED) {
        throw new ConflictException('Baholangan vazifani qayta topshirib bo\'lmaydi');
      }
      await this.submissionRepo.update(existing.id, {
        content: content ?? null,
        fileUrls,
        status: isLate ? SubmissionStatus.LATE : SubmissionStatus.RESUBMITTED,
        isLate,
        onTime,
        submittedAt: now,
      });
      return this.submissionRepo.findOne({ where: { id: existing.id } });
    }

    const submission = this.submissionRepo.create({
      homeworkId,
      studentId,
      content: content ?? null,
      fileUrls,
      status: isLate ? SubmissionStatus.LATE : SubmissionStatus.SUBMITTED,
      isLate,
      onTime,
      submittedAt: now,
    });

    await this.submissionRepo.save(submission);

    // Streak hisoblash
    await this.updateStreak(studentId, onTime);

    return submission;
  }

  // ─── BAHOLASH (USTOZ) ─────────────────────────────────────────────────────
  async grade(dto: GradeHomeworkDto, actorId: string, actorRole: string) {
    const submission = await this.submissionRepo.findOne({
      where: { id: dto.submissionId },
      relations: { homework: true, student: true },
    });

    if (!submission) throw new NotFoundException('Topshiriq topilmadi');

    await this.submissionRepo.update(submission.id, {
      score: dto.score,
      teacherComment: dto.teacherComment ?? null,
      status: SubmissionStatus.GRADED,
      gradedAt: new Date(),
      gradedById: actorId,
    });

    // O'quvchiga bildirishnoma
    await this.notifRepo.save(
      this.notifRepo.create({
        userId: submission.studentId,
        type: NotificationType.HOMEWORK,
        title: '✅ Vazifa baholandi',
        body: `"${submission.homework.title}": ${dto.score}/${submission.homework.maxScore} ball${dto.teacherComment ? ' — ' + dto.teacherComment : ''}`,
        data: { submissionId: submission.id },
        pushSent: false, smsSent: false, telegramSent: false,
      }),
    );

    await this.auditLog.log({
      userId: actorId, userRole: actorRole,
      action: 'HOMEWORK_GRADED',
      entityName: 'homework_submissions', entityId: submission.id,
      newValues: { score: dto.score },
    });

    return this.submissionRepo.findOne({ where: { id: submission.id } });
  }

  // ─── RO'YXAT ─────────────────────────────────────────────────────────────
  async findByGroup(groupId: string, actorId: string, actorRole: string) {
    const homeworks = await this.homeworkRepo.find({
      where: { groupId },
      order: { dueDate: 'DESC' },
    });

    if (actorRole !== Role.STUDENT || homeworks.length === 0) return homeworks;

    // O'quvchi uchun: har vazifaga o'zining topshirig'ini biriktirish
    const submissions = await this.submissionRepo.find({
      where: { studentId: actorId, homeworkId: In(homeworks.map((h) => h.id)) },
    });
    const byHomeworkId = new Map(submissions.map((s) => [s.homeworkId, s]));

    return homeworks.map((h) => ({
      ...h,
      mySubmission: byHomeworkId.get(h.id) ?? null,
    }));
  }

  async getSubmissions(homeworkId: string) {
    const homework = await this.homeworkRepo.findOne({ where: { id: homeworkId } });
    if (!homework) throw new NotFoundException('Vazifa topilmadi');

    const rawSubmissions = await this.submissionRepo.find({
      where: { homeworkId },
      order: { submittedAt: 'DESC' },
    });

    // O'quvchi keyinchalik arxivlangan bo'lsa ham, topshiriq ro'yxatida ismi
    // ko'rinishi kerak — TypeORM relation-join arxivlangan yozuvni avtomatik
    // chetlab o'tadi, shuning uchun alohida so'rov (.withDeleted()) bilan olinadi
    const studentIds = [...new Set(rawSubmissions.map((s) => s.studentId))];
    const students = studentIds.length
      ? await this.userRepo.createQueryBuilder('u').withDeleted().where('u.id IN (:...ids)', { ids: studentIds }).getMany()
      : [];
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const submissions = rawSubmissions.map((s) => ({ ...s, student: studentMap.get(s.studentId) ?? null }));

    const stats = {
      total: submissions.length,
      onTime: submissions.filter((s) => s.onTime).length,
      late: submissions.filter((s) => s.isLate).length,
      graded: submissions.filter((s) => s.status === SubmissionStatus.GRADED).length,
      avgScore: submissions
        .filter((s) => s.score !== null)
        .reduce((acc, s) => ({ sum: acc.sum + Number(s.score), count: acc.count + 1 }),
                { sum: 0, count: 0 }),
    };

    return {
      homework,
      stats: {
        ...stats,
        avgScore: stats.avgScore.count > 0
          ? Math.round(stats.avgScore.sum / stats.avgScore.count * 10) / 10
          : 0,
      },
      submissions,
    };
  }

  // ─── STREAK HISOBLASH ─────────────────────────────────────────────────────
  private async updateStreak(studentId: string, onTime: boolean) {
    if (!onTime) return;

    // O'z vaqtida topshirilgan ketma-ket vazifalar soni
    const recentSubmissions = await this.submissionRepo.query(
      `SELECT on_time FROM homework_submissions
       WHERE student_id = $1 AND status != 'graded'
       ORDER BY submitted_at DESC
       LIMIT 30`,
      [studentId],
    );

    let streak = 0;
    for (const s of recentSubmissions) {
      if (s.on_time) streak++;
      else break;
    }

    // Streak mukofotlari
    const reward = STREAK_REWARDS[streak];
    if (reward) {
      await this.pointsRepo.save(
        this.pointsRepo.create({
          userId: studentId,
          action: PointsAction.MANUAL,
          points: reward,
          description: `${streak} kunlik streak mukofoti!`,
        }),
      );
      await this.userRepo.increment({ id: studentId }, 'totalPoints', reward);

      await this.notifRepo.save(
        this.notifRepo.create({
          userId: studentId,
          type: NotificationType.SYSTEM,
          title: `🔥 ${streak} kunlik streak!`,
          body: `Tabriklaymiz! Ketma-ket ${streak} ta vazifani o'z vaqtida topshirdingiz. +${reward} ball!`,
          pushSent: false, smsSent: false, telegramSent: false,
        }),
      );
    }
  }
}
