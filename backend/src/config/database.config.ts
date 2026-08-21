import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Session } from '../entities/session.entity';
import { Parent } from '../entities/parent.entity';
import { Subject } from '../entities/subject.entity';
import { Group } from '../entities/group.entity';
import { Enrollment } from '../entities/enrollment.entity';
import { Lesson } from '../entities/lesson.entity';
import { Attendance } from '../entities/attendance.entity';
import { Test } from '../entities/test.entity';
import { TestQuestion } from '../entities/test-question.entity';
import { TestResult } from '../entities/test-result.entity';
import { Homework } from '../entities/homework.entity';
import { Material } from '../entities/material.entity';
import { Payment } from '../entities/payment.entity';
import { InstallmentPlan } from '../entities/installment-plan.entity';
import { Expense } from '../entities/expense.entity';
import { Salary } from '../entities/salary.entity';
import { SalaryRecord } from '../entities/salary-record.entity';
import { CashSession } from '../entities/cash-session.entity';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { CollectionEvent } from '../entities/collection-event.entity';
import { Contribution } from '../entities/contribution.entity';
import { PointsLog } from '../entities/points-log.entity';
import { Badge } from '../entities/badge.entity';
import { Book } from '../entities/book.entity';
import { BookTest } from '../entities/book-test.entity';
import { BaselineAssessment } from '../entities/baseline-assessment.entity';
import { ProgressSnapshot } from '../entities/progress-snapshot.entity';
import { VocabularyWord } from '../entities/vocabulary-word.entity';
import { ChatRoom } from '../entities/chat-room.entity';
import { Message } from '../entities/message.entity';
import { Notification } from '../entities/notification.entity';
import { Announcement } from '../entities/announcement.entity';
import { LiveSession } from '../entities/live-session.entity';
import { VideoMessage } from '../entities/video-message.entity';
import { Lead } from '../entities/lead.entity';
import { LeadNote } from '../entities/lead-note.entity';
import { Event } from '../entities/event.entity';
import { EventParticipant } from '../entities/event-participant.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { DutySchedule } from '../entities/duty-schedule.entity';
import { Certificate } from '../entities/certificate.entity';
import { LessonSubstitution } from '../entities/lesson-substitution.entity';
import { TeacherAbsence } from '../entities/teacher-absence.entity';
import { HomeworkSubmission } from '../entities/homework-submission.entity';
import { TestTimeExtension } from '../entities/test-time-extension.entity';
import { TestAttemptGrant } from '../entities/test-attempt-grant.entity';
import { EventQuestion } from '../entities/event-question.entity';
import { EventSubmission } from '../entities/event-submission.entity';
import { SpellingError } from '../entities/spelling-error.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Room } from '../entities/room.entity';
import { ScheduleTimeSlot } from '../entities/schedule-time-slot.entity';

export const getDatabaseConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST', 'localhost'),
  port: config.get<number>('DB_PORT', 5432),
  database: config.get<string>('DB_NAME', 'ilm_crm'),
  username: config.get<string>('DB_USER', 'admin'),
  password: config.get<string>('DB_PASS', 'secret123'),
  synchronize: config.get<string>('APP_ENV') !== 'production',
  logging: config.get<string>('APP_ENV') === 'development',
  entities: [
    User,
    Session,
    Parent,
    Subject,
    Group,
    Enrollment,
    Lesson,
    Attendance,
    Test,
    TestQuestion,
    TestResult,
    Homework,
    Material,
    Payment,
    InstallmentPlan,
    Expense,
    Salary,
    SalaryRecord,
    CashSession,
    Product,
    Sale,
    CollectionEvent,
    Contribution,
    PointsLog,
    Badge,
    Book,
    BookTest,
    BaselineAssessment,
    ProgressSnapshot,
    VocabularyWord,
    ChatRoom,
    Message,
    Notification,
    Announcement,
    LiveSession,
    VideoMessage,
    Lead,
    LeadNote,
    Event,
    EventParticipant,
    AuditLog,
    DutySchedule,
    Certificate,
    LessonSubstitution,
    TeacherAbsence,
    HomeworkSubmission,
    TestTimeExtension,
    TestAttemptGrant,
    EventQuestion,
    EventSubmission,
    SpellingError,
    Permission,
    RolePermission,
    Room,
    ScheduleTimeSlot,
  ],
});
