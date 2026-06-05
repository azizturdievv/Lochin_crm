import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { StudentsModule } from './modules/students/students.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ScheduleModule as JadvalModule } from './modules/schedule/schedule.module';
import { LeadsModule } from './modules/leads/leads.module';
import { LmsModule } from './modules/lms/lms.module';
import { FinanceModule } from './modules/finance/finance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { SubstitutionModule } from './modules/substitution/substitution.module';
import { EventsModule } from './modules/events/events.module';
import { QualityModule } from './modules/quality/quality.module';
import { UsersModule } from './modules/users/users.module';
import { GroupsModule } from './modules/groups/groups.module';
import { ReportsModule } from './modules/reports/reports.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // Cron job uchun
    ScheduleModule.forRoot(),

    // .env faylini yuklash
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // PostgreSQL ulanishi
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Auth moduli (JWT + 2FA)
    AuthModule,

    // Audit log moduli
    AuditLogModule,

    // O'quvchilar moduli
    StudentsModule,

    // To'lovlar moduli
    PaymentsModule,

    // Davomat moduli
    AttendanceModule,

    // Jadval moduli
    JadvalModule,

    // Lidlar moduli
    LeadsModule,

    // LMS moduli
    LmsModule,

    // Moliya moduli
    FinanceModule,

    // Bildirishnomalar moduli (SMS + Telegram + Push)
    NotificationsModule,

    // Chat moduli (WebSocket + AI moderatsiya)
    ChatModule,

    // Gamifikatsiya moduli (ball, badge, kitob, lug'at)
    GamificationModule,

    // O'rinbosarlik moduli (TZ 15-bo'lim)
    SubstitutionModule,

    // Tadbirlar moduli (TZ 11-bo'lim)
    EventsModule,

    // Sifat nazorati moduli
    QualityModule,

    // Xodimlar moduli (manager, ustoz CRUD)
    UsersModule,

    // Guruhlar moduli
    GroupsModule,

    // Hisobotlar moduli (dashboard, rol bo'yicha)
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Global JWT guard — barcha endpointlar himoyalangan
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Global RBAC guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
