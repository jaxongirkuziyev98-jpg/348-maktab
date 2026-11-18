import type { Ebook } from '../src/types/lms.ts';

function toAsciiPdfSafe(input: string): string {
  return input
    .replace(/o‘|o'|o`/gi, (m) => (m[0] === 'O' ? "O'" : "o'"))
    .replace(/g‘|g'|g`/gi, (m) => (m[0] === 'G' ? "G'" : "g'"))
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/±/g, '+/-')
    .replace(/²/g, '^2')
    .replace(/₁/g, '1')
    .replace(/₂/g, '2')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface PdfLine {
  text: string;
  size: number;
  bold?: boolean;
  gap?: number;
}

function buildPageStream(lines: PdfLine[], pageNum: number, totalPages: number): string {
  const cmds: string[] = [];
  // Subtle top header bar
  cmds.push('0.145 0.388 0.922 rg');
  cmds.push('48 804 499 2 re f');
  cmds.push('0 0 0 rg');
  cmds.push(`BT /F1 9 Tf 48 812 Td (348-MAKTAB ELEKTRON KUTUBXONASI) Tj ET`);
  cmds.push(`BT /F1 9 Tf 490 812 Td (Sahifa ${pageNum}/${totalPages}) Tj ET`);

  let y = 776;
  for (const item of lines) {
    if (y < 60) break;
    if (item.text) {
      const font = item.bold ? '/F2' : '/F1';
      cmds.push(`BT ${font} ${item.size} Tf 48 ${y} Td (${escapePdfString(item.text)}) Tj ET`);
    }
    y -= item.gap || 16;
  }

  // Footer
  cmds.push('0.85 0.87 0.90 rg');
  cmds.push('48 42 499 1 re f');
  cmds.push('0.4 0.45 0.5 rg');
  cmds.push('BT /F1 9 Tf 48 28 Td (348-MAKTAB Onlayn Ta\'lim Platformasi · Rasmiy O\'quv Qo\'llanma) Tj ET');
  return cmds.join('\n');
}

export function buildEbookPdfBuffer(book: Ebook, subjectName?: string): Buffer {
  const safeTitle = toAsciiPdfSafe(book.title);
  const safeAuthor = toAsciiPdfSafe(book.author);
  const safeSubject = toAsciiPdfSafe(subjectName || 'Maktab fani');
  const safeDesc = toAsciiPdfSafe(book.description);
  const safeBody = toAsciiPdfSafe(book.previewText || book.description);

  // Page 1: Title & Overview & Chapter 1
  const page1Lines: PdfLine[] = [
    { text: safeSubject.toUpperCase() + ` · ${book.grade}-SINF`, size: 10, bold: true, gap: 20 },
    ...wrapLine(safeTitle, 44).map((l) => ({ text: l, size: 17, bold: true, gap: 22 })),
    { text: `Muallif: ${safeAuthor}  |  Jami sahifalar: ${book.pagesCount}`, size: 10, gap: 24 },
    { text: '1-BOB. KIRISH VA NAZARIY ASOSLAR', size: 12, bold: true, gap: 18 },
    ...wrapLine(safeDesc, 78).map((l) => ({ text: l, size: 11, gap: 16 })),
    { text: '', size: 11, gap: 10 },
    { text: 'ASOSIY TUSHUNCHALAR:', size: 11, bold: true, gap: 18 },
    ...safeBody
      .split('\n')
      .flatMap((p) => wrapLine(p, 78))
      .slice(0, 18)
      .map((l) => ({ text: l, size: 11, gap: 16 })),
  ];

  // Page 2: Worked Examples & Methodology
  const page2Lines: PdfLine[] = [
    { text: `2-BOB. AMALIY NAMUNALAR (${book.grade}-SINF)`, size: 13, bold: true, gap: 22 },
    ...wrapLine(
      `Ushbu bo'limda ${safeSubject} fanidan ${book.grade}-sinf o'quv dasturi asosidagi eng muhim misollar va ularning yechish bosqichlari keltirilgan.`,
      78
    ).map((l) => ({ text: l, size: 11, gap: 16 })),
    { text: '', size: 11, gap: 12 },
    { text: '1-namuna (Bosqichma-bosqich tahlil):', size: 11, bold: true, gap: 18 },
    ...wrapLine(
      'Berilgan shartni diqqat bilan o\'qing, asosiy kattaliklar va qoidalarni ajratib oling, so\'ngra ketma-ket hisoblash va mantiqiy tekshirishni bajaring.',
      78
    ).map((l) => ({ text: l, size: 11, gap: 16 })),
    { text: '', size: 11, gap: 10 },
    { text: '2-namuna (Mustaqil fikrlash uchun):', size: 11, bold: true, gap: 18 },
    ...wrapLine(
      'Mavzu yuzasidan olgan bilimlaringizni kundalik hayotiy vaziyatlar bilan bog\'lang va natijani sinf testida sinab ko\'ring.',
      78
    ).map((l) => ({ text: l, size: 11, gap: 16 })),
  ];

  // Page 3: Practice Exercises & Self-Check
  const page3Lines: PdfLine[] = [
    { text: `3-BOB. MUSTAQIL MASHQLAR VA NAZORAT SAVOLLARI`, size: 13, bold: true, gap: 22 },
    { text: 'Quyidagi topshiriqlarni daftaringizga bajaring:', size: 11, gap: 20 },
    { text: '1. Mavzuning asosiy qoidalarini 3 ta kalit jumla bilan yozing.', size: 11, gap: 18 },
    { text: '2. Darslikdagi namunalarga o\'xshash 2 ta yangi misol tuzing.', size: 11, gap: 18 },
    { text: '3. O\'rgangan bilimlaringizni 348-MAKTAB platformasidagi 20 savollik testda tekshiring.', size: 11, gap: 24 },
    { text: 'UY VAZIFASI UCHUN ESLATMA:', size: 11, bold: true, gap: 18 },
    ...wrapLine(
      'Yechimlaringizni rasm yoki PDF shaklida o\'qituvchingizga yuborishingiz mumkin. O\'qituvchi tekshirgach yashil tasdiq belgisi beriladi.',
      78
    ).map((l) => ({ text: l, size: 11, gap: 16 })),
  ];

  const pages = [page1Lines, page2Lines, page3Lines];
  const streams = pages.map((lines, i) => buildPageStream(lines, i + 1, pages.length));

  // Objects:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // For each page i (0..2): Page obj = 5 + i*2, Content obj = 6 + i*2
  const pageObjNums = pages.map((_, i) => 5 + i * 2);
  const objects: string[] = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
  ];

  streams.forEach((streamContent, i) => {
    const pageNum = 5 + i * 2;
    const contentNum = 6 + i * 2;
    const len = Buffer.byteLength(streamContent, 'utf8');
    objects.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`
    );
    objects.push(
      `${contentNum} 0 obj\n<< /Length ${len} >>\nstream\n${streamContent}\nendstream\nendobj\n`
    );
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
