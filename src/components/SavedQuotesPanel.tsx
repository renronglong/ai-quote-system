"use client";
import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText, History, CheckCircle2, FileSpreadsheet, Percent } from 'lucide-react';

// ==================== Types ====================
export interface SavedQuote {
  id: string;
  date: string;
  product_type: string;
  params: Record<string, any>;
  result: Record<string, any>;
  name: string;
  product_discount?: number;
  mold_discount?: number;
  created_at?: string;
}

// ==================== API helpers ====================
function getHeaders(userId: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-user-id': userId };
}

export async function loadSavedQuotes(userId: string): Promise<SavedQuote[]> {
  try {
    const res = await fetch('/api/saved-quotes', { headers: getHeaders(userId) });
    const json = await res.json();
    if (json.success) return json.data || [];
    return [];
  } catch {
    return [];
  }
}

export async function saveQuoteToAPI(
  userId: string,
  params: Record<string, any>,
  result: Record<string, any>,
  productType: string,
  productDiscount?: number,
  moldDiscount?: number,
): Promise<SavedQuote | null> {
  try {
    const name = `报价-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}-${productType}`;
    const res = await fetch('/api/saved-quotes', {
      method: 'POST',
      headers: getHeaders(userId),
      body: JSON.stringify({
        name,
        product_type: productType,
        params,
        result,
        product_discount: productDiscount,
        mold_discount: moldDiscount,
      }),
    });
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch {
    return null;
  }
}

export async function deleteSavedQuoteAPI(userId: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/saved-quotes?id=${id}`, {
      method: 'DELETE',
      headers: getHeaders(userId),
    });
    const json = await res.json();
    return json.success;
  } catch {
    return false;
  }
}

// ==================== Export config ====================
export const EXPORT_SECTIONS = [
  { key: 'product_params', label: '产品参数（尺寸、材料等）', default: true },
  { key: 'cost_breakdown', label: '费用明细（各项费用）', default: true },
  { key: 'mold_info', label: '模具信息', default: true },
  { key: 'surface_info', label: '表面处理信息', default: true },
  { key: 'total_price', label: '合计总价', default: true },
] as const;

export type ExportSectionKey = typeof EXPORT_SECTIONS[number]['key'];

// ==================== Component ====================
interface SavedQuotesPanelProps {
  userId: string;
  trigger?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export default function SavedQuotesPanel({ userId, trigger, onOpenChange }: SavedQuotesPanelProps) {
  const [open, setOpen] = useState(false);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSections, setExportSections] = useState<Set<ExportSectionKey>>(
    new Set(EXPORT_SECTIONS.filter(s => s.default).map(s => s.key))
  );
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!userId) return;
    setLoading(true);
    const data = await loadSavedQuotes(userId);
    setQuotes(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open && userId) reload();
  }, [open, userId]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === quotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quotes.map(q => q.id)));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSavedQuoteAPI(userId, id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    reload();
  };

  const handleDeleteSelected = async () => {
    for (const id of selectedIds) {
      await deleteSavedQuoteAPI(userId, id);
    }
    setSelectedIds(new Set());
    reload();
  };

  const toggleExportSection = (key: ExportSectionKey) => {
    setExportSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    const selectedQuotes = quotes.filter(q => selectedIds.has(q.id));
    if (selectedQuotes.length === 0) return;

    setExporting(true);
    try {
      const res = await fetch('/api/saved-quotes/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: exportFormat,
          quotes: selectedQuotes,
          sections: Array.from(exportSections),
        }),
      });

      if (!res.ok) throw new Error('Export failed');

      const dateStr = new Date().toISOString().slice(0, 10);
      if (exportFormat === 'excel') {
        const blob = await res.blob();
        downloadBlob(blob, `报价单_${dateStr}_${selectedQuotes.length}条.xlsx`);
      } else {
        // PDF: open HTML in new window for browser print-to-PDF
        const html = await res.text();
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          setTimeout(() => w.print(), 500);
        }
      }

      setExportSuccess(true);
      setTimeout(() => { setExportSuccess(false); setExportDialogOpen(false); }, 1200);
    } catch (err) {
      console.error('Export error:', err);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const openExportDialog = () => {
    setExportSections(new Set(EXPORT_SECTIONS.filter(s => s.default).map(s => s.key)));
    setExportFormat('excel');
    setExportSuccess(false);
    setExportDialogOpen(true);
  };

  const fmt = (v: any) => {
    if (v == null || isNaN(v)) return '¥0.00';
    return `¥${Number(v).toFixed(2)}`;
  };

  const getDiscountedPrice = (quote: SavedQuote): { unitPrice: string; isDiscounted: boolean } => {
    const orig = quote.result?.unit_price || 0;
    const pd = quote.product_discount;
    if (pd && pd < 100) {
      return { unitPrice: fmt(orig * (pd / 100)), isDiscounted: true };
    }
    return { unitPrice: fmt(orig), isDiscounted: false };
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); onOpenChange?.(o); }}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <History className="w-4 h-4" />
            已保存报价
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-[520px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            已保存报价（{quotes.length}）
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2 mt-4">
          {loading && (
            <div className="text-center py-4 text-sm text-gray-400">加载中...</div>
          )}
          {!loading && quotes.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              暂无保存的报价记录
            </div>
          )}

          {quotes.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <Checkbox
                  checked={quotes.length > 0 && selectedIds.size === quotes.length}
                  onCheckedChange={toggleSelectAll}
                />
                全选
              </label>
              {selectedIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={handleDeleteSelected} className="text-red-500 hover:text-red-600 text-xs h-7">
                  删除选中
                </Button>
              )}
            </div>
          )}

          {quotes.map(quote => {
            const { unitPrice, isDiscounted } = getDiscountedPrice(quote);
            return (
              <div
                key={quote.id}
                className={`p-3 rounded-lg border transition-all ${
                  selectedIds.has(quote.id)
                    ? 'border-blue-400 bg-blue-50/50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selectedIds.has(quote.id)}
                    onCheckedChange={() => toggleSelect(quote.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">{quote.name}</span>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-emerald-600">{unitPrice}</span>
                        {isDiscounted && (
                          <div className="text-[10px] text-gray-400 line-through">
                            {fmt(quote.result?.unit_price)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(quote.date || quote.created_at || '').toLocaleString('zh-CN')}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-gray-500">
                        {quote.params?.quantity || 0}件 · {quote.params?.material?.category || '-'}
                      </span>
                      {(quote.product_discount || quote.mold_discount) && (
                        <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                          <Percent className="w-3 h-3" />
                          {quote.product_discount && quote.product_discount < 100 && `产品${quote.product_discount}%折`}
                          {quote.product_discount && quote.product_discount < 100 && quote.mold_discount && quote.mold_discount < 100 && ' '}
                          {quote.mold_discount && quote.mold_discount < 100 && `模具${quote.mold_discount}%折`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(quote.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 批量导出 */}
        <div className="pt-3 border-t border-gray-200 mt-3">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <Button
              className="w-full gap-2"
              disabled={selectedIds.size === 0}
              onClick={openExportDialog}
            >
              <Download className="w-4 h-4" />
              批量导出报价单（{selectedIds.size}）
            </Button>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>导出报价单</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="text-xs text-gray-500 mb-1">
                  已选择 <span className="font-semibold text-gray-700">{selectedIds.size}</span> 条报价
                </div>

                {/* 导出格式 */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1.5">导出格式</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExportFormat('excel')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                        exportFormat === 'excel'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Excel
                    </button>
                    <button
                      onClick={() => setExportFormat('pdf')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                        exportFormat === 'pdf'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      PDF
                    </button>
                  </div>
                </div>

                {/* 内容选择 */}
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1.5">包含内容</div>
                  {EXPORT_SECTIONS.map(section => (
                    <label
                      key={section.key}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      <Checkbox
                        checked={exportSections.has(section.key)}
                        onCheckedChange={() => toggleExportSection(section.key)}
                      />
                      <span className="text-sm text-gray-700">{section.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExportSections(new Set(EXPORT_SECTIONS.map(s => s.key)))}
                >
                  全选
                </Button>
                <Button className="gap-2" onClick={handleExport} disabled={exportSections.size === 0 || exporting}>
                  {exporting ? (
                    <>导出中...</>
                  ) : exportSuccess ? (
                    <><CheckCircle2 className="w-4 h-4" /> 已导出</>
                  ) : (
                    <><Download className="w-4 h-4" /> 导出 {exportFormat === 'excel' ? 'Excel' : 'PDF'}</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ==================== Helper ====================
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
