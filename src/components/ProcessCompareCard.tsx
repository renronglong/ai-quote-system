"use client";
import React from 'react';

/**
 * 批量工艺对比卡（批量优先原则）
 * 对比「挤压」与「压铸」两条开模路线：模具费分摊 + 单件成本 = 单件综合成本，
 * 按当前填写数量给出推荐与盈亏平衡点。计价口径对齐 src/lib/pricing/engine.ts。
 */

interface ProcessCompareCardProps {
  productType: string;
  crossSectionArea?: number; // mm² 挤出截面积
  lengthMm?: number;         // mm 单件长度
  weightKg?: number;         // kg 单件重量（净重口径）
  quantity?: number;         // 件
}

const AL_PRICE_KG = 23.53;
const EXTRUSION_MOLD = 9200;  // 挤出平模参考价（gyparts 实价）
const DIECAST_MOLD = 20000;   // 简单小件压铸模参考价

// 挤出单件含税 = (材料+氧化+包运+加工8) × 1.28，对齐 calculateExtrusion
function extrusionUnitTax(area: number, length: number): number | null {
  if (!(area > 0) || !(length > 0)) return null;
  const F = area * 0.0027;
  const net = (F * length) / 1000;
  const E = length + 5 + 100 / Math.floor(3100 / length);
  const eff = area * E * 0.0000027;
  const L = eff * AL_PRICE_KG + net * 6.5 + net * 0.5 + 8;
  return L * 1.28;
}

// 压铸单件含税 = (材料+压铸5/kg+切割1.5+包运1/kg) × 1.28，对齐 calculateDieCasting
function diecastUnitTax(weightKg: number): number | null {
  if (!(weightKg > 0)) return null;
  return (weightKg * AL_PRICE_KG + weightKg * 5 + 1.5 + weightKg * 1.0) * 1.28;
}

export default function ProcessCompareCard({ productType, crossSectionArea, lengthMm, weightKg, quantity }: ProcessCompareCardProps) {
  if (productType !== '挤出' && productType !== '压铸') return null;
  const qty = Math.floor(Number(quantity) || 0);
  if (qty <= 0) return null;

  const area = Number(crossSectionArea) || 0;
  const len = Number(lengthMm) || 0;
  const exUnit = area > 0 && len > 0 ? extrusionUnitTax(area, len) : null;
  const wKg = weightKg && weightKg > 0 ? weightKg : (area > 0 && len > 0 ? (area * 0.0027 * len) / 1000 : 0);
  const dcUnit = diecastUnitTax(wKg);
  if (exUnit == null && dcUnit == null) return null;

  const fmt = (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const exTotal = exUnit != null ? exUnit * qty + EXTRUSION_MOLD : null;
  const dcTotal = dcUnit != null ? dcUnit * qty + DIECAST_MOLD : null;
  const exPer = exTotal != null ? exTotal / qty : null;
  const dcPer = dcTotal != null ? dcTotal / qty : null;

  let bep: number | null = null;
  if (exUnit != null && dcUnit != null && exUnit > dcUnit) {
    bep = Math.ceil((DIECAST_MOLD - EXTRUSION_MOLD) / (exUnit - dcUnit));
  }
  const better = exPer != null && dcPer != null ? (exPer <= dcPer ? '挤压' : '压铸') : null;

  const Row = ({ label, ex, dc, bold }: { label: string; ex: string | null; dc: string | null; bold?: boolean }) => (
    <div className={`grid grid-cols-3 gap-1 py-1 border-b border-slate-100 last:border-0 ${bold ? 'font-semibold' : ''}`}>
      <div className="text-slate-500 text-xs">{label}</div>
      <div className={`text-right font-mono ${bold ? 'text-slate-800' : 'text-slate-600'}`}>{ex ?? '—'}</div>
      <div className={`text-right font-mono ${bold ? 'text-slate-800' : 'text-slate-600'}`}>{dc ?? '—'}</div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
      <div className="px-3 py-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 flex items-center gap-2 flex-wrap">
        <span className="text-base">⚖️</span>
        <span className="text-sm font-semibold text-indigo-800">批量工艺对比：挤压 vs 压铸</span>
        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">按 {qty.toLocaleString()} 件</span>
        {better && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
            批量优先推荐：{better}
          </span>
        )}
      </div>
      <div className="px-3 pb-3 pt-1 text-sm">
        <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-200 text-xs font-semibold text-slate-400">
          <div />
          <div className="text-right">挤压（平模 ¥{EXTRUSION_MOLD.toLocaleString()}）</div>
          <div className="text-right">压铸（模 ¥{DIECAST_MOLD.toLocaleString()}）</div>
        </div>
        <Row label="单件价（含税）" ex={exUnit != null ? `¥${fmt(exUnit)}` : '需截面积+长度'} dc={dcUnit != null ? `¥${fmt(dcUnit)}` : '需单件重量'} />
        <Row label={`模具费分摊（/件）`} ex={exUnit != null ? `¥${fmt(EXTRUSION_MOLD / qty)}` : null} dc={dcUnit != null ? `¥${fmt(DIECAST_MOLD / qty)}` : null} />
        <Row label="单件综合成本" ex={exPer != null ? `¥${fmt(exPer)}` : null} dc={dcPer != null ? `¥${fmt(dcPer)}` : null} bold />
        <Row label={`${qty.toLocaleString()} 件总成本`} ex={exTotal != null ? `¥${fmt(exTotal)}` : null} dc={dcTotal != null ? `¥${fmt(dcTotal)}` : null} bold />
        <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 p-2 text-xs text-indigo-900 leading-relaxed">
          {better === '压铸' && (
            <>按当前数量，<b>压铸总成本更低</b>{exPer != null && dcPer != null ? `（每件省 ¥${fmt(exPer - dcPer)}，含模具分摊）` : ''}。{bep != null && qty < bep ? `注意：尚未到达盈亏平衡点约 ${bep.toLocaleString()} 件，以上按实际数量直算。` : ''}
            前提：表面走喷涂/电泳（压铸件不能阳极氧化），结构无封闭内腔。压铸材质为 ADC12。</>
          )}
          {better === '挤压' && (
            <>按当前数量，<b>挤压更划算</b>（压铸模具费摊不薄）。{bep != null ? `订单稳定超过约 ${bep.toLocaleString()} 件后，压铸才占优。` : ''}</>
          )}
          {better == null && <>数据不足，无法对比——压铸路线需单件重量，挤压路线需截面积+长度。</>}
        </div>
        <div className="mt-1 text-xs text-slate-400 leading-relaxed">
          口径：对齐报价引擎（挤压含 ¥8/件加工费与氧化费；压铸含 ¥1.5/件切割费）。模具费为一次性参考价，可按实际供应商调整。
        </div>
      </div>
    </div>
  );
}
