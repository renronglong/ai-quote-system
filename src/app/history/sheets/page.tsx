'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import QuoteSidebarLayout from '@/components/QuoteSidebarLayout';
import {
  ArrowLeft, FileSpreadsheet, FileText, Loader2, Trash2, Printer,
  AlertCircle, CheckCircle2,
} from 'lucide-react';

/**
 * 「已保存报价单」子页面（/history/sheets）
 * 业主 2026-11-11：导出报价单弹窗增加「保存」，保存到这里，格式与导出报价单一致。
 * 数据源：/api/quote-sheets（Supabase Storage，按 user_id 分目录）。
 * 本页只做展示 / 下载 / 打印 / 删除，不参与任何报价计算，也不改价格。
 */

interface SheetItem {
  model?: string;
  spec?: string;
  name?: string;
  unit?: string;
  material?: string;
  surface?: string;
  price_ex_tax?: number;
  price_inc_tax?: number;
  moq?: number | string;
  mold_fee?: number | null;
  remark?: string;
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
  quote_no?: string;
  global_remark?: string;
  aluminum_price?: number;
  items: SheetItem[];
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
  saved: boolean;
  body: SheetBody | null;
}

const HEADERS = ['序号', '客户型号', '规格尺寸mm', '产品名称', '单位', '材质', '表面处理', '单价未税(元)', '含税价', '最小起订量', '模具费RMB(元)', '备注'];
const TERMS = [
  '1：依照图纸进行开模及送样。',
  '2：此报价含运费、含13%增值税',
  '3：付款方式：现金',
  '4：此报价单有效期为15天',
  '5：开模时间15个工作日，出样5个工作日',
];

function fmtDate(v: string | null): string {
  if (!v) return '-';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : d.toLocaleString('zh-CN');
}
function money(n: any): string {
  const v = Number(n);
  return isNaN(v) ? '' : v.toFixed(2);
}

/** 与 /api/quote-sheet 导出的 Excel/PDF 同一套版式：A-L 共 12 列、15 行明细、总计行 */
function QuoteSheetView({ body, quoteNo, createdAt }: { body: SheetBody; quoteNo: string; createdAt: string | null }) {
  const items = Array.isArray(body.items) ? body.items : [];
  const rows: (SheetItem | null)[] = [...items];
  while (rows.length < 15) rows.push(null);
  const sum = (key: 'price_ex_tax' | 'price_inc_tax' | 'mold_fee') =>
    items.reduce((a, it) => a + (Number(it[key]) || 0), 0);
  const dateStr = (() => {
    const d = createdAt ? new Date(createdAt) : new Date();
    return isNaN(d.getTime()) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  })();

  const info: [string, string][] = [
    [`供方：${body.supplier_company || ''}`, `客户名称：${body.customer_name || ''}`],
    [`联系人：${body.supplier_contact || ''}`, `联系人：${body.customer_contact || ''}`],
    [`电话：${body.supplier_phone || ''}`, `电话：${body.customer_phone || ''}`],
    [`地址：${body.supplier_address || ''}`, `地址：${body.customer_address || ''}`],
  ];

  return (
    <div className="print-area bg-white border border-gray-300 text-[12px] text-gray-900 p-5 sm:p-7" style={{ minWidth: 900 }}>
      <div className="text-center text-xl font-bold tracking-wide">{body.supplier_company || ''}</div>
      <div className="text-center text-lg font-bold tracking-[0.45em] mt-1 mb-4">报 价 单</div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1">
        {info.map(([l, r], i) => (
          <div key={i} className="contents">
            <div className="break-all">{l}</div>
            <div className="break-all">{r}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="font-semibold">报价单编号：{body.quote_no || quoteNo}</span>
        <span>报价日期：{dateStr}</span>
      </div>

      <table className="w-full border-collapse mt-3 table-fixed">
        <colgroup>
          {[5, 12, 14, 11, 5, 9, 8, 10, 9, 8, 10, 7].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
        </colgroup>
        <thead>
          <tr className="bg-blue-50">
            {HEADERS.map(h => (
              <th key={h} className="border border-gray-800 px-1 py-1.5 font-semibold text-center align-middle break-words">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((it, i) => (
            <tr key={i} className="h-[26px]">
              <td className="border border-gray-800 px-1 text-center">{i + 1}</td>
              <td className="border border-gray-800 px-1 break-all">{it?.model || ''}</td>
              <td className="border border-gray-800 px-1 break-all">{it?.spec || ''}</td>
              <td className="border border-gray-800 px-1 break-all">{it?.name || ''}</td>
              <td className="border border-gray-800 px-1 text-center">{it?.unit || (it ? 'pcs' : '')}</td>
              <td className="border border-gray-800 px-1 break-all">{it?.material || ''}</td>
              <td className="border border-gray-800 px-1 break-all">{it?.surface || ''}</td>
              <td className="border border-gray-800 px-1 text-right">{it?.price_ex_tax != null ? money(it.price_ex_tax) : ''}</td>
              <td className="border border-gray-800 px-1 text-right">{it?.price_inc_tax != null ? money(it.price_inc_tax) : ''}</td>
              <td className="border border-gray-800 px-1 text-center">{it?.moq ?? ''}</td>
              <td className="border border-gray-800 px-1 text-right">{it?.mold_fee != null ? money(it.mold_fee) : ''}</td>
              <td className="border border-gray-800 px-1 break-all">{it?.remark || ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={7} className="border border-gray-800 px-1 text-center">总计</td>
            <td className="border border-gray-800 px-1 text-right">{money(sum('price_ex_tax'))}</td>
            <td className="border border-gray-800 px-1 text-right">{money(sum('price_inc_tax'))}</td>
            <td className="border border-gray-800 px-1" />
            <td className="border border-gray-800 px-1 text-right">{money(sum('mold_fee'))}</td>
            <td className="border border-gray-800 px-1" />
          </tr>
        </tfoot>
      </table>

      <div className="mt-3 space-y-0.5">
        {TERMS.map(t => <div key={t}>{t}</div>)}
      </div>
      {body.global_remark && <div className="mt-2 break-all">备注：{body.global_remark}</div>}
      {body.aluminum_price ? (
        <div className="mt-2 text-gray-500">报价基准：当日铝锭价 ¥{Number(body.aluminum_price).toLocaleString()}/吨</div>
      ) : null}
      <div className="grid grid-cols-2 mt-8 font-semibold">
        <div>需方（签章）</div>
        <div>供方（签章）</div>
      </div>
      <div className="grid grid-cols-2 mt-10">
        <div>日期:</div>
        <div className="text-right">日期: {dateStr}</div>
      </div>
    </div>
  );
}

export default function SavedSheetsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<SheetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeNo, setActiveNo] = useState<string>('');
  const [downloading, setDownloading] = useState('');
  const [deleting, setDeleting] = useState('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login?redirect=/history/sheets');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`/api/quote-sheets?user_id=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || '读取失败');
      const list: SheetRecord[] = data.records || [];
      setRecords(list);
      setActiveNo(prev => (list.some(r => r.quote_no === prev) ? prev : (list[0]?.quote_no || '')));
    } catch (e: any) {
      setError(e?.message || '读取失败');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const active = records.find(r => r.quote_no === activeNo) || null;

  const downloadB64 = (b64: string, filename: string, mime: string) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // 保存过的报价单：用同一份 body 现场生成 Excel/PDF（不写 user_id，避免重复存档）
  const generateFile = async (rec: SheetRecord, format: 'excel' | 'pdf') => {
    if (!rec.body) return;
    setDownloading(`${rec.quote_no}-${format}`);
    setError('');
    try {
      const resp = await fetch('/api/quote-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rec.body, quote_no: rec.quote_no, user_id: undefined }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || '生成失败');
      if (format === 'excel') {
        downloadB64(data.xlsx_base64, `报价单-${rec.quote_no}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } else {
        downloadB64(data.pdf_base64, `报价单-${rec.quote_no}.pdf`, 'application/pdf');
      }
    } catch (e: any) {
      setError(e?.message || '生成失败');
    } finally {
      setDownloading('');
    }
  };

  const remove = async (rec: SheetRecord) => {
    if (!user?.id) return;
    if (!window.confirm(`确认删除报价单 ${rec.quote_no}？此操作不可恢复。`)) return;
    setDeleting(rec.quote_no);
    setError('');
    try {
      const resp = await fetch(`/api/quote-sheets?user_id=${encodeURIComponent(user.id)}&quote_no=${encodeURIComponent(rec.quote_no)}&kind=${rec.saved ? 'saved' : 'legacy'}`,
        { method: 'DELETE' });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) throw new Error(data.error || '删除失败');
      await load();
    } catch (e: any) {
      setError(e?.message || '删除失败');
    } finally {
      setDeleting('');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* 打印时只保留报价单本体 */}
      <style>{`@media print { body * { visibility: hidden !important; } .print-area, .print-area * { visibility: visible !important; } .print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; } }`}</style>
      <QuoteSidebarLayout>
        <main className="w-full max-w-none px-3 sm:px-5 py-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">已保存报价单</h1>
              <p className="text-slate-500 mt-0.5 text-xs sm:text-sm">
                在「我的报价 → 导出报价单」点保存后，报价单按导出格式存到这里
              </p>
            </div>
            <Link href="/history"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />返回我的报价
            </Link>
          </div>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {authLoading || !user || loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center text-sm text-gray-400">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              暂无保存的报价单，去「我的报价」勾选后点「保存报价单」
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              {/* 左：报价单列表 */}
              <div className="w-full lg:w-72 shrink-0 space-y-2">
                <div className="text-xs text-gray-500 px-1">共 {records.length} 张</div>
                {records.map(rec => (
                  <button key={rec.quote_no} onClick={() => setActiveNo(rec.quote_no)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      activeNo === rec.quote_no ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-blue-700 break-all">{rec.quote_no}</span>
                      {rec.saved && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200">已保存</span>}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 break-all">{rec.customer_name || '未填客户'}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {fmtDate(rec.created_at)} · {rec.item_count} 项
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      未税 ¥{Number(rec.ex_sum).toFixed(0)} · 含税 ¥{Number(rec.inc_sum).toFixed(0)}
                    </div>
                  </button>
                ))}
              </div>

              {/* 右：报价单正文（与导出格式一致） */}
              <div className="flex-1 min-w-0 w-full">
                {active && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 mr-auto">
                      {active.quote_no} {active.customer_name ? `· ${active.customer_name}` : ''}
                    </span>
                    {active.body ? (
                      <>
                        <button onClick={() => window.print()}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
                          <Printer className="w-3.5 h-3.5" />打印
                        </button>
                        <button onClick={() => generateFile(active, 'excel')} disabled={!!downloading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                          {downloading === `${active.quote_no}-excel` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}下载 Excel
                        </button>
                        <button onClick={() => generateFile(active, 'pdf')} disabled={!!downloading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">
                          {downloading === `${active.quote_no}-pdf` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}下载 PDF
                        </button>
                      </>
                    ) : (
                      <>
                        {active.xlsx_url && (
                          <a href={`/api/quote-sheet-file?user_id=${encodeURIComponent(user!.id)}&quote_no=${encodeURIComponent(active.quote_no)}&kind=legacy&ext=xlsx`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                            <FileSpreadsheet className="w-3.5 h-3.5" />下载 Excel
                          </a>
                        )}
                        {active.pdf_url && (
                          <a href={`/api/quote-sheet-file?user_id=${encodeURIComponent(user!.id)}&quote_no=${encodeURIComponent(active.quote_no)}&kind=legacy&ext=pdf`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                            <FileText className="w-3.5 h-3.5" />下载 PDF
                          </a>
                        )}
                      </>
                    )}
                    <button onClick={() => remove(active)} disabled={deleting === active.quote_no}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white text-red-500 hover:bg-red-50 disabled:opacity-50">
                      {deleting === active.quote_no ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}删除
                    </button>
                  </div>
                )}

                {active ? (
                  active.body ? (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <QuoteSheetView body={active.body} quoteNo={active.quote_no} createdAt={active.created_at} />
                    </div>
                  ) : active.pdf_url ? (
                    <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                      <iframe
                        src={`/api/quote-sheet-file?user_id=${encodeURIComponent(user!.id)}&quote_no=${encodeURIComponent(active.quote_no)}&kind=legacy&ext=pdf`}
                        title="报价单预览"
                        className="w-full block"
                        style={{ height: '78vh', border: 0 }}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
                      <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="w-4 h-4" />历史导出记录</div>
                      <p className="mt-2 leading-relaxed">
                        这张报价单是旧版「直接导出」生成的，只留存了 Excel 文件，没有留存可还原的明细数据，
                        因此不能在网页里按报价单格式展开。可点上方按钮下载原文件查看。
                        <br />之后用「我的报价 → 导出报价单 → 保存报价单」保存的，都会在这里完整显示。
                      </p>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          )}
        </main>
      </QuoteSidebarLayout>
    </div>
  );
}
