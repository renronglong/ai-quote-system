import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

interface QuotationItem {
  productCode: string;
  productName: string;
  specSize: string;
  unit: string;
  material: string;
  surfaceTreatment: string;
  meterWeight?: number;   // kg/m
  length?: number;        // mm
  width?: number;         // mm
  height?: number;        // mm
  wallThickness?: number; // mm
  weightPerPiece?: number; // g/件
  processType?: string;   // 挤压/冲压/注塑
  moldFee: number;
  materialCost: number;   // 材料费
  extrusionFee: number;   // 挤压费
  machiningFee: number;   // 加工费
  surfaceFee: number;     // 表面处理费
  packagingFee: number;   // 包装费
  transportFee: number;   // 运输费
  lossFee: number;        // 损耗费
  managementFee: number;  // 管理费利润
  priceBeforeTax: number; // 不含税单价
  priceWithTax: number;   // 含税单价
  minOrderQty: number;
  remarks: string;
}

interface QuotationData {
  companyName: string;
  companyAddr: string;
  companyContact: string;
  customerName: string;
  customerContact: string;
  quotationNo: string;
  validDays: number;
  aluminumPrice: number;
  items: QuotationItem[];
  exportPdf?: boolean;
}

// 数字转中文列标
function colLetter(n: number): string {
  let s = '';
  while (n > 0) { s = String.fromCharCode(64 + (n % 26 || 26)) + s; n = Math.floor(n / 26); }
  return s;
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' as ExcelJS.BorderStyle }, left: { style: 'thin' as ExcelJS.BorderStyle },
  bottom: { style: 'thin' as ExcelJS.BorderStyle }, right: { style: 'thin' as ExcelJS.BorderStyle },
};

export async function POST(request: Request) {
  try {
    const body: QuotationData = await request.json();
    const { items, companyName, customerName, quotationNo, validDays, aluminumPrice } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '无报价数据' }, { status: 400 });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = companyName || 'AI智能报价助手';
    wb.created = new Date();

    // ==================== Sheet 1: 报价单（展示） ====================
    const ws1 = wb.addWorksheet('报价单', {
      properties: { defaultColWidth: 12 },
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
    });

    // 标题行
    ws1.mergeCells('A1:R1');
    const title = ws1.getCell('A1');
    title.value = `${companyName || '佛山市质稳五金制品有限公司'} — 报价单`;
    title.font = { size: 14, bold: true, color: { argb: 'FF1F4E79' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    ws1.getRow(1).height = 32;

    // 信息行
    ws1.mergeCells('A2:H2');
    ws1.getCell('A2').value = `报价单号：${quotationNo || 'QT-' + Date.now().toString().slice(-8)}  日期：${new Date().toLocaleDateString('zh-CN')}`;
    ws1.getCell('A2').font = { size: 9, color: { argb: 'FF666666' } };
    ws1.mergeCells('I2:R2');
    ws1.getCell('I2').value = `客户：${customerName || '-'}  有效期：${validDays || 15}天  铝锭价：¥${aluminumPrice || 22.78}/kg`;
    ws1.getCell('I2').font = { size: 9, color: { argb: 'FF666666' } };
    ws1.getCell('I2').alignment = { horizontal: 'right' };
    ws1.getRow(2).height = 22;

    // 表头（Row 3）
    const headers = [
      '序号', '产品名称', '规格&型号', '重量(g)', '模具费(元)',
      '材料费', '挤出费', '加工费', '损耗费', '表面处理',
      '包装费', '运输费', '成本', '管理费及利润', '不含税单价',
      '含税单价', '最小起订量', '材质',
    ];
    const colWidths = [5, 26, 14, 9, 11, 9, 8, 8, 8, 9, 8, 8, 9, 12, 11, 11, 10, 10];

    const hdrRow = ws1.getRow(3);
    hdrRow.values = headers;
    hdrRow.height = 28;
    hdrRow.eachCell((cell, i) => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E75B6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });
    colWidths.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });

    // 数据行
    let totalCost = 0, totalTax = 0, totalMold = 0;

    items.forEach((item, idx) => {
      const r = 4 + idx;
      const row = ws1.getRow(r);
      const cost = (item.materialCost || 0) + (item.extrusionFee || 0) + (item.machiningFee || 0)
                 + (item.lossFee || 0) + (item.surfaceFee || 0) + (item.packagingFee || 0) + (item.transportFee || 0);
      const mgmtFee = item.managementFee || cost * 0.1;
      const beforeTax = item.priceBeforeTax || cost + mgmtFee;
      const withTax = item.priceWithTax || Math.round(beforeTax * 1.13 * 100) / 100;

      row.values = [
        idx + 1,
        item.productName || '-',
        item.specSize || '-',
        item.weightPerPiece || '-',
        item.moldFee || 0,
        item.materialCost || 0,
        item.extrusionFee || 0,
        item.machiningFee || 0,
        item.lossFee || 0,
        item.surfaceFee || 0,
        item.packagingFee || 0,
        item.transportFee || 0,
        cost,
        mgmtFee,
        beforeTax,
        withTax,
        item.minOrderQty || 100,
        item.material || '6063-T5',
      ];
      row.height = 24;
      row.eachCell((cell, col) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
        if ([5,6,7,8,9,10,11,12,13,14,15,16].includes(col)) cell.numFmt = '#,##0.00';
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F7FB' } };
      });

      totalCost += cost;
      totalTax += withTax;
      totalMold += item.moldFee || 0;
    });

    // 合计行
    const sumRow = 4 + items.length;
    ws1.mergeCells(`A${sumRow}:D${sumRow}`);
    ws1.getCell(`A${sumRow}`).value = '合  计';
    ws1.getCell(`A${sumRow}`).font = { bold: true, size: 11 };
    ws1.getCell(`A${sumRow}`).alignment = { horizontal: 'center' };
    ws1.getCell(`E${sumRow}`).value = totalMold;
    ws1.getCell(`E${sumRow}`).numFmt = '#,##0';
    ws1.getCell(`E${sumRow}`).font = { bold: true, color: { argb: 'FFD32F2F' } };
    ws1.getCell(`M${sumRow}`).value = totalCost;
    ws1.getCell(`M${sumRow}`).numFmt = '#,##0.00';
    ws1.getCell(`M${sumRow}`).font = { bold: true };
    ws1.getCell(`O${sumRow}`).value = items.reduce((s, it) => s + (it.priceBeforeTax || 0), 0);
    ws1.getCell(`O${sumRow}`).numFmt = '#,##0.00';
    ws1.getCell(`P${sumRow}`).value = totalTax;
    ws1.getCell(`P${sumRow}`).numFmt = '#,##0.00';
    ws1.getCell(`P${sumRow}`).font = { bold: true, color: { argb: 'FFD32F2F' } };
    ws1.getRow(sumRow).eachCell(c => { c.border = thinBorder; });

    // 备注行
    const noteRow = sumRow + 2;
    ws1.mergeCells(`A${noteRow}:R${noteRow}`);
    ws1.getCell(`A${noteRow}`).value = '备注：1. 以上报价含13%增值税；2. 铝锭价按南海灵通当日铝锭价结算，涨跌幅±500元/吨以内不作调整；3. 模具费在首批订单达最小起订量后返还。';
    ws1.getCell(`A${noteRow}`).font = { size: 8, color: { argb: 'FF888888' } };
    ws1.getCell(`A${noteRow}`).alignment = { wrapText: true };
    ws1.getRow(noteRow).height = 40;

    // 签章行
    const signRow = noteRow + 2;
    ws1.mergeCells(`A${signRow}:G${signRow}`);
    ws1.getCell(`A${signRow}`).value = `供方（盖章）：${companyName || ''}`;
    ws1.getCell(`A${signRow}`).font = { size: 9 };
    ws1.mergeCells(`I${signRow}:R${signRow}`);
    ws1.getCell(`I${signRow}`).value = `需方确认：${customerName || ''}`;
    ws1.getCell(`I${signRow}`).font = { size: 9 };
    ws1.getCell(`I${signRow}`).alignment = { horizontal: 'right' };

    // ==================== Sheet 2: 报价明细（数据） ====================
    const ws2 = wb.addWorksheet('报价明细', {
      properties: { defaultColWidth: 13 },
    });

    const detailHeaders = [
      '产品编号', '产品名称', '材质', '截面宽(mm)', '截面高(mm)', '长度(mm)',
      '米重(kg/m)', '加工费', '表面处理', '挤压费',
      '材料费', '表面处理费', '包装费', '损耗费', '管理费利润',
      '不含税单价', '含税单价', '最小起订量', '备注',
    ];
    const detailRow = ws2.getRow(1);
    detailRow.values = detailHeaders;
    detailRow.height = 28;
    detailRow.eachCell(cell => {
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF424242' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });

    items.forEach((item, idx) => {
      const r = 2 + idx;
      const row = ws2.getRow(r);
      row.values = [
        item.productCode || `P-${String(idx+1).padStart(3,'0')}`,
        item.productName || '-',
        item.material || '6063-T5',
        item.width || '-',
        item.height || '-',
        item.length || '-',
        item.meterWeight || '-',
        item.machiningFee || 0,
        item.surfaceTreatment || '氧化',
        item.extrusionFee || 0,
        item.materialCost || 0,
        item.surfaceFee || 0,
        item.packagingFee || 0,
        item.lossFee || 0,
        item.managementFee || 0,
        item.priceBeforeTax || 0,
        item.priceWithTax || 0,
        item.minOrderQty || 100,
        item.remarks || '',
      ];
      row.height = 22;
      row.eachCell((cell, col) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
        if ([8,10,11,12,13,14,15,16,17].includes(col)) cell.numFmt = '#,##0.00';
      });
    });

    // 冻结首行
    ws2.views = [{ state: 'frozen', ySplit: 1 }];

    // ==================== 导出 ====================
    const buf = await wb.xlsx.writeBuffer();
    const fname = `${customerName ? customerName + '_' : ''}报价单_${quotationNo || Date.now().toString().slice(-8)}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
      },
    });
  } catch (error) {
    console.error('报价单生成失败:', error);
    return NextResponse.json({ error: '报价单生成失败：' + (error as Error).message }, { status: 500 });
  }
}
