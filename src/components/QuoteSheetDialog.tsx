'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, FileSpreadsheet, FileText, Check, Loader2, Building2, User, Phone, MapPin, Hash, Download, History, AlertTriangle } from 'lucide-react';
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

interface SheetRecord {
  quote_no: string;
  customer_name: string;
  ex_sum: number;
  inc_sum: number;
  mold_sum: number;
  item_count: number;
  created_at: string | null;
  xlsx_url: string;
  pdf_url: string;
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

// 保留n位有效数字
function sigfig(n: number, digits: number): number {
  if (n === 0 || !isFinite(n)) return n;
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const factor = Math.pow(10, digits - d);
  return Math.round(n * factor) / factor;
}
function r3sig(n: number): number { return sigfig(n, 3); }
function r2sig(n: number): number { return sigfig(n, 2); }

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
    price_ex_tax: r3sig(unitPrice),
    price_inc_tax: r3sig(unitPrice * 1.13),
    moq: (r.min_order_qty || p.quantity) ? r2sig(Number(r.min_order_qty || p.quantity || 0)) : '',
    mold_fee: r2sig(moldFee),
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
  const [globalRemark, setGlobalRemark] = useState('');
    const [editable, setEditable] = useState<Record<string, any>>({}); // 行内微调（未税价/模具费）
  const [history, setHistory] = useState<SheetRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [generated, setGenerated] = useState<{ quoteNo: string; xlsxB64: string; pdfB64: string } | null>(null);
  const [supplierInfo, setSupplierInfo] = useState<{ company_name?: string; contact_name?: string; contact_phone?: string; contact_email?: string; address?: string }>({});
  const [noCompanyInfo, setNoCompanyInfo] = useState(false);
  
  // 公司搜索（启信宝/企查查）
  const [companySearchResults, setCompanySearchResults] = useState<{name: string; address: string; creditCode: string; orgCode: string}[]>([]);
  const [companySearching, setCompanySearching] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const companySearchTimer = useRef<NodeJS.Timeout | null>(null);
  const companyDropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭公司搜索下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCompany = (c: { name: string; address: string; creditCode: string; orgCode: string }) => {
    setCust({ ...cust, name: c.name, address: c.address || cust.address });
    setShowCompanyDropdown(false);
    setCompanySearchResults([]);
  };

  const loadHistory = async () => {
    if (!userId) return;
    try {
      const resp = await fetch(`/api/quote-sheets?user_id=${encodeURIComponent(userId)}`);
      const data = await resp.json();
      if (data.success) setHistory(data.records || []);
    } catch { /* ignore */ }
  };

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
      loadHistory();
      // 默认勾选最新一条
      if (list.length > 0) setSelected(new Set([list[0].id]));
      setLoading(false);
    })();
  }, [open, userId]);

  // 加载供方资料（不依赖对话框是否打开，确保随时可用）
  useEffect(() => {
    if (userId) {
      fetch(`/api/auth/profile?user_id=${encodeURIComponent(userId)}`)
        .then(r => r.json())
        .then(d => {
          if (d.success?.data) {
            const u = d.data.user || {};
            const p = d.data.profile || {};
            setSupplierInfo(p);
            // 检查公司名是否已填写
            if (!u.company_name && !p.company_name) setNoCompanyInfo(true);
          } else {
            console.warn('[QuoteSheetDialog] No profile data in response');
          }
        })
        .catch(err => {
          console.error('[QuoteSheetDialog] Failed to load profile:', err);
        });
    }
  }, [userId]);

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

  const downloadB64 = (b64: string, filename: string, mime: string) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    const chosen = items.filter((it) => selected.has(it.id));
    if (chosen.length === 0) { alert('请先勾选至少一条报价'); return; }
    // 客户信息改为非必填，不填也能生成报价单
    setExporting(true);
    try {
      const seenGroup = new Set<string>();
      const payloadItems = chosen.map((it) => {
        const ed = editable[it.id] || {};
        const ex = ed.price_ex_tax != null ? Number(ed.price_ex_tax) : it.price_ex_tax;
        let moldFee: number | null = ed.mold_fee != null ? Number(ed.mold_fee) : it.mold_fee;
        const g = it.moldGroup || `__single_${it.id}`;
        if (seenGroup.has(g)) moldFee = null;
        else seenGroup.add(g);
        return {
          ...it,
          price_ex_tax: ex,
          price_inc_tax: ed.price_inc_tax != null ? Number(ed.price_inc_tax) : r3sig(ex * 1.13),
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
          user_id: userId || undefined,
          supplier_company: supplierInfo.company_name || '',
          supplier_contact: supplierInfo.contact_name || '',
          supplier_phone: supplierInfo.contact_phone || '',
          supplier_address: supplierInfo.address || '',
          customer_name: cust.name,
          customer_contact: cust.contact,
          customer_phone: cust.phone,
          customer_address: cust.address,
          customer_qq: cust.qq,
          aluminum_price: aluminumPrice,
          global_remark: globalRemark,
          items: payloadItems,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        alert(data.error || '生成失败，请重试');
        return;
      }
      saveCustomer(cust);
      setGenerated({ quoteNo: data.quote_no || quoteNo, xlsxB64: data.xlsx_base64, pdfB64: data.pdf_base64 });
      // 默认自动下载 Excel
      downloadB64(data.xlsx_base64, `报价单-${data.quote_no || quoteNo}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      loadHistory();
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
            <h3 className="text-base font-semibold text-gray-900">生成报价单（Excel / PDF）</h3>
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

          {/* 公司资料未填写提醒 */}
          {noCompanyInfo && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <span className="text-amber-800 font-medium">尚未填写公司资料</span>
                <span className="text-amber-700 ml-1">— 报价单抬头将显示空白，建议先完善公司信息</span>
                <a href="/profile" target="_blank" rel="noreferrer" className="block mt-1 text-blue-600 hover:underline text-xs font-medium">
                  → 前往填写公司资料
                </a>
              </div>
              <button onClick={() => setNoCompanyInfo(false)} className="text-amber-400 hover:text-amber-600 text-xs">✕</button>
            </div>
          )}

          {/* 客户信息 */}
          <div className="space-y-2.5">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-gray-400" />客户信息</div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative" ref={companyDropdownRef}>
                <input className={inputCls} placeholder="客户名称（输入搜索） *" value={cust.name}
                  onChange={(e) => onPickCustomer(e.target.value)}
                  onFocus={() => { if (companySearchResults.length > 0) setShowCompanyDropdown(true); }} />
                {companySearching && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin absolute right-2.5 top-2.5" />}
                {showCompanyDropdown && companySearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
                    {companySearchResults.map((c, i) => (
                      <div key={i} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                        onMouseDown={() => selectCompany(c)}>
                        <div className="text-sm font-medium text-gray-800">{c.name}</div>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {c.creditCode && <span className="text-xs text-blue-500">信用代码: {c.creditCode}</span>}
                          {c.orgCode && <span className="text-xs text-green-600">组织代码: {c.orgCode}</span>}
                        </div>
                        {c.address && <div className="text-xs text-gray-400 truncate mt-0.5">{c.address}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {/* 已保存的客户资料（非搜索时显示） */}
                {!showCompanyDropdown && customers.length > 0 && cust.name === '' && (
                  <div className="absolute z-40 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto hidden peer-focus:block">
                    {customers.map((c, i) => (
                      <div key={i} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700"
                        onMouseDown={() => { setCust(c); }}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
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

          {/* 全局备注 */}
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-400" />全局备注
            </div>
            <textarea
              className={`${inputCls} min-h-[48px] resize-none`}
              placeholder="备注信息（选填，将显示在报价单底部）"
              value={globalRemark}
              onChange={(e) => setGlobalRemark(e.target.value)}
            />
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

          {/* 已生成文件 */}
          {generated && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
              <div className="text-sm text-emerald-800 font-medium flex items-center gap-1.5">
                <Check className="w-4 h-4" /> 报价单 {generated.quoteNo} 已生成并保存到云端
              </div>
              <div className="flex gap-2">
                <button onClick={() => downloadB64(generated.xlsxB64, `报价单-${generated.quoteNo}.xlsx`,
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
                  className="flex-1 px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 flex items-center justify-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4" /> 下载 Excel
                </button>
                <button onClick={() => downloadB64(generated.pdfB64, `报价单-${generated.quoteNo}.pdf`, 'application/pdf')}
                  className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-1.5">
                  <FileText className="w-4 h-4" /> 下载 PDF
                </button>
              </div>
            </div>
          )}

          {/* 历史报价单 */}
          <div className="border-t pt-3">
            <button onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) loadHistory(); }}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
              <History className="w-4 h-4" /> 历史报价单（{history.length}）
              <span className="text-xs text-gray-400">{historyOpen ? '收起' : '展开'}</span>
            </button>
            {historyOpen && (
              <div className="mt-2 border border-gray-200 rounded-lg divide-y max-h-56 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="text-sm text-gray-400 py-5 text-center">暂无历史报价单</div>
                ) : history.map((h) => (
                  <div key={h.quote_no} className="px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">
                        <span className="font-mono text-blue-600">{h.quote_no}</span>
                        {h.customer_name && <span className="ml-2">{h.customer_name}</span>}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {h.created_at ? new Date(h.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                        {' · '}{h.item_count}项 · 未税¥{Number(h.ex_sum).toFixed(0)} · 含税¥{Number(h.inc_sum).toFixed(0)}
                      </div>
                    </div>
                    <a href={h.xlsx_url} target="_blank" rel="noreferrer"
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded shrink-0" title="下载Excel">
                      <FileSpreadsheet className="w-4 h-4" />
                    </a>
                    <a href={h.pdf_url} target="_blank" rel="noreferrer"
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded shrink-0" title="下载PDF">
                      <FileText className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex items-center justify-between rounded-b-2xl">
          <div className="text-xs text-gray-400">供方：{supplierInfo.company_name || '未填写公司名'} · {supplierInfo.contact_phone || ''}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">取消</button>
            <button onClick={handleExport} disabled={exporting || selected.size === 0}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? '正在生成...' : generated ? '重新生成报价单' : '生成报价单（Excel+PDF）'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
