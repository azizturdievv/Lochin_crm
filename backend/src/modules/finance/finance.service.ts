import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { Expense } from '../../entities/expense.entity';
import { SalaryRecord } from '../../entities/salary-record.entity';
import { User } from '../../entities/user.entity';
import { Enrollment, EnrollmentStatus } from '../../entities/enrollment.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(Expense)
    private expenseRepo: Repository<Expense>,
    @InjectRepository(SalaryRecord)
    private recordRepo: Repository<SalaryRecord>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
  ) {}

  // ─── KPI DASHBOARD ────────────────────────────────────────────────────────
  async getKpiDashboard(month: string) {
    // Jami tushum
    const incomeRow = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .select(['SUM(p.amount) AS total', 'COUNT(*) AS cnt'])
      .getRawOne();

    const totalIncome = Number(incomeRow?.total ?? 0);

    // Operatsion xarajatlar
    const expRow = await this.expenseRepo
      .createQueryBuilder('e')
      .where("TO_CHAR(e.expense_date, 'YYYY-MM') = :month", { month })
      .andWhere('e.deleted_at IS NULL')
      .select('SUM(e.amount) AS total')
      .getRawOne();

    const operationalExpenses = Number(expRow?.total ?? 0);

    // Maosh xarajatlari (tasdiqlangan/to'langan)
    const salRow = await this.recordRepo
      .createQueryBuilder('sr')
      .where('sr.period_month = :month', { month })
      .andWhere('sr.status IN (:...st)', { st: ['approved', 'paid'] })
      .andWhere('sr.deleted_at IS NULL')
      .select('SUM(sr.total_amount) AS total')
      .getRawOne();

    const salaryExpenses = Number(salRow?.total ?? 0);
    const totalExpenses = operationalExpenses + salaryExpenses;
    const netProfit = totalIncome - totalExpenses;
    const marginPercent =
      totalIncome > 0 ? Math.round((netProfit / totalIncome) * 1000) / 10 : 0;

    // Faol o'quvchilar
    const activeStudents = await this.enrollmentRepo.count({
      where: { status: EnrollmentStatus.ACTIVE },
    });

    // Qarzdorlar soni
    const debtorCount = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', "e.student_id = u.id AND e.status = 'active' AND e.deleted_at IS NULL")
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.student_id = u.id
            AND p.payment_month = :month
            AND p.status = 'completed'
            AND p.deleted_at IS NULL
        )`,
        { month },
      )
      .getCount();

    // Qarz summasi: yozilmagan o'quvchilarning guruh narxlari jami
    const debtRow = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', "e.student_id = u.id AND e.status = 'active' AND e.deleted_at IS NULL")
      .innerJoin('groups', 'g', 'g.id = e.group_id AND g.deleted_at IS NULL')
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.student_id = u.id
            AND p.payment_month = :month
            AND p.status = 'completed'
            AND p.deleted_at IS NULL
        )`,
        { month },
      )
      .select('SUM(g.monthly_price) AS debt_total')
      .getRawOne();

    const debtAmount = Number(debtRow?.debt_total ?? 0);

    return {
      month,
      totalIncome,
      totalExpenses,
      expensesBreakdown: { operational: operationalExpenses, salaries: salaryExpenses },
      netProfit,
      marginPercent,
      activeStudents,
      debtorCount,
      debtAmount,
    };
  }

  // ─── OYLIK P&L ────────────────────────────────────────────────────────────
  async getMonthlyPnl(month: string) {
    const kpi = await this.getKpiDashboard(month);

    // To'lov usuli bo'yicha
    const byMethod = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .select(['p.method AS method', 'SUM(p.amount) AS total', 'COUNT(*) AS cnt'])
      .groupBy('p.method')
      .orderBy('total', 'DESC')
      .getRawMany();

    // To'lov turi bo'yicha
    const byType = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .select(['p.type AS type', 'SUM(p.amount) AS total', 'COUNT(*) AS cnt'])
      .groupBy('p.type')
      .orderBy('total', 'DESC')
      .getRawMany();

    // Fan bo'yicha daromad
    const bySubject = await this.getSubjectRevenueForMonth(month);

    // Xarajat kategoriya bo'yicha
    const expByCategory = await this.expenseRepo
      .createQueryBuilder('e')
      .where("TO_CHAR(e.expense_date, 'YYYY-MM') = :month", { month })
      .andWhere('e.deleted_at IS NULL')
      .select(['e.category AS category', 'SUM(e.amount) AS total'])
      .groupBy('e.category')
      .orderBy('total', 'DESC')
      .getRawMany();

    return {
      ...kpi,
      income: {
        byMethod: byMethod.map((r) => ({
          method: r.method,
          total: Number(r.total),
          count: Number(r.cnt),
        })),
        byType: byType.map((r) => ({
          type: r.type,
          total: Number(r.total),
          count: Number(r.cnt),
        })),
        bySubject,
      },
      expenses: {
        byCategory: expByCategory.map((r) => ({
          category: r.category,
          total: Number(r.total),
        })),
      },
    };
  }

  // ─── YILLIK P&L ───────────────────────────────────────────────────────────
  async getAnnualPnl(year: string) {
    const months = Array.from({ length: 12 }, (_, i) =>
      `${year}-${String(i + 1).padStart(2, '0')}`,
    );

    const monthlyData = await Promise.all(months.map((m) => this.getKpiDashboard(m)));

    const annualTotal = monthlyData.reduce(
      (acc, m) => ({
        income: acc.income + m.totalIncome,
        expenses: acc.expenses + m.totalExpenses,
        netProfit: acc.netProfit + m.netProfit,
      }),
      { income: 0, expenses: 0, netProfit: 0 },
    );

    const annualMargin =
      annualTotal.income > 0
        ? Math.round((annualTotal.netProfit / annualTotal.income) * 1000) / 10
        : 0;

    return {
      year,
      months: monthlyData,
      annualTotal: { ...annualTotal, marginPercent: annualMargin },
    };
  }

  // ─── FAN BO'YICHA DAROMAD ─────────────────────────────────────────────────
  async getSubjectRevenue(year: string) {
    const months = Array.from({ length: 12 }, (_, i) =>
      `${year}-${String(i + 1).padStart(2, '0')}`,
    );

    const monthly = await Promise.all(
      months.map(async (m) => ({ month: m, subjects: await this.getSubjectRevenueForMonth(m) })),
    );

    // Yillik jami fan bo'yicha
    const totals: Record<string, number> = {};
    for (const { subjects } of monthly) {
      for (const { subjectName, total } of subjects) {
        totals[subjectName] = (totals[subjectName] ?? 0) + total;
      }
    }

    return {
      year,
      monthly,
      annual: Object.entries(totals)
        .map(([subjectName, total]) => ({ subjectName, total }))
        .sort((a, b) => b.total - a.total),
    };
  }

  // ─── YORDAMCHI: bitta oy uchun fan daromadi ───────────────────────────────
  private async getSubjectRevenueForMonth(month: string) {
    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('users', 'u', 'u.id = p.student_id')
      .innerJoin(
        'enrollments',
        'e',
        "e.student_id = u.id AND e.status = 'active' AND e.deleted_at IS NULL",
      )
      .innerJoin('groups', 'g', 'g.id = e.group_id AND g.deleted_at IS NULL')
      .innerJoin('subjects', 'sub', 'sub.id = g.subject_id AND sub.deleted_at IS NULL')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .select([
        'sub.name AS subject_name',
        'SUM(p.amount) AS total',
        'COUNT(DISTINCT u.id) AS students',
      ])
      .groupBy('sub.name')
      .orderBy('total', 'DESC')
      .getRawMany();

    return rows.map((r) => ({
      subjectName: r.subject_name,
      total: Number(r.total),
      studentCount: Number(r.students),
    }));
  }

  // ─── EXCEL EKSPORT: P&L ───────────────────────────────────────────────────
  async exportPnlExcel(month: string): Promise<Buffer> {
    const pnl = await this.getMonthlyPnl(month);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lochin School CRM';
    wb.created = new Date();

    const ws = wb.addWorksheet(`P&L — ${month}`);
    ws.columns = [{ width: 35 }, { width: 22 }, { width: 12 }];

    // Sarlavha
    ws.mergeCells('A1:C1');
    const title = ws.getCell('A1');
    title.value = `LOCHIN SCHOOL — P&L Hisoboti (${month})`;
    title.font = { bold: true, size: 14 };
    title.alignment = { horizontal: 'center' };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
    title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };

    let rowIdx = 3;
    const hdrRow = ws.getRow(rowIdx);
    hdrRow.values = ['Ko\'rsatkich', 'Summa (so\'m)', '%'];
    hdrRow.font = { bold: true };
    hdrRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };

    const addSection = (label: string, value: number, pct?: number, isTotal = false) => {
      rowIdx++;
      const row = ws.getRow(rowIdx);
      row.values = [label, value, pct !== undefined ? pct : ''];
      row.getCell(2).numFmt = '#,##0';
      if (isTotal) {
        row.font = { bold: true };
        row.getCell(2).font = {
          bold: true,
          color: { argb: value >= 0 ? 'FF2E7D32' : 'FFC62828' },
        };
      }
    };

    addSection('JAMI DAROMAD', pnl.totalIncome, 100, true);
    for (const m of pnl.income.byMethod) {
      const pct = pnl.totalIncome > 0 ? Math.round((m.total / pnl.totalIncome) * 1000) / 10 : 0;
      addSection(`  • ${m.method} (${m.count} ta)`, m.total, pct);
    }

    rowIdx++;
    addSection('JAMI XARAJAT', pnl.totalExpenses, undefined, true);
    addSection('  • Maoshlar', pnl.expensesBreakdown.salaries);
    addSection('  • Operatsion', pnl.expensesBreakdown.operational);
    for (const c of pnl.expenses.byCategory) {
      addSection(`    — ${c.category}`, c.total);
    }

    rowIdx++;
    addSection('SOF FOYDA', pnl.netProfit, pnl.marginPercent, true);
    addSection('MARJA %', pnl.marginPercent);

    rowIdx += 2;
    addSection('Faol o\'quvchilar', pnl.activeStudents, undefined, true);
    addSection('Qarzdorlar soni', pnl.debtorCount);
    addSection('Qarz summasi', pnl.debtAmount);

    if (pnl.income.bySubject.length > 0) {
      rowIdx += 2;
      const subHdr = ws.getRow(rowIdx);
      subHdr.values = ['FAN BO\'YICHA DAROMAD', '', ''];
      subHdr.font = { bold: true };
      subHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
      for (const s of pnl.income.bySubject) {
        const pct = pnl.totalIncome > 0 ? Math.round((s.total / pnl.totalIncome) * 1000) / 10 : 0;
        addSection(`  ${s.subjectName} (${s.studentCount} o'q)`, s.total, pct);
      }
    }

    // Chegara
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── EXCEL EKSPORT: MAOSH ─────────────────────────────────────────────────
  async exportSalaryExcel(month: string, records: SalaryRecord[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lochin School CRM';

    const ws = wb.addWorksheet(`Maosh — ${month}`);
    ws.columns = [
      { width: 28 }, { width: 18 }, { width: 14 },
      { width: 16 }, { width: 14 }, { width: 18 }, { width: 14 },
    ];

    // Maxfiylik belgisi
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `LOCHIN SCHOOL — Ish haqi (${month})  ⚠ MAXFIY`;
    titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB71C1C' } };
    titleCell.alignment = { horizontal: 'center' };

    const hdr = ws.getRow(2);
    hdr.values = ['Xodim', 'Asosiy (so\'m)', 'KPI Bonus', 'O\'rinbosar +', 'Chegirma −', 'JAMI', 'Holat'];
    hdr.font = { bold: true };
    hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };

    let grandTotal = 0n;

    for (const r of records) {
      const total = r.totalAmount;
      grandTotal += total;

      const name = r.teacher ? `${r.teacher.firstName} ${r.teacher.lastName}` : r.teacherId;

      const dataRow = ws.addRow([
        name,
        Number(r.baseAmount),
        Number(r.kpiBonus),
        Number(r.subAmount),
        Number(r.deduction),
        Number(total),
        r.status,
      ]);

      [2, 3, 4, 5, 6].forEach((col) => { dataRow.getCell(col).numFmt = '#,##0'; });
    }

    const totalRow = ws.addRow(['JAMI', '', '', '', '', Number(grandTotal), '']);
    totalRow.font = { bold: true };
    totalRow.getCell(6).numFmt = '#,##0';
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── PDF EKSPORT ──────────────────────────────────────────────────────────
  async exportPdf(month: string): Promise<Buffer> {
    const pnl = await this.getMonthlyPnl(month);

    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const fmt = (n: number) => n.toLocaleString('uz-UZ') + " so'm";

      // Sarlavha
      doc.fontSize(18).font('Helvetica-Bold').text('LOCHIN SCHOOL', { align: 'center' });
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(`Moliyaviy hisobot — ${month}`, { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Asosiy ko'rsatkichlar
      doc.fontSize(12).font('Helvetica-Bold').text('ASOSIY KO\'RSATKICHLAR');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Jami daromad:      ${fmt(pnl.totalIncome)}`);
      doc.text(`Jami xarajat:      ${fmt(pnl.totalExpenses)}`);
      doc.text(`  — Maoshlar:      ${fmt(pnl.expensesBreakdown.salaries)}`);
      doc.text(`  — Operatsion:    ${fmt(pnl.expensesBreakdown.operational)}`);
      doc.font('Helvetica-Bold');
      doc.text(`Sof foyda:         ${fmt(pnl.netProfit)}`);
      doc.text(`Marja:             ${pnl.marginPercent}%`);
      doc.font('Helvetica');
      doc.moveDown(0.4);

      // O'quvchilar
      doc.text(`Faol o'quvchilar:  ${pnl.activeStudents} ta`);
      doc.text(`Qarzdorlar:        ${pnl.debtorCount} ta (${fmt(pnl.debtAmount)})`);
      doc.moveDown(0.5);

      // Fan bo'yicha daromad
      if (pnl.income.bySubject.length > 0) {
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.3);
        doc.fontSize(11).font('Helvetica-Bold').text('FAN BO\'YICHA DAROMAD');
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica');
        for (const s of pnl.income.bySubject) {
          doc.text(`  ${s.subjectName}: ${fmt(s.total)}  (${s.studentCount} o'quvchi)`);
        }
        doc.moveDown(0.4);
      }

      // To'lov usullari
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').text('TO\'LOV USULLARI');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      for (const m of pnl.income.byMethod) {
        doc.text(`  ${m.method}: ${fmt(m.total)}  (${m.count} ta)`);
      }

      doc.moveDown(1);
      doc
        .fontSize(9)
        .fillColor('gray')
        .text(`Hisobot yaratildi: ${new Date().toLocaleString('uz-UZ')}`, { align: 'right' });

      doc.end();
    });
  }

  // ─── TELEGRAM EKSPORT ─────────────────────────────────────────────────────
  async sendTelegramReport(month: string, chatId: string): Promise<{ message: string }> {
    const pnl = await this.getMonthlyPnl(month);
    const text = this.buildTelegramText(month, pnl);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return { message: 'TELEGRAM_BOT_TOKEN sozlanmagan' };
    }

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    return { message: `Hisobot ${chatId} ga yuborildi` };
  }

  private buildTelegramText(month: string, pnl: Awaited<ReturnType<FinanceService['getMonthlyPnl']>>): string {
    const fmt = (n: number) => n.toLocaleString('uz-UZ');
    const sign = pnl.netProfit >= 0 ? '📈' : '📉';

    const subjectLines = pnl.income.bySubject
      .slice(0, 5)
      .map((s) => `  • ${s.subjectName}: *${fmt(s.total)} so'm*`)
      .join('\n');

    return (
      `${sign} *LOCHIN SCHOOL — ${month}*\n\n` +
      `💰 Daromad: *${fmt(pnl.totalIncome)} so'm*\n` +
      `📤 Xarajat: *${fmt(pnl.totalExpenses)} so'm*\n` +
      `  — Maosh: ${fmt(pnl.expensesBreakdown.salaries)} so'm\n` +
      `  — Operatsion: ${fmt(pnl.expensesBreakdown.operational)} so'm\n\n` +
      `✅ *Sof foyda: ${fmt(pnl.netProfit)} so'm*\n` +
      `📊 Marja: *${pnl.marginPercent}%*\n\n` +
      `👥 Faol o'quvchilar: *${pnl.activeStudents} ta*\n` +
      `⚠️ Qarzdorlar: *${pnl.debtorCount} ta* (${fmt(pnl.debtAmount)} so'm)\n\n` +
      (subjectLines ? `📚 *Fanlar bo'yicha:*\n${subjectLines}\n\n` : '') +
      `_Avtomatik hisobot • ${new Date().toLocaleDateString('uz-UZ')}_`
    );
  }
}
