"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import QuoteForm, { PricingResult } from '@/components/QuoteForm';
import {
  TrendingUp,
  Loader2,
  Factory,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Package,
  BarChart3,
  Save,
  History,
  CheckCircle2,
} from 'lucide-react';
import SavedQuotesPanel, { saveQuoteToStorage } from '@/components/SavedQuotesPanel';

interface AiFormUpdate {
  productType?: string;
  materialCategory?: string;
  materialGrade?: string;
  quantity?: number;
  length?: number;
  width?: number;
  height?: number;
  surfaceTreatment?: string;
  packaging?: string;
  secondaryProcessing?: string[];
}

interface AluminumPrice {
  price: number;
  change: number;
  changePercent: number;
}

export default function QuotePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [aiFormData, setAiFormData] = useState<AiFormUpdate | null>(null);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [productInfo, setProductInfo] = useState<{ productName: string; productCode: string }>({ productName: '', productCode: '' });
  const [resultExpanded, setResultExpanded] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, any> | null>(null);
  const aiDataCounter = useRef(0);

  const handleFormUpdate = useCallback((data: AiFormUpdate) => {
    aiDataCounter.current += 1;
    setAiFormData({ ...data, _v: aiDataCounter.current } as AiFormUpdate);
  }, []);

  const handleResult = useCallback((result: PricingResult | null) => {
    setPricingResult(result);
  }, []);

  // 保存当前计算参数（供保存报价使用）
  const handleParamsUpdate = useCallback((params: Record<string, any>) => {
    setCurrentParams(params);
  }, []);

  const handleProductInfoChange = useCallback((info: { productName: string; productCode: string }) => {
    setProductInfo(info);
  }, []);

  // 保存报价
  const handleSaveQuote = () => {
    if (!pricingResult) return;
    const params = currentParams || {};
    const productType = params.product_type || productInfo.productName || '产品';
    const result = {
      material_cost: pricingResult.material_cost,
      processing_cost: pricingResult.processing_cost,
      surface_treatment_cost: pricingResult.surface_treatment_cost,
      packaging_cost: pricingResult.packaging_cost,
      transport_cost: pricingResult.transport_cost,
      management_fee: pricingResult.management_fee,
      unit_price: pricingResult.unit_price,
      total_price: pricingResult.total_price,
      weight_per_piece_kg: pricingResult.weight_per_piece_kg,
      material_utilization_rate: pricingResult.material_utilization_rate,
      breakdown: pricingResult.breakdown,
      aluminum_index: pricingResult.aluminum_index,
      notes: pricingResult.notes,
    };
    saveQuoteToStorage(params, result, productType);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };

  // Login check
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/quote');
    }
  }, [authLoading, user, router]);

  // Fetch aluminum price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/market-price?material=${encodeURIComponent('铝型材')}`);
        const data = await res.json();
        if (data.success) setAluminumPrice(data.data);
      } catch (error) {
        console.error('获取铝锭价失败:', error);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* 顶部栏 - 紧凑 */}
      <header className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Factory className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold text-gray-800">报价计算器</span>
                <span className="hidden sm:inline text-[10px] text-gray-400">gyparts.cn</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <SavedQuotesPanel
                trigger={
                  <button className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                    <History className="w-3.5 h-3.5" />
                    已保存
                  </button>
                }
              />
              {aluminumPrice && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
                  <TrendingUp className="w-3 h-3 text-orange-500" />
                  <span className="text-[10px] text-gray-500">铝锭</span>
                  <span className="text-xs font-bold text-gray-800">¥{aluminumPrice.price.toLocaleString()}</span>
                  <span className={`text-[10px] font-medium ${aluminumPrice.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                  </span>
                </div>
              )}
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : user ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">{user.email || '用户'}</span>
                  <button onClick={() => signOut()} className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
                    退出
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：参数输入区 */}
        <div className="w-full lg:w-[58%] xl:w-[55%] overflow-y-auto bg-gray-50">
          <div className="max-w-2xl mx-auto">
            <QuoteForm
              aiData={aiFormData}
              onResult={handleResult}
              onProductInfoChange={handleProductInfoChange}
              onCalculate={handleParamsUpdate}
            />
          </div>
        </div>

        {/* 右侧：实时结果区 - PC sticky */}
        <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] flex-col border-l border-gray-200 bg-white">
          <div className="flex-1 overflow-y-auto">
            <div className="sticky top-0 p-5 space-y-4">
              {/* 结果卡片 */}
              <ResultPanel pricingResult={pricingResult} aluminumPrice={aluminumPrice} productName={productInfo.productName} productCode={productInfo.productCode} onSave={handleSaveQuote} saveSuccess={saveSuccess} />
            </div>
          </div>
        </div>
      </main>

      {/* 移动端底部结果区 - 可折叠 */}
      <div className="lg:hidden shrink-0 border-t border-gray-200 bg-white">
        <button
          onClick={() => setResultExpanded(!resultExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100"
        >
          <span className="text-sm font-medium text-gray-700">
            {pricingResult ? `¥${pricingResult.unit_price.toFixed(2)}/件` : '报价结果'}
          </span>
          {resultExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </button>
        {resultExpanded && (
          <div className="p-4 max-h-[40vh] overflow-y-auto">
            <ResultPanel pricingResult={pricingResult} aluminumPrice={aluminumPrice} productName={productInfo.productName} productCode={productInfo.productCode} compact onSave={handleSaveQuote} saveSuccess={saveSuccess} />
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Result Panel Component ====================

function ResultPanel({ pricingResult, aluminumPrice, productName, productCode, compact, onSave, saveSuccess }: {
  pricingResult: PricingResult | null;
  aluminumPrice: AluminumPrice | null;
  productName: string;
  productCode: string;
  compact?: boolean;
  onSave?: () => void;
  saveSuccess?: boolean;
}) {
  // 保留UI结构，只显示占位数据
  const isPlaceholder = !pricingResult;
  const p = pricingResult || {
    material_cost: 0, processing_cost: 0, surface_treatment_cost: 0,
    secondary_operations_cost: 0, packaging_cost: 0, transport_cost: 0,
    management_fee: 0, unit_price: 0, total_price: 0, weight_per_piece_kg: 0, material_utilization_rate: undefined as number | undefined,
    breakdown: {} as Record<string, { formula: string; detail: string }>,
    aluminum_index: 0, notes: [] as string[],
  };

  const breakdownItems = [
    { label: '材料费', value: p.material_cost, key: 'material_cost' },
    { label: '加工费', value: p.processing_cost, key: 'processing_cost' },
    { label: '表面处理费', value: p.surface_treatment_cost, key: 'surface_treatment_cost' },
    { label: '包装费', value: p.packaging_cost, key: 'packaging_cost' },
    { label: '运输费', value: p.transport_cost, key: 'transport_cost' },
    { label: '管理费', value: p.management_fee, key: 'management_fee' },
  ];

  return (
    <div className={`space-y-3 ${compact ? 'space-y-2' : ''}`}>
      {/* 产品信息 */}
      {(productName || productCode) && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm px-3 py-2.5">
          {productName && (
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] text-gray-400 shrink-0">名称</span>
              <span className="text-sm font-semibold text-gray-800 truncate">{productName}</span>
            </div>
          )}
          {productCode && (
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-[11px] text-gray-400 shrink-0">编号</span>
              <span className="text-xs font-medium text-gray-500 font-mono">{productCode}</span>
            </div>
          )}
        </div>
      )}

      {/* 单价大卡片 */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/60 p-4 shadow-sm">
        <div className="flex items-center gap-1.5 mb-1">
          <Package className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">单价</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`font-bold ${isPlaceholder ? 'text-gray-300' : 'text-emerald-700'} ${compact ? 'text-2xl' : 'text-4xl'}`}>
            {isPlaceholder ? '¥--' : `¥${p.unit_price.toFixed(2)}`}
          </span>
          <span className={`text-sm ${isPlaceholder ? 'text-gray-300' : 'text-emerald-500'}`}>/件</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-xs text-gray-500">总价</span>
          <span className={`font-bold ${isPlaceholder ? 'text-gray-300' : 'text-gray-800'} ${compact ? 'text-lg' : 'text-2xl'}`}>
            {isPlaceholder ? '¥--' : `¥${p.total_price.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      {!isPlaceholder && onSave && (
        <div className="flex gap-2">
          <button
            onClick={onSave}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              saveSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {saveSuccess ? (
              <><CheckCircle2 className="w-4 h-4" /> 已保存</>
            ) : (
              <><Save className="w-4 h-4" /> 保存报价</>
            )}
          </button>
        </div>
      )}

      {/* 费用明细 */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">费用明细</span>
        </div>
        <div className="divide-y divide-gray-100">
          {breakdownItems.map((item, idx) => (
            <div key={item.key} className={`flex justify-between items-center px-3 py-2 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
              <span className="text-xs text-gray-500">{item.label}</span>
              <div className="text-right">
                <span className={`text-sm font-semibold ${isPlaceholder ? 'text-gray-300' : 'text-gray-800'}`}>
                  {isPlaceholder ? '--' : `¥${item.value.toFixed(2)}`}
                </span>
                {!isPlaceholder && p.breakdown?.[item.key] && (
                  <div className="text-[10px] text-gray-400 leading-tight">
                    {p.breakdown[item.key].formula && (
                      <span className="italic">{p.breakdown[item.key].formula}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 分割线 */}
        <div className="border-t-2 border-dashed border-gray-200" />

        {/* 单价汇总 */}
        <div className="flex justify-between items-center px-3 py-2 bg-emerald-50/50">
          <span className="text-xs font-medium text-gray-600">单价合计</span>
          <span className={`text-base font-bold ${isPlaceholder ? 'text-gray-300' : 'text-emerald-600'}`}>
            {isPlaceholder ? '--' : `¥${p.unit_price.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* 辅助信息 */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-1.5">
        {(!isPlaceholder && p.weight_per_piece_kg > 0) && (
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-400">单件型材消耗</span>
            <span className="text-xs font-medium text-gray-600">
              {p.weight_per_piece_kg >= 1
                ? `${p.weight_per_piece_kg.toFixed(3)} kg`
                : `${(p.weight_per_piece_kg * 1000).toFixed(1)} g`}
            </span>
          </div>
        )}
        {(!isPlaceholder && p.material_utilization_rate != null && p.material_utilization_rate > 0) && (
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-400">材料利用率</span>
            <span className={`text-xs font-semibold ${(p.material_utilization_rate * 100) >= 80 ? 'text-emerald-600' : (p.material_utilization_rate * 100) >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {(p.material_utilization_rate * 100).toFixed(1)}%
            </span>
          </div>
        )}
        {aluminumPrice && (
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-400">铝锭基价</span>
            <span className="text-xs font-medium text-gray-600">¥{aluminumPrice.price.toLocaleString()}/吨</span>
          </div>
        )}
        {!isPlaceholder && p.aluminum_index > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-400">计价铝锭价</span>
            <span className="text-xs font-medium text-gray-600">¥{p.aluminum_index.toLocaleString()}/吨</span>
          </div>
        )}
      </div>

      {/* 警告提示 */}
      {!isPlaceholder && p.notes && p.notes.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          {p.notes.map((note: string, i: number) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}

      {/* 无数据时的提示 */}
      {isPlaceholder && (
        <div className="flex items-center justify-center py-3">
          <p className="text-xs text-gray-300">请填写参数，系统将自动计算报价</p>
        </div>
      )}
    </div>
  );
}
