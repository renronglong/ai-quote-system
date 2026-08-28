import { NextRequest, NextResponse } from 'next/server';

// ==================== 数字转中文大写 ====================
function numberToChinese(num: number): string {
  if (num === 0) return '零元整';
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  
  let intStr = '';
  if (intPart === 0) {
    intStr = '零';
  } else {
    const s = String(intPart);
    let zeroFlag = false;
    for (let i = 0; i < s.length; i++) {
      const d = parseInt(s[i]);
      const pos = s.length - 1 - i;
      const bigIdx = Math.floor(pos / 4);
      const smallIdx = pos % 4;
      if (d === 0) {
        zeroFlag = true;
      } else {
        if (zeroFlag) { intStr += '零'; zeroFlag = false; }
        intStr += digits[d] + units[smallIdx];
      }
      if (smallIdx === 0 && bigIdx > 0) {
        intStr += bigUnits[bigIdx];
      }
    }
  }
  
  let result = intStr + '元';
  if (decPart === 0) {
    result += '整';
  } else {
    const jiao = Math.floor(decPart / 10);
    const fen = decPart % 10;
    if (jiao > 0) result += digits[jiao] + '角';
    if (fen > 0) result += digits[fen] + '分';
  }
  return result;
}

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '0.00';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// ==================== 报价单 HTML 生成 ====================
function generateQuoteHTML(data: QuotePDFData): string {
  const {
    quote_no,
    date,
    valid_until,
    customer_name,
    customer_contact,
    customer_phone,
    company_name = '佛山市盛世源通铝材有限公司',
    company_address = '广东省佛山市南海区',
    company_phone = '',
    items,
    subtotal,
    mold_fee,
    discount,
    discount_amount,
    tax_rate,
    tax_amount,
    total,
    notes,
    payment_terms,
    delivery_terms,
    aluminum_price,
  } = data;

  const totalChinese = numberToChinese(total);

  const itemsRows = items.map((item, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${item.name}</td>
      <td>${item.spec || '-'}</td>
      <td>${item.material || '6063-T5'}</td>
      <td>${item.surface || '素材'}</td>
      <td class="right">${item.qty}</td>
      <td class="right">${item.weight_kg ? item.weight_kg.toFixed(3) : '-'}</td>
      <td class="right">${fmt(item.unit_price)}</td>
      <td class="right">${fmt(item.amount)}</td>
    </tr>
  `).join('');

  const notesHtml = notes && notes.length > 0
    ? `<div class="section"><div class="section-title">备注</div><ul class="notes-list">${notes.map(n => `<li>${n}</li>`).join('')}</ul></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>报价单 ${quote_no}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "SimSun", "PingFang SC", sans-serif; color: #333; background: #f5f5f5; padding: 20px; }
  .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px 50px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
  
  /* 抬头 */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a5632; padding-bottom: 15px; margin-bottom: 20px; }
  .company-info h1 { font-size: 22px; color: #1a5632; letter-spacing: 2px; }
  .company-info p { font-size: 11px; color: #666; margin-top: 4px; line-height: 1.6; }
  .quote-title { text-align: right; }
  .quote-title h2 { font-size: 28px; color: #1a5632; letter-spacing: 6px; }
  .quote-title .quote-no { font-size: 12px; color: #999; margin-top: 6px; }

  /* 报价信息 */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 30px; margin-bottom: 18px; font-size: 12px; }
  .info-grid .label { color: #888; display: inline-block; width: 70px; }
  .info-grid .value { color: #333; }

  /* 表格 */
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  thead th { background: #1a5632; color: #fff; padding: 8px 6px; font-weight: 500; text-align: center; font-size: 11px; }
  tbody td { padding: 7px 6px; border-bottom: 1px solid #eee; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .center { text-align: center; }
  .right { text-align: right; }
  tfoot td { padding: 8px 6px; font-weight: 600; border-top: 2px solid #1a5632; }
  .total-row td { background: #f0f7f2 !important; font-size: 14px; color: #1a5632; padding: 10px 6px; }
  .total-row .amount { font-size: 18px; font-weight: 700; color: #c33; }

  /* 合计区域 */
  .summary { display: flex; justify-content: flex-end; margin-top: 8px; }
  .summary table { width: 320px; font-size: 12px; }
  .summary td { padding: 5px 8px; border: none; }
  .summary .s-label { color: #666; text-align: right; }
  .summary .s-value { text-align: right; font-weight: 500; }
  .summary .s-total { border-top: 2px solid #1a5632; font-size: 14px; color: #c33; font-weight: 700; }

  /* 中文大写 */
  .chinese-total { background: #fffbe6; border: 1px solid #ffe58f; padding: 8px 12px; font-size: 13px; margin-bottom: 16px; border-radius: 2px; }
  .chinese-total strong { color: #c33; }

  /* 条款 */
  .section { margin-bottom: 14px; }
  .section-title { font-size: 12px; font-weight: 600; color: #1a5632; border-left: 3px solid #1a5632; padding-left: 8px; margin-bottom: 6px; }
  .section-content { font-size: 11px; color: #555; line-height: 1.8; }
  .notes-list { padding-left: 18px; font-size: 11px; color: #555; line-height: 1.8; }

  /* 签章区 */
  .sign-area { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; }
  .sign-block { width: 45%; font-size: 11px; color: #666; }
  .sign-block .sign-line { border-top: 1px solid #999; margin-top: 50px; padding-top: 4px; }

  /* 页脚 */
  .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }

  @media print {
    body { background: #fff; padding: 0; }
    .page { box-shadow: none; padding: 20px 30px; max-width: 100%; }
    .no-print { display: none; }
  }
  @page { size: A4; margin: 12mm; }
</style>
</head>
<body>
<div class="page">
  <!-- 抬头 -->
  <div class="header">
    <div class="company-info">
      <h1>${company_name}</h1>
      <p>
        ${company_address ? `地址：${company_address}<br>` : ''}
        ${company_phone ? `电话：${company_phone}<br>` : ''}
        ${aluminum_price ? `当日铝锭基价：¥${aluminum_price.toLocaleString()}/吨` : ''}
      </p>
    </div>
    <div class="quote-title">
      <h2>报价单</h2>
      <div class="quote-no">编号：${quote_no}</div>
    </div>
  </div>

  <!-- 报价信息 -->
  <div class="info-grid">
    <div><span class="label">客户名称：</span><span class="value">${customer_name || ''}</span></div>
    <div><span class="label">报价日期：</span><span class="value">${fmtDate(new Date(date))}</span></div>
    <div><span class="label">联系人：</span><span class="value">${customer_contact || ''}</span></div>
    <div><span class="label">有效期至：</span><span class="value">${fmtDate(new Date(valid_until))}</span></div>
    <div><span class="label">联系电话：</span><span class="value">${customer_phone || ''}</span></div>
    <div><span class="label">付款方式：</span><span class="value">${payment_terms || ''}</span></div>
  </div>

  <!-- 产品明细表 -->
  <table>
    <thead>
      <tr>
        <th style="width:30px">序号</th>
        <th>产品名称/型号</th>
        <th>规格(mm)</th>
        <th>材质</th>
        <th>表面处理</th>
        <th style="width:40px">数量</th>
        <th style="width:65px">单重(kg)</th>
        <th style="width:75px">单价(元)</th>
        <th style="width:85px">金额(元)</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="8" style="text-align:right; padding-right:15px;">合计金额</td>
        <td class="right amount">¥${fmt(total)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- 中文大写 -->
  <div class="chinese-total">
    大写金额：<strong>${totalChinese}</strong>
  </div>

  <!-- 费用汇总 -->
  <div class="summary">
    <table>
      <tr><td class="s-label">产品金额小计：</td><td class="s-value">¥${fmt(subtotal)}</td></tr>
      ${mold_fee ? `<tr><td class="s-label">模具费（一次性）：</td><td class="s-value">¥${fmt(mold_fee)}</td></tr>` : ''}
      ${discount ? `<tr><td class="s-label">折扣优惠：</td><td class="s-value" style="color:#c33">-¥${fmt(discount_amount || 0)}</td></tr>` : ''}
      ${tax_rate ? `<tr><td class="s-label">税费（${(tax_rate*100).toFixed(0)}%）：</td><td class="s-value">¥${fmt(tax_amount || 0)}</td></tr>` : ''}
      <tr><td class="s-label s-total">应付总额：</td><td class="s-value s-total">¥${fmt(total)}</td></tr>
    </table>
  </div>

  <!-- 交货条款 -->
  ${delivery_terms ? `<div class="section"><div class="section-title">交货条款</div><div class="section-content">${delivery_terms}</div></div>` : ''}

  <!-- 备注 -->
  ${notesHtml}

  <!-- 签章 -->
  <div class="sign-area">
    <div class="sign-block">
      <div>供方（盖章）：${company_name}</div>
      <div class="sign-line">经办人签字：</div>
    </div>
    <div class="sign-block">
      <div>需方（盖章）：</div>
      <div class="sign-line">经办人签字：</div>
    </div>
  </div>

  <div class="footer">
    此报价由 AI 智能报价系统(gyparts.cn)生成，最终价格以正式合同为准。
  </div>
</div>

<div class="no-print" style="text-align:center; padding:15px;">
  <button onclick="window.print()" style="padding:10px 30px; background:#1a5632; color:#fff; border:none; border-radius:4px; font-size:14px; cursor:pointer;">打印 / 导出PDF</button>
</div>
</body>
</html>`;
}

// ==================== 类型 ====================
interface QuoteItem {
  name: string;
  spec?: string;
  material?: string;
  surface?: string;
  qty: number;
  weight_kg?: number;
  unit_price: number;
  amount: number;
}

interface QuotePDFData {
  quote_no: string;
  date: string;
  valid_until: string;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  items: QuoteItem[];
  subtotal: number;
  mold_fee?: number;
  discount?: number;
  discount_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  total: number;
  notes?: string[];
  payment_terms?: string;
  delivery_terms?: string;
  aluminum_price?: number;
}

// ==================== Handler ====================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as QuotePDFData;
    if (!body.items?.length) {
      return NextResponse.json({ error: '缺少报价明细' }, { status: 400 });
    }

    // 自动生成报价编号
    if (!body.quote_no) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      body.quote_no = `GY${dateStr}-${rand}`;
    }

    // 默认日期
    const now = new Date();
    body.date = body.date || now.toISOString();
    if (!body.valid_until) {
      const valid = new Date(now);
      valid.setDate(valid.getDate() + 15);
      body.valid_until = valid.toISOString();
    }

    // 自动计算合计
    if (!body.subtotal && body.items.length > 0) {
      body.subtotal = body.items.reduce((s, item) => s + (item.amount || item.unit_price * item.qty), 0);
    }
    if (body.total == null) {
      body.total = body.subtotal + (body.mold_fee || 0) - (body.discount_amount || 0) + (body.tax_amount || 0);
    }

    const html = generateQuoteHTML(body);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('[Quote PDF]', err);
    return NextResponse.json({ error: err.message || '生成报价单失败' }, { status: 500 });
  }
}

// GET 也支持，方便测试
export async function GET() {
  return NextResponse.json({ message: 'POST quote data to generate PDF quote', field: 'see QuotePDFData interface' });
}
