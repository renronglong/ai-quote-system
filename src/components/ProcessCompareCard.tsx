"use client";
import React from 'react';
import { compareProcesses } from '@/lib/pricing/engine';

/**
 * 批量工艺对比卡（批量优先原则）
 * 数据与判定全部来自报价引擎 compareProcesses()，前端不再维护公式。
 */

interface ProcessCompareCardProps {
  productType: string;
  crossSectionArea?: number; // mm² 挤出截面积
  lengthMm?: number;         // mm 单件长度
  weightKg?: number;         // kg 单件重量（净重口径）
  quantity?: number;         // 件
}

export default function ProcessCompareCard({ productType, crossSectionArea, lengthMm, weightKg, quantity }: ProcessCompareCardProps) {
  if (productType !== '挤出' && productType !== '压铸') return null;
  const qty = Math.floor(Number(quantity) || 0);
  if (qty <= 0) return null;

  const cmp = compareProcesses({
    crossSectionArea: Number(crossSectionArea) || 0,
    lengthMm: Number(lengthMm) || 0,
    weightPerPieceKg: Number(weightKg) || 0,
    quantity: qty,
  });

  const ex = cmp.extrusion;
  const dc = cmp.dieCasting;
  if (ex.totalCost == null && dc.totalCost == null) return null;

  const fmt = (v: number | null) => (v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const better = cmp.recommended === 'die_casting' ? '压铸' : cmp.recommended === 'extrusion' ? '挤压' : null;

  const Row = ({ label, ex, dc, bold }: { label: string; ex: string; dc: string; bold?: boolean }) => (
    <div className={`grid grid-cols-3 gap-1 py-1 border-b border-slate-100 last:border-0 ${bold ? 'font-semibold' : ''}`}>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className={`text-right font-mono ${bold ? 'text-slate-800' : 'text-slate-600'}`}>{ex}</div>
      <div className={`text-right font-mono ${bold ? 'text-slate-800' : 'text-slate-600'}`}>{dc}</div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
      <div className="px-3 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 flex items-center gap-2 flex-wrap">
        <span className="text-base">⚖️</span>
        <span className="text-sm font-semibold text-indigo-800">批量工艺对比：挤压 vs 压铸</span>
        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">按 {cmp.quantity.toLocaleString()} 件</span>
        {better && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
            批量优先推荐：{better}
          </span>
        )}
      </div>
      <div className="px-3 pb-3 pt-1 text-sm">
        <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-200 text-xs font-semibold text-slate-400">
          <div />
          <div className="text-right">挤压（平模 ¥{ex.moldCost.toLocaleString()}）</div>
          <div className="text-right">压铸（模 ¥{dc.moldCost.toLocaleString()}）</div>
        </div>
        <Row label="单件价（含税）" ex={fmt(ex.unitPriceWithTax)} dc={dc.unitPriceWithTax != null ? fmt(dc.unitPriceWithTax) : '需单件重量'} />
        <Row label="模具费分摊（/件）" ex={fmt(ex.moldCost / cmp.quantity)} dc={fmt(dc.moldCost / cmp.quantity)} />
        <Row label="单件综合成本" ex={fmt(ex.unitWithMold)} dc={fmt(dc.unitWithMold)} bold />
        <Row label={`${cmp.quantity.toLocaleString()} 件总成本`} ex={fmt(ex.totalCost)} dc={fmt(dc.totalCost)} bold />
        <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 p-2 text-xs text-indigo-900 leading-relaxed">
          {better === '压铸' && (
            <>按当前数量，<b>压铸总成本更低</b>{ex.unitWithMold != null && dc.unitWithMold != null ? `（每件省 ¥${(ex.unitWithMold - dc.unitWithMold).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}，含模具分摊）` : ''}。
            前提：表面走喷涂/电泳（压铸件不能阳极氧化），结构无封闭内腔。压铸材质为 ADC12。</>
          )}
          {better === '挤压' && (
            <>按当前数量，<b>挤压更划算</b>（压铸模具费摊不薄）。{cmp.breakEvenQty != null ? `订单稳定超过约 ${cmp.breakEvenQty.toLocaleString()} 件后，压铸才占优。` : ''}</>
          )}
          {better == null && <>数据不足，无法对比——压铸路线需单件重量，挤压路线需截面积+长度。</>}
        </div>
        <div className="mt-1 text-xs text-slate-400 leading-relaxed">
          {cmp.notes.join('；')}。盈亏平衡点：{cmp.breakEvenQty != null ? `约 ${cmp.breakEvenQty.toLocaleString()} 件` : '—'}。
        </div>
      </div>
    </div>
  );
}
