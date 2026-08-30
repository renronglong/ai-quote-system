import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

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
  mold_fee?: number;       // 模具费
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
  items: SheetItem[];
}

const FONT = '宋体';
const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};
const medium: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF000000' } },
  left: { style: 'medium', color: { argb: 'FF000000' } },
  bottom: { style: 'medium', color: { argb: 'FF000000' } },
  right: { style: 'medium', color: { argb: 'FF000000' } },
};

function fmtNum(n: number | undefined | null, digits = 3): string {
  if (n == null || isNaN(n)) return '';
  return Number(n.toFixed(digits)).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body: SheetBody = await request.json();
    const items = body.items || [];
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: '请至少勾选一条报价' }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = body.supplier_company || 'gyparts.cn';
    wb.created = new Date();
    const ws = wb.addWorksheet('报价单', {
      views: [{ showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    // 列宽（对照模板）
    const widths = [6.5, 15, 16, 13, 5.5, 10, 8, 12, 11, 9, 12, 10];
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

    const today = new Date();
    const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

    const setCell = (addr: string, value: any, opts: Partial<ExcelJS.Style> = {}) => {
      const c = ws.getCell(addr);
      c.value = value;
      c.font = { name: FONT, size: 11, ...(opts.font || {}) };
      if (opts.alignment) c.alignment = opts.alignment;
      if (opts.border) c.border = opts.border;
      return c;
    };

    // ===== 抬头 =====
    ws.mergeCells('A1:L1');
    setCell('A1', body.supplier_company || '', {
      font: { name: FONT, size: 20, bold: true },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    ws.getRow(1).height = 26;

    ws.mergeCells('A2:L2');
    setCell('A2', '报价单', {
      font: { name: FONT, size: 20, bold: true },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    ws.getRow(2).height = 26;

    // ===== 信息区（行3-8）=====
    ws.getRow(3).height = 18;
    setCell('A3', '报价日期:', { font: { name: FONT, size: 11, bold: true } });
    ws.mergeCells('C3:E3');
    setCell('C3', dateStr, { alignment: { horizontal: 'center' } });

    ws.getRow(4).height = 20;
    setCell('A4', '客户：', { font: { name: FONT, size: 11, bold: true } });
    setCell('B4', body.customer_name || '');
    ws.mergeCells('F4:G4');
    setCell('F4', '编号', { font: { name: FONT, size: 11, bold: true }, alignment: { horizontal: 'center' } });
    ws.mergeCells('H4:L4');
    setCell('H4', body.quote_no || '', { alignment: { horizontal: 'center' } });

    ws.getRow(5).height = 20;
    setCell('A5', '联系人：', { font: { name: FONT, size: 11, bold: true } });
    ws.mergeCells('B5:E5');
    setCell('B5', body.customer_contact || '');
    setCell('F5', `联系人：${body.supplier_contact || ''}`);

    ws.getRow(6).height = 20;
    setCell('A6', '联系地址：', { font: { name: FONT, size: 11, bold: true } });
    ws.mergeCells('B6:E6');
    setCell('B6', body.customer_address || '');
    setCell('F6', body.supplier_address || '');

    ws.getRow(7).height = 20;
    setCell('A7', '电话：', { font: { name: FONT, size: 11, bold: true } });
    setCell('B7', body.customer_phone || '');
    setCell('F7', `联系电话：${body.supplier_phone || ''}`);

    ws.getRow(8).height = 18;
    setCell('A8', 'QQ：', { font: { name: FONT, size: 11, bold: true } });
    setCell('B8', body.customer_qq || '');

    // ===== 表头（行9）=====
    const headers = ['序号', '客户型号', '规格尺寸mm', '产品名称', '单位', '材质', '表面处理', '单价未税(元）', '含税价', '最小起订量', '模具费RMB(元）', '备注'];
    ws.getRow(9).height = 32;
    headers.forEach((h, i) => {
      const c = ws.getCell(9, i + 1);
      c.value = h;
      c.font = { name: FONT, size: 11, bold: true };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = thin;
    });

    // ===== 数据行（行10起，最多15行，与模板一致）=====
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
            item.price_ex_tax != null ? Number(item.price_ex_tax.toFixed(4)) : '',
            item.price_inc_tax != null ? Number(item.price_inc_tax.toFixed(4)) : '',
            item.moq != null ? item.moq : '',
            item.mold_fee != null ? Number(item.mold_fee.toFixed(2)) : '',
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
          c.numFmt = '0.000';
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

    // ===== 总计行（行25）=====
    const totalRow = DATA_START + DATA_ROWS; // 25
    ws.getRow(totalRow).height = 22;
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
    exCell.value = Number(exSum.toFixed(4));
    exCell.numFmt = '0.000';
    exCell.alignment = { horizontal: 'right' };
    exCell.font = { name: FONT, size: 11, bold: true };
    const incCell = ws.getCell(totalRow, 9);
    incCell.value = Number(incSum.toFixed(4));
    incCell.numFmt = '0.000';
    incCell.alignment = { horizontal: 'right' };
    incCell.font = { name: FONT, size: 11, bold: true };
    const moldCell = ws.getCell(totalRow, 11);
    moldCell.value = Number(moldSum.toFixed(2));
    moldCell.numFmt = '0.00';
    moldCell.alignment = { horizontal: 'right' };
    moldCell.font = { name: FONT, size: 11, bold: true };

    // ===== 条款区（行26-30）=====
    const terms = [
      '1：依照图纸进行开模及送样。',
      '2：此报价含运费、含13%增值税',
      '3：付款方式：现金',
      '4：此报价单有效期为15天',
      '5：开模时间15个工作日，出样5个工作日',
    ];
    terms.forEach((t, i) => {
      const r = totalRow + 1 + i; // 26-30
      ws.mergeCells(`A${r}:L${r}`);
      setCell(`A${r}`, t, { font: { name: FONT, size: 11 } });
      ws.getRow(r).height = 18;
    });

    // 铝锭价提示（条款后追加一行）
    const alRow = totalRow + 6; // 31
    ws.mergeCells(`A${alRow}:L${alRow}`);
    setCell(`A${alRow}`, body.aluminum_price ? `报价基准：当日铝锭价 ¥${body.aluminum_price.toLocaleString()}/吨` : '', {
      font: { name: FONT, size: 10, color: { argb: 'FF888888' } },
    });

    // ===== 签章区（行33-35，留空手签）=====
    const signRow = alRow + 2; // 33
    ws.mergeCells(`A${signRow}:G${signRow}`);
    setCell(`A${signRow}`, '需方（签章）', {
      font: { name: FONT, size: 12, bold: true },
      alignment: { horizontal: 'left' },
    });
    ws.mergeCells(`H${signRow}:L${signRow}`);
    setCell(`H${signRow}`, '供方（签章）', {
      font: { name: FONT, size: 12, bold: true },
      alignment: { horizontal: 'left' },
    });
    ws.getRow(signRow).height = 24;
    // 签章留白行
    ws.getRow(signRow + 1).height = 40;
    ws.getRow(signRow + 2).height = 40;

    const dateRow = signRow + 3; // 36
    setCell(`A${dateRow}`, '日期:', { font: { name: FONT, size: 11 } });
    ws.mergeCells(`H${dateRow}:K${dateRow}`);
    setCell(`H${dateRow}`, `日期: ${dateStr}`, { font: { name: FONT, size: 11 } });

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `报价单-${body.quote_no || today.toISOString().slice(0, 10)}.xlsx`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err: any) {
    console.error('[QuoteSheet] 生成失败:', err);
    return NextResponse.json({ success: false, error: err?.message || '生成失败' }, { status: 500 });
  }
}
