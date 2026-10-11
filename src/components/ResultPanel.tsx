'use client';

import {
  Percent, FileText, CheckCircle2, Loader2, Save, AlertTriangle,
} from 'lucide-react';
import type { PricingResult } from '@/components/QuoteForm';

// 铝价信息（与 quote/page.tsx 同源）
interface AluminumPrice {
  price: number;
  change: number;
  changePercent: number;
}

const INTERNAL_PHONES = ['13900139000', '18929979760'];
const INTERNAL_USER_IDS = ['98853002-61ba-485d-9672-6b4fa20906cd', 'd9e19564-5dfd-456b-b6d8-8068c84354e4'];
function isInternalUser(user: any): boolean {
  if (!user) return false;
  const phone = user.phone || user.user_metadata?.phone || '';
  const id = user.id || user.user_id || '';
  return INTERNAL_PHONES.includes(phone) || INTERNAL_USER_IDS.includes(id);
}

// 三位有效数字取整，用于前端价格显示
function fmtPrice(n: number): string {
  if (n === 0 || !isFinite(n)) return n === 0 ? '0.00' : String(n);
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const factor = Math.pow(10, 3 - d);
  const rounded = Math.round(n * factor) / factor;
  return rounded.toFixed(2);
}

export function ResultPanel({ pricingResult, aluminumPrice, productName, productCode, compact, productDiscount, moldDiscount, onProductDiscountChange, onMoldDiscountChange, moldFee, onSave, saving, saveSuccess, user, baseUnitPrice, baseMoldFee, useExistingMold, manualUnitPrice, manualMoldFee, onManualUnitPriceChange, onManualMoldFeeChange, minOrderQty, manualMinOrderQty, onManualMinOrderQtyChange, onExportPDF, hideActions }: {
  pricingResult: PricingResult | null;
  aluminumPrice: AluminumPrice | null;
  productName: string;
  productCode: string;
  compact?: boolean;
  productDiscount: number;
  moldDiscount: number;
  onProductDiscountChange: (v: number) => void;
  onMoldDiscountChange: (v: number) => void;
  moldFee: number;
  onSave?: () => void;
  saving?: boolean;
  saveSuccess?: boolean;
  user: any;
  baseUnitPrice: number;
  baseMoldFee: number;
  useExistingMold?: boolean | null;
  manualUnitPrice: number | null;
  manualMoldFee: number | null;
  onManualUnitPriceChange: (v: number | null) => void;
  onManualMoldFeeChange: (v: number | null) => void;
  minOrderQty: number;
  manualMinOrderQty: number | null;
  onManualMinOrderQtyChange: (v: number | null) => void;
  onExportPDF?: () => void;
  hideActions?: boolean;
}) {
  const isPlaceholder = !pricingResult;
  const internal = isInternalUser(user);
  const p = pricingResult || {
    material_cost: 0, processing_cost: 0, surface_treatment_cost: 0,
    secondary_operations_cost: 0, packaging_cost: 0, transport_cost: 0,
    unit_price: 0, unit_price_ex_tax: 0, unit_price_in_tax: 0, total_price: 0, weight_per_piece_kg: 0,
    material_utilization_rate: undefined as number | undefined,
    breakdown: {} as Record<string, { formula: string; detail: string }>,
    aluminum_index: 0, notes: [] as string[], mold_cost: 0, mold_spec: '' as string | undefined,
    min_order_weight_kg: 0,
  };

  const hasProductDiscount = productDiscount !== 100;
  const hasMoldDiscount = moldDiscount !== 100 && moldFee > 0;
  const hideMoldFeeForUser = useExistingMold === true && !user?.is_admin;
  const discountedUnit = p.unit_price * (productDiscount / 100);
  const discountedMold = moldFee * (moldDiscount / 100);
  const displayUnit = hasProductDiscount ? discountedUnit : p.unit_price;
  const qty = 1; // TODO: get from params if available

  const breakdownItems = [
    { label: '材料费', value: p.material_cost, key: 'material_cost' },
    // 加工费 = 基础加工费 + 二次工序费（合并为单行，避免重复列出）
    { label: '加工费', value: (p.processing_cost || 0) + (p.secondary_operations_cost || 0), key: 'processing_cost' },
    { label: '表面处理费', value: p.surface_treatment_cost, key: 'surface_treatment_cost' },
    { label: '包装费', value: p.packaging_cost, key: 'packaging_cost' },
    { label: '运输费', value: p.transport_cost, key: 'transport_cost' },
  ];

  return (
    <div className={`space-y-3 ${compact ? 'space-y-2' : ''}`}>
      {/* 产品信息 */}
      {(productName || productCode) && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm px-3 py-2.5">
          {productName && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-slate-600 shrink-0">名称</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{productName}</span>
            </div>
          )}
          {productCode && (
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-sm text-slate-600 shrink-0">编号</span>
              <span className="text-sm font-medium text-slate-600 font-mono">{productCode}</span>
            </div>
          )}
        </div>
      )}

      {/* 总价卡片 */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/60 p-4 shadow-sm">
        {/* 含税单价 */}
        {!isPlaceholder && p.unit_price_in_tax && p.unit_price_in_tax > 0 && (
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xs text-slate-600">含税单价</span>
            <span className="text-sm font-semibold text-gray-600">
              ¥{fmtPrice(manualUnitPrice
                ? manualUnitPrice * (p.unit_price_in_tax / (p.unit_price_ex_tax || p.unit_price || 1))
                : p.unit_price_in_tax
              )}/件
            </span>
            <span className="text-xs text-gray-300">（含13%增值税）</span>
          </div>
        )}
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-sm text-slate-600">未税总价</span>
          <span className={`font-bold ${isPlaceholder ? 'text-gray-300' : 'text-gray-800'} ${compact ? 'text-lg' : 'text-2xl'}`}>
            {isPlaceholder ? '¥--' : `¥${fmtPrice((displayUnit * ((p as any).quantity || 1)))}`}
          </span>
        </div>
        {/* 模具费（右上角标注模具规格） */}
        {baseMoldFee > 0 && !isPlaceholder && !hideMoldFeeForUser && (
          <div className="mt-2">
            {p.mold_spec && (
              <div className="flex justify-end">
                <span className="inline-block text-xs text-slate-600 bg-gray-100 rounded px-1.5 py-0.5 font-mono">{p.mold_spec}</span>
              </div>
            )}
            {internal ? (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-sm text-slate-600">模具费(一次性)</span>
              <span className="text-xs text-slate-600">¥</span>
              <input
                type="number"
                step="1"
                min="0"
                value={manualMoldFee ?? moldFee}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0) onManualMoldFeeChange(v);
                }}
                className={`w-20 text-right text-sm border rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400 font-semibold text-blue-700 ${manualMoldFee !== null ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white/50'}`}
              />
              {hasMoldDiscount && (
                <span className="text-xs text-amber-600">→ 折后 ¥{fmtPrice(discountedMold)}（{moldDiscount}%）</span>
              )}
              {manualMoldFee !== null && (
                <button onClick={() => onManualMoldFeeChange(null)} className="text-xs text-slate-600 hover:text-red-500" title="恢复计算值">✕</button>
              )}
            </div>
            ) : (
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-sm text-slate-600">模具费(一次性)</span>
              <span className="text-sm font-semibold text-blue-700">¥{fmtPrice(discountedMold)}</span>
            </div>
            )}
          </div>
        )}
        {/* 最小起订量 */}
        {!isPlaceholder && minOrderQty > 0 && (
          internal ? (
          <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-emerald-200/40">
            <span className="text-sm text-slate-600">最小起订量</span>
            <input
              type="number"
              step="1"
              min="1"
              value={manualMinOrderQty ?? minOrderQty}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 1) onManualMinOrderQtyChange(v);
              }}
              className={`w-20 text-right text-sm border rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400 font-semibold text-gray-700 ${manualMinOrderQty !== null ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white/50'}`}
            />
            <span className="text-xs text-slate-600">件</span>
            {manualMinOrderQty !== null && (
              <button onClick={() => onManualMinOrderQtyChange(null)} className="text-xs text-slate-600 hover:text-red-500" title="恢复计算值">✕</button>
            )}
          </div>
          ) : (
          <div className="mt-2 pt-2 border-t border-emerald-200/40 flex items-baseline gap-1">
            <span className="text-sm text-slate-600">最小起订量</span>
            <span className="text-sm font-semibold text-gray-700">{manualMinOrderQty ?? minOrderQty} 件{(p as any).min_order_weight_kg ? <span className="text-xs text-slate-600 font-normal ml-1">约{(p as any).min_order_weight_kg}kg</span> : null}</span>
          </div>
          )
        )}
      </div>

      {/* 折扣调整区域（仅内部可见） */}
      {internal && !isPlaceholder && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700 uppercase tracking-wide">折扣调整</span>
          </div>
          <div className="divide-y divide-gray-100">
            {/* 产品折扣 */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm text-gray-600">产品价调整</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="1"
                  value={productDiscount}
                  onChange={(e) => onProductDiscountChange(Number(e.target.value))}
                  className="w-20 h-1.5 accent-amber-500"
                />
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={productDiscount}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 50 && v <= 200) onProductDiscountChange(v);
                  }}
                  className="w-14 text-sm text-right border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-amber-400"
                />
                <span className="text-xs text-slate-600 w-8">{productDiscount > 100 ? '加价' : '%折'}</span>
              </div>
            </div>
            {/* 模具费折扣 */}
            {moldFee > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-gray-600">模具费调整</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="1"
                    value={moldDiscount}
                    onChange={(e) => onMoldDiscountChange(Number(e.target.value))}
                    className="w-20 h-1.5 accent-amber-500"
                  />
                  <input
                    type="number"
                    min="50"
                    max="200"
                    value={moldDiscount}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 50 && v <= 200) onMoldDiscountChange(v);
                    }}
                    className="w-14 text-sm text-right border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-xs text-slate-600 w-8">{moldDiscount > 100 ? '加价' : '%折'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      {!hideActions && !isPlaceholder && onSave && (
        <div className="space-y-2">
          <button
            onClick={onExportPDF}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-700 hover:to-emerald-600 transition-all shadow-sm"
          >
            <FileText className="w-4 h-4" /> 导出报价单
          </button>
          <button
            onClick={onSave}
            disabled={saving || saveSuccess}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              saveSuccess
                ? 'bg-emerald-500 text-white'
                : saving
                  ? 'bg-gray-100 text-slate-600 cursor-not-allowed'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {saveSuccess ? (
              <><CheckCircle2 className="w-4 h-4" /> 已保存</>
            ) : saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</>
            ) : (
              <><Save className="w-4 h-4" /> 保存报价</>
            )}
          </button>
        </div>
      )}

      {/* 费用明细（仅内部账号可见） */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-base font-bold text-slate-600 uppercase tracking-wide">费用明细</span>
        </div>
        <div className="divide-y divide-gray-100">
          {breakdownItems.map((item, idx) => (
            <div key={item.key} className={`flex justify-between items-center px-3 py-2 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
              <span className="text-sm text-slate-600">{item.label}</span>
              <div className="text-right">
                <span className={`text-sm font-semibold ${isPlaceholder ? 'text-gray-300' : 'text-gray-800'}`}>
                  {isPlaceholder ? '--' : `¥${fmtPrice(item.value)}`}
                </span>
                {!isPlaceholder && p.breakdown?.[item.key] && (
                  <div className="text-xs text-slate-600 leading-tight">
                    {p.breakdown[item.key].formula && (
                      <span className="italic">{p.breakdown[item.key].formula}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* 辅助信息（仅内部账号可见） */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1.5">
        {(!isPlaceholder && p.weight_per_piece_kg > 0) && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">单件型材消耗</span>
            <span className="text-sm font-medium text-gray-600">
              {p.weight_per_piece_kg >= 1
                ? `${p.weight_per_piece_kg.toFixed(3)} kg`
                : `${(p.weight_per_piece_kg * 1000).toFixed(1)} g`}
            </span>
          </div>
        )}
        {(!isPlaceholder && p.material_utilization_rate != null && p.material_utilization_rate > 0) && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">材料利用率</span>
            <span className={`text-sm font-semibold ${(p.material_utilization_rate * 100) >= 80 ? 'text-emerald-600' : (p.material_utilization_rate * 100) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {(p.material_utilization_rate * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* 备注（成本/模具明细，仅管理员可见） */}
      {!isPlaceholder && user?.is_admin && p.notes && p.notes.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          {p.notes.map((note: string, i: number) => (
            <div key={i} className="flex items-start gap-1.5 text-sm text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {isPlaceholder && (
        <div className="flex items-center justify-center py-3">
          <p className="text-sm text-gray-300">请填写参数，系统将自动计算报价</p>
        </div>
      )}
    </div>
  );
}

export { fmtPrice, isInternalUser };
