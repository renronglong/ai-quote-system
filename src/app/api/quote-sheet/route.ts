import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { createClient } from '@supabase/supabase-js';

// 质稳五金报价单模板复刻：A-L 共12列
// 序号|客户型号|规格尺寸mm|产品名称|单位|材质|表面处理|单价未税(元)|含税价|最小起订量|模具费RMB(元)|备注

interface SheetItem {
  model?: string;       // 客户型号
  spec?: string;        // 规格尺寸
  name?: string;        // 产品名称
  unit?: string;        // 单位
  material?: string;    // 材质
  surface?: string;     // 表面处理
  price_ex_tax?: number;   // 单价未税
  price_inc_tax?: number;  // 含税价
  moq?: number | string;   // 最小起订量
  mold_fee?: number | null; // 模具费（同模具组非首行传null，显示空白）
  remark?: string;         // 备注
}

interface SheetBody {
  supplier_company?: string;
  supplier_contact?: string;
  supplier_phone?: string;
  supplier_address?: string;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_qq?: string;
  quote_no?: string;
  aluminum_price?: number;
  user_id?: string;        // 登录用户ID（传入则存档到云端）
  global_remark?: string;  // 报价单全局备注
  items: SheetItem[];
}

const FONT = '宋体';
const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

// ─── Supabase（存档用）──────────────────────────────────────
const SUPA_URL = 'https://jotgxnhueagbsvfeepic.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUwMjEyMywiZXhwIjoyMDk5MDc4MTIzfQ.dSfa-90iQd4jVhpuvNAgqKPqBdzfXPqgYqpxpHl71Fo';
const BUCKET = 'quote-sheets';

// ─── 中文字体（pdfkit用）：优先Supabase自有源，回退jsDelivr ───
const FONT_SOURCES = [
  `${SUPA_URL}/storage/v1/object/public/${BUCKET}/assets/SimHei.ttf`,
  'https://cdn.jsdelivr.net/gh/StellarCN/scp_zh@master/fonts/SimHei.ttf',
  'https://fastly.jsdelivr.net/gh/StellarCN/scp_zh@master/fonts/SimHei.ttf',
];

async function loadChineseFont(): Promise<Buffer> {
  let lastErr: any = null;
  for (const url of FONT_SOURCES) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > 3000000) return buf; // 完整字体约9.7MB，过小说明下载残缺
      lastErr = new Error(`font size too small: ${buf.length}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('字体下载失败');
}

function fmtMoney(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 保留n位有效数字
function sigfig(n: number, digits: number): number {
  if (n === 0 || !isFinite(n)) return n;
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const factor = Math.pow(10, digits - d);
  return Math.round(n * factor) / factor;
}
function r3s(n: number): number { return sigfig(n, 3); }
function r2s(n: number): number { return sigfig(n, 2); }

// ===== Excel 生成（质稳模板复刻）============================
async function buildExcel(body: SheetBody): Promise<Buffer> {
  const items = body.items;
  const wb = new ExcelJS.Workbook();
  wb.creator = body.supplier_company || 'gyparts.cn';
  wb.created = new Date();
  const ws = wb.addWorksheet('报价单', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const widths = [6.5, 15, 19, 13, 5.5, 10, 8, 12, 11, 9, 12, 10];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const today = new Date();
  const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  const setCell = (addr: string, value: any, opts: Partial<ExcelJS.Style> = {}) => {
    const c = ws.getCell(addr);
    c.value = value;
    if (opts.font) c.font = opts.font;
    if (opts.alignment) c.alignment = opts.alignment;
    if (opts.border) c.border = opts.border;
    if (opts.fill) c.fill = opts.fill;
  };

  ws.mergeCells('A1:L1');
  setCell('A1', body.supplier_company || '', {
    font: { name: FONT, size: 18, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  ws.getRow(1).height = 30;
  ws.mergeCells('A2:L2');
  setCell('A2', '报 价 单', {
    font: { name: FONT, size: 15, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  ws.getRow(2).height = 24;

  const infoRows = [
    [`供方：${body.supplier_company || ''}`, `客户名称：${body.customer_name || ''}`],
    [`联系人：${body.supplier_contact || ''}`, `联系人：${body.customer_contact || ''}`],
    [`电话：${body.supplier_phone || ''}`, `电话：${body.customer_phone || ''}`],
    [`地址：${body.supplier_address || ''}`, `地址：${body.customer_address || ''}`],
  ];
  infoRows.forEach(([left, right], i) => {
    const r = 4 + i;
    ws.mergeCells(`A${r}:F${r}`);
    setCell(`A${r}`, left, { font: { name: FONT, size: 11 }, alignment: { horizontal: 'left', vertical: 'middle' } });
    ws.mergeCells(`G${r}:L${r}`);
    setCell(`G${r}`, right, { font: { name: FONT, size: 11 }, alignment: { horizontal: 'left', vertical: 'middle' } });
    ws.getRow(r).height = 18;
  });

  ws.mergeCells('A8:F8');
  setCell('A8', `报价单编号：${body.quote_no || ''}`, {
    font: { name: FONT, size: 11, bold: true },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  ws.mergeCells('G8:L8');
  setCell('G8', `报价日期：${dateStr}`, {
    font: { name: FONT, size: 11 },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  ws.getRow(8).height = 18;

  const headers = ['序号', '客户型号', '规格尺寸mm', '产品名称', '单位', '材质', '表面处理', '单价未税(元)', '含税价', '最小起订量', '模具费RMB(元)', '备注'];
  const headerFill: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
  headers.forEach((h, i) => {
    const c = ws.getCell(9, i + 1);
    c.value = h;
    c.font = { name: FONT, size: 11, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thin;
    c.fill = headerFill;
  });
  ws.getRow(9).height = 28;

  const DATA_START = 10;
  const DATA_ROWS = 15;
  let exSum = 0, incSum = 0, moldSum = 0;
  for (let i = 0; i < DATA_ROWS; i++) {
    const r = DATA_START + i;
    ws.getRow(r).height = 22;
    const item: SheetItem | undefined = items[i];
    const vals: any[] = item
      ? [
          i + 1,
          item.model || '',
          item.spec || '',
          item.name || '',
          item.unit || 'pcs',
          item.material || '',
          item.surface || '',
          item.price_ex_tax != null ? r3s(Number(item.price_ex_tax)) : '',
          item.price_inc_tax != null ? r3s(Number(item.price_inc_tax)) : '',
          item.moq != null ? r2s(Number(item.moq)) : '',
          item.mold_fee != null ? r2s(Number(item.mold_fee)) : '',
          item.remark || '',
        ]
      : [i + 1, '', '', '', '', '', '', '', '', '', '', ''];
    vals.forEach((v, ci) => {
      const c = ws.getCell(r, ci + 1);
      c.value = v;
      c.font = { name: FONT, size: 11 };
      c.border = thin;
      if (ci === 0 || ci === 4 || ci === 6 || ci === 9) {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (ci === 7 || ci === 8 || ci === 10) {
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.numFmt = '#0.##';
      } else {
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    });
    if (item) {
      exSum += item.price_ex_tax || 0;
      incSum += item.price_inc_tax || 0;
      moldSum += item.mold_fee || 0;
    }
  }

  const totalRow = DATA_START + DATA_ROWS;
  ws.getRow(totalRow).height = 22;
  ws.mergeCells(`A${totalRow}:G${totalRow}`);
  setCell(`A${totalRow}`, '总计', {
    font: { name: FONT, size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thin,
  });
  for (let ci = 2; ci <= 12; ci++) {
    const c = ws.getCell(totalRow, ci);
    c.border = thin;
    c.font = { name: FONT, size: 11 };
  }
  const exCell = ws.getCell(totalRow, 8);
  exCell.value = r3s(Number(exSum));
  exCell.numFmt = '#0.##';
  exCell.alignment = { horizontal: 'right' };
  exCell.font = { name: FONT, size: 11, bold: true };
  const incCell = ws.getCell(totalRow, 9);
  incCell.value = r3s(Number(incSum));
  incCell.numFmt = '#0.##';
  incCell.alignment = { horizontal: 'right' };
  incCell.font = { name: FONT, size: 11, bold: true };
  const moldCell = ws.getCell(totalRow, 11);
  moldCell.value = r2s(Number(moldSum));
  moldCell.numFmt = '#0.##';
  moldCell.alignment = { horizontal: 'right' };
  moldCell.font = { name: FONT, size: 11, bold: true };

  const terms = [
    '1：依照图纸进行开模及送样。',
    '2：此报价含运费、含13%增值税',
    '3：付款方式：现金',
    '4：此报价单有效期为15天',
    '5：开模时间15个工作日，出样5个工作日',
  ];
  terms.forEach((t, i) => {
    const r = totalRow + 1 + i;
    ws.mergeCells(`A${r}:L${r}`);
    setCell(`A${r}`, t, { font: { name: FONT, size: 11 } });
    ws.getRow(r).height = 18;
  });

  let nextRow = totalRow + 6;

  // 备注栏
  if (body.global_remark) {
    const rmRow = nextRow;
    ws.mergeCells(`A${rmRow}:L${rmRow}`);
    setCell(`A${rmRow}`, `备注：${body.global_remark}`, {
      font: { name: FONT, size: 11 },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    });
    ws.getRow(rmRow).height = 36;
    nextRow += 1;
  }

  const alRow = nextRow;
  ws.mergeCells(`A${alRow}:L${alRow}`);
  setCell(`A${alRow}`, body.aluminum_price ? `报价基准：当日铝锭价 ¥${body.aluminum_price.toLocaleString()}/吨` : '', {
    font: { name: FONT, size: 10, color: { argb: 'FF888888' } },
  });

  const signRow = alRow + 2;
  ws.mergeCells(`A${signRow}:G${signRow}`);
  setCell(`A${signRow}`, '需方（签章）', { font: { name: FONT, size: 12, bold: true }, alignment: { horizontal: 'left' } });
  ws.mergeCells(`H${signRow}:L${signRow}`);
  setCell(`H${signRow}`, '供方（签章）', { font: { name: FONT, size: 12, bold: true }, alignment: { horizontal: 'left' } });
  ws.getRow(signRow).height = 24;
  ws.getRow(signRow + 1).height = 40;
  ws.getRow(signRow + 2).height = 40;

  const dateRow = signRow + 3;
  setCell(`A${dateRow}`, '日期:', { font: { name: FONT, size: 11 } });
  ws.mergeCells(`H${dateRow}:K${dateRow}`);
  setCell(`H${dateRow}`, `日期: ${dateStr}`, { font: { name: FONT, size: 11 } });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ===== PDF 生成（版式对齐Excel）=============================
async function buildPdf(body: SheetBody, fontBuf: Buffer): Promise<Buffer> {
  const items = body.items;
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.registerFont('cn', fontBuf);

  // 12列列宽（pt），合计≈525 ≈ A4可用宽度(595-60)
  const COLS = [24, 48, 74, 58, 24, 44, 36, 48, 46, 30, 46, 36];
  const HEADERS = ['序号', '客户型号', '规格尺寸', '产品名称', '单位', '材质', '表面处理', '单价未税', '含税价', '起订量', '模具费', '备注'];
  const TABLE_X = 30;
  const TABLE_W = COLS.reduce((a, b) => a + b, 0);
  const cellX = (col: number) => TABLE_X + COLS.slice(0, col).reduce((a, b) => a + b, 0);

  const drawTableHeader = () => {
    const y = doc.y;
    doc.font('cn').fontSize(8.5).fillColor('#000000');
    doc.rect(TABLE_X, y, TABLE_W, 26).fillAndStroke('#E8F0FE', '#000000');
    let cx = TABLE_X;
    COLS.forEach((w, i) => {
      if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + 26).strokeColor('#000000').stroke();
      doc.fillColor('#000000').text(HEADERS[i], cx + 2, y + 4, { width: w - 4, align: 'center', lineBreak: false });
      cx += w;
    });
    doc.y = y + 26;
  };

  doc.font('cn').fontSize(17).fillColor('#000000').text(body.supplier_company || '', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(14).text('报 价 单', { align: 'center' });
  doc.moveDown(0.6);

  doc.fontSize(9.5);
  const startX = TABLE_X;
  const halfW = TABLE_W / 2;
  const infoLine = (left: string, right: string) => {
    const y = doc.y;
    doc.text(left, startX, y, { width: halfW - 10, lineBreak: false });
    doc.text(right, startX + halfW, y, { width: halfW - 10, lineBreak: false });
    doc.y = y + 15;
  };
  infoLine(`供方：${body.supplier_company || ''}`, `客户名称：${body.customer_name || ''}`);
  infoLine(`联系人：${body.supplier_contact || ''}`, `联系人：${body.customer_contact || ''}`);
  infoLine(`电话：${body.supplier_phone || ''}`, `电话：${body.customer_phone || ''}`);
  infoLine(`地址：${body.supplier_address || ''}`, `地址：${body.customer_address || ''}`);
  {
    const y = doc.y;
    doc.text(`报价单编号：${body.quote_no || ''}`, startX, y, { width: halfW - 10, lineBreak: false });
    doc.text(`报价日期：${dateStr}`, startX + halfW, y, { width: halfW - 10, align: 'right', lineBreak: false });
    doc.y = y + 16;
  }
  doc.moveDown(0.5);

  drawTableHeader();

  let exSum = 0, incSum = 0, moldSum = 0;
  doc.fontSize(9).fillColor('#000000');
  items.forEach((item, idx) => {
    const vals = [
      String(idx + 1),
      item.model || '',
      item.spec || '',
      item.name || '',
      item.unit || 'pcs',
      item.material || '',
      item.surface || '',
      item.price_ex_tax != null ? fmtMoney(r3s(Number(item.price_ex_tax))) : '',
      item.price_inc_tax != null ? fmtMoney(r3s(Number(item.price_inc_tax))) : '',
      item.moq != null ? String(r2s(Number(item.moq))) : '',
      item.mold_fee != null ? fmtMoney(r2s(Number(item.mold_fee))) : '',
      item.remark || '',
    ];
    let rowH = 18;
    vals.forEach((v, ci) => {
      const h = doc.heightOfString(v, { width: COLS[ci] - 4 });
      if (h + 8 > rowH) rowH = h + 8;
    });
    if (doc.y + rowH > 770) {
      doc.addPage();
      drawTableHeader();
      doc.fontSize(9);
    }
    const y = doc.y;
    doc.rect(TABLE_X, y, TABLE_W, rowH).strokeColor('#000000').stroke();
    let cx = TABLE_X;
    vals.forEach((v, ci) => {
      if (ci > 0) doc.moveTo(cx, y).lineTo(cx, y + rowH).strokeColor('#000000').stroke();
      const isCenter = [0, 4, 6, 9].includes(ci);
      const isRight = [7, 8, 10].includes(ci);
      doc.fillColor('#000000').text(v, cx + 2, y + 4, {
        width: COLS[ci] - 4,
        align: isRight ? 'right' : 'center',
        lineBreak: false,
      });
      cx += COLS[ci];
    });
    doc.y = y + rowH;
    exSum += item.price_ex_tax || 0;
    incSum += item.price_inc_tax || 0;
    moldSum += item.mold_fee || 0;
  });

  const emptyRows = Math.max(0, Math.min(4, 15 - items.length));
  for (let i = 0; i < emptyRows; i++) {
    if (doc.y + 20 > 770) { doc.addPage(); drawTableHeader(); doc.fontSize(9); }
    const y = doc.y;
    doc.rect(TABLE_X, y, TABLE_W, 20).strokeColor('#000000').stroke();
    let cx = TABLE_X;
    COLS.forEach((w, ci) => {
      if (ci > 0) doc.moveTo(cx, y).lineTo(cx, y + 20).strokeColor('#000000').stroke();
      if (ci === 0) doc.fillColor('#000000').text(String(items.length + i + 1), cx + 2, y + 5, { width: w - 4, align: 'center', lineBreak: false });
      cx += w;
    });
    doc.y = y + 20;
  }

  // 总计行
  if (doc.y + 24 > 770) { doc.addPage(); drawTableHeader(); doc.fontSize(10); }
  {
    const y = doc.y;
    doc.rect(TABLE_X, y, TABLE_W, 24).strokeColor('#000000').stroke();
    let cx = TABLE_X;
    COLS.forEach((w) => { doc.moveTo(cx, y).lineTo(cx, y + 24).strokeColor('#000000').stroke(); cx += w; });
    doc.moveTo(TABLE_X + TABLE_W, y).lineTo(TABLE_X + TABLE_W, y + 24).strokeColor('#000000').stroke();
    doc.fontSize(10).fillColor('#000000');
    doc.text('总计', TABLE_X + 2, y + 7, { width: cellX(7) - TABLE_X - 4, align: 'center', lineBreak: false });
    doc.text(fmtMoney(r3s(exSum)), cellX(7) + 2, y + 7, { width: COLS[7] - 4, align: 'right', lineBreak: false });
    doc.text(fmtMoney(r3s(incSum)), cellX(8) + 2, y + 7, { width: COLS[8] - 4, align: 'right', lineBreak: false });
    doc.text(fmtMoney(r2s(moldSum)), cellX(10) + 2, y + 7, { width: COLS[10] - 4, align: 'right', lineBreak: false });
    doc.y = y + 24;
    doc.x = doc.page.margins.left;
  }

  doc.moveDown(0.8);
  doc.fontSize(9.5).fillColor('#000000');
  [
    '1：依照图纸进行开模及送样。',
    '2：此报价含运费、含13%增值税',
    '3：付款方式：现金',
    '4：此报价单有效期为15天',
    '5：开模时间15个工作日，出样5个工作日',
  ].forEach((t) => {
    doc.text(t, TABLE_X, doc.y, { width: TABLE_W });
  });

  if (body.global_remark) {
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000')
      .text(`备注：${body.global_remark}`, TABLE_X, doc.y, { width: TABLE_W });
  }

  if (body.aluminum_price) {
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#666666')
      .text(`报价基准：当日铝锭价 ${body.aluminum_price} 元/吨（南海现货均价）`, TABLE_X, doc.y, { width: TABLE_W })
      .fillColor('#000000');
  }

  doc.moveDown(2);
  doc.x = doc.page.margins.left;
  const sy = doc.y;
  doc.fontSize(11).fillColor('#000000');
  doc.text('需方（签章）', TABLE_X, sy, { width: TABLE_W / 2, lineBreak: false });
  doc.text('供方（签章）', TABLE_X + TABLE_W / 2, sy, { width: TABLE_W / 2, lineBreak: false });
  doc.moveDown(3.5);
  doc.fontSize(9.5);
  const dy = doc.y;
  doc.text('日期:', TABLE_X, dy, { width: TABLE_W / 2, lineBreak: false });
  doc.text(`日期: ${dateStr}`, TABLE_X + TABLE_W / 2, dy, { width: TABLE_W / 2 - 10, align: 'right', lineBreak: false });

  doc.end();
  return done;
}

// ===== 存档到 Supabase Storage =================================
async function archiveFiles(userId: string, quoteNo: string, customerName: string,
  totals: { ex_sum: number; inc_sum: number; mold_sum: number; item_count: number },
  xlsxBuf: Buffer, pdfBuf: Buffer) {
  const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const date = new Date();
  const base = `${userId}/${quoteNo}`;
  const up1 = await sb.storage.from(BUCKET).upload(`${base}.xlsx`, xlsxBuf, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: true, cacheControl: '3600',
  });
  if (up1.error) throw up1.error;
  const up2 = await sb.storage.from(BUCKET).upload(`${base}.pdf`, pdfBuf, {
    contentType: 'application/pdf', upsert: true, cacheControl: '3600',
  });
  if (up2.error) throw up2.error;
  const up3 = await sb.storage.from(BUCKET).upload(`${base}.json`, JSON.stringify({
    quote_no: quoteNo,
    customer_name: customerName || '',
    user_id: userId,
    ex_sum: Number(totals.ex_sum.toFixed(2)),
    inc_sum: Number(totals.inc_sum.toFixed(2)),
    mold_sum: Number(totals.mold_sum.toFixed(2)),
    item_count: totals.item_count,
    created_at: new Date().toISOString(),
  }), { contentType: 'application/json', upsert: true });
  if (up3.error) throw up3.error;
  return {
    xlsx_url: `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${base}.xlsx`,
    pdf_url: `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${base}.pdf`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SheetBody = await request.json();
    const items = body.items || [];
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: '请至少勾选一条报价' }, { status: 400 });
    }

    const today = new Date();
    const quoteNo = body.quote_no || `GY${today.toISOString().slice(0, 10).replace(/-/g, '')}001`;

    const [xlsxBuf, fontBuf] = await Promise.all([buildExcel(body), loadChineseFont()]);
    const pdfBuf = await buildPdf(body, fontBuf);

    const exSum = items.reduce((a, it) => a + (it.price_ex_tax || 0), 0);
    const incSum = items.reduce((a, it) => a + (it.price_inc_tax || 0), 0);
    const moldSum = items.reduce((a, it) => a + (it.mold_fee || 0), 0);
    const totals = { ex_sum: exSum, inc_sum: incSum, mold_sum: moldSum, item_count: items.length };

    let urls: { xlsx_url: string; pdf_url: string } | null = null;
    if (body.user_id) {
      try {
        urls = await archiveFiles(body.user_id, quoteNo, body.customer_name || '', totals, xlsxBuf, pdfBuf);
      } catch (e: any) {
        console.error('[QuoteSheet] 存档失败（不影响下载）:', e?.message);
      }
    }

    return NextResponse.json({
      success: true,
      quote_no: quoteNo,
      totals,
      xlsx_base64: xlsxBuf.toString('base64'),
      pdf_base64: pdfBuf.toString('base64'),
      ...(urls || {}),
    });
  } catch (err: any) {
    console.error('[QuoteSheet] 生成失败:', err);
    return NextResponse.json({ success: false, error: err?.message || '生成失败' }, { status: 500 });
  }
}
