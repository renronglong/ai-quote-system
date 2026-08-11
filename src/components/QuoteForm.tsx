'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Calculator, ChevronDown, Search, Loader2, Package, CheckCircle, Sparkles } from 'lucide-react';

interface QuoteFormData {
  productType: string;
  materialCategory: string;
  materialGrade: string;
  quantity: number;
  length: number;
  width: number;
  height: number;
  surfaceTreatment: string;
  packaging: string;
  secondaryProcessing: string[];
}

/** AI 同步到表单的数据（所有字段可选） */
export interface AiFormUpdate {
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

interface QuoteFormProps {
  onCalculate?: (data: QuoteFormData) => void;
  /** 从 ChatPanel 传入的 AI 识别参数 */
  aiData?: AiFormUpdate | null;
  /** 从 Bot 回复中解析的报价明细 */
  pricingResult?: {
    unitWeight: number;
    materialCost: number;
    processingCost: number;
    surfaceCost: number;
    packagingCost: number;
    shippingCost: number;
    managementFee: number;
    unitPrice: number;
  } | null;
}

interface SimilarProduct {
  id: number;
  product_code: string;
  name: string;
  material: string;
  process: string;
  surface_treatment: string;
  cost_price: string;
  min_price?: string;
  specs: Record<string, unknown>;
  supplier: string;
  similarity: number;
}

const secondaryOptions = ['CNC精加工', '钻孔', '攻丝', '折弯', '焊接', '切割', '冲压'];

// 产品类型到 API product_type 的映射
const PRODUCT_TYPE_API_MAP: Record<string, string> = {
  '挤压铝型材': 'extrusion',
  '铝板/铝平板': 'sheet_metal',
  '压铸铝件': 'die_casting',
  'CNC加工件': 'die_casting',
  '冲压件': 'sheet_metal',
};

// 产品类型到产品库 material/process 的映射（用于搜索相似产品）
const PRODUCT_TYPE_SEARCH_MAP: Record<string, { material: string; process: string }> = {
  '挤压铝型材': { material: '铝', process: '挤压' },
  '铝板/铝平板': { material: '铝', process: '冲压' },
  '压铸铝件': { material: '铝', process: '压铸' },
  'CNC加工件': { material: '', process: 'CNC' },
  '冲压件': { material: '', process: '冲压' },
};

export default function QuoteForm({ onCalculate, aiData, pricingResult: pricingResultProp }: QuoteFormProps) {
  const [aiSynced, setAiSynced] = useState(false);
  const prevAiDataRef = useRef<AiFormUpdate | null | undefined>(null);

  const [formData, setFormData] = useState<QuoteFormData>({
    productType: '挤压铝型材',
    materialCategory: '铝合金',
    materialGrade: '6063-T5',
    quantity: 1,
    length: 100,
    width: 50,
    height: 20,
    surfaceTreatment: '无',
    packaging: '标准包装',
    secondaryProcessing: [],
  });

  const [pricingResult, setPricingResult] = useState<{
    unitWeight: number;
    materialCost: number;
    processingCost: number;
    surfaceCost: number;
    packagingCost: number;
    shippingCost: number;
    managementFee: number;
    unitPrice: number;
  } | null>(null);

  // 相似产品搜索
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SimilarProduct | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 计算状态
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  // 监听 Bot 返回的报价明细，自动更新报价结果
  useEffect(() => {
    if (pricingResultProp) {
      setPricingResult(pricingResultProp);
    }
  }, [pricingResultProp]);

  // 监听 AI 识别参数，自动填入表单
  useEffect(() => {
    if (!aiData || aiData === prevAiDataRef.current) return;
    prevAiDataRef.current = aiData;

    setFormData(prev => {
      const next = { ...prev };
      if (aiData.productType) next.productType = aiData.productType;
      if (aiData.materialCategory) next.materialCategory = aiData.materialCategory;
      if (aiData.materialGrade) next.materialGrade = aiData.materialGrade;
      if (aiData.quantity != null && aiData.quantity > 0) next.quantity = aiData.quantity;
      if (aiData.length != null && aiData.length > 0) next.length = aiData.length;
      if (aiData.width != null && aiData.width > 0) next.width = aiData.width;
      if (aiData.height != null && aiData.height > 0) next.height = aiData.height;
      if (aiData.surfaceTreatment) {
        const st = aiData.surfaceTreatment;
        const stMap: Record<string, string> = {
          '氧化': '阳极氧化-自然色', '阳极氧化': '阳极氧化-自然色',
          '氧化本色': '阳极氧化-自然色', '自然色': '阳极氧化-自然色',
          '氧化黑色': '阳极氧化-黑色', '黑色氧化': '阳极氧化-黑色',
          '喷涂': '粉末喷涂', '喷塑': '粉末喷涂',
          '电泳': '电泳', '电镀': '电镀', '拉丝': '拉丝', '抛光': '抛光',
          '无': '无',
        };
        next.surfaceTreatment = stMap[st] || st;
      }
      if (aiData.packaging) next.packaging = aiData.packaging;
      if (aiData.secondaryProcessing && aiData.secondaryProcessing.length > 0) {
        next.secondaryProcessing = aiData.secondaryProcessing;
      }
      return next;
    });

    setAiSynced(true);
    const timer = setTimeout(() => setAiSynced(false), 2000);
    return () => clearTimeout(timer);
  }, [aiData]);

  // 防抖搜索相近产品：当关键参数变化时自动搜索
  useEffect(() => {
    const hasDim = formData.width > 0 || formData.height > 0;
    if (!hasDim) {
      setSimilarProducts([]);
      return;
    }

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const searchMap = PRODUCT_TYPE_SEARCH_MAP[formData.productType] || { material: '', process: '' };
        const params = new URLSearchParams();
        if (formData.width > 0) params.set('width', String(formData.width));
        if (formData.height > 0) params.set('height', String(formData.height));
        if (formData.length > 0) params.set('length', String(formData.length));
        if (searchMap.material) params.set('material', searchMap.material);
        if (searchMap.process) params.set('process', searchMap.process);
        params.set('limit', '5');

        const res = await fetch(`/api/products/similar?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setSimilarProducts(json.data || []);
        }
      } catch (err) {
        console.error('搜索相近产品失败:', err);
      } finally {
        setSearchingProducts(false);
      }
    }, 800); // 800ms 防抖

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [formData.width, formData.height, formData.length, formData.productType]);

  const updateField = (key: keyof QuoteFormData, value: string | number | string[]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    // 用户手动修改参数时清除已选产品
    if (['width', 'height', 'length', 'productType'].includes(key)) {
      setSelectedProduct(null);
    }
  };

  const toggleSecondary = (item: string) => {
    setFormData(prev => ({
      ...prev,
      secondaryProcessing: prev.secondaryProcessing.includes(item)
        ? prev.secondaryProcessing.filter(s => s !== item)
        : [...prev.secondaryProcessing, item],
    }));
  };

  // 选择相似产品 → 自动填充参数
  const handleSelectProduct = useCallback((product: SimilarProduct) => {
    setSelectedProduct(product);
    const s = product.specs || {};
    setFormData(prev => {
      const next = { ...prev };
      // 填充尺寸
      if (s.width) next.width = Number(s.width);
      if (s.height) next.height = Number(s.height);
      if (s.length) next.length = Number(s.length);
      if (s.wall_thickness) {
        // wall_thickness 没有对应的 formData 字段，但可以用于计算
      }
      // 填充材料
      if (product.material) {
        if (/铝/.test(product.material)) next.materialCategory = '铝合金';
        else if (/不锈钢/.test(product.material)) next.materialCategory = '不锈钢';
        else if (/冷/.test(product.material)) next.materialCategory = '冷轧板';
      }
      if (product.surface_treatment) {
        const st = product.surface_treatment;
        if (/氧化/.test(st) && /黑/.test(st)) next.surfaceTreatment = '阳极氧化-黑色';
        else if (/氧化/.test(st)) next.surfaceTreatment = '阳极氧化-自然色';
        else if (/喷涂|喷粉/.test(st)) next.surfaceTreatment = '粉末喷涂';
        else if (/电泳/.test(st)) next.surfaceTreatment = '电泳';
        else if (/电镀/.test(st)) next.surfaceTreatment = '电镀';
        else if (/拉丝/.test(st)) next.surfaceTreatment = '拉丝';
        else if (/抛光/.test(st)) next.surfaceTreatment = '抛光';
      }
      return next;
    });
  }, []);

  const handleCalculate = async () => {
    setCalculating(true);
    setCalcError(null);

    try {
      const apiProductType = PRODUCT_TYPE_API_MAP[formData.productType] || 'extrusion';

      // 构建请求体
      const requestBody: Record<string, unknown> = {
        product_type: apiProductType,
        material: {
          category: formData.materialCategory,
          grade: formData.materialGrade,
        },
        dimensions: {
          length_mm: formData.length,
          width_mm: formData.width,
          height_mm: formData.height,
        },
        quantity: formData.quantity,
      };

      // 表面处理
      if (formData.surfaceTreatment && formData.surfaceTreatment !== '无') {
        requestBody.surface_treatment = {
          type: formData.surfaceTreatment,
        };
      }

      // 二次加工
      if (formData.secondaryProcessing.length > 0) {
        requestBody.process = {
          secondary_operations: formData.secondaryProcessing,
        };
      }

      const res = await fetch('/api/v1/quote/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await res.json();

      if (result.success) {
        setPricingResult({
          unitWeight: result.weight_per_piece_kg || 0,
          materialCost: result.material_cost || 0,
          processingCost: result.processing_cost || 0,
          surfaceCost: result.surface_treatment_cost || 0,
          packagingCost: result.packaging_cost || 0,
          shippingCost: result.transport_cost || 0,
          managementFee: result.management_fee || 0,
          unitPrice: result.unit_price || 0,
        });
        if (onCalculate) onCalculate(formData);
      } else {
        setCalcError(result.error || '计算失败');
      }
    } catch (err) {
      console.error('报价计算失败:', err);
      setCalcError('网络错误，请重试');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 表单区域 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800 text-base">报价计算器</h3>
          </div>
          {aiSynced && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium animate-pulse">
              <Sparkles className="w-3 h-3" />
              AI 已填入
            </div>
          )}
        </div>

        {/* 产品类型 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">产品类型</label>
          <div className="relative">
            <select
              value={formData.productType}
              onChange={e => updateField('productType', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
            >
              <option>挤压铝型材</option>
              <option>铝板/铝平板</option>
              <option>压铸铝件</option>
              <option>CNC加工件</option>
              <option>冲压件</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 材料类别 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">材料类别</label>
          <div className="relative">
            <select
              value={formData.materialCategory}
              onChange={e => updateField('materialCategory', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
            >
              <option>铝合金</option>
              <option>不锈钢</option>
              <option>碳钢</option>
              <option>铜合金</option>
              <option>锌合金</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 材料牌号 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">材料牌号</label>
          <div className="relative">
            <select
              value={formData.materialGrade}
              onChange={e => updateField('materialGrade', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
            >
              <option>6063-T5</option>
              <option>6061-T6</option>
              <option>6063-T6</option>
              <option>6061-T4</option>
              <option>5052-H32</option>
              <option>304不锈钢</option>
              <option>316L不锈钢</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 数量 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">数量（件）</label>
          <input
            type="number"
            min={1}
            value={formData.quantity}
            onChange={e => updateField('quantity', parseInt(e.target.value) || 1)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
          />
        </div>

        {/* 尺寸 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">尺寸（mm）</label>
          <div className="grid grid-cols-3 gap-2">
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">长</span>
              <input
                type="number"
                value={formData.length}
                onChange={e => updateField('length', parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 pl-7 pr-2 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              />
            </div>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">宽</span>
              <input
                type="number"
                value={formData.width}
                onChange={e => updateField('width', parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 pl-7 pr-2 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              />
            </div>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">高</span>
              <input
                type="number"
                value={formData.height}
                onChange={e => updateField('height', parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-200 pl-7 pr-2 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 相近规格产品推荐 */}
        {(searchingProducts || similarProducts.length > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">
                {searchingProducts ? '搜索相近规格中...' : `找到 ${similarProducts.length} 个相近规格产品`}
              </span>
              {searchingProducts && <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />}
            </div>
            {!searchingProducts && similarProducts.length > 0 && (
              <div className="space-y-1.5">
                {similarProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className={`w-full text-left px-2.5 py-2 rounded-md border text-xs transition-all ${
                      selectedProduct?.id === p.id
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                        : 'border-amber-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {selectedProduct?.id === p.id && <CheckCircle className="w-3 h-3 text-blue-500" />}
                        <Package className="w-3 h-3 text-gray-400" />
                        <span className="font-medium text-gray-700">{p.product_code}</span>
                      </div>
                      <span className="text-[10px] text-amber-600 font-medium">匹配 {p.similarity}%</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 ml-[18px]">
                      {p.name}
                      {p.specs.width && p.specs.height && (
                        <span> · {String(p.specs.width)}×{String(p.specs.height)}mm</span>
                      )}
                      {p.cost_price && <span> · ¥{Number(p.cost_price).toFixed(2)}/kg</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 表面处理 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">表面处理</label>
          <div className="relative">
            <select
              value={formData.surfaceTreatment}
              onChange={e => updateField('surfaceTreatment', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
            >
              <option>无</option>
              <option>阳极氧化-自然色</option>
              <option>阳极氧化-黑色</option>
              <option>粉末喷涂</option>
              <option>电泳</option>
              <option>电镀</option>
              <option>拉丝</option>
              <option>抛光</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 包装方式 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">包装方式</label>
          <div className="relative">
            <select
              value={formData.packaging}
              onChange={e => updateField('packaging', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
            >
              <option>标准包装</option>
              <option>气泡膜包装</option>
              <option>纸箱包装</option>
              <option>木箱包装</option>
              <option>托盘包装</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 二次加工 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">二次加工（可多选）</label>
          <div className="flex flex-wrap gap-2">
            {secondaryOptions.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => toggleSecondary(item)}
                className={`px-2.5 py-1.5 text-xs rounded-md border transition-all ${
                  formData.secondaryProcessing.includes(item)
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* 计算按钮 */}
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {calculating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              计算中...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4" />
              计算报价
            </>
          )}
        </button>

        {/* 计算错误 */}
        {calcError && (
          <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
            {calcError}
          </div>
        )}

        {/* 报价结果 */}
        {pricingResult && (
          <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 space-y-2">
            <h4 className="text-sm font-bold text-emerald-700">报价结果</h4>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span className="text-gray-500">单件重量</span>
              <span className="text-right font-medium text-gray-800">{pricingResult.unitWeight.toFixed(3)} kg</span>
              <span className="text-gray-500">材料费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.materialCost}</span>
              <span className="text-gray-500">加工费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.processingCost}</span>
              <span className="text-gray-500">表面处理费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.surfaceCost}</span>
              <span className="text-gray-500">包装费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.packagingCost}</span>
              <span className="text-gray-500">运费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.shippingCost}</span>
              <span className="text-gray-500">管理费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.managementFee}</span>
            </div>
            <div className="pt-2 border-t border-emerald-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">单价</span>
                <span className="text-lg font-bold text-emerald-600">¥{pricingResult.unitPrice}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
