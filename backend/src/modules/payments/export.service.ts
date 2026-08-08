import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Payment, PaymentStatus } from '../../entities/payment.entity';
import { User } from '../../entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  // ─── EXCEL EKSPORT ────────────────────────────────────────────────────────
  async exportPaymentsToExcel(month: string): Promise<Buffer> {
    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .leftJoin('p.student', 'st')
      .leftJoin('p.receivedBy', 'rb')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .addSelect([
        'p.id', 'p.receiptNumber', 'p.amount', 'p.method', 'p.type',
        'p.createdAt', 'p.notes', 'p.cashAmount', 'p.cardAmount',
        'st.id', 'st.firstName', 'st.lastName', 'st.phone',
        'rb.id', 'rb.firstName', 'rb.lastName',
      ])
      .orderBy('p.created_at', 'ASC')
      .getMany();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lochin School CRM';
    wb.created = new Date();

    const ws = wb.addWorksheet(`To'lovlar — ${month}`, {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Sarlavha
    ws.mergeCells('A1:K1');
    ws.getCell('A1').value = `LOCHIN SCHOOL — To'lovlar hisoboti (${month})`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    // Ustun sarlavhalari
    ws.getRow(2).values = [
      '№', 'Kvitansiya', 'O\'quvchi', 'Telefon', 'Summa (so\'m)',
      'Usul', 'Tur', 'Naqd', 'Karta', 'Kassir', 'Sana',
    ];
    ws.getRow(2).font = { bold: true };
    ws.getRow(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2196F3' },
    };
    ws.getRow(2).getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const cols = [
      { key: 'no', width: 5 },
      { key: 'receipt', width: 20 },
      { key: 'student', width: 25 },
      { key: 'phone', width: 16 },
      { key: 'amount', width: 18 },
      { key: 'method', width: 12 },
      { key: 'type', width: 14 },
      { key: 'cash', width: 16 },
      { key: 'card', width: 16 },
      { key: 'cashier', width: 20 },
      { key: 'date', width: 22 },
    ];
    ws.columns = cols;

    const methodLabel: Record<string, string> = {
      cash: 'Naqd', card: 'Karta', bank: 'Bank',
      payme: 'Payme', click: 'Click', mixed: 'Aralash',
    };
    const typeLabel: Record<string, string> = {
      tuition: 'O\'quv to\'lovi', registration: 'Ro\'yxat', book: 'Kitob', other: 'Boshqa',
    };

    let grandTotal = 0;

    payments.forEach((p, i) => {
      const amount = Number(p.amount);
      grandTotal += amount;
      const row = ws.addRow([
        i + 1,
        p.receiptNumber,
        p.student ? `${p.student.firstName} ${p.student.lastName}` : '',
        p.student?.phone ?? '',
        amount,
        methodLabel[p.method] ?? p.method,
        typeLabel[p.type] ?? p.type,
        Number(p.cashAmount),
        Number(p.cardAmount),
        p.receivedBy ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}` : '',
        new Date(p.createdAt).toLocaleString('uz-UZ'),
      ]);
      // Summa ustuni raqam formatida
      row.getCell(5).numFmt = '#,##0';
      row.getCell(8).numFmt = '#,##0';
      row.getCell(9).numFmt = '#,##0';
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });

    // Jami qator
    const totalRow = ws.addRow(['', '', '', 'JAMI:', grandTotal, '', '', '', '', '', '']);
    totalRow.font = { bold: true };
    totalRow.getCell(5).numFmt = '#,##0';
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };

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

  // ─── QARZDORLAR EXCEL ─────────────────────────────────────────────────────
  async exportDebtorsToExcel(month: string): Promise<Buffer> {
    const debtors = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', 'e.student_id = u.id AND e.status = :es', { es: 'active' })
      .innerJoin('groups', 'g', 'g.id = e.group_id')
      .leftJoin('subjects', 's', 's.id = g.subject_id')
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere('u.deleted_at IS NULL')
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM payments p WHERE p.student_id = u.id AND p.payment_month = :month AND p.status = 'completed' AND p.deleted_at IS NULL)`,
        { month },
      )
      .select([
        'u."firstName"', 'u.last_name', 'u.phone',
        'g.name AS group_name', 'g.monthly_price AS price', 's.name AS subject',
      ])
      .orderBy('u.last_name', 'ASC')
      .getRawMany();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Qarzdorlar — ${month}`);

    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = `LOCHIN SCHOOL — Qarzdorlar (${month})`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.getRow(2).values = ['№', 'Ism Familiya', 'Telefon', 'Guruh', 'Fan', 'Summa (so\'m)'];
    ws.getRow(2).font = { bold: true };
    ws.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF5350' } };
    ws.columns = [
      { width: 5 }, { width: 28 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 18 },
    ];

    debtors.forEach((d, i) => {
      ws.addRow([
        i + 1,
        `${d.firstName} ${d.last_name}`,
        d.phone ?? '',
        d.group_name,
        d.subject ?? '',
        Number(d.price),
      ]);
    });

    ws.addRow(['', '', '', '', `JAMI QARZDOR: ${debtors.length} ta`, '']);
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── PDF HISOBOT ──────────────────────────────────────────────────────────
  async exportPaymentsToPdf(month: string): Promise<Buffer> {
    const report = await this.getMonthlyReportData(month);

    return new Promise((resolve) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Sarlavha
      doc.fontSize(18).font('Helvetica-Bold')
        .text('LOCHIN SCHOOL', { align: 'center' });
      doc.fontSize(13).font('Helvetica')
        .text(`To'lovlar hisoboti — ${month}`, { align: 'center' });
      doc.moveDown(0.5);

      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.5);

      // Umumiy ko'rsatkichlar
      doc.fontSize(11).font('Helvetica-Bold').text('UMUMIY KO\'RSATKICHLAR');
      doc.moveDown(0.3);

      const fmt = (n: number) => n.toLocaleString('uz-UZ') + ' so\'m';

      doc.font('Helvetica').fontSize(10);
      doc.text(`• Jami tushum: ${fmt(report.grandTotal)}`);
      doc.text(`• To'lovlar soni: ${report.totalCount} ta`);
      doc.text(`• Qarzdorlar: ${report.debtorCount} ta`);
      doc.moveDown(0.5);

      // Usul bo'yicha jadval
      doc.font('Helvetica-Bold').text('TO\'LOV USULLARI BO\'YICHA:');
      doc.moveDown(0.3);

      const methodLabel: Record<string, string> = {
        cash: 'Naqd', card: 'Karta', bank: 'Bank',
        payme: 'Payme', click: 'Click', mixed: 'Aralash',
      };

      for (const [method, data] of Object.entries(report.byMethod)) {
        doc.font('Helvetica').text(
          `  ${methodLabel[method] ?? method}: ${fmt(data.total)} (${data.count} ta)`,
        );
      }

      doc.moveDown();
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.3);

      doc.fontSize(9).fillColor('gray')
        .text(`Hisobot yaratildi: ${new Date().toLocaleString('uz-UZ')}`, { align: 'right' });

      doc.end();
    });
  }

  private async getMonthlyReportData(month: string) {
    const raw = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.payment_month = :month', { month })
      .andWhere('p.status = :s', { s: PaymentStatus.COMPLETED })
      .andWhere('p.deleted_at IS NULL')
      .select([
        'p.method AS method',
        'SUM(p.amount) AS total',
        'COUNT(*) AS count',
      ])
      .groupBy('p.method')
      .getRawMany();

    const byMethod: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;
    let totalCount = 0;

    for (const row of raw) {
      byMethod[row.method] = { total: Number(row.total), count: Number(row.count) };
      grandTotal += Number(row.total);
      totalCount += Number(row.count);
    }

    const debtorCount = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('enrollments', 'e', 'e.student_id = u.id AND e.status = :es', { es: 'active' })
      .where('u.role = :role', { role: Role.STUDENT })
      .andWhere('u.is_active = true')
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM payments p WHERE p.student_id = u.id AND p.payment_month = :month AND p.status = 'completed' AND p.deleted_at IS NULL)`,
        { month },
      )
      .getCount();

    return { month, grandTotal, totalCount, debtorCount, byMethod };
  }
}
