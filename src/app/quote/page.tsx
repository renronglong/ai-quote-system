"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QuoteForm, { PricingResult } from '@/components/QuoteForm';
import {
  Sparkles,
  TrendingUp,
  Loader2,
  Factory,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Save,
  History,
  CheckCircle2,
  Percent,
  Store,
  FileText,
  User,
  LogOut,
  Settings,
  MessageCircle,
  X,
  ArrowLeft,
} from 'lucide-react';
import SavedQuotesPanel, { saveQuoteToAPI } from '@/components/SavedQuotesPanel';
import QuoteSheetDialog from '@/components/QuoteSheetDialog';
import TopNavLinks from '@/components/TopNav';
import ChatPanel from '@/components/ChatPanel';

interface AiFormUpdate {
  productType?: string;
  materialCategory?: string;
  materialGrade?: string;
  standardCategory?: string;
  quantity?: number;
  length?: number;
  width?: number;
  height?: number;
  wallThickness?: number;
  surfaceTreatment?: string;
  packaging?: string;
  secondaryProcessing?: string[];
}

interface AluminumPrice {
  price: number;
  change: number;
  changePercent: number;
}

// 内部管理/测试账号：可查看详细报价过程（费用明细、计算公式、铝锭价、折扣调整）
const INTERNAL_PHONES = ['13900139000', '18929979760'];
const INTERNAL_USER_IDS = ['98853002-61ba-485d-9672-6b4fa20906cd', 'd9e19564-5dfd-456b-b6d8-8068c84354e4'];
function isInternalUser(user: any): boolean {
  if (!user) return false;
  const phone = user.phone || user.user_metadata?.phone || '';
  const id = user.id || user.user_id || '';
  return INTERNAL_PHONES.includes(phone) || INTERNAL_USER_IDS.includes(id);
}

export default function QuotePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [aiFormData, setAiFormData] = useState<AiFormUpdate | null>(null);
  const [drawingRecogData, setDrawingRecogData] = useState<any>(null);
  const drawingRecogCounter = useRef(0);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [productInfo, setProductInfo] = useState<{ productName: string; productCode: string }>({ productName: '', productCode: '' });
  const [resultExpanded, setResultExpanded] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showExportLogin, setShowExportLogin] = useState(false); // 游客导出报价单时弹登录墙
  const [showSheetDialog, setShowSheetDialog] = useState(false); // Excel报价单出单弹窗
  const [currentParams, setCurrentParams] = useState<Record<string, any> | null>(null);
  const [productDiscount, setProductDiscount] = useState<number>(100); // 产品折扣，100=无折扣
  const [moldDiscount, setMoldDiscount] = useState<number>(100); // 模具费折扣，100=无折扣
  const [manualUnitPrice, setManualUnitPrice] = useState<number | null>(null); // 手动覆盖单价
  const [manualMoldFee, setManualMoldFee] = useState<number | null>(null); // 手动覆盖模具费
  const [manualMinOrderQty, setManualMinOrderQty] = useState<number | null>(null);
  const [useExistingMold, setUseExistingMoldState] = useState<boolean | null>(null); // 手动覆盖最小起订量
  const [editQuoteData, setEditQuoteData] = useState<Record<string, any> | null>(null);
  const [moldGroupId, setMoldGroupId] = useState<string>(() => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)); // 当前模具组ID：同组报价共用一副模具
  const [formNonce, setFormNonce] = useState(0); // 新建报价时重挂载 QuoteForm 清空表单
  const [guideCollapsed, setGuideCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [fromPartsList, setFromPartsList] = useState(false); // 从零件列表页跳过来
  const [partsListPartIdx, setPartsListPartIdx] = useState<number>(-1);
  const [partsListPartName, setPartsListPartName] = useState('');
  const aiDataCounter = useRef(0);
  const sectionParamRef = useRef<HTMLDivElement>(null);
  const sectionResultRef = useRef<HTMLDivElement>(null);

  // 从零件列表页跳转过来时，读取sessionStorage中的预填零件参数
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('from') === 'parts') {
        const idxStr = sessionStorage.getItem('ai_quote_selected_idx');
        const partRaw = sessionStorage.getItem('ai_quote_selected_part');
        if (idxStr != null && partRaw) {
          const idx = parseInt(idxStr, 10);
          const part = JSON.parse(partRaw);
          setFromPartsList(true);
          setPartsListPartIdx(idx);
          setPartsListPartName(part._partName || part.product_code || part.product_name || `零件${idx + 1}`);
          // 模拟handleDrawingData预填参数
          handleFormUpdate(part);
          // 设置productName/productCode
          if (part._partName) setProductInfo(prev => ({ ...prev, productName: part._partName }));
          if (part.product_code) setProductInfo(prev => ({ ...prev, productCode: part.product_code }));
          if (part.product_name) setProductInfo(prev => ({ ...prev, productName: part.product_name }));
        }
      }
    } catch (e) { console.error('Failed to load parts data:', e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFormUpdate = useCallback((data: AiFormUpdate) => {
    aiDataCounter.current += 1;
    setAiFormData({ ...data, _v: aiDataCounter.current } as AiFormUpdate);
  }, []);

  // 兼容QuoteForm内部Ctrl+V粘贴识别：直接把识别数据传给表单
  const handleDrawingData = useCallback((data: any) => {
    drawingRecogCounter.current += 1;
    setDrawingRecogData({ ...data, _v: drawingRecogCounter.current });
    const rd = data?.recogData || data;
    if (rd && typeof rd === 'object') {
      handleFormUpdate({ ...rd, _v: drawingRecogCounter.current } as AiFormUpdate);
    }
  }, [handleFormUpdate]);

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

  const handleMoldInfoChange = useCallback((info: { useExistingMold: boolean | null; selectedMoldId: string | null }) => {
    setUseExistingMoldState(info.useExistingMold);
  }, []);

  // Clear editQuoteData after QuoteForm consumes it
  useEffect(() => {
    if (editQuoteData) {
      const timer = setTimeout(() => setEditQuoteData(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [editQuoteData]);

  const handleEditQuote = useCallback((quote: any) => {
    setEditQuoteData(quote);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 长度＋：把当前长度/参数的报价存进报价池（归属当前模具组）
  const handleSaveVariant = useCallback(async (): Promise<boolean> => {
    if (!user) {
      router.push('/login?redirect=/quote');
      return false;
    }
    if (!pricingResult) {
      alert('请先填好截面和长度参数，出现报价结果后再点＋保存');
      return false;
    }
    const params = { ...(currentParams || {}) };
    const productType = params.product_type || productInfo.productName || '铝型材';
    if (productInfo.productName) params.productName = productInfo.productName;
    if (productInfo.productCode) params.productCode = productInfo.productCode;
    const len = params.length;
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
      // 模具费保留原值（每条单算都有）；出单时同组只取第一条，实现同副模具只收一次
      mold_cost: manualMoldFee ?? pricingResult.mold_cost ?? 0,
      min_order_qty: manualMinOrderQty ?? pricingResult.min_order_qty ?? 0,
    };
    const label = len ? `${productInfo.productName || productType} ${len}mm` : (productInfo.productName || productType);
    const saved = await saveQuoteToAPI(user.id, params, result, productType, productDiscount, moldDiscount, moldGroupId, label);
    return !!saved;
  }, [user, pricingResult, currentParams, productInfo, manualUnitPrice, manualMinOrderQty, productDiscount, moldDiscount, moldGroupId, router]);

  // 新建报价：开一副新模具（新模具组 + 清空表单）
  const handleNewQuote = useCallback(() => {
    setMoldGroupId('m' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    setPricingResult(null);
    setManualUnitPrice(null);
    setManualMoldFee(null);
    setManualMinOrderQty(null);
    setCurrentParams(null);
    setProductInfo({ productName: '', productCode: '' });
    setAiFormData(null);
    setDrawingRecogData(null);
    setDrawingKey(k => k + 1);
    setFormNonce(n => n + 1);
  }, []);

  // 保存报价 → 调用 API 存入数据库（游客先跳登录）
  const handleSaveQuote = async () => {
    if (saving || saveSuccess) return;
    if (!user) {
      router.push('/login?redirect=/quote');
      return;
    }
    if (!pricingResult) return;
    const params = { ...(currentParams || {}) };
    const productType = params.product_type || productInfo.productName || '产品';
    if (productInfo.productName) params.productName = productInfo.productName;
    if (productInfo.productCode) params.productCode = productInfo.productCode;
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
    setSaving(true);
    const saved = await saveQuoteToAPI(user.id, params, result, productType, productDiscount, moldDiscount, moldGroupId);
    setSaving(false);
    if (saved) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
      // 如果来自零件列表，标记该零件已报价并返回列表
      if (fromPartsList && partsListPartIdx >= 0) {
        try {
          sessionStorage.setItem('ai_quote_last_quoted_idx', String(partsListPartIdx));
          // 派发自定义事件通知同tab的零件列表页（如果是新tab打开会走storage事件）
          window.dispatchEvent(new Event('ai-quote-saved'));
          // 延迟跳转，让用户看到"保存成功"提示
          setTimeout(() => {
            router.push('/quote/parts');
          }, 1200);
        } catch (e) { console.error(e); }
      }
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
  const hideMoldFeeForUser = useExistingMold === true && !user?.is_admin;
  const hasAnyDiscount = hasProductDiscount || hasMoldDiscount;
  const hasManualUnitPrice = manualUnitPrice !== null;
  const hasManualMoldFee = manualMoldFee !== null;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-x-auto">
      {/* 顶部栏 */}
      <header className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-3 py-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Factory className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold text-gray-800"><span className="text-blue-600">碧利制造</span> <span className="text-slate-600">·</span> AI报价系统</span>
                <span className="hidden sm:inline text-xs text-slate-600">gyparts.cn <span className="text-[11px] text-blue-400">v2.1.3</span></span>
              </div>
            </Link>

            {/* 全站统一导航 */}
            <div className="flex items-center gap-1 flex-wrap">
              <TopNavLinks />
            </div>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {user && (
                <SavedQuotesPanel
                  userId={user.id}
                  user={user}
                  onEditQuote={handleEditQuote}
                  trigger={
                    <button className="hidden sm:flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">
                      <History className="w-3.5 h-3.5" />
                      已保存
                    </button>
                  }
                />
              )}
              <button onClick={() => router.push('/supplier')} className="hidden sm:flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                <Store className="w-3.5 h-3.5" />
                供应商
              </button>
              {aluminumPrice && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
                  <TrendingUp className="w-3 h-3 text-orange-500" />
                  <span className="text-xs text-slate-600">铝锭</span>
                  <span className="text-sm font-bold text-gray-800">¥{aluminumPrice.price.toLocaleString()}</span>
                  <span className={`text-xs font-medium ${aluminumPrice.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                  </span>
                </div>
              )}
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              ) : user ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push('/profile')} className="hidden sm:flex items-center gap-1 px-2 py-1 text-sm rounded-md bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors" title="公司资料">
                    <Settings className="w-3.5 h-3.5" />
                    <span className="max-w-[100px] truncate">{user.company_name || '公司资料'}</span>
                  </button>
                  <button onClick={() => signOut()} className="flex items-center gap-1 px-2 py-1 text-sm rounded-md border border-gray-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                    <LogOut className="w-3 h-3" />退出
                  </button>
                </div>
              ) : (
                <button onClick={() => router.push('/login?redirect=/quote')} className="px-2.5 py-1 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
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
          moldGroupId={moldGroupId}
          currentQuote={pricingResult && currentParams ? {
            params: { ...currentParams, ...(productInfo.productName ? { productName: productInfo.productName } : {}), ...(productInfo.productCode ? { productCode: productInfo.productCode } : {}) },
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
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">正式报价单需包含您的公司名称与联系方式，登录后可自动生成 PDF 并保存报价记录</p>
              <p className="text-sm text-blue-600 mt-2">注册即送 100 积分，还能用图纸 AI 识别自动填尺寸</p>
            </div>
            <div className="flex gap-3">
              <a href="/login?redirect=/quote" className="flex-1 text-center py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">去登录</a>
              <a href="/register?redirect=/quote" className="flex-1 text-center py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition">注册</a>
            </div>
            <button onClick={() => setShowExportLogin(false)} className="w-full text-center text-sm text-slate-600 hover:text-gray-600">取消</button>
          </div>
        </div>
      )}

      {/* 主内容区 - 两栏布局（参数 + 结果），图纸识别跳转至独立页面 */}
      <main className="flex-1 min-h-0 overflow-x-auto grid" style={{ gridTemplateColumns: guideCollapsed ? '280px minmax(700px, 780px) 360px' : '280px minmax(700px, 780px) 360px 300px', gap: '16px', padding: '16px', minWidth: guideCollapsed ? '1340px' : '1640px' }}>
        {/* 第一栏：快捷操作 */}
        <div className="space-y-3">
          {/* 从零件列表过来：显示返回入口 */}
          {fromPartsList ? (
            <Link href="/quote/parts" className="block rounded-xl border border-blue-200 bg-blue-50 p-4 hover:bg-blue-100 transition">
              <div className="flex items-center gap-2 text-blue-700 font-medium mb-1">
                <ArrowLeft size={16} /> 返回零件列表
              </div>
              <p className="text-xs text-blue-600">当前零件：{partsListPartName || `零件${partsListPartIdx + 1}`}</p>
              <p className="text-xs text-blue-500 mt-1">保存报价后将自动返回</p>
            </Link>
          ) : (
            <Link href="/quote/recognize" className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:shadow-md transition group">
              <div className="flex items-center gap-2 text-gray-800 font-medium mb-1">
                <Sparkles size={16} className="text-blue-600" /> 图纸AI识别
              </div>
              <p className="text-xs text-gray-500">上传STP/PDF/图片，AI自动识别尺寸参数并报价</p>
              <div className="mt-2 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition">去上传 →</div>
            </Link>
          )}

          {/* 手动报价提示 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-gray-800 font-medium mb-2">
              <FileText size={16} className="text-slate-500" /> 手动填单报价
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">在右侧直接填写产品参数、选择材质和表面处理，点击计算即可出报价。</p>
          </div>

          {/* 已有报价 */}
          <Link href="/history" className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 transition">
            <div className="flex items-center gap-2 text-gray-800 font-medium">
              <History size={16} className="text-slate-500" /> 我的报价
            </div>
          </Link>
        </div>

        {/* 第二栏：参数设置 */}
        <div ref={sectionParamRef} className="overflow-y-auto overflow-x-hidden min-w-0 bg-gray-50 rounded-xl border border-gray-200">
          <div className="p-4 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <QuoteForm
                key={formNonce}
                aiData={aiFormData}
                loadQuoteData={editQuoteData}
                onResult={handleResult}
                onProductInfoChange={handleProductInfoChange}
                onMoldInfoChange={handleMoldInfoChange}
                onSaveVariant={handleSaveVariant}
                onNewQuote={handleNewQuote}
                onCalculate={handleParamsUpdate}
                onDrawingData={handleDrawingData}
              />
            </div>
          </div>
        </div>

        {/* 中栏：报价结果 */}
        <div ref={sectionResultRef} className="overflow-y-auto overflow-x-hidden bg-gray-50 rounded-xl border border-gray-200">
          <div className="p-5">
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
                saving={saving}
                saveSuccess={saveSuccess}
                user={user}
                baseUnitPrice={baseUnitPrice}
                baseMoldFee={baseMoldFee}
                useExistingMold={useExistingMold}
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
          </div>

        {/* 右栏：报价指南 */}
        {!guideCollapsed && (
          <div className="overflow-y-auto overflow-x-hidden bg-gray-50 rounded-xl border border-gray-200">
            <div className="p-4">
                {/* 标题行 */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="text-base font-bold text-gray-700">💡 报价指南</span>
                  <button
                    onClick={() => setGuideCollapsed(true)}
                    className="text-sm text-slate-600 hover:text-gray-600 transition-colors"
                    title="收起指南"
                  >
                    收起 ✕
                  </button>
                </div>

                {/* 步骤进度条 */}
                <div className="p-4 space-y-0">
                  {/* 步骤1: AI识别（跳转独立页） */}
                  <Link href="/quote/recognize" className="flex items-start gap-3 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-blue-50/50 transition-colors">
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="w-0.5 h-7 bg-blue-200 mt-1" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-blue-700">图纸AI识别</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">点击跳转上传STP/PDF/图片自动识别；也可直接手动填写</p>
                    </div>
                  </Link>

                  {/* 步骤2: 核对参数 */}
                  <div className="flex items-start gap-3 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-blue-50/50 transition-colors" onClick={() => scrollToSection(sectionParamRef)}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${pricingResult !== null ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                        {pricingResult !== null ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <span className="text-sm font-bold text-blue-600">1</span>
                        )}
                      </div>
                      <div className={`w-0.5 h-7 mt-1 ${pricingResult !== null ? 'bg-emerald-200' : 'bg-gray-200'}`} />
                    </div>
                    <div className={`pt-0.5 rounded-lg px-2 py-1 -ml-2 ${pricingResult !== null ? '' : 'bg-blue-50'}`}>
                      <p className={`text-sm font-medium ${pricingResult !== null ? 'text-emerald-700' : 'text-blue-700'}`}>核对参数</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">选择产品类型和材质，填写截面尺寸和长度数量</p>
                    </div>
                  </div>

                  {/* 步骤3: 匹配模具 */}
                  <div className="flex items-start gap-3 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-blue-50/50 transition-colors" onClick={() => scrollToSection(sectionParamRef)}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${pricingResult !== null ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        {pricingResult !== null ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <span className="text-sm font-bold text-slate-600">2</span>
                        )}
                      </div>
                      <div className={`w-0.5 h-7 mt-1 ${pricingResult !== null ? 'bg-emerald-200' : 'bg-gray-200'}`} />
                    </div>
                    <div className="pt-0.5">
                      <p className={`text-sm font-medium ${pricingResult !== null ? 'text-emerald-700' : 'text-slate-600'}`}>匹配模具</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">选平模/分流模，填宽高周长，搜索现有模具可免开模费</p>
                    </div>
                  </div>

                  {/* 步骤4: 选择工艺 */}
                  <div className="flex items-start gap-3 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-blue-50/50 transition-colors" onClick={() => scrollToSection(sectionParamRef)}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${pricingResult !== null ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        {pricingResult !== null ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <span className="text-sm font-bold text-slate-600">3</span>
                        )}
                      </div>
                      <div className={`w-0.5 h-7 mt-1 ${pricingResult !== null ? 'bg-emerald-200' : 'bg-gray-200'}`} />
                    </div>
                    <div className="pt-0.5">
                      <p className={`text-sm font-medium ${pricingResult !== null ? 'text-emerald-700' : 'text-slate-600'}`}>选择工艺</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">勾选加工与表面处理，表面处理直接影响单价，出价前请回查</p>
                    </div>
                  </div>

                  {/* 步骤4: 出价导出 */}
                  <div className="flex items-start gap-3 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 hover:bg-blue-50/50 transition-colors" onClick={() => scrollToSection(sectionResultRef)}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${pricingResult !== null ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        {pricingResult !== null ? (
                          <span className="text-sm font-bold text-blue-600">4</span>
                        ) : (
                          <span className="text-sm font-bold text-slate-600">4</span>
                        )}
                      </div>
                    </div>
                    <div className={`pt-0.5 rounded-lg px-2 py-1 -ml-2 ${pricingResult !== null ? 'bg-blue-50' : ''}`}>
                      <p className={`text-sm font-medium ${pricingResult !== null ? 'text-blue-700' : 'text-slate-600'}`}>出价导出</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">核对含税/未税单价，导出Excel与PDF报价单</p>
                    </div>
                  </div>
                </div>

                {/* 底部快捷提示 */}
                <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-slate-600">快捷提示</p>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      <span className="text-xs text-slate-600">同一模具多个长度：点「＋」存入报价池，出单时模具费只算一次</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span className="text-xs text-slate-600">模具费为一次性费用，不计入单件价格</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-orange-400 mt-1.5 shrink-0" />
                      <span className="text-xs text-slate-600">最小起订量按300kg折算，未达标时页面会提示</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                      <span className="text-xs text-slate-600">材料费随南海现货铝锭价每日同步，以出单当日为准</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                      <span className="text-xs text-slate-600">注册赠送100积分，免注册也可试算</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                      <span className="text-xs text-slate-600">报价单自出具之日起15天内有效</span>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        )}

        {/* 折叠时的展开按钮 - 固定在右栏位置 */}
        {guideCollapsed && (
          <div className="fixed right-0 top-1/2 -translate-y-1/2 z-10">
            <button
              onClick={() => setGuideCollapsed(false)}
              className="bg-white border border-gray-200 rounded-l-lg px-1.5 py-3 shadow-sm hover:bg-gray-50 transition-colors"
              title="展开报价指南"
            >
              <span className="text-sm text-slate-600">💡</span>
            </button>
          </div>
        )}
      </main>

      {/* 移动端底部结果区 */}
      <div className="hidden shrink-0 border-t border-gray-200 bg-white">
        <button
          onClick={() => setResultExpanded(!resultExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100"
        >
          <span className="text-base font-bold text-gray-700">
            {pricingResult ? `¥${fmtPrice(finalUnit)}/件` : '报价结果'}
          </span>
          {resultExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronUp className="w-4 h-4 text-slate-600" />}
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
              saving={saving}
              saveSuccess={saveSuccess}
              user={user}
              baseUnitPrice={baseUnitPrice}
              baseMoldFee={baseMoldFee}
              useExistingMold={useExistingMold}
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

      {/* ===== 浮动智能客服按钮 + 聊天面板 ===== */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* 聊天面板 */}
        {chatOpen && (
          <div className="absolute bottom-16 right-0 w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
            <ChatPanel
              onFormUpdate={handleFormUpdate}
              onPricingResult={(result) => handleResult(result as any)}
            />
          </div>
        )}

        {/* 浮动按钮 */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 ${
            chatOpen
              ? 'bg-gray-700 hover:bg-gray-800'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
          }`}
          title={chatOpen ? '关闭客服' : '智能客服'}
        >
          {chatOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <MessageCircle className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

// ==================== Result Panel Component ====================

// 三位有效数字取整，用于前端价格显示
function fmtPrice(n: number): string {
  if (n === 0 || !isFinite(n)) return n === 0 ? '0.00' : String(n);
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const factor = Math.pow(10, 3 - d);
  const rounded = Math.round(n * factor) / factor;
  return rounded.toFixed(2);
}


function ResultPanel({ pricingResult, aluminumPrice, productName, productCode, compact, productDiscount, moldDiscount, onProductDiscountChange, onMoldDiscountChange, moldFee, onSave, saving, saveSuccess, user, baseUnitPrice, baseMoldFee, useExistingMold, manualUnitPrice, manualMoldFee, onManualUnitPriceChange, onManualMoldFeeChange, minOrderQty, manualMinOrderQty, onManualMinOrderQtyChange, onExportPDF }: {
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
}) {
  const isPlaceholder = !pricingResult;
  const internal = isInternalUser(user);
  const p = pricingResult || {
    material_cost: 0, processing_cost: 0, surface_treatment_cost: 0,
    secondary_operations_cost: 0, packaging_cost: 0, transport_cost: 0,
    management_fee: 0, unit_price: 0, unit_price_ex_tax: 0, unit_price_in_tax: 0, total_price: 0, weight_per_piece_kg: 0,
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
      {!isPlaceholder && onSave && (
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

