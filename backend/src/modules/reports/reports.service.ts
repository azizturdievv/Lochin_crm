import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  // ─── ASOSIY DISPATCHER ───────────────────────────────────────────────────────
  async getDashboard(userId: string, role: Role) {
    if (role === Role.SUPER_ADMIN) {
      return this.getAdminDashboard();
    }
    if (role === Role.MANAGER) {
      // Manager operatsion ko'rsatkichlarni ko'radi — daromad/qarzdorlik
      // summasi kabi moliyaviy raqamlarsiz (SA bilan bir xil so'rov emas,
      // alohida metod — moliyaviy ustunlar javobga umuman qo'shilmasin)
      return this.getManagerDashboard();
    }
    if (role === Role.USTOZ) {
      return this.getTeacherDashboard(userId);
    }
    return this.getStudentDashboard(userId);
  }

  // ─── ADMIN / MANAGER DASHBOARD ───────────────────────────────────────────────
  private async getAdminDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // Daromad (bugun / oy / yil)
    const [rev] = await this.ds.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE created_at::date = CURRENT_DATE), 0)::bigint AS today,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= $1),               0)::bigint AS month,
        COALESCE(SUM(amount) FILTER (WHERE created_at >= $2),               0)::bigint AS year
      FROM payments
      WHERE status = 'completed' AND deleted_at IS NULL
    `, [monthStart, yearStart]);

    // O'quvchilar soni
    const [stu] = await this.ds.query(`
      SELECT
        COUNT(*)::int                                    AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int   AS active,
        COUNT(*) FILTER (WHERE created_at >= $1)::int   AS new_this_month
      FROM users
      WHERE role = 'student' AND deleted_at IS NULL
    `, [monthStart]);

    // Qarzdorlar: joriy oy uchun to'lov qilmagan faol o'quvchilar + ularning kutilayotgan
    // oylik to'lovlari jami (guruh narxi × (1 - chegirma%), har bir faol yozilishi bo'yicha)
    const [debt] = await this.ds.query(`
      SELECT
        COUNT(DISTINCT u.id)::int AS count,
        COALESCE(SUM(g.monthly_price * (1 - e.discount_percent / 100.0)), 0)::bigint AS total
      FROM users u
      JOIN enrollments e ON e.student_id = u.id
        AND e.status = 'active' AND e.deleted_at IS NULL
      JOIN groups g ON g.id = e.group_id
      LEFT JOIN payments p ON p.student_id = u.id
        AND p.payment_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        AND p.status = 'completed'
        AND p.deleted_at IS NULL
      WHERE u.role = 'student' AND u.is_active = true
        AND u.deleted_at IS NULL AND p.id IS NULL
    `);

    // Bugungi davomat
    const [att] = await this.ds.query(`
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'present')::int   AS present_today,
        COUNT(*)::int                                        AS total_today,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / COUNT(*))::int
          ELSE 0
        END AS rate_today
      FROM attendance a
      JOIN lessons l ON l.id = a.lesson_id
      WHERE l.lesson_date = CURRENT_DATE AND a.deleted_at IS NULL
    `);

    // 7 kunlik daromad grafigi (O'zbek hafta kunlari nomi)
    const revenueChart = await this.ds.query(`
      SELECT
        TO_CHAR(d::date, 'Dy') AS date,
        COALESCE(SUM(p.amount), 0)::bigint AS amount
      FROM generate_series($1::date, CURRENT_DATE, '1 day') AS d
      LEFT JOIN payments p
        ON p.created_at::date = d::date
        AND p.status = 'completed'
        AND p.deleted_at IS NULL
      GROUP BY d ORDER BY d
    `, [sevenDaysAgo]);

    // Oxirgi 5 to'lov — "firstName" quoted, last_name snake_case
    // O'quvchi arxivlangan (soft-delete) bo'lsa ham chiqib qolmasin — u.deleted_at tekshiruvi shart
    const recentPayments = await this.ds.query(`
      SELECT
        p.id,
        u.last_name || ' ' || u."firstName" AS student_name,
        p.amount::bigint,
        p.method,
        p.created_at
      FROM payments p
      JOIN users u ON u.id = p.student_id
      WHERE p.status = 'completed' AND p.deleted_at IS NULL AND u.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    // Xodimlar KPI
    const staffKpi = await this.ds.query(`
      SELECT
        u.id,
        u.last_name || ' ' || u."firstName" AS name,
        u.role,
        COUNT(g.id)::int                      AS groups,
        COALESCE(SUM(g.current_students), 0)::int AS students
      FROM users u
      LEFT JOIN groups g ON g.teacher_id = u.id
        AND g.is_active = true AND g.deleted_at IS NULL
      WHERE u.role IN ('ustoz', 'manager')
        AND u.is_active = true AND u.deleted_at IS NULL
      GROUP BY u.id, u.last_name, u."firstName", u.role
      ORDER BY students DESC, groups DESC
      LIMIT 10
    `);

    return {
      role: 'admin',
      revenue: {
        today: Number(rev.today),
        month: Number(rev.month),
        year:  Number(rev.year),
      },
      students: {
        total:        stu.total,
        active:       stu.active,
        newThisMonth: stu.new_this_month,
      },
      debt: {
        count: debt.count,
        total: Number(debt.total),
      },
      attendance: {
        rateToday:    att.rate_today,
        presentToday: att.present_today,
        totalToday:   att.total_today,
      },
      revenueChart: revenueChart.map((r: Record<string, unknown>) => ({
        date:   r.date,
        amount: Number(r.amount),
      })),
      recentPayments: recentPayments.map((p: Record<string, unknown>) => ({
        id:          p.id,
        studentName: p.student_name,
        amount:      Number(p.amount),
        method:      p.method,
        createdAt:   p.created_at,
      })),
      staffKpi: staffKpi.map((s: Record<string, unknown>) => ({
        id:       s.id,
        name:     s.name,
        role:     s.role,
        groups:   s.groups,
        students: s.students,
      })),
    };
  }

  // ─── MANAGER DASHBOARD (moliyaviy summalarsiz — faqat operatsion) ────────────
  // Manager "Hisobotlar"ni ko'ra olmaydi (finance:report:read ruxsati yo'q) —
  // shu sabab bosh sahifada ham daromad/qarzdorlik summasi kabi moliyaviy
  // raqamlar berilmaydi. Faoliyat ko'rsatkichlari (nechta to'lov, nechta
  // qarzdor) qoladi — bular pul miqdorini oshkor qilmaydi
  private async getManagerDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [stu] = await this.ds.query(`
      SELECT
        COUNT(*)::int                                    AS total,
        COUNT(*) FILTER (WHERE is_active = true)::int   AS active,
        COUNT(*) FILTER (WHERE created_at >= $1)::int   AS new_this_month
      FROM users
      WHERE role = 'student' AND deleted_at IS NULL
    `, [monthStart]);

    // Qarzdorlar soni — summasiz (faqat kim bilan bog'lanish kerakligini bilish uchun)
    const [debt] = await this.ds.query(`
      SELECT COUNT(DISTINCT u.id)::int AS count
      FROM users u
      JOIN enrollments e ON e.student_id = u.id
        AND e.status = 'active' AND e.deleted_at IS NULL
      LEFT JOIN payments p ON p.student_id = u.id
        AND p.payment_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        AND p.status = 'completed'
        AND p.deleted_at IS NULL
      WHERE u.role = 'student' AND u.is_active = true
        AND u.deleted_at IS NULL AND p.id IS NULL
    `);

    const [att] = await this.ds.query(`
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'present')::int   AS present_today,
        COUNT(*)::int                                        AS total_today,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / COUNT(*))::int
          ELSE 0
        END AS rate_today
      FROM attendance a
      JOIN lessons l ON l.id = a.lesson_id
      WHERE l.lesson_date = CURRENT_DATE AND a.deleted_at IS NULL
    `);

    // Bugungi to'lovlar soni — summasiz
    const [payToday] = await this.ds.query(`
      SELECT COUNT(*)::int AS count
      FROM payments
      WHERE status = 'completed' AND deleted_at IS NULL AND created_at::date = CURRENT_DATE
    `);

    // 7 kunlik to'lov FAOLLIGI grafigi — summasi emas, nechta to'lov qabul qilingani
    const paymentsChart = await this.ds.query(`
      SELECT
        TO_CHAR(d::date, 'Dy') AS date,
        COUNT(p.id)::int AS count
      FROM generate_series($1::date, CURRENT_DATE, '1 day') AS d
      LEFT JOIN payments p
        ON p.created_at::date = d::date
        AND p.status = 'completed'
        AND p.deleted_at IS NULL
      GROUP BY d ORDER BY d
    `, [sevenDaysAgo]);

    // Oxirgi to'lovlar — kim, qachon, qanday usulda — summasiz
    const recentPayments = await this.ds.query(`
      SELECT
        p.id,
        u.last_name || ' ' || u."firstName" AS student_name,
        p.method,
        p.created_at
      FROM payments p
      JOIN users u ON u.id = p.student_id
      WHERE p.status = 'completed' AND p.deleted_at IS NULL AND u.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 5
    `);

    const staffKpi = await this.ds.query(`
      SELECT
        u.id,
        u.last_name || ' ' || u."firstName" AS name,
        u.role,
        COUNT(g.id)::int                      AS groups,
        COALESCE(SUM(g.current_students), 0)::int AS students
      FROM users u
      LEFT JOIN groups g ON g.teacher_id = u.id
        AND g.is_active = true AND g.deleted_at IS NULL
      WHERE u.role IN ('ustoz', 'manager')
        AND u.is_active = true AND u.deleted_at IS NULL
      GROUP BY u.id, u.last_name, u."firstName", u.role
      ORDER BY students DESC, groups DESC
      LIMIT 10
    `);

    return {
      role: 'manager',
      students: {
        total:        stu.total,
        active:       stu.active,
        newThisMonth: stu.new_this_month,
      },
      debtorsCount: debt.count,
      attendance: {
        rateToday:    att.rate_today,
        presentToday: att.present_today,
        totalToday:   att.total_today,
      },
      paymentsToday: payToday.count,
      paymentsChart: paymentsChart.map((r: Record<string, unknown>) => ({
        date:  r.date,
        count: Number(r.count),
      })),
      recentPayments: recentPayments.map((p: Record<string, unknown>) => ({
        id:          p.id,
        studentName: p.student_name,
        method:      p.method,
        createdAt:   p.created_at,
      })),
      staffKpi: staffKpi.map((s: Record<string, unknown>) => ({
        id:       s.id,
        name:     s.name,
        role:     s.role,
        groups:   s.groups,
        students: s.students,
      })),
    };
  }

  // ─── USTOZ DASHBOARD ─────────────────────────────────────────────────────────
  private async getTeacherDashboard(userId: string) {
    // O'z guruhlari + keyingi dars
    const groups = await this.ds.query(`
      SELECT
        g.id,
        g.name,
        s.name           AS subject_name,
        g.current_students,
        g.max_students,
        nl.lesson_date   AS next_date,
        nl.start_time    AS next_start,
        nl.end_time      AS next_end
      FROM groups g
      JOIN subjects s ON s.id = g.subject_id
      LEFT JOIN LATERAL (
        SELECT lesson_date, start_time, end_time
        FROM lessons
        WHERE group_id = g.id
          AND lesson_date >= CURRENT_DATE
          AND deleted_at IS NULL
        ORDER BY lesson_date, start_time
        LIMIT 1
      ) nl ON true
      WHERE g.teacher_id = $1
        AND g.is_active = true
        AND g.deleted_at IS NULL
      ORDER BY g.name
    `, [userId]);

    // Bugungi darslar (davomat soni bilan)
    const todayLessons = await this.ds.query(`
      SELECT
        l.id,
        g.name           AS group_name,
        s.name           AS subject_name,
        l.start_time,
        l.end_time,
        l.room_number,
        l.status,
        COUNT(a.id) FILTER (WHERE a.status = 'present')::int AS present,
        COUNT(a.id) FILTER (WHERE a.status = 'late')::int    AS late,
        g.current_students                                    AS total
      FROM lessons l
      JOIN groups g ON g.id = l.group_id
      JOIN subjects s ON s.id = g.subject_id
      LEFT JOIN attendance a ON a.lesson_id = l.id AND a.deleted_at IS NULL
      WHERE l.teacher_id = $1
        AND l.lesson_date = CURRENT_DATE
        AND l.deleted_at IS NULL
      GROUP BY l.id, g.name, s.name,
               l.start_time, l.end_time, l.room_number, l.status,
               g.current_students
      ORDER BY l.start_time
    `, [userId]);

    // Test statistikasi (teacher yaratgan testlar)
    const [testStats] = await this.ds.query(`
      SELECT
        COUNT(*)::int                                          AS total_tests,
        ROUND(AVG(tr.score))::int                             AS avg_score,
        COUNT(*) FILTER (WHERE t.status = 'published')::int   AS published
      FROM tests t
      LEFT JOIN test_results tr ON tr.test_id = t.id
      WHERE t.created_by = $1 AND t.deleted_at IS NULL
    `, [userId]);

    return {
      role: 'ustoz',
      groups: groups.map((g: Record<string, unknown>) => ({
        id:              g.id,
        name:            g.name,
        subjectName:     g.subject_name,
        currentStudents: g.current_students,
        maxStudents:     g.max_students,
        nextLesson: g.next_date ? {
          date:      g.next_date,
          startTime: g.next_start,
          endTime:   g.next_end,
        } : null,
      })),
      todayLessons: todayLessons.map((l: Record<string, unknown>) => ({
        id:          l.id,
        groupName:   l.group_name,
        subjectName: l.subject_name,
        startTime:   l.start_time,
        endTime:     l.end_time,
        room:        l.room_number,
        status:      l.status,
        present:     l.present,
        late:        l.late,
        total:       l.total,
      })),
      testStats: {
        totalTests: testStats?.total_tests ?? 0,
        avgScore:   testStats?.avg_score   ?? 0,
        published:  testStats?.published   ?? 0,
      },
    };
  }

  // ─── STUDENT DASHBOARD ───────────────────────────────────────────────────────
  private async getStudentDashboard(userId: string) {
    // Umumiy ball
    const [userRow] = await this.ds.query(`
      SELECT total_points FROM users WHERE id = $1
    `, [userId]);

    // Davomat foizi (oxirgi 30 kun)
    const [attRow] = await this.ds.query(`
      SELECT
        COUNT(*) FILTER (WHERE a.status IN ('present', 'late'))::int AS attended,
        COUNT(*)::int                                                  AS total
      FROM attendance a
      JOIN lessons l ON l.id = a.lesson_id
      WHERE a.student_id = $1
        AND l.lesson_date >= (CURRENT_DATE - INTERVAL '30 days')
        AND a.deleted_at IS NULL
    `, [userId]);

    const attendanceRate = attRow.total > 0
      ? Math.round((attRow.attended * 100) / attRow.total)
      : 100;

    // Keyingi dars
    const [nextLesson] = await this.ds.query(`
      SELECT
        g.name        AS group_name,
        s.name        AS subject_name,
        l.lesson_date,
        l.start_time,
        l.end_time,
        l.room_number
      FROM lessons l
      JOIN groups g ON g.id = l.group_id
      JOIN subjects s ON s.id = g.subject_id
      JOIN enrollments e ON e.group_id = g.id
        AND e.student_id = $1
        AND e.status = 'active'
        AND e.deleted_at IS NULL
      WHERE l.lesson_date >= CURRENT_DATE
        AND l.deleted_at IS NULL
        AND (l.lesson_date > CURRENT_DATE OR l.start_time > CURRENT_TIME::time)
      ORDER BY l.lesson_date, l.start_time
      LIMIT 1
    `, [userId]);

    // To'lov holati (joriy oy)
    const [payRow] = await this.ds.query(`
      SELECT
        COALESCE(SUM(p.amount), 0)::bigint AS paid_this_month,
        COUNT(e.id)::int                   AS active_enrollments
      FROM enrollments e
      LEFT JOIN payments p
        ON p.student_id = $1
        AND p.payment_month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        AND p.status = 'completed'
        AND p.deleted_at IS NULL
      WHERE e.student_id = $1
        AND e.status = 'active'
        AND e.deleted_at IS NULL
    `, [userId]);

    // Oxirgi test natijasi
    const [lastTest] = await this.ds.query(`
      SELECT t.title, tr.score::numeric, tr.earned_points, tr.finished_at
      FROM test_results tr
      JOIN tests t ON t.id = tr.test_id
      WHERE tr.student_id = $1 AND tr.finished_at IS NOT NULL
      ORDER BY tr.finished_at DESC
      LIMIT 1
    `, [userId]);

    const paidMonth     = Number(payRow?.paid_this_month ?? 0);
    const activeEnrolls = payRow?.active_enrollments ?? 0;

    return {
      role: 'student',
      totalPoints:    userRow?.total_points ?? 0,
      attendanceRate,
      attendedDays:   attRow.attended,
      totalDays:      attRow.total,
      nextLesson: nextLesson ? {
        groupName:   nextLesson.group_name,
        subjectName: nextLesson.subject_name,
        date:        nextLesson.lesson_date,
        startTime:   nextLesson.start_time,
        endTime:     nextLesson.end_time,
        room:        nextLesson.room_number,
      } : null,
      paymentStatus: {
        paidThisMonth:     paidMonth,
        activeEnrollments: activeEnrolls,
        hasDebt:           paidMonth === 0 && activeEnrolls > 0,
      },
      lastTestResult: lastTest ? {
        title:        lastTest.title,
        score:        Number(lastTest.score),
        earnedPoints: lastTest.earned_points,
        finishedAt:   lastTest.finished_at,
      } : null,
    };
  }
}
