"use client";
import { useState, useEffect } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Trash2, FileText, History, CheckCircle2 } from 'lucide-react';

export interface SavedQuote {
  id: number;
  date: string;
  product_type: string;
  params: Record<string, any>;
  result: Record<string, any>;
  name: string;
}

export const SAVED_QUOTES_KEY = 'saved_quotes';

export function loadSavedQuotes(): SavedQuote[] {
  try {
    const raw = localStorage.getItem(SAVED_QUOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuoteToStorage(
  params: Record<string, any>,
  result: Record<string, any>,
  productType: string,
): SavedQuote | null {
  try {
    const now = Date.now();
    const date = new Date().toISOString();
    const name = `报价-${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}-${productType}`;
    const newItem: SavedQuote = {
      id: now,
      date,
      product_type: productType,
      params,
      result,
      name,
    };
    const existing = loadSavedQuotes();
    const updated = [newItem, ...existing];
    localStorage.setItem(SAVED_QUOTES_KEY, JSON.stringify(updated));
    return newItem;
  } catch {
    return null;
  }
}

export function deleteSavedQuote(id: number): void {
  const existing = loadSavedQuotes().filter(q => q.id !== id);
  localStorage.setItem(SAVED_QUOTES_KEY, JSON.stringify(existing));
}

// 导出配置选项
export const EXPORT_SECTIONS = [
  { key: 'product_params', label: '产品参数（尺寸、材料等）', default: true },
  { key: 'cost_breakdown', label: '费用明细（各项费用）', default: true },
  { key: 'mold_info', label: '模具信息', default: true },
  { key: 'surface_info', label: '表面处理信息', default: true },
  { key: 'total_price', label: '合计总价', default: true },
] as const;

export type ExportSectionKey = typeof EXPORT_SECTIONS[number]['key'];

interface SavedQuotesPanelProps {
  trigger?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}

export default function SavedQuotesPanel({ trigger, onOpenChange }: SavedQuotesPanelProps) {
  const [open, setOpen] = useState(false);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportSections, setExportSections] = useState<Set<ExportSectionKey>>(
    new Set(EXPORT_SECTIONS.filter(s => s.default).map(s => s.key))
  );
  const [exportSuccess, setExportSuccess] = useState(false);

  const reload = () => {
    setQuotes(loadSavedQuotes());
  };

  useEffect(() => {
    if (open) reload();
  }, [open]);

  const toggleSelect = (id: number) => {
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

  const handleDelete = (id: number) => {
    deleteSavedQuote(id);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    reload();
  };

  const handleDeleteSelected = () => {
    for (const id of selectedIds) deleteSavedQuote(id);
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

  const generateQuotationHTML = (quote: SavedQuote): string => {
    const { params, result, name, date } = quote;
    const sections = exportSections;
    const fmt = (v: any) => {
      if (v == null || isNaN(v)) return '¥0.00';
      return `¥${Number(v).toFixed(2)}`;
    };
    const dateStr = new Date(date).toLocaleString('zh-CN');

    let html = `
<div style="page-break-after: always; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; color: #333;">
  <div style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #065f46;">${name}</h2>
    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">生成时间：${dateStr}</div>
  </div>
`;

    if (sections.has('product_params')) {
      const dims = params.dimensions || {};
      const mat = params.material || {};
      html += `
  <div style="margin-bottom: 18px;">
    <h3 style="font-size: 14px; color: #374151; border-left: 3px solid #10b981; padding-left: 8px; margin: 0 0 10px 0;">产品参数</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding: 4px 8px; background: #f9fafb; width: 120px;">产品类型</td><td style="padding: 4px 8px;">${params.product_type || '-'}</td></tr>
      <tr><td style="padding: 4px 8px; background: #f9fafb;">材质</td><td style="padding: 4px 8px;">${mat.category || '-'}</td></tr>
      <tr><td style="padding: 4px 8px; background: #f9fafb;">数量</td><td style="padding: 4px 8px;">${params.quantity || 0} 件</td></tr>
      ${dims.length_mm ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">长度</td><td style="padding: 4px 8px;">${dims.length_mm} mm</td></tr>` : ''}
      ${dims.width_mm ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">宽度</td><td style="padding: 4px 8px;">${dims.width_mm} mm</td></tr>` : ''}
      ${dims.height_mm ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">高度</td><td style="padding: 4px 8px;">${dims.height_mm} mm</td></tr>` : ''}
      ${dims.num_cavities ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">面域数</td><td style="padding: 4px 8px;">${dims.num_cavities}</td></tr>` : ''}
      ${dims.perimeter_mm ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">周长</td><td style="padding: 4px 8px;">${dims.perimeter_mm} mm</td></tr>` : ''}
      ${result.weight_per_piece_kg ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">单件重量</td><td style="padding: 4px 8px;">${result.weight_per_piece_kg.toFixed(3)} kg</td></tr>` : ''}
    </table>
  </div>
`;
    }

    if (sections.has('mold_info')) {
      const dims = params.dimensions || {};
      const bd = result.breakdown || {};
      const moldBd = bd.mold;
      html += `
  <div style="margin-bottom: 18px;">
    <h3 style="font-size: 14px; color: #374151; border-left: 3px solid #3b82f6; padding-left: 8px; margin: 0 0 10px 0;">模具信息</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      ${dims.die_type ? `<tr><td style="padding: 4px 8px; background: #f9fafb; width: 120px;">模具类型</td><td style="padding: 4px 8px;">${dims.die_type === 'flat' ? '平模' : '分流模'}</td></tr>` : ''}
      ${dims.num_cavities ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">面域数</td><td style="padding: 4px 8px;">${dims.num_cavities}</td></tr>` : ''}
      ${dims.die_steel_price ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">模具钢价</td><td style="padding: 4px 8px;">${dims.die_steel_price} 元/吨</td></tr>` : ''}
      ${moldBd?.detail ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">模具费明细</td><td style="padding: 4px 8px; font-size: 12px; color: #6b7280;">${moldBd.detail}</td></tr>` : ''}
    </table>
  </div>
`;
    }

    if (sections.has('surface_info')) {
      const st = params.surface_treatment;
      html += `
  <div style="margin-bottom: 18px;">
    <h3 style="font-size: 14px; color: #374151; border-left: 3px solid #f59e0b; padding-left: 8px; margin: 0 0 10px 0;">表面处理信息</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding: 4px 8px; background: #f9fafb; width: 120px;">表面处理</td><td style="padding: 4px 8px;">${st?.type || '无'}</td></tr>
      ${st?.color ? `<tr><td style="padding: 4px 8px; background: #f9fafb;">颜色</td><td style="padding: 4px 8px;">${st.color}</td></tr>` : ''}
      <tr><td style="padding: 4px 8px; background: #f9fafb;">表面处理费</td><td style="padding: 4px 8px;">${fmt(result.surface_treatment_cost)}</td></tr>
    </table>
  </div>
`;
    }

    if (sections.has('cost_breakdown')) {
      const items = [
        { label: '材料费', key: 'material_cost' },
        { label: '加工费', key: 'processing_cost' },
        { label: '表面处理费', key: 'surface_treatment_cost' },
        { label: '包装费', key: 'packaging_cost' },
        { label: '运输费', key: 'transport_cost' },
        { label: '管理费', key: 'management_fee' },
      ];
      let rows = '';
      for (const item of items) {
        const val = (result as any)[item.key];
        const bd = (result.breakdown || {}) as any;
        const detail = bd[item.key]?.formula || '';
        rows += `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${item.label}</td>
          <td style="padding: 6px 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">${fmt(val)}</td>
          <td style="padding: 6px 8px; font-size: 11px; color: #9ca3af; border-bottom: 1px solid #e5e7eb;">${detail}</td>
        </tr>`;
      }
      html += `
  <div style="margin-bottom: 18px;">
    <h3 style="font-size: 14px; color: #374151; border-left: 3px solid #8b5cf6; padding-left: 8px; margin: 0 0 10px 0;">费用明细</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 6px 8px; text-align: left; font-weight: 600;">项目</th>
          <th style="padding: 6px 8px; text-align: right; font-weight: 600;">金额</th>
          <th style="padding: 6px 8px; text-align: left; font-weight: 600; font-size: 11px; color: #6b7280;">计算公式</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
`;
    }

    if (sections.has('total_price')) {
      html += `
  <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border: 1px solid #a7f3d0; border-radius: 8px;">
    <div style="display: flex; justify-content: space-between; align-items: baseline;">
      <span style="font-size: 14px; color: #065f46;">单价（含税）</span>
      <span style="font-size: 28px; font-weight: bold; color: #059669;">${fmt(result.unit_price)}</span>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px;">
      <span style="font-size: 13px; color: #047857;">总价（${params.quantity || 0}件）</span>
      <span style="font-size: 20px; font-weight: bold; color: #047857;">${fmt(result.total_price)}</span>
    </div>
  </div>
`;
    }

    if (result.notes && result.notes.length > 0) {
      html += `
  <div style="margin-top: 16px; padding: 10px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; font-size: 12px; color: #92400e;">
    <strong>备注：</strong>
    <ul style="margin: 4px 0 0 16px; padding: 0;">
      ${result.notes.map((n: string) => `<li>${n}</li>`).join('')}
    </ul>
  </div>
`;
    }

    html += `</div>`;
    return html;
  };

  const handleExport = () => {
    const selectedQuotes = quotes.filter(q => selectedIds.has(q.id));
    if (selectedQuotes.length === 0) return;

    const allHtml = selectedQuotes.map(q => generateQuotationHTML(q)).join('\n');
    const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>报价单</title>
  <style>
    @media print {
      body { margin: 0; }
      div[style*="page-break-after"] { page-break-after: always; }
    }
  </style>
</head>
<body>
${allHtml}
</body>
</html>
`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `报价单_${dateStr}_${selectedQuotes.length}条.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportSuccess(true);
    setTimeout(() => {
      setExportSuccess(false);
      setExportDialogOpen(false);
    }, 1200);
  };

  const openExportDialog = () => {
    setExportSections(new Set(EXPORT_SECTIONS.filter(s => s.default).map(s => s.key)));
    setExportSuccess(false);
    setExportDialogOpen(true);
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
          {quotes.length === 0 && (
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

          {quotes.map(quote => (
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
                    <span className="text-sm font-bold text-emerald-600 shrink-0">
                      ¥{Number(quote.result?.unit_price || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(quote.date).toLocaleString('zh-CN')}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {quote.params?.quantity || 0}件 · {quote.params?.material?.category || '-'}
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
          ))}
        </div>

        {/* 批量导出 */}
        <div className="pt-3 border-t border-gray-200 mt-3">
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="w-full gap-2"
                disabled={selectedIds.size === 0}
                onClick={openExportDialog}
              >
                <Download className="w-4 h-4" />
                批量导出报价单（{selectedIds.size}）
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>导出报价单</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="text-xs text-gray-500 mb-1">
                  已选择 <span className="font-semibold text-gray-700">{selectedIds.size}</span> 条报价，请勾选要包含的内容：
                </div>
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
              <div className="flex justify-between mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExportSections(new Set(EXPORT_SECTIONS.map(s => s.key)))}
                >
                  全选
                </Button>
                <Button className="gap-2" onClick={handleExport} disabled={exportSections.size === 0}>
                  {exportSuccess ? (
                    <><CheckCircle2 className="w-4 h-4" /> 已导出</>
                  ) : (
                    <><Download className="w-4 h-4" /> 导出 HTML</>
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
