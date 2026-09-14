import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

// ============================================================
// 报价导出 API — Excel / HTML(浏览器打印为PDF)
// POST /api/saved-quotes/export
// Body: { format, quotes[], sections[], product_discount?, mold_discount? }
// ============================================================

export interface ExportQuote {
  id: string | number;
  name: string;
  date?: string;
  created_at?: string;
  product_type: string;
  params: Record<string, any>;
  result: Record<string, any>;
  product_discount?: number; // 产品折扣 % (如 95 = 95折)
  mold_discount?: number;    // 模具费折扣 %
}

const fmt = (v: any) => {
  if (v == null || isNaN(v)) return '¥0.00';
  return `¥${Number(v).toFixed(2)}`;
};

function applyDisc(price: number, disc?: number): number {
  if (!disc || disc >= 100 || disc <= 0) return price;
  return price * (disc / 100);
}

// ======================== Excel ========================
async function generateExcel(quotes: ExportQuote[], sections: Set<string>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AI智能报价系统';
  workbook.created = new Date();

  const usedSheetNames = new Set<string>();
  for (const quote of quotes) {
    const { params, result, name, date, product_discount, mold_discount } = quote;
    // Excel sheet 名：≤31字符，且同一 workbook 内不能重名
    let sheetName = (name || '报价').replace(/[\\\/\?\*\[\]:]/g, '_');
    if (sheetName.length > 28) sheetName = sheetName.slice(0, 28);
    let unique = sheetName;
    let seq = 2;
    while (usedSheetNames.has(unique)) {
      const suffix = `-${seq}`;
      unique = sheetName.slice(0, 31 - suffix.length) + suffix;
      seq++;
    }
    usedSheetNames.add(unique);
    const ws = workbook.addWorksheet(unique);

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
    const secFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    const secFont: Partial<ExcelJS.Font> = { bold: true, size: 12, color: { argb: 'FF374151' } };
    const lblFont: Partial<ExcelJS.Font> = { size: 11, color: { argb: 'FF6B7280' } };
    const valFont: Partial<ExcelJS.Font> = { size: 11 };

    ws.columns = [{ width: 18 }, { width: 28 }, { width: 35 }];
    let r = 1;

    // 标题
    ws.mergeCells(r, 1, r, 3);
    const tc = ws.getCell(r, 1);
    tc.value = name; tc.font = headerFont; tc.fill = headerFill;
    tc.alignment = { horizontal: 'left', vertical: 'middle' };
    ws.getRow(r).height = 32;
    r++;
    const quoteDate = (quote as any).created_at || date;
    ws.getCell(r, 1).value = `生成时间：${new Date(quoteDate).toLocaleString('zh-CN')}`;
    ws.getCell(r, 1).font = { size: 9, color: { argb: 'FF9CA3AF' } };
    ws.mergeCells(r, 1, r, 3);
    r += 2;

    // 产品参数
    if (sections.has('product_params')) {
      ws.mergeCells(r, 1, r, 3);
      ws.getCell(r, 1).value = '产品参数';
      ws.getCell(r, 1).font = secFont; ws.getCell(r, 1).fill = secFill;
      r++;
      const dims = params.dimensions || {};
      const mat = params.material || {};
      const rows: [string, string][] = [
        ['产品类型', params.product_type || params.productType || '-'],
        ['材质', mat.category || params.materialCategory || '-'],
        ['数量', `${params.quantity || 0} 件`],
      ];
      if (dims.length_mm) rows.push(['长度', `${dims.length_mm} mm`]);
      if (dims.width_mm) rows.push(['宽度', `${dims.width_mm} mm`]);
      if (dims.height_mm) rows.push(['高度', `${dims.height_mm} mm`]);
      if (dims.wall_thickness_mm) rows.push(['壁厚', `${dims.wall_thickness_mm} mm`]);
      if (dims.num_cavities) rows.push(['面域数', `${dims.num_cavities}`]);
      if (dims.perimeter_mm) rows.push(['周长', `${dims.perimeter_mm} mm`]);
      if (result.weight_per_piece_kg) rows.push(['单件重量', `${Number(result.weight_per_piece_kg).toFixed(3)} kg`]);
      for (const [l, v] of rows) {
        ws.getCell(r, 1).value = l; ws.getCell(r, 1).font = lblFont;
        ws.getCell(r, 2).value = v; ws.getCell(r, 2).font = valFont;
        r++;
      }
      r++;
    }

    // 费用明细
    if (sections.has('cost_breakdown')) {
      ws.mergeCells(r, 1, r, 3);
      ws.getCell(r, 1).value = '费用明细';
      ws.getCell(r, 1).font = secFont; ws.getCell(r, 1).fill = secFill;
      r++;
      for (const [label, col] of [['项目',1],['金额',2],['计算公式',3]] as [string,number][]) {
        ws.getCell(r, col).value = label;
        ws.getCell(r, col).font = { bold: true, size: 11 };
        ws.getCell(r, col).fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF9FAFB'} };
      }
      r++;

      const items: [string,string][] = [
        ['材料费','material_cost'],['加工费','processing_cost'],
        ['表面处理费','surface_treatment_cost'],['包装费','packaging_cost'],
        ['运输费','transport_cost'],['管理费','management_fee'],
      ];
      for (const [label, key] of items) {
        const val = (result as any)[key];
        const detail = (result.breakdown || {})[key]?.formula || '';
        ws.getCell(r, 1).value = label; ws.getCell(r, 1).font = lblFont;
        ws.getCell(r, 2).value = fmt(val); ws.getCell(r, 2).font = valFont;
        ws.getCell(r, 2).alignment = { horizontal: 'right' };
        ws.getCell(r, 3).value = detail;
        ws.getCell(r, 3).font = { size: 10, color: { argb: 'FF9CA3AF' } };
        r++;
      }

      // 产品折扣行
      if (product_discount && product_discount < 100) {
        const origUnit = result.unit_price || 0;
        const discUnit = applyDisc(origUnit, product_discount);
        ws.getCell(r, 1).value = `产品折扣 (${product_discount}%)`;
        ws.getCell(r, 1).font = { ...lblFont, color: { argb: 'FFEF4444' } };
        ws.getCell(r, 2).value = `${fmt(discUnit)}/件 (原 ${fmt(origUnit)})`;
        ws.getCell(r, 2).font = { size: 11, color: { argb: 'FFEF4444' } };
        ws.getCell(r, 2).alignment = { horizontal: 'right' };
        r++;
      }

      // 模具费折扣行
      const moldFee = (result.breakdown || {}).mold?.amount || result.mold_cost || 0;
      if (mold_discount && mold_discount < 100 && moldFee > 0) {
        const discMold = applyDisc(moldFee, mold_discount);
        ws.getCell(r, 1).value = `模具费折扣 (${mold_discount}%)`;
        ws.getCell(r, 1).font = { ...lblFont, color: { argb: 'FFEF4444' } };
        ws.getCell(r, 2).value = `${fmt(discMold)} (原 ${fmt(moldFee)})`;
        ws.getCell(r, 2).font = { size: 11, color: { argb: 'FFEF4444' } };
        ws.getCell(r, 2).alignment = { horizontal: 'right' };
        r++;
      }
      r++;
    }

    // 模具信息
    if (sections.has('mold_info')) {
      ws.mergeCells(r, 1, r, 3);
      ws.getCell(r, 1).value = '模具信息';
      ws.getCell(r, 1).font = secFont; ws.getCell(r, 1).fill = secFill;
      r++;
      const dims = params.dimensions || {};
      const bd = result.breakdown || {};
      const mRows: [string,string][] = [];
      if (dims.die_type) mRows.push(['模具类型', dims.die_type === 'flat' ? '平模' : '分流模']);
      if (dims.num_cavities) mRows.push(['面域数', `${dims.num_cavities}`]);
      if (bd.mold?.detail) mRows.push(['模具费明细', bd.mold.detail]);
      if (bd.mold?.amount) mRows.push(['模具费', fmt(bd.mold.amount)]);
      for (const [l, v] of mRows) {
        ws.getCell(r, 1).value = l; ws.getCell(r, 1).font = lblFont;
        ws.getCell(r, 2).value = v; ws.getCell(r, 2).font = valFont;
        r++;
      }
      // 模具费折扣汇总
      if (mold_discount && mold_discount < 100 && (bd.mold?.amount || 0) > 0) {
        ws.getCell(r, 1).value = '模具费(折后)';
        ws.getCell(r, 1).font = { ...lblFont, bold: true };
        ws.getCell(r, 2).value = fmt(applyDisc(bd.mold?.amount || 0, mold_discount));
        ws.getCell(r, 2).font = { ...valFont, bold: true, color: { argb: 'FF059669' } };
        ws.getCell(r, 2).alignment = { horizontal: 'right' };
        r++;
      }
      r++;
    }

    // 表面处理
    if (sections.has('surface_info')) {
      ws.mergeCells(r, 1, r, 3);
      ws.getCell(r, 1).value = '表面处理信息';
      ws.getCell(r, 1).font = secFont; ws.getCell(r, 1).fill = secFill;
      r++;
      const st = params.surface_treatment;
      ws.getCell(r, 1).value = '表面处理'; ws.getCell(r, 1).font = lblFont;
      ws.getCell(r, 2).value = st?.type || '无'; ws.getCell(r, 2).font = valFont;
      r++;
      if (st?.color) {
        ws.getCell(r, 1).value = '颜色'; ws.getCell(r, 1).font = lblFont;
        ws.getCell(r, 2).value = st.color; ws.getCell(r, 2).font = valFont;
        r++;
      }
      ws.getCell(r, 1).value = '表面处理费'; ws.getCell(r, 1).font = lblFont;
      ws.getCell(r, 2).value = fmt(result.surface_treatment_cost); ws.getCell(r, 2).font = valFont;
      ws.getCell(r, 2).alignment = { horizontal: 'right' };
      r += 2;
    }

    // 合计
    if (sections.has('total_price')) {
      const unitPrice = result.unit_price || 0;
      const totalPrice = result.total_price || 0;
      const moldFee2 = (result.breakdown || {}).mold?.amount || result.mold_cost || 0;

      const discUnit = applyDisc(unitPrice, product_discount);
      const discTotal = applyDisc(totalPrice, product_discount);
      const discMold = applyDisc(moldFee2, mold_discount);
      // 模具费独立，需要从总价中减去差额
      const moldDiff = moldFee2 - discMold;
      const finalUnit = discUnit - (moldDiff / (params.quantity || 1));
      const finalTotal = discTotal - moldDiff;

      ws.mergeCells(r, 1, r, 3);
      const totalCell = ws.getCell(r, 1);
      totalCell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFECFDF5'} };
      totalCell.font = { bold: true, size: 14, color: { argb: 'FF059669' } };
      totalCell.alignment = { horizontal: 'left', vertical: 'middle' };

      const hasAnyDisc = (product_discount && product_discount < 100) || (mold_discount && mold_discount < 100);
      if (hasAnyDisc) {
        totalCell.value = `折后单价: ${fmt(finalUnit)}  |  折后总价(${params.quantity||0}件): ${fmt(finalTotal)}`;
        r++;
        ws.mergeCells(r, 1, r, 3);
        let note = `原价: ${fmt(unitPrice)}/件, 总价: ${fmt(totalPrice)}`;
        if (product_discount && product_discount < 100) note += `, 产品${product_discount}%折`;
        if (mold_discount && mold_discount < 100) note += `, 模具${mold_discount}%折`;
        ws.getCell(r, 1).value = `（${note}）`;
        ws.getCell(r, 1).font = { size: 11, color: { argb: 'FF6B7280' } };
      } else {
        totalCell.value = `单价: ${fmt(unitPrice)}  |  总价(${params.quantity||0}件): ${fmt(totalPrice)}`;
      }
      ws.getRow(r).height = 38;
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return buf;
}

// ======================== HTML ========================
function generateHTML(quotes: ExportQuote[], sections: Set<string>): string {
  let allHtml = '';
  for (const quote of quotes) {
    const { params, result, name, date, product_discount, mold_discount } = quote;
    const dims = params.dimensions || {};
    const mat = params.material || {};
    const hasPD = product_discount && product_discount < 100;
    const hasMD = mold_discount && mold_discount < 100;
    const discUnit = applyDisc(result.unit_price || 0, product_discount);
    const discTotal = applyDisc(result.total_price || 0, product_discount);
    const moldFee = (result.breakdown || {}).mold?.amount || result.mold_cost || 0;
    const discMold = applyDisc(moldFee, mold_discount);
    const moldDiff = moldFee - discMold;
    const finalUnit = discUnit - (moldDiff / (params.quantity || 1));
    const finalTotal = discTotal - moldDiff;
    const hasAny = hasPD || hasMD;

    let html = `
<div style="page-break-after:always;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;padding:30px;color:#333;max-width:800px;margin:0 auto;">
  <div style="border-bottom:2px solid #10b981;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:baseline;">
    <div>
      <h2 style="margin:0;color:#065f46;font-size:20px;">${name}</h2>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">${new Date((quote as any).created_at || date).toLocaleString('zh-CN')}</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#9ca3af;">AI智能报价系统</div>
  </div>`;

    if (sections.has('product_params')) {
      const prs: [string,string][] = [
        ['产品类型',params.product_type||params.productType||'-'],['材质',mat.category||params.materialCategory||'-'],['数量',`${params.quantity||0} 件`],
      ];
      if (dims.length_mm) prs.push(['长度',`${dims.length_mm} mm`]);
      if (dims.width_mm) prs.push(['宽度',`${dims.width_mm} mm`]);
      if (dims.height_mm) prs.push(['高度',`${dims.height_mm} mm`]);
      if (dims.wall_thickness_mm) prs.push(['壁厚',`${dims.wall_thickness_mm} mm`]);
      if (dims.num_cavities) prs.push(['面域数',`${dims.num_cavities}`]);
      if (dims.perimeter_mm) prs.push(['周长',`${dims.perimeter_mm} mm`]);
      if (result.weight_per_piece_kg) prs.push(['单件重量',`${Number(result.weight_per_piece_kg).toFixed(3)} kg`]);
      html += `<div style="margin-bottom:18px;">
    <h3 style="font-size:14px;color:#374151;border-left:3px solid #10b981;padding-left:8px;margin:0 0 10px 0;">产品参数</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${prs.map(([l,v])=>`<tr><td style="padding:4px 8px;background:#f9fafb;width:120px;color:#6b7280;">${l}</td><td style="padding:4px 8px;">${v}</td></tr>`).join('')}
    </table></div>`;
    }

    if (sections.has('cost_breakdown')) {
      const items: [string,string][] = [
        ['材料费','material_cost'],['加工费','processing_cost'],['表面处理费','surface_treatment_cost'],
        ['包装费','packaging_cost'],['运输费','transport_cost'],['管理费','management_fee'],
      ];
      let rows = items.map(([l,k])=>{
        const v=(result as any)[k]; const d=(result.breakdown||{})[k]?.formula||'';
        return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${l}</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:500;">${fmt(v)}</td><td style="padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">${d}</td></tr>`;
      }).join('');

      if (hasPD) {
        rows += `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#ef4444;font-weight:500;">产品折扣 (${product_discount}%)</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;color:#ef4444;font-weight:500;">${fmt(discUnit)}/件</td><td style="padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">原价 ${fmt(result.unit_price)}</td></tr>`;
      }
      if (hasMD && moldFee > 0) {
        rows += `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#f59e0b;font-weight:500;">模具费折扣 (${mold_discount}%)</td><td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;color:#f59e0b;font-weight:500;">${fmt(discMold)}</td><td style="padding:6px 8px;font-size:11px;color:#9ca3af;border-bottom:1px solid #e5e7eb;">原价 ${fmt(moldFee)}</td></tr>`;
      }

      html += `<div style="margin-bottom:18px;">
    <h3 style="font-size:14px;color:#374151;border-left:3px solid #8b5cf6;padding-left:8px;margin:0 0 10px 0;">费用明细</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f3f4f6;"><th style="padding:6px 8px;text-align:left;font-weight:600;">项目</th><th style="padding:6px 8px;text-align:right;font-weight:600;">金额</th><th style="padding:6px 8px;text-align:left;font-weight:600;font-size:11px;color:#6b7280;">计算公式</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    }

    if (sections.has('mold_info')) {
      const bd = result.breakdown || {};
      const mr: [string,string][] = [];
      if (dims.die_type) mr.push(['模具类型', dims.die_type==='flat'?'平模':'分流模']);
      if (dims.num_cavities) mr.push(['面域数',`${dims.num_cavities}`]);
      if (bd.mold?.detail) mr.push(['模具费明细', bd.mold.detail]);
      if (bd.mold?.amount) mr.push(['模具费', fmt(bd.mold.amount)]);
      if (mr.length > 0) {
        html += `<div style="margin-bottom:18px;">
    <h3 style="font-size:14px;color:#374151;border-left:3px solid #3b82f6;padding-left:8px;margin:0 0 10px 0;">模具信息</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${mr.map(([l,v])=>`<tr><td style="padding:4px 8px;background:#f9fafb;width:120px;color:#6b7280;">${l}</td><td style="padding:4px 8px;">${v}</td></tr>`).join('')}
    </table></div>`;
      }
    }

    if (sections.has('surface_info')) {
      const st = params.surface_treatment;
      html += `<div style="margin-bottom:18px;">
    <h3 style="font-size:14px;color:#374151;border-left:3px solid #f59e0b;padding-left:8px;margin:0 0 10px 0;">表面处理信息</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr><td style="padding:4px 8px;background:#f9fafb;width:120px;color:#6b7280;">表面处理</td><td style="padding:4px 8px;">${st?.type||'无'}</td></tr>
      ${st?.color?`<tr><td style="padding:4px 8px;background:#f9fafb;color:#6b7280;">颜色</td><td style="padding:4px 8px;">${st.color}</td></tr>`:''}
      <tr><td style="padding:4px 8px;background:#f9fafb;color:#6b7280;">表面处理费</td><td style="padding:4px 8px;">${fmt(result.surface_treatment_cost)}</td></tr>
    </table></div>`;
    }

    if (sections.has('total_price')) {
      html += `<div style="margin-top:20px;padding:16px;background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid #a7f3d0;border-radius:8px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <span style="font-size:14px;color:#065f46;">单价（含税）</span>
      <span style="font-size:28px;font-weight:bold;color:#059669;">${hasAny ? fmt(finalUnit) : fmt(result.unit_price)}</span>
    </div>
    ${hasAny ? `<div style="text-align:right;font-size:12px;color:#ef4444;margin-top:2px;">${hasPD?`产品${product_discount}%折 `:''}${hasMD?`模具${mold_discount}%折`:''}· 原价 ${fmt(result.unit_price)}/件</div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px;">
      <span style="font-size:13px;color:#047857;">总价（${params.quantity||0}件）</span>
      <span style="font-size:20px;font-weight:bold;color:#047857;">${hasAny ? fmt(finalTotal) : fmt(result.total_price)}</span>
    </div>
  </div>`;
    }

    if (result.notes?.length > 0) {
      html += `<div style="margin-top:16px;padding:10px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;font-size:12px;color:#92400e;">
    <strong>备注：</strong><ul style="margin:4px 0 0 16px;padding:0;">${result.notes.map((n:string)=>`<li>${n}</li>`).join('')}</ul></div>`;
    }
    html += `</div>`;
    allHtml += html;
  }
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>报价单</title>
<style>@media print{body{margin:0;}div[style*="page-break-after"]{page-break-after:always;}}@page{margin:15mm;}</style></head><body>${allHtml}</body></html>`;
}

// ======================== Handler ========================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format, quotes, sections } = body as {
      format: 'excel'|'pdf'|'html';
      quotes: ExportQuote[];
      sections: string[];
    };
    if (!quotes?.length) return NextResponse.json({ error: '没有选择报价' }, { status: 400 });

    const sectionSet = new Set(sections || ['product_params','cost_breakdown','mold_info','surface_info','total_price']);
    const dateStr = new Date().toISOString().slice(0,10);

    if (format === 'excel') {
      const buf = await generateExcel(quotes, sectionSet);
      return new NextResponse(buf as ArrayBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename*=UTF-8''quotes_${dateStr}.xlsx`,
        },
      });
    }
    if (format === 'pdf' || format === 'html') {
      const html = generateHTML(quotes, sectionSet);
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    return NextResponse.json({ error: '不支持的格式' }, { status: 400 });
  } catch (err) {
    console.error('[Export] error:', err);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
