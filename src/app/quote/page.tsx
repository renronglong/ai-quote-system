"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QuoteForm, { PricingResult, BatchVariantResult } from '@/components/QuoteForm';
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
  Download,
  Edit2,
  CheckCircle2,
  Percent,
  Store,
  FileText,
  User,
  LogOut,
} from 'lucide-react';
import SavedQuotesPanel, { saveQuoteToAPI } from '@/components/SavedQuotesPanel';
import QuoteSheetDialog from '@/components/QuoteSheetDialog';
import TopNavLinks from '@/components/TopNav';

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
  const [showExportLogin, setShowExportLogin] = useState(false); // 游客导出报价单时弹登录墙
  const [showSheetDialog, setShowSheetDialog] = useState(false); // Excel报价单出单弹窗
  const [currentParams, setCurrentParams] = useState<Record<string, any> | null>(null);
  const [productDiscount, setProductDiscount] = useState<number>(100); // 产品折扣，100=无折扣
  const [moldDiscount, setMoldDiscount] = useState<number>(100); // 模具费折扣，100=无折扣
  const [manualUnitPrice, setManualUnitPrice] = useState<number | null>(null); // 手动覆盖单价
  const [manualMoldFee, setManualMoldFee] = useState<number | null>(null); // 手动覆盖模具费
  const [manualMinOrderQty, setManualMinOrderQty] = useState<number | null>(null); // 手动覆盖最小起订量
  const [batchResults, setBatchResults] = useState<BatchVariantResult[]>([]);
  const aiDataCounter = useRef(0);

  const handleFormUpdate = useCallback((data: AiFormUpdate) => {
    aiDataCounter.current += 1;
    setAiFormData({ ...data, _v: aiDataCounter.current } as AiFormUpdate);
  }, []);

  const handleResult = useCallback((result: PricingResult | null) => {
    setPricingResult(result);
    setManualUnitPrice(null);
    setManualMoldFee(null);
    setManualMinOrderQty(null);
  }, []);

  const handleParamsUpdate = useCallback((params: Record<string, any>) => {
    setCurrentParams(params);
  }, []);

  const handleProductInfoChange = useCallback((info: { productName: string; productCode: string }) => {
    setProductInfo(info);
  }, []);

  const handleBatchResult = useCallback((results: BatchVariantResult[]) => {
    setBatchResults(results);
  }, []);

  const exportBatchCSV = () => {
    if (batchResults.length === 0) return;
    const headers = ['产品型号', '长度(mm)', '重量(g)', '重量(kg)', '数量', '材料费', '加工费', '表面处理费', '单价', '总价', '模具费'];
    const rows = batchResults.map((br, idx) => [
      br.name || `变体${idx + 1}`,
      br.length,
      br.weight,
      (br.weight / 1000).toFixed(3),
      br.quantity || 1,
      br.result.material_cost.toFixed(2),
      (br.result.secondary_operations_cost || 0).toFixed(2),
      br.result.surface_treatment_cost.toFixed(2),
      br.result.unit_price.toFixed(2),
      br.result.total_price.toFixed(2),
      idx === 0 ? (br.result.mold_cost || 0).toFixed(2) : '-',
    ]);
    const totalUnit = batchResults.reduce((s, br) => s + br.result.unit_price * (br.quantity || 1), 0);
    const moldCost = batchResults[0]?.result.mold_cost || 0;
    rows.push([
      '合计', '', '', '', '',
      batchResults.reduce((s, br) => s + br.result.material_cost, 0).toFixed(2),
      batchResults.reduce((s, br) => s + (br.result.secondary_operations_cost || 0), 0).toFixed(2),
      batchResults.reduce((s, br) => s + br.result.surface_treatment_cost, 0).toFixed(2),
      totalUnit.toFixed(2),
      batchResults.reduce((s, br) => s + br.result.total_price, 0).toFixed(2),
      moldCost > 0 ? moldCost.toFixed(2) : '-',
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `批量报价_${productInfo.productName || '产品'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 保存报价 → 调用 API 存入数据库（游客先跳登录）
  const handleSaveQuote = async () => {
    if (!user) {
      router.push('/login?redirect=/quote');
      return;
    }
    if (!pricingResult) return;
    const params = currentParams || {};
    const productType = params.product_type || productInfo.productName || '产品';
    const result = {
      material_cost: pricingResult.material_cost,
      processing_cost: pricingResult.secondary_operations_cost || 0,
      surface_treatment_cost: pricingResult.surface_treatment_cost,
      packaging_cost: pricingResult.packaging_cost,
      transport_cost: pricingResult.transport_cost,
      management_fee: pricingResult.management_fee,
      unit_price: manualUnitPrice ?? pricingResult.unit_price,
      total_price: pricingResult.total_price,
      weight_per_piece_kg: pricingResult.weight_per_piece_kg,
      material_utilization_rate: pricingResult.material_utilization_rate,
      breakdown: pricingResult.breakdown,
      aluminum_index: pricingResult.aluminum_index,
      notes: pricingResult.notes,
      mold_cost: manualMoldFee ?? pricingResult.mold_cost ?? 0,
      manual_unit_price: manualUnitPrice,
      manual_mold_fee: manualMoldFee,
      min_order_qty: manualMinOrderQty ?? pricingResult.min_order_qty ?? 0,
      manual_min_order_qty: manualMinOrderQty,
    };
    const saved = await saveQuoteToAPI(user.id, params, result, productType);
    if (saved) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
    }
  };


  // 导出正式报价单（游客先弹登录墙；登录后打开 Excel 出单弹窗）
  const exportQuotePDF = () => {
    if (!user) {
      setShowExportLogin(true);
      return;
    }
    setShowSheetDialog(true);
  };

  // 游客可直接使用计算器；图纸识别/保存报价/深度报价时在组件内弹登录墙

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

  // 折扣计算（支持手动覆盖）
  const baseUnitPrice = pricingResult?.unit_price || 0;
  const baseMoldFee = pricingResult?.mold_cost || 0;
  const effectiveUnitPrice = manualUnitPrice ?? baseUnitPrice;
  const effectiveMoldFee = manualMoldFee ?? baseMoldFee;
  const moldFee = effectiveMoldFee;
  const discountedUnit = effectiveUnitPrice * (productDiscount / 100);
  const discountedMold = effectiveMoldFee * (moldDiscount / 100);
  const moldDiffPerPiece = pricingResult ? (moldFee - discountedMold) / (pricingResult.weight_per_piece_kg > 0 ? ((currentParams?.quantity || 1)) : 1) : 0;
  const finalUnit = discountedUnit; // 产品折后单价
  const hasProductDiscount = productDiscount !== 100;
  const hasMoldDiscount = moldDiscount !== 100 && moldFee > 0;
  const hasAnyDiscount = hasProductDiscount || hasMoldDiscount;
  const hasManualUnitPrice = manualUnitPrice !== null;
  const hasManualMoldFee = manualMoldFee !== null;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* 顶部栏 */}
      <header className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="relative flex items-center justify-between h-12">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Factory className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold text-gray-800">报价计算器</span>
                <span className="hidden sm:inline text-[10px] text-gray-400">gyparts.cn</span>
              </div>
            </Link>

            {/* 中间：全站统一导航（桌面端，任意页面可互跳） */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
              <TopNavLinks />
            </div>

            <div className="flex items-center gap-2">
              {user && (
                <SavedQuotesPanel
                  userId={user.id}
                  trigger={
                    <button className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                      <History className="w-3.5 h-3.5" />
                      已保存
                    </button>
                  }
                />
              )}
              <button onClick={() => router.push('/supplier')} className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                <Store className="w-3.5 h-3.5" />
                供应商
              </button>
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
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-xs text-gray-500 max-w-[120px] truncate">{user.company_name || user.email || '已登录'}</span>
                  <button onClick={() => signOut()} className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                    <LogOut className="w-3 h-3" />退出
                  </button>
                </div>
              ) : (
                <button onClick={() => router.push('/login?redirect=/quote')} className="px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                  登录
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ===== Excel 正式报价单出单弹窗 ===== */}
      {showSheetDialog && user && (
        <QuoteSheetDialog
          open={showSheetDialog}
          onClose={() => setShowSheetDialog(false)}
          userId={user.id}
          aluminumPrice={aluminumPrice?.price}
          currentQuote={pricingResult && currentParams ? {
            params: currentParams,
            result: pricingResult,
            productType: productInfo.productName || currentParams.product_type || '产品',
            productDiscount,
            moldDiscount,
          } : null}
        />
      )}

      {/* ===== 游客导出报价单 登录提示弹窗 ===== */}
      {showExportLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">登录后生成报价单</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">正式报价单需包含您的公司名称与联系方式，登录后可自动生成 PDF 并保存报价记录</p>
              <p className="text-xs text-blue-600 mt-2">注册即送 100 积分，还能用图纸 AI 识别自动填尺寸</p>
            </div>
            <div className="flex gap-3">
              <a href="/login?redirect=/quote" className="flex-1 text-center py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">去登录</a>
              <a href="/register?redirect=/quote" className="flex-1 text-center py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition">注册</a>
            </div>
            <button onClick={() => setShowExportLogin(false)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">取消</button>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧：参数输入区 */}
        <div className="w-full lg:w-[58%] xl:w-[55%] overflow-y-auto bg-gray-50">
          <div className="max-w-2xl mx-auto">
            <QuoteForm
              aiData={aiFormData}
              onResult={handleResult}
              onProductInfoChange={handleProductInfoChange}
              onBatchResult={handleBatchResult}
              onCalculate={handleParamsUpdate}
            />
          </div>
        </div>

        {/* 右侧：实时结果区 */}
        <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] flex-col border-l border-gray-200 bg-white">
          <div className="flex-1 overflow-y-auto">
            <div className="sticky top-0 p-5 space-y-4">
              <ResultPanel
                pricingResult={pricingResult}
                aluminumPrice={aluminumPrice}
                productName={productInfo.productName}
                productCode={productInfo.productCode}
                productDiscount={productDiscount}
                moldDiscount={moldDiscount}
                onProductDiscountChange={setProductDiscount}
                onMoldDiscountChange={setMoldDiscount}
                moldFee={moldFee}
                onSave={handleSaveQuote}
                saveSuccess={saveSuccess}
                user={user}
                baseUnitPrice={baseUnitPrice}
                baseMoldFee={baseMoldFee}
                manualUnitPrice={manualUnitPrice}
                manualMoldFee={manualMoldFee}
                onManualUnitPriceChange={setManualUnitPrice}
                onManualMoldFeeChange={setManualMoldFee}
                minOrderQty={pricingResult?.min_order_qty || 0}
                manualMinOrderQty={manualMinOrderQty}
                onManualMinOrderQtyChange={setManualMinOrderQty}
                onExportPDF={exportQuotePDF}
              />
              {/* ---- 批量报价汇总表 ---- */}
              {batchResults.length > 0 && (
                <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">批量报价汇总</span>
                    </div>
                    <button
                      onClick={exportBatchCSV}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      导出CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-2 py-1.5 text-left text-[10px] font-medium text-gray-500">产品</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">长度(mm)</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">重量(g)</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">数量</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">材料费</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">加工费</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">表处费</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">单价</th>
                          <th className="px-2 py-1.5 text-right text-[10px] font-medium text-gray-500">模具费</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {batchResults.map((br, idx) => (
                          <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                            <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{br.name}{br.surfaceTreatment && br.surfaceTreatment !== '无' && br.surfaceTreatment !== '' ? <span className="text-[9px] text-blue-500 ml-1">({br.surfaceTreatment})</span> : null}</td>
                            <td className="px-2 py-1.5 text-right text-gray-800 font-medium">{br.length}</td>
                            <td className="px-2 py-1.5 text-right text-gray-800">{br.weight}</td>
                            <td className="px-2 py-1.5 text-right text-gray-800">{br.quantity || 1}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600">¥{br.result.material_cost.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600">¥{(br.result.secondary_operations_cost || 0).toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600">¥{br.result.surface_treatment_cost.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right text-emerald-600 font-semibold">¥{br.result.unit_price.toFixed(2)}</td>
                            <td className="px-2 py-1.5 text-right text-blue-600 font-medium">
                              {idx === 0 && br.result.mold_cost ? `¥${br.result.mold_cost.toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/50 border-t-2 border-dashed border-gray-200">
                          <td className="px-2 py-2 text-[11px] font-semibold text-gray-700">合计</td>
                          <td className="px-2 py-2"></td>
                          <td className="px-2 py-2"></td>
                          <td className="px-2 py-2 text-right text-[11px] font-semibold text-gray-700">
                            {batchResults.reduce((s, br) => s + (br.quantity || 1), 0)}
                          </td>
                          <td className="px-2 py-2 text-right text-[11px] font-semibold text-gray-700">
                            ¥{batchResults.reduce((s, br) => s + br.result.material_cost, 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-[11px] font-semibold text-gray-700">
                            ¥{batchResults.reduce((s, br) => s + (br.result.secondary_operations_cost || 0), 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-[11px] font-semibold text-gray-700">
                            ¥{batchResults.reduce((s, br) => s + br.result.surface_treatment_cost, 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-sm font-bold text-emerald-600">
                            ¥{batchResults.reduce((s, br) => s + br.result.unit_price * (br.quantity || 1), 0).toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-[11px] font-semibold text-blue-600">
                            {batchResults[0]?.result.mold_cost ? `¥${batchResults[0].result.mold_cost.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* 移动端底部结果区 */}
      <div className="lg:hidden shrink-0 border-t border-gray-200 bg-white">
        <button
          onClick={() => setResultExpanded(!resultExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100"
        >
          <span className="text-sm font-medium text-gray-700">
            {pricingResult ? `¥${finalUnit.toFixed(2)}/件` : '报价结果'}
          </span>
          {resultExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </button>
        {resultExpanded && (
          <div className="p-4 max-h-[40vh] overflow-y-auto">
            <ResultPanel
              pricingResult={pricingResult}
              aluminumPrice={aluminumPrice}
              productName={productInfo.productName}
              productCode={productInfo.productCode}
              productDiscount={productDiscount}
              moldDiscount={moldDiscount}
              onProductDiscountChange={setProductDiscount}
              onMoldDiscountChange={setMoldDiscount}
              moldFee={moldFee}
              compact
              onSave={handleSaveQuote}
              saveSuccess={saveSuccess}
              user={user}
              baseUnitPrice={baseUnitPrice}
              baseMoldFee={baseMoldFee}
              manualUnitPrice={manualUnitPrice}
              manualMoldFee={manualMoldFee}
              onManualUnitPriceChange={setManualUnitPrice}
              onManualMoldFeeChange={setManualMoldFee}
              minOrderQty={pricingResult?.min_order_qty || 0}
              manualMinOrderQty={manualMinOrderQty}
              onManualMinOrderQtyChange={setManualMinOrderQty}
              onExportPDF={exportQuotePDF}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Result Panel Component ====================

function ResultPanel({ pricingResult, aluminumPrice, productName, productCode, compact, productDiscount, moldDiscount, onProductDiscountChange, onMoldDiscountChange, moldFee, onSave, saveSuccess, user, baseUnitPrice, baseMoldFee, manualUnitPrice, manualMoldFee, onManualUnitPriceChange, onManualMoldFeeChange, minOrderQty, manualMinOrderQty, onManualMinOrderQtyChange, onExportPDF }: {
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
  saveSuccess?: boolean;
  user: any;
  baseUnitPrice: number;
  baseMoldFee: number;
  manualUnitPrice: number | null;
  manualMoldFee: number | null;
  onManualUnitPriceChange: (v: number | null) => void;
  onManualMoldFeeChange: (v: number | null) => void;
  minOrderQty: number;
  manualMinOrderQty: number | null;
  onManualMinOrderQtyChange: (v: number | null) => void;
  onExportPDF?: () => void;
}) {
  const isPlaceholder = !pricingResult;
  const p = pricingResult || {
    material_cost: 0, processing_cost: 0, surface_treatment_cost: 0,
    secondary_operations_cost: 0, packaging_cost: 0, transport_cost: 0,
    management_fee: 0, unit_price: 0, unit_price_ex_tax: 0, unit_price_in_tax: 0, total_price: 0, weight_per_piece_kg: 0,
    material_utilization_rate: undefined as number | undefined,
    breakdown: {} as Record<string, { formula: string; detail: string }>,
    aluminum_index: 0, notes: [] as string[], mold_cost: 0,
  };

  const hasProductDiscount = productDiscount !== 100;
  const hasMoldDiscount = moldDiscount !== 100 && moldFee > 0;
  const discountedUnit = p.unit_price * (productDiscount / 100);
  const discountedMold = moldFee * (moldDiscount / 100);
  const displayUnit = hasProductDiscount ? discountedUnit : p.unit_price;
  const qty = 1; // TODO: get from params if available

  const breakdownItems = [
    { label: '材料费', value: p.material_cost, key: 'material_cost' },
    { label: '加工费', value: p.secondary_operations_cost || 0, key: 'processing_cost' },
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
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wide">未税单价</span>
          </div>
          {!isPlaceholder && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-400">¥</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={manualUnitPrice ?? displayUnit}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0) onManualUnitPriceChange(v);
                }}
                className={`w-20 text-right border rounded px-1.5 py-0.5 focus:outline-none focus:border-emerald-400 ${compact ? 'text-sm' : 'text-base'} font-bold text-emerald-700 ${manualUnitPrice !== null ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-white/50'}`}
              />
              <span className={`text-sm ${isPlaceholder ? 'text-gray-300' : 'text-emerald-500'}`}>/件</span>
              {manualUnitPrice !== null && (
                <button onClick={() => onManualUnitPriceChange(null)} className="text-[10px] text-gray-400 hover:text-red-500 ml-0.5" title="恢复计算值">✕</button>
              )}
            </div>
          )}
        </div>
        {isPlaceholder && (
          <div className={`font-bold text-gray-300 ${compact ? 'text-2xl' : 'text-4xl'}`}>¥--</div>
        )}
        {hasProductDiscount && !isPlaceholder && (
          <div className="text-[11px] text-red-500 mt-0.5">
            基准 ¥{baseUnitPrice.toFixed(2)}{manualUnitPrice !== null ? ` → 手动 ¥${manualUnitPrice.toFixed(2)}` : ''} · {productDiscount > 100 ? `加价${productDiscount - 100}%` : `${productDiscount}%折`}
          </div>
        )}
        {!hasProductDiscount && manualUnitPrice !== null && !isPlaceholder && (
          <div className="text-[11px] text-amber-600 mt-0.5">
            手动调整：计算值 ¥{baseUnitPrice.toFixed(2)} → ¥{manualUnitPrice.toFixed(2)}
          </div>
        )}
        {/* 含税单价 */}
        {!isPlaceholder && p.unit_price_in_tax && p.unit_price_in_tax > 0 && (
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[10px] text-gray-400">含税单价</span>
            <span className="text-sm font-semibold text-gray-600">
              ¥{(manualUnitPrice
                ? manualUnitPrice * (p.unit_price_in_tax / (p.unit_price_ex_tax || p.unit_price || 1))
                : p.unit_price_in_tax
              ).toFixed(2)}/件
            </span>
            <span className="text-[10px] text-gray-300">（含13%增值税）</span>
          </div>
        )}
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-xs text-gray-500">总价</span>
          <span className={`font-bold ${isPlaceholder ? 'text-gray-300' : 'text-gray-800'} ${compact ? 'text-lg' : 'text-2xl'}`}>
            {isPlaceholder ? '¥--' : `¥${(displayUnit * ((p as any).quantity || 1)).toFixed(2)}`}
          </span>
        </div>
        {/* 模具费编辑 */}
        {baseMoldFee > 0 && !isPlaceholder && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">模具费(一次性)</span>
            <span className="text-[10px] text-gray-400">¥</span>
            <input
              type="number"
              step="1"
              min="0"
              value={manualMoldFee ?? moldFee}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) onManualMoldFeeChange(v);
              }}
              className={`w-20 text-right text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400 font-semibold text-blue-700 ${manualMoldFee !== null ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white/50'}`}
            />
            {hasMoldDiscount && (
              <span className="text-[10px] text-amber-600">→ 折后 ¥{discountedMold.toFixed(2)}（{moldDiscount}%）</span>
            )}
            {manualMoldFee !== null && (
              <button onClick={() => onManualMoldFeeChange(null)} className="text-[10px] text-gray-400 hover:text-red-500" title="恢复计算值">✕</button>
            )}
          </div>
        )}
        {/* 最小起订量 */}
        {!isPlaceholder && minOrderQty > 0 && (
          <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-emerald-200/40">
            <span className="text-[11px] text-gray-500">最小起订量</span>
            <input
              type="number"
              step="1"
              min="1"
              value={manualMinOrderQty ?? minOrderQty}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 1) onManualMinOrderQtyChange(v);
              }}
              className={`w-20 text-right text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400 font-semibold text-gray-700 ${manualMinOrderQty !== null ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white/50'}`}
            />
            <span className="text-[10px] text-gray-400">件</span>
            {manualMinOrderQty !== null && (
              <button onClick={() => onManualMinOrderQtyChange(null)} className="text-[10px] text-gray-400 hover:text-red-500" title="恢复计算值">✕</button>
            )}
          </div>
        )}
      </div>

      {/* 折扣调整区域 */}
      {!isPlaceholder && (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">折扣调整</span>
          </div>
          <div className="divide-y divide-gray-100">
            {/* 产品折扣 */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-gray-600">产品价调整</span>
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
                  className="w-14 text-xs text-right border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-gray-400 w-8">{productDiscount > 100 ? '加价' : '%折'}</span>
              </div>
            </div>
            {/* 模具费折扣 */}
            {moldFee > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-gray-600">模具费调整</span>
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
                    className="w-14 text-xs text-right border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-amber-400"
                  />
                  <span className="text-[10px] text-gray-400 w-8">{moldDiscount > 100 ? '加价' : '%折'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <button
            onClick={onExportPDF}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
          >
            <FileText className="w-4 h-4" /> 导出报价单
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
          {/* 模具费（一次性，独立显示） */}
          {moldFee > 0 && (
            <div className="flex justify-between items-center px-3 py-2 bg-blue-50/30">
              <span className="text-xs text-blue-600 font-medium">模具费（一次性）</span>
              <div className="text-right">
                <span className="text-sm font-semibold text-blue-700">
                  {hasMoldDiscount ? `¥${discountedMold.toFixed(2)}` : `¥${moldFee.toFixed(2)}`}
                </span>
                {hasMoldDiscount && (
                  <div className="text-[10px] text-gray-400 line-through">¥{moldFee.toFixed(2)}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t-2 border-dashed border-gray-200" />

        <div className="flex justify-between items-center px-3 py-2 bg-emerald-50/50">
          <span className="text-xs font-medium text-gray-600">单价合计</span>
          <span className={`text-base font-bold ${isPlaceholder ? 'text-gray-300' : 'text-emerald-600'}`}>
            {isPlaceholder ? '--' : `¥${displayUnit.toFixed(2)}`}
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

      {/* 备注 */}
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

      {isPlaceholder && (
        <div className="flex items-center justify-center py-3">
          <p className="text-xs text-gray-300">请填写参数，系统将自动计算报价</p>
        </div>
      )}
    </div>
  );
}

