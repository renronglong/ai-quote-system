'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { calculateExtrusion, calculatePlate } from '@/lib/pricing/engine';
import type { SurfaceTreatment } from '@/lib/pricing/types';
import { Button } from '@/components/ui/button';
import { Calculator, ArrowRight } from 'lucide-react';

const SURFACE_OPTIONS: SurfaceTreatment[] = [
  '无', '阳极氧化原色', '氧化黑色', '氧化银白', '喷涂', '电泳', '白色哑光',
];

function NumField({
  label, unit, value, onChange, placeholder,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}{unit ? ` (${unit})` : ''}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

export default function QuickQuote() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'extrusion' | 'plate'>('extrusion');

  // 型材
  const [meterWeight, setMeterWeight] = useState('');
  const [extLength, setExtLength] = useState('');
  // 板材
  const [plateLength, setPlateLength] = useState('');
  const [plateWidth, setPlateWidth] = useState('');
  const [plateThickness, setPlateThickness] = useState('');
  // 共用
  const [qty, setQty] = useState('1');
  const [surface, setSurface] = useState<SurfaceTreatment>('无');

  const result = useMemo(() => {
    const quantity = Math.max(0, parseFloat(qty) || 0);
    if (quantity <= 0) return null;
    if (mode === 'extrusion') {
      const w = parseFloat(meterWeight);
      const len = parseFloat(extLength);
      if (!(w > 0) || !(len > 0)) return null;
      // 米重(kg/m) → 截面面积(mm²)：crossSectionArea × 0.0027 = 米重
      return calculateExtrusion({
        productType: 'extrusion',
        crossSectionArea: w / 0.0027,
        length: len,
        quantity,
        surfaceTreatment: surface,
      });
    }
    const h = parseFloat(plateLength);
    const wid = parseFloat(plateWidth);
    const t = parseFloat(plateThickness);
    if (!(h > 0) || !(wid > 0) || !(t > 0)) return null;
    return calculatePlate({
      productType: 'plate',
      width: wid,
      height: h,
      thickness: t,
      quantity,
      surfaceTreatment: surface,
    });
  }, [mode, meterWeight, extLength, plateLength, plateWidth, plateThickness, qty, surface]);

  const unitPrice = result?.unitCost ?? 0;
  const totalPrice = result?.totalCost ?? 0;
  const alPerKg = result?.aluminumPrice?.pricePerKg ?? 23.53;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center">
          <Calculator className="w-4 h-4 mr-1.5 text-blue-600" />
          快速报价估算
        </p>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">免登录</span>
      </div>

      <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-4 w-full">
        <button
          type="button"
          onClick={() => setMode('extrusion')}
          className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${mode === 'extrusion' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >铝型材</button>
        <button
          type="button"
          onClick={() => setMode('plate')}
          className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${mode === 'plate' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
        >铝板</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {mode === 'extrusion' ? (
          <>
            <NumField label="米重" unit="kg/m" value={meterWeight} onChange={setMeterWeight} placeholder="如 0.5" />
            <NumField label="长度" unit="mm" value={extLength} onChange={setExtLength} placeholder="如 1000" />
          </>
        ) : (
          <>
            <NumField label="长" unit="mm" value={plateLength} onChange={setPlateLength} placeholder="如 1000" />
            <NumField label="宽" unit="mm" value={plateWidth} onChange={setPlateWidth} placeholder="如 500" />
            <NumField label="厚" unit="mm" value={plateThickness} onChange={setPlateThickness} placeholder="如 2" />
          </>
        )}
        <NumField label="数量" unit="件" value={qty} onChange={setQty} placeholder="1" />
        <label className="block">
          <span className="text-xs text-gray-500">表面处理</span>
          <select
            value={surface}
            onChange={(e) => setSurface(e.target.value as SurfaceTreatment)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white"
          >
            {SURFACE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500">单件参考价</span>
          <span className="text-2xl font-bold text-blue-600 tabular-nums">¥{unitPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <span className="text-sm text-gray-500">批量总价（{qty || 0} 件）</span>
          <span className="text-sm font-semibold text-gray-700 tabular-nums">¥{totalPrice.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">铝价基准 ¥{alPerKg.toFixed(2)}/kg · 估算值，仅供参考</p>
      </div>

      <div className="mt-4">
        {user ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/quote">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                打开完整报价器
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link href="/history">
              <Button size="sm" variant="outline" className="border-gray-300 font-semibold">我的报价</Button>
            </Link>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            登录后可保存报价、查看历史记录 ·
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium ml-1">登录</Link>
          </p>
        )}
      </div>
    </div>
  );
}
