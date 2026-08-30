'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, FileSpreadsheet, Check, Loader2, Building2, User, Phone, MapPin, Hash } from 'lucide-react';
import { loadSavedQuotes, saveQuoteToAPI, type SavedQuote } from './SavedQuotesPanel';
import { useAuth } from '@/lib/auth-context';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  // 当前页面上的报价（未保存也可一键加入）
  currentQuote?: {
    params: Record<string, any>;
    result: Record<string, any>;
    productType: string;
    productDiscount?: number;
    moldDiscount?: number;
  } | null;
  aluminumPrice?: number;
  // 当前模具组ID（页面上正在报价的这副模具）
  moldGroupId?: string;
}

interface CustomerInfo {
  name: string;
  contact: string;
  phone: string;
  address: string;
  qq: string;
}

const CUST_KEY = 'gyparts_customer_profiles';
const SEQ_KEY = 'gyparts_quote_seq';

function loadCustomers(): CustomerInfo[] {
  try { return JSON.parse(localStorage.getItem(CUST_KEY) || '[]'); } catch { return []; }
}
function saveCustomer(c: CustomerInfo) {
  if (!c.name) return;
  const list = loadCustomers().filter((x) => x.name !== c.name);
  list.unshift(c);
  localStorage.setItem(CUST_KEY, JSON.stringify(list.slice(0, 50)));
}
function nextQuoteNo(): string {
  const today = new Date();
  const d = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  let seq = 1;
  try {
    const saved = JSON.parse(localStorage.getItem(SEQ_KEY) || '{}');
    if (saved.date === d) seq = (saved.seq || 0) + 1;
  } catch { /* ignore */ }
  localStorage.setItem(SEQ_KEY, JSON.stringify({ date: d, seq }));
  return `GY${d}${String(seq).padStart(3, '0')}`;
}

// 从保存的报价提取出单字段
function toSheetItem(q: SavedQuote) {
  const p = q.params || {};
  const r = q.result || {};
  const pd = (q.product_discount ?? 100) / 100;
  const md = (q.mold_discount ?? 100) / 100;
  const specParts: string[] = [];
  if (p.width) specParts.push(`${p.width}`);
  if (p.height) specParts.push(`${p.height}`);
  if (p.length) specParts.push(`${p.length}`);
  const unitPrice = (r.unit_price || 0) * pd;
  const moldFee = (r.mold_cost || 0) * md;
  return {
    id: q.id,
    moldGroup: p._mold_group_id || '',
    model: '',
    spec: specParts.length ? specParts.join('*') : (p.productSize || ''),
    name: p.productName || p.product_type_name || q.product_type || '铝型材',
    unit: 'pcs',
    material: p.materialCategory || p.grade || '6063-T5',
    surface: p.productSurfaceTreatment && p.productSurfaceTreatment !== '无' ? p.productSurfaceTreatment : '无',
    price_ex_tax: Number(unitPrice.toFixed(4)),
    price_inc_tax: Number((unitPrice * 1.13).toFixed(4)),
    moq: r.min_order_qty || p.quantity || '',
    mold_fee: Number(moldFee.toFixed(2)),
    remark: '',
    _label: `${q.name}｜${specParts.join('*') || '-'}｜未税¥${unitPrice.toFixed(2)}`,
  };
}

export default function QuoteSheetDialog({ open, onClose, userId, currentQuote, aluminumPrice, moldGroupId }: Props) {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quoteNo, setQuoteNo] = useState('');
  const [customers, setCustomers] = useState<CustomerInfo[]>([]);
  const [cust, setCust] = useState<CustomerInfo>({ name: '', contact: '', phone: '', address: '', qq: '' });
  const [editable, setEditable] = useState<Record<string, any>>({}); // 行内微调（未税价/模具费）

  useEffect(() => {
    if (!open) return;
    setQuoteNo(nextQuoteNo());
    setCustomers(loadCustomers());
    (async () => {
      setLoading(true);
      let list = await loadSavedQuotes(userId);
      // 当前报价若未保存，先保存进报价池
      if (currentQuote && currentQuote.result) {
        const exists = list.some((q) => q.result === currentQuote.result);
        if (!exists) {
          const saved = await saveQuoteToAPI(
            userId,
            currentQuote.params,
            currentQuote.result,
            currentQuote.productType,
            currentQuote.productDiscount,
            currentQuote.moldDiscount,
            moldGroupId,
          );
          if (saved) {
            list = [saved, ...list];
          }
        }
      }
      setQuotes(list);
      // 默认勾选最新一条
      if (list.length > 0) setSelected(new Set([list[0].id]));
      setLoading(false);
    })();
  }, [open, userId]);

  const items = useMemo(() => {
    const list = quotes.map(toSheetItem);
    // 同模具组：仅列表中第一条保留模具费（出单时后端行空白由导出逻辑置null）
    const seen = new Set<string>();
    for (const it of list) {
      if (it.moldGroup) {
        if (seen.has(it.moldGroup)) it.mold_fee = 0;
        else seen.add(it.moldGroup);
      }
    }
    return list;
  }, [quotes]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onPickCustomer = (name: string) => {
    const hit = customers.find((c) => c.name === name);
    if (hit) setCust(hit);
    else setCust({ ...cust, name });
  };

  const handleExport = async () => {
    const chosen = items.filter((it) => selected.has(it.id));
    if (chosen.length === 0) { alert('请先勾选至少一条报价'); return; }
    if (!cust.name.trim()) { alert('请填写客户名称'); return; }
    setExporting(true);
    try {
      // 应用行内微调；同模具组内模具费只算一次（该组第一条带费，其余置空）
      const seenGroup = new Set<string>();
      const payloadItems = chosen.map((it) => {
        const ed = editable[it.id] || {};
        const ex = ed.price_ex_tax != null ? Number(ed.price_ex_tax) : it.price_ex_tax;
        let moldFee: number | null = ed.mold_fee != null ? Number(ed.mold_fee) : it.mold_fee;
        const g = it.moldGroup || `__single_${it.id}`;
        if (seenGroup.has(g)) moldFee = null; // 同组后续行：模具费已在第一行收取
        else seenGroup.add(g);
        return {
          ...it,
          price_ex_tax: ex,
          price_inc_tax: ed.price_inc_tax != null ? Number(ed.price_inc_tax) : Number((ex * 1.13).toFixed(4)),
          mold_fee: moldFee,
          moq: ed.moq != null ? ed.moq : it.moq,
          remark: ed.remark || it.remark,
          model: ed.model || it.model,
        };
      });
      const resp = await fetch('/api/quote-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quote_no: quoteNo,
          supplier_company: user?.company_name || '',
          supplier_contact: '龙任荣',
          supplier_phone: user?.phone || '18929979760',
          supplier_address: user?.address || '佛山市南海区里水镇',
          customer_name: cust.name,
          customer_contact: cust.contact,
          customer_phone: cust.phone,
          customer_address: cust.address,
          customer_qq: cust.qq,
          aluminum_price: aluminumPrice,
          items: payloadItems,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert(err.error || '生成失败，请重试');
        return;
      }
      saveCustomer(cust);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `报价单-${quoteNo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      alert('网络错误，请重试');
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* 头部 */}
        <div className="sticky top-0 bg-white border-b px-5 py-3.5 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-gray-900">生成报价单（Excel）</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* 编号 */}
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 text-gray-500"><Hash className="w-4 h-4" />报价单编号</span>
            <span className="font-mono font-semibold text-blue-600">{quoteNo}</span>
            <span className="text-xs text-gray-400">（自动生成，含税价=未税×1.13，导出后可在Excel中修改）</span>
          </div>

          {/* 客户信息 */}
          <div className="space-y-2.5">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" />客户信息</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative">
                <input list="cust-names" className={inputCls} placeholder="客户名称 *" value={cust.name}
                  onChange={(e) => onPickCustomer(e.target.value)} />
                <datalist id="cust-names">
                  {customers.map((c) => <option key={c.name} value={c.name} />)}
                </datalist>
              </div>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-2.5" />
                <input className={`${inputCls} pl-8`} placeholder="联系人" value={cust.contact}
                  onChange={(e) => setCust({ ...cust, contact: e.target.value })} />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-2.5" />
                <input className={`${inputCls} pl-8`} placeholder="联系电话" value={cust.phone}
                  onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
              </div>
              <input className={inputCls} placeholder="QQ（选填）" value={cust.qq}
                onChange={(e) => setCust({ ...cust, qq: e.target.value })} />
              <div className="col-span-2 relative">
                <MapPin className="w-3.5 h-3.5 text-gray-300 absolute left-2.5 top-2.5" />
                <input className={`${inputCls} pl-8`} placeholder="客户地址（选填）" value={cust.address}
                  onChange={(e) => setCust({ ...cust, address: e.target.value })} />
              </div>
            </div>
          </div>

          {/* 报价勾选 */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">勾选本次报价（{selected.size} 项）
              <span className="ml-2 text-[11px] font-normal text-blue-600">
                含同模具 {(() => {
                  const sel = items.filter(it => selected.has(it.id) && it.moldGroup);
                  const groups = new Set(sel.map(it => it.moldGroup));
                  return groups.size;
                })()} 副 · 同副模具模具费只收一次
              </span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> 加载报价池...
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-gray-400 py-6 text-center border border-dashed border-gray-200 rounded-lg">
                报价池为空，先在页面上算出价格并保存
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y max-h-64 overflow-y-auto">
                {items.map((it) => {
                  const checked = selected.has(it.id);
                  const ed = editable[it.id] || {};
                  return (
                    <div key={it.id} className="px-3 py-2.5">
                      <div className="flex items-start gap-2.5">
                        <button onClick={() => toggle(it.id)}
                          className={`mt-0.5 w-4.5 h-4.5 w-[18px] h-[18px] rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {it.moldGroup && (
                              <span className="shrink-0 px-1.5 py-0 rounded bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-medium">同一副模</span>
                            )}
                            <div className="text-sm text-gray-800 truncate">{it._label}</div>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {it.material} · {it.surface} · 起订{String(it.moq)} · 模具费¥{it.mold_fee.toFixed(0)} · 含税¥{it.price_inc_tax.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      {checked && (
                        <div className="mt-2 ml-7 grid grid-cols-4 gap-2">
                          <input className="px-2 py-1 text-xs border border-gray-200 rounded" placeholder="客户型号"
                            value={ed.model || ''} onChange={(e) => setEditable({ ...editable, [it.id]: { ...ed, model: e.target.value } })} />
                          <input type="number" className="px-2 py-1 text-xs border border-gray-200 rounded" placeholder="未税单价"
                            defaultValue={it.price_ex_tax} onBlur={(e) => setEditable({ ...editable, [it.id]: { ...ed, price_ex_tax: e.target.value } })} />
                          <input type="number" className="px-2 py-1 text-xs border border-gray-200 rounded" placeholder="模具费"
                            defaultValue={it.mold_fee} onBlur={(e) => setEditable({ ...editable, [it.id]: { ...ed, mold_fee: e.target.value } })} />
                          <input className="px-2 py-1 text-xs border border-gray-200 rounded" placeholder="备注"
                            value={ed.remark || ''} onChange={(e) => setEditable({ ...editable, [it.id]: { ...ed, remark: e.target.value } })} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex items-center justify-between rounded-b-2xl">
          <div className="text-xs text-gray-400">供方：{user?.company_name || '未填写公司名'} · {user?.phone || ''}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
            <button onClick={handleExport} disabled={exporting || selected.size === 0}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              下载Excel报价单
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
