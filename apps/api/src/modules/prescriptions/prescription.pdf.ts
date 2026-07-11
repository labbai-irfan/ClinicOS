import PDFDocument from 'pdfkit';
import type { Gender } from '@clinicos/types';

/** Plain data the layout needs — deliberately not a Mongoose document, so the layout
 *  can be unit-tested and reused (e.g. for a future "email the prescription" job)
 *  without any database coupling. */
export interface PrescriptionPdfItem {
  medicineName: string;
  genericName?: string;
  form?: string;
  strength?: string;
  dose: string;
  route?: string;
  frequency: string;
  durationDays?: number;
  timing?: string;
  foodRelation?: 'before_food' | 'after_food' | 'with_food' | 'any';
  instruction?: string;
}

export interface PrescriptionPdfData {
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  doctorName: string;
  doctorQualification?: string;
  doctorRegistrationNumber?: string;
  patientName: string;
  patientCode?: string;
  patientAge?: number;
  patientGender?: Gender;
  patientMobile?: string;
  /** ISO instant — the date printed on the prescription (finalizedAt, or now for a draft preview). */
  prescriptionDate: string;
  /** Only populated when the prescription was saved with includeDiagnosis: true. */
  diagnosis?: string[];
  items: PrescriptionPdfItem[];
  advice?: string;
  testsRecommended: string[];
  followUpAt?: string;
  verificationCode?: string;
  versionNumber: number;
  status: 'draft' | 'finalized' | 'superseded';
}

interface Column {
  text: string;
  width: number;
  align: 'left' | 'right' | 'center';
}

const FOOD_RELATION_LABEL: Record<NonNullable<PrescriptionPdfItem['foodRelation']>, string> = {
  before_food: 'Before food',
  after_food: 'After food',
  with_food: 'With food',
  any: 'Anytime',
};

const RULE_COLOR = '#cccccc';
const MUTED_COLOR = '#555555';

function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function drawRow(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  columns: Column[],
  opts: { bold?: boolean; size?: number; color?: string } = {},
): void {
  doc
    .font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color ?? '#000000');
  let cx = x;
  for (const column of columns) {
    doc.text(column.text, cx, y, { width: column.width, align: column.align });
    cx += column.width;
  }
  doc.fillColor('#000000');
}

function measureRowHeight(doc: PDFKit.PDFDocument, columns: Column[], size = 9): number {
  doc.font('Helvetica').fontSize(size);
  const heights = columns.map((c) => doc.heightOfString(c.text || ' ', { width: c.width }));
  return Math.max(...heights, 12);
}

function medicineColumns(tableWidth: number) {
  return {
    medicine: tableWidth * 0.34,
    dose: tableWidth * 0.13,
    frequency: tableWidth * 0.19,
    duration: tableWidth * 0.13,
    timing: tableWidth * 0.21,
  };
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed = 140): number {
  if (y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
    return doc.y;
  }
  return y;
}

function drawHeader(doc: PDFKit.PDFDocument, data: PrescriptionPdfData): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000').text(data.clinicName, left, doc.y);
  const clinicContact = [data.clinicAddress, data.clinicPhone].filter(Boolean).join('   |   ');
  if (clinicContact) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED_COLOR).text(clinicContact);
  }
  doc.fillColor('#000000');
  doc.moveDown(0.4);

  const doctorLine = [data.doctorName, data.doctorQualification].filter(Boolean).join(', ');
  doc.font('Helvetica-Bold').fontSize(11).text(doctorLine);
  if (data.doctorRegistrationNumber) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED_COLOR).text(`Reg. No: ${data.doctorRegistrationNumber}`);
  }
  doc.fillColor('#000000');

  doc.moveDown(0.5);
  doc.strokeColor(RULE_COLOR).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.5);
}

function drawPatientInfo(doc: PDFKit.PDFDocument, data: PrescriptionPdfData): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const topY = doc.y;

  const patientBits = [
    data.patientCode ? `#${data.patientCode}` : undefined,
    data.patientAge !== undefined ? `${data.patientAge}y` : undefined,
    data.patientGender ? data.patientGender.charAt(0).toUpperCase() + data.patientGender.slice(1) : undefined,
  ]
    .filter(Boolean)
    .join('  |  ');

  doc.font('Helvetica-Bold').fontSize(12).text(data.patientName, left, topY, { width: (right - left) * 0.6 });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED_COLOR);
  if (patientBits) doc.text(patientBits, left, doc.y, { width: (right - left) * 0.6 });
  if (data.patientMobile) doc.text(`Mobile: ${data.patientMobile}`, left, doc.y, { width: (right - left) * 0.6 });
  doc.fillColor('#000000');

  const dateLabel = data.status === 'draft' ? 'Draft as of' : 'Date';
  doc
    .font('Helvetica')
    .fontSize(9)
    .text(`${dateLabel}: ${formatDisplayDate(data.prescriptionDate)}`, left, topY, {
      width: right - left,
      align: 'right',
    });

  doc.y = Math.max(doc.y, topY + 14);
  doc.moveDown(0.6);
}

function drawMedicineTable(doc: PDFKit.PDFDocument, data: PrescriptionPdfData): void {
  const left = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = medicineColumns(tableWidth);

  doc.font('Helvetica-Bold').fontSize(11).text('Rx', left, doc.y);
  doc.moveDown(0.3);

  let y = doc.y;
  const headerColumns: Column[] = [
    { text: 'Medicine', width: cols.medicine, align: 'left' },
    { text: 'Dose', width: cols.dose, align: 'left' },
    { text: 'Frequency', width: cols.frequency, align: 'left' },
    { text: 'Duration', width: cols.duration, align: 'left' },
    { text: 'Timing / Food', width: cols.timing, align: 'left' },
  ];
  drawRow(doc, left, y, headerColumns, { bold: true });
  y += 14;
  doc.strokeColor(RULE_COLOR).moveTo(left, y).lineTo(left + tableWidth, y).stroke();
  y += 6;

  if (data.items.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED_COLOR).text('No medicines added.', left, y);
    doc.fillColor('#000000');
    y += 16;
  }

  data.items.forEach((item, index) => {
    const medicineLabel = [
      `${index + 1}. ${item.medicineName}`,
      item.genericName ? `(${item.genericName})` : undefined,
      item.strength,
      item.form,
    ]
      .filter(Boolean)
      .join(' ');
    const timingLabel = [item.timing, item.foodRelation ? FOOD_RELATION_LABEL[item.foodRelation] : undefined]
      .filter(Boolean)
      .join(' — ');
    const durationLabel = item.durationDays ? `${item.durationDays} day${item.durationDays === 1 ? '' : 's'}` : '—';
    const routeSuffix = item.route ? ` (${item.route})` : '';

    const columns: Column[] = [
      { text: medicineLabel, width: cols.medicine, align: 'left' },
      { text: `${item.dose}${routeSuffix}`, width: cols.dose, align: 'left' },
      { text: item.frequency, width: cols.frequency, align: 'left' },
      { text: durationLabel, width: cols.duration, align: 'left' },
      { text: timingLabel || '—', width: cols.timing, align: 'left' },
    ];

    y = ensureSpace(doc, y);
    const rowHeight = measureRowHeight(doc, columns);
    drawRow(doc, left, y, columns);
    y += rowHeight + 4;

    if (item.instruction) {
      y = ensureSpace(doc, y);
      const noteText = `Note: ${item.instruction}`;
      const noteWidth = tableWidth - 16;
      doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED_COLOR);
      const noteHeight = doc.heightOfString(noteText, { width: noteWidth });
      doc.text(noteText, left + 16, y, { width: noteWidth });
      doc.fillColor('#000000');
      y += noteHeight + 4;
    }
  });

  doc.strokeColor(RULE_COLOR).moveTo(left, y).lineTo(left + tableWidth, y).stroke();
  doc.y = y + 10;
}

function drawSection(doc: PDFKit.PDFDocument, title: string, body: string): void {
  doc.font('Helvetica-Bold').fontSize(10).text(title);
  doc.font('Helvetica').fontSize(9).text(body);
  doc.moveDown(0.5);
}

function drawFooter(doc: PDFKit.PDFDocument, data: PrescriptionPdfData): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.moveDown(0.4);
  doc.strokeColor(RULE_COLOR).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.4);

  if (data.status === 'superseded') {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#b45309')
      .text('This prescription version has been superseded by a later revision.', { align: 'center' });
    doc.fillColor('#000000');
  }

  const footerLine = data.verificationCode
    ? `Verification code: ${data.verificationCode}   |   Version ${data.versionNumber}   |   Computer-generated prescription — no signature required.`
    : 'DRAFT — not finalized, not valid for dispensing.';

  doc.font('Helvetica').fontSize(8).fillColor('#888888').text(footerLine, { align: 'center' });
  doc.fillColor('#000000');
}

/**
 * Renders a print-ready prescription PDF and resolves the resulting file as a Buffer.
 * Takes a plain data object (never a Mongoose document) so the layout stays testable
 * and reusable independent of persistence shape.
 */
export function buildPrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    drawHeader(doc, data);
    drawPatientInfo(doc, data);

    if (data.diagnosis && data.diagnosis.length > 0) {
      drawSection(doc, 'Diagnosis', data.diagnosis.join(', '));
    }

    drawMedicineTable(doc, data);

    if (data.advice) drawSection(doc, 'Advice', data.advice);
    if (data.testsRecommended.length > 0) {
      drawSection(doc, 'Recommended Tests', data.testsRecommended.join(', '));
    }
    if (data.followUpAt) {
      drawSection(doc, 'Follow-up', formatDisplayDate(data.followUpAt));
    }

    drawFooter(doc, data);

    doc.end();
  });
}
