import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { formatMoney } from '@clinicos/config';
import type { InvoiceDoc } from './invoice.model';
import type { PaymentDoc } from './payment.model';

/** Minimal clinic details needed for a print header — no cross-module model coupling. */
export interface ClinicHeaderInfo {
  name: string;
  phone?: string;
  email?: string;
}

interface Column {
  text: string;
  width: number;
  align: 'left' | 'right';
}

function drawRow(doc: PDFKit.PDFDocument, startX: number, y: number, columns: Column[], bold = false): void {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#000000');
  let x = startX;
  for (const column of columns) {
    doc.text(column.text, x, y, { width: column.width, align: column.align, lineBreak: false });
    x += column.width;
  }
}

function drawClinicHeader(
  doc: PDFKit.PDFDocument,
  clinic: ClinicHeaderInfo,
  documentTitle: string,
  documentNumber: string,
  issuedAt: Date,
): void {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000').text(clinic.name, left, doc.y);
  const contactLine = [clinic.phone, clinic.email].filter(Boolean).join('   |   ');
  if (contactLine) {
    doc.font('Helvetica').fontSize(9).fillColor('#555555').text(contactLine);
  }
  doc.fillColor('#000000');
  doc.moveDown(0.6);
  doc.strokeColor('#cccccc').moveTo(left, doc.y).lineTo(right, doc.y).stroke();
  doc.moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(14).text(documentTitle);
  doc.font('Helvetica').fontSize(10);
  doc.text(`No: ${documentNumber}`);
  doc.text(
    `Date: ${issuedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`,
  );
  doc.moveDown(0.8);
}

function itemColumns(tableWidth: number): { description: number; type: number; qty: number; unitPrice: number; total: number } {
  return {
    description: tableWidth * 0.4,
    type: tableWidth * 0.16,
    qty: tableWidth * 0.1,
    unitPrice: tableWidth * 0.17,
    total: tableWidth * 0.17,
  };
}

/**
 * Streams a print-ready invoice PDF: clinic header, patient reference, itemized table,
 * totals, and a payment history summary. Writes directly to the response stream.
 */
export function buildInvoicePdf(
  res: Response,
  clinic: ClinicHeaderInfo,
  invoice: InvoiceDoc,
  payments: PaymentDoc[],
): void {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  drawClinicHeader(doc, clinic, 'Invoice', invoice.invoiceNumber, invoice.createdAt);

  doc.font('Helvetica-Bold').fontSize(10).text('Patient');
  doc.font('Helvetica').fontSize(10).text(`Patient ID: ${invoice.patientId.toString()}`);
  if (invoice.deferred) {
    doc.fillColor('#b45309').text('Billing deferred — emergency admission').fillColor('#000000');
  }
  doc.moveDown(0.8);

  const left = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = itemColumns(tableWidth);

  let y = doc.y;
  drawRow(
    doc,
    left,
    y,
    [
      { text: 'Description', width: cols.description, align: 'left' },
      { text: 'Type', width: cols.type, align: 'left' },
      { text: 'Qty', width: cols.qty, align: 'right' },
      { text: 'Unit Price', width: cols.unitPrice, align: 'right' },
      { text: 'Amount', width: cols.total, align: 'right' },
    ],
    true,
  );
  y += 16;
  doc.strokeColor('#cccccc').moveTo(left, y).lineTo(left + tableWidth, y).stroke();
  y += 8;

  for (const item of invoice.items) {
    drawRow(doc, left, y, [
      { text: item.description, width: cols.description, align: 'left' },
      { text: item.type, width: cols.type, align: 'left' },
      { text: String(item.quantity), width: cols.qty, align: 'right' },
      { text: formatMoney(item.unitPricePaise), width: cols.unitPrice, align: 'right' },
      { text: formatMoney(item.totalPaise), width: cols.total, align: 'right' },
    ]);
    y += 18;
  }

  doc.strokeColor('#cccccc').moveTo(left, y).lineTo(left + tableWidth, y).stroke();
  y += 12;

  const totalsLabelWidth = tableWidth * 0.7;
  const totalsValueWidth = tableWidth * 0.3;
  function totalsLine(label: string, value: string, bold = false): void {
    drawRow(
      doc,
      left,
      y,
      [
        { text: label, width: totalsLabelWidth, align: 'right' },
        { text: value, width: totalsValueWidth, align: 'right' },
      ],
      bold,
    );
    y += 16;
  }

  totalsLine('Subtotal', formatMoney(invoice.subtotalPaise));
  if (invoice.discountPaise > 0) {
    totalsLine(`Discount${invoice.discountReason ? ` (${invoice.discountReason})` : ''}`, `-${formatMoney(invoice.discountPaise)}`);
  }
  totalsLine('Total', formatMoney(invoice.totalPaise), true);
  totalsLine('Paid', formatMoney(invoice.paidPaise));
  if (invoice.refundedPaise > 0) totalsLine('Refunded', formatMoney(invoice.refundedPaise));
  totalsLine('Balance Due', formatMoney(Math.max(0, invoice.totalPaise - invoice.paidPaise)), true);

  y += 8;
  doc.y = y;

  if (payments.length > 0) {
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(11).text('Payments');
    doc.moveDown(0.2);
    for (const payment of payments) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(
          `${payment.receiptNumber} — ${payment.method.toUpperCase()} — ${formatMoney(payment.amountPaise)} — ${payment.createdAt.toLocaleDateString('en-IN')}`,
        );
    }
  }

  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(8).fillColor('#888888').text('This is a computer-generated invoice.', { align: 'center' });

  doc.end();
}

/**
 * Streams a print-ready payment receipt PDF: clinic header, receipt number, invoice
 * reference, payment method and amount, and who received the payment.
 */
export function buildReceiptPdf(
  res: Response,
  clinic: ClinicHeaderInfo,
  payment: PaymentDoc,
  invoice: InvoiceDoc,
): void {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${payment.receiptNumber}.pdf"`);
  doc.pipe(res);

  drawClinicHeader(doc, clinic, 'Payment Receipt', payment.receiptNumber, payment.createdAt);

  doc.font('Helvetica-Bold').fontSize(10).text('Patient');
  doc.font('Helvetica').fontSize(10).text(`Patient ID: ${invoice.patientId.toString()}`);
  doc.text(`Invoice No: ${invoice.invoiceNumber}`);
  doc.moveDown(0.8);

  const left = doc.page.margins.left;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelWidth = tableWidth * 0.4;
  const valueWidth = tableWidth * 0.6;

  let y = doc.y;
  function line(label: string, value: string, bold = false): void {
    drawRow(
      doc,
      left,
      y,
      [
        { text: label, width: labelWidth, align: 'left' },
        { text: value, width: valueWidth, align: 'left' },
      ],
      bold,
    );
    y += 20;
  }

  line('Amount Received', formatMoney(payment.amountPaise), true);
  line('Payment Method', payment.method.toUpperCase());
  if (payment.reference) line('Reference', payment.reference);
  line('Received By', payment.receivedByName);
  if (payment.refundedAmountPaise > 0) {
    line('Refunded', formatMoney(payment.refundedAmountPaise));
  }

  y += 8;
  doc.strokeColor('#cccccc').moveTo(left, y).lineTo(left + tableWidth, y).stroke();
  y += 12;
  doc.y = y;

  doc.font('Helvetica-Bold').fontSize(10).text('Invoice Summary');
  doc.font('Helvetica').fontSize(9);
  doc.text(`Invoice Total: ${formatMoney(invoice.totalPaise)}`);
  doc.text(`Paid to Date: ${formatMoney(invoice.paidPaise)}`);
  doc.text(`Balance Due: ${formatMoney(Math.max(0, invoice.totalPaise - invoice.paidPaise))}`);

  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(8).fillColor('#888888').text('This is a computer-generated receipt.', { align: 'center' });

  doc.end();
}
