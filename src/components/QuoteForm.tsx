'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Calculator, ChevronDown, Loader2, Sparkles, Search, Package, X } from 'lucide-react';

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
  aiData?: AiFormUpdate | null;
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

interface SearchResult {
  id: number;
  product_code: string;
  name: string;
  material: string;
  process: string;
  surface_treatment: string;
  oxidation_color?: string;
  cost_price: string;
  min_price?: string;
  specs: Record<string, unknown>;
  supplier: string;
  similarity?: number;
}

const secondaryOptions = ['CNC精加工', '钻孔', '攻丝', '折弯', '焊接', '切割', '冲压'];

const PRODUCT_TYPE_API_MAP: Record<string, string> = {
  '挤压铝型材': 'extrusion',
  '铝板/铝平板': 'sheet_metal',
  '压铸铝件': 'die_casting',
  'CNC加工件': 'die_casting',
  '冲压件': 'sheet_metal',
};

// 产品库 process 到表单 productType 的映射
const PROCESS_TO_PRODUCT_TYPE: Record<string, string> = {
  '铝挤压': '挤压铝型材',
  '挤压': '挤压铝型材',
  '冲压': '冲压件',
  '铝压铸': '压铸铝件',
  '压铸': '压铸铝件',
  '注塑': 'CNC加工件',
  'CNC加工': 'CNC加工件',
  '车加工': 'CNC加工件',
};

// 产品库 material 到表单 materialCategory 的映射
const MATERIAL_TO_CATEGORY: Record<string, string> = {
  '铝型材': '铝合金',
  '铝合金': '铝合金',
  '冷轧板': '碳钢',
  '不锈钢': '不锈钢',
  '压铸铝': '铝合金',
  '塑胶': '铝合金',
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

  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  // 产品搜索相关
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 监听 Bot 返回的报价明细
  useEffect(() => {
    if (pricingResultProp) setPricingResult(pricingResultProp);
  }, [pricingResultProp]);

  // 监听 AI 参数同步
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
          '电泳': '电泳', '电镀': '电镀', '拉丝': '拉丝', '抛光': '抛光', '无': '无',
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

  // 搜索产品（防抖）
  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=8`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data || []);
        setShowResults(true);
      }
    } catch (err) {
      console.error('搜索产品失败:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(value), 400);
  };

  // 选择产品 → 填充表单
  const handleSelectProduct = (product: SearchResult) => {
    const s = product.specs || {};
    setFormData(prev => {
      const next = { ...prev };
      // 产品类型
      if (product.process) {
        const mapped = PROCESS_TO_PRODUCT_TYPE[product.process];
        if (mapped) next.productType = mapped;
      }
      // 材料
      if (product.material) {
        const cat = MATERIAL_TO_CATEGORY[product.material];
        if (cat) next.materialCategory = cat;
      }
      // 尺寸
      if (s.width) next.width = Number(s.width);
      if (s.height) next.height = Number(s.height);
      if (s.length) next.length = Number(s.length);
      // 表面处理
      if (product.surface_treatment) {
        const st = product.surface_treatment;
        if (/氧化/.test(st) && /黑/.test(st)) next.surfaceTreatment = '阳极氧化-黑色';
        else if (/氧化/.test(st)) next.surfaceTreatment = '阳极氧化-自然色';
        else if (/喷涂|喷粉/.test(st)) next.surfaceTreatment = '粉末喷涂';
        else if (/电泳/.test(st)) next.surfaceTreatment = '电泳';
        else if (/电镀/.test(st)) next.surfaceTreatment = '电镀';
        else if (/拉丝/.test(st)) next.surfaceTreatment = '拉丝';
        else if (/抛光/.test(st)) next.surfaceTreatment = '抛光';
        else next.surfaceTreatment = st;
      }
      return next;
    });
    setSearchQuery(product.product_code);
    setShowResults(false);
  };

  const updateField = (key: keyof QuoteFormData, value: string | number | string[]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleSecondary = (item: string) => {
    setFormData(prev => ({
      ...prev,
      secondaryProcessing: prev.secondaryProcessing.includes(item)
        ? prev.secondaryProcessing.filter(s => s !== item)
        : [...prev.secondaryProcessing, item],
    }));
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setCalcError(null);
    try {
      const apiProductType = PRODUCT_TYPE_API_MAP[formData.productType] || 'extrusion';
      const requestBody: Record<string, unknown> = {
        product_type: apiProductType,
        material: { category: formData.materialCategory, grade: formData.materialGrade },
        dimensions: { length_mm: formData.length, width_mm: formData.width, height_mm: formData.height },
        quantity: formData.quantity,
      };
      if (formData.surfaceTreatment && formData.surfaceTreatment !== '无') {
        requestBody.surface_treatment = { type: formData.surfaceTreatment };
      }
      if (formData.secondaryProcessing.length > 0) {
        requestBody.process = { secondary_operations: formData.secondaryProcessing };
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

        {/* 产品搜索 */}
        <div ref={searchBoxRef} className="relative">
          <label className="block text-xs font-medium text-gray-500 mb-1">搜索现有产品</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
              placeholder="输入产品编号或名称..."
              className="w-full rounded-lg border border-gray-200 pl-9 pr-8 py-2 text-sm bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowResults(false); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* 搜索结果下拉 */}
          {showResults && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> 搜索中...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-400 text-center">未找到匹配产品</div>
              ) : (
                searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-sm font-medium text-gray-700">{p.product_code}</span>
                      <span className="text-xs text-gray-400 truncate">{p.name}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 ml-[22px]">
                      {p.material} · {p.process}
                      {p.specs && (p.specs as Record<string, unknown>).width && (
                        <span> · {String((p.specs as Record<string, unknown>).width)}×{String((p.specs as Record<string, unknown>).height)}mm</span>
                      )}
                    </div>
                  </button>
                ))
              )}
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

        {calcError && (
          <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
            {calcError}
          </div>
        )}

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
