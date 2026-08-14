import { useState, useEffect, useRef } from 'react';
import { Calculator, ChevronDown, Sparkles, Loader2 } from 'lucide-react';

// ==================== Types ====================

interface QuoteFormData {
  productType: string;
  materialCategory: string;
  quantity: number;
  width?: number;
  height?: number;
  length?: number;
  thickness?: number;
  productSize?: string;
  netWeight?: number;
  materialSurfaceTreatment: string;
  materialColor: string;
  processes: ProcessSelection[];
  productSurfaceTreatment: string;
  productColor: string;
}

interface ProcessSelection {
  name: string;
  quantity?: number;
}

interface PricingResult {
  unitWeight: number;
  materialCost: number;
  processingCost: number;
  surfaceCost: number;
  packagingCost: number;
  shippingCost: number;
  managementFee: number;
  unitPrice: number;
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
  pricingResult?: PricingResult | null;
}

// ==================== Configuration Data ====================

interface ProcessOption {
  name: string;
  unit?: string; // '次' | '分钟' | '米'
}

interface ProductSurfaceOption {
  name: string;
  colors?: string[];
}

interface MaterialCategoryConfig {
  label: string;
  fields: string[]; // 'width'|'height'|'length'|'thickness'|'productSize'|'quantity'|'netWeight'
  materialSurfaceTreatment?: string[];
  materialColorMap?: Record<string, string[]>; // surfaceTreatment -> colors
  processes: ProcessOption[];
  productSurfaceTreatmentMap?: Record<string, ProductSurfaceOption[]>; // materialSurfaceTreatment -> options
  productSurfaceTreatment?: ProductSurfaceOption[]; // for categories without material surface treatment
}

interface ProductTypeConfig {
  label: string;
  icon: string;
  materialCategories: Record<string, MaterialCategoryConfig>;
}

const ALL_COLORS_OXIDATION = ['本色', '红色', '黑色', '金色', '铁灰色'];

const PRODUCT_TYPES: Record<string, ProductTypeConfig> = {
  '挤出': {
    label: '挤出',
    icon: '⊞',
    materialCategories: {
      '铝型材': {
        label: '铝型材',
        fields: ['width', 'height', 'length', 'meterWeight', 'quantity', 'netWeight'],
        materialSurfaceTreatment: ['无', '喷砂氧化', '抛光氧化', '拉丝氧化', '喷涂'],
        materialColorMap: {
          '喷砂氧化': ['本色', '黑色', '铁灰色', '金色'],
        },
        processes: [
          { name: '无' },
          { name: '锯切' },
          { name: '冲压', unit: '次' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '车加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
        ],
        productSurfaceTreatmentMap: {
          '无': [
            { name: '无' },
            { name: '除油' },
            { name: '氧化', colors: ALL_COLORS_OXIDATION },
            { name: '喷砂氧化' },
            { name: '抛光氧化' },
            { name: '拉丝氧化' },
            { name: '喷涂' },
          ],
          '喷砂氧化': [
            { name: '除油' },
            { name: '氧化', colors: ALL_COLORS_OXIDATION },
            { name: '喷砂氧化' },
            { name: '抛光氧化' },
            { name: '拉丝氧化' },
            { name: '喷涂' },
          ],
          '抛光氧化': [
            { name: '氧化', colors: ALL_COLORS_OXIDATION },
            { name: '喷砂氧化' },
            { name: '抛光氧化' },
            { name: '拉丝氧化' },
            { name: '喷涂' },
          ],
          '拉丝氧化': [
            { name: '抛光氧化' },
            { name: '拉丝氧化' },
            { name: '喷涂' },
          ],
          '喷涂': [
            { name: '喷涂' },
          ],
        },
      },
    },
  },
  '板材': {
    label: '板材',
    icon: '▤',
    materialCategories: {
      '铝板': {
        label: '铝板',
        fields: ['thickness', 'productSize', 'quantity', 'netWeight'],
        processes: [
          { name: '无' },
          { name: '冲压', unit: '次' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
          { name: '激光切割', unit: '米' },
          { name: '折弯', unit: '次' },
        ],
        productSurfaceTreatment: [
          { name: '无' },
          { name: '除油' },
          { name: '氧化', colors: ALL_COLORS_OXIDATION },
          { name: '喷砂氧化' },
          { name: '抛光氧化' },
          { name: '拉丝氧化' },
          { name: '喷涂' },
        ],
      },
      '冷轧板': {
        label: '冷轧板',
        fields: ['thickness', 'productSize', 'quantity', 'netWeight'],
        processes: [
          { name: '无' },
          { name: '冲压', unit: '次' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
          { name: '激光切割', unit: '米' },
          { name: '折弯', unit: '次' },
          { name: '抛光' },
        ],
        productSurfaceTreatment: [
          { name: '无' },
          { name: '喷涂' },
          { name: '电镀' },
        ],
      },
      '不锈钢': {
        label: '不锈钢',
        fields: ['thickness', 'productSize', 'quantity', 'netWeight'],
        processes: [
          { name: '无' },
          { name: '冲压', unit: '次' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
          { name: '激光切割', unit: '米' },
          { name: '折弯', unit: '次' },
          { name: '抛光' },
        ],
        productSurfaceTreatment: [
          { name: '无' },
          { name: '喷涂' },
          { name: '电镀' },
        ],
      },
      '镀锌板': {
        label: '镀锌板',
        fields: ['thickness', 'productSize', 'quantity', 'netWeight'],
        processes: [
          { name: '无' },
          { name: '冲压', unit: '次' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
          { name: '激光切割', unit: '米' },
          { name: '折弯', unit: '次' },
          { name: '抛光' },
        ],
        productSurfaceTreatment: [
          { name: '无' },
          { name: '喷涂' },
          { name: '电镀' },
        ],
      },
    },
  },
  '压铸': {
    label: '压铸',
    icon: '◈',
    materialCategories: {
      '铝': {
        label: '铝',
        fields: ['quantity', 'netWeight', 'productSize'],
        processes: [
          { name: '无' },
          { name: '开合' },
          { name: '冲压', unit: '次' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
          { name: '抛光' },
          { name: '除披锋' },
        ],
        productSurfaceTreatment: [
          { name: '无' },
          { name: '喷涂' },
          { name: '电镀' },
        ],
      },
      '锌合金': {
        label: '锌合金',
        fields: ['quantity', 'netWeight', 'productSize'],
        processes: [
          { name: '无' },
          { name: '开合' },
          { name: '冲压', unit: '次' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
          { name: '抛光' },
          { name: '除披锋' },
        ],
        productSurfaceTreatment: [
          { name: '无' },
          { name: '喷涂' },
          { name: '电镀' },
        ],
      },
    },
  },
  '注塑': {
    label: '注塑',
    icon: '◉',
    materialCategories: {
      'ABS': { label: 'ABS', fields: ['quantity', 'netWeight', 'productSize'], processes: [{ name: '无' }, { name: '开合' }, { name: '除披锋' }, { name: '钻孔', unit: '次' }, { name: '攻牙', unit: '次' }] },
      'PP': { label: 'PP', fields: ['quantity', 'netWeight', 'productSize'], processes: [{ name: '无' }, { name: '开合' }, { name: '除披锋' }, { name: '钻孔', unit: '次' }, { name: '攻牙', unit: '次' }] },
      'PC': { label: 'PC', fields: ['quantity', 'netWeight', 'productSize'], processes: [{ name: '无' }, { name: '开合' }, { name: '除披锋' }, { name: '钻孔', unit: '次' }, { name: '攻牙', unit: '次' }] },
      'PA': { label: 'PA', fields: ['quantity', 'netWeight', 'productSize'], processes: [{ name: '无' }, { name: '开合' }, { name: '除披锋' }, { name: '钻孔', unit: '次' }, { name: '攻牙', unit: '次' }] },
      'POM': { label: 'POM', fields: ['quantity', 'netWeight', 'productSize'], processes: [{ name: '无' }, { name: '开合' }, { name: '除披锋' }, { name: '钻孔', unit: '次' }, { name: '攻牙', unit: '次' }] },
      'PMMA': { label: 'PMMA', fields: ['quantity', 'netWeight', 'productSize'], processes: [{ name: '无' }, { name: '开合' }, { name: '除披锋' }, { name: '钻孔', unit: '次' }, { name: '攻牙', unit: '次' }] },
    },
  },
};

// Field display labels
const FIELD_LABELS: Record<string, string> = {
  width: '截面宽度(mm)',
  height: '截面高度(mm)',
  length: '长度(mm)',
  thickness: '厚度(mm)',
  productSize: '产品尺寸(长×宽×高mm)',
  quantity: '数量',
  meterWeight: '米重(kg/m)',
  netWeight: '产品净重(kg)(选填)',
};

// ==================== Component ====================

export default function QuoteForm({ onCalculate, aiData, pricingResult: pricingResultProp }: QuoteFormProps) {
  const [aiSynced, setAiSynced] = useState(false);
  const prevAiDataRef = useRef<AiFormUpdate | null | undefined>(null);
  const [loading, setLoading] = useState(false);

  // Core form state
  const [productType, setProductType] = useState('挤出');
  const [materialCategory, setMaterialCategory] = useState('铝型材');
  const [fields, setFields] = useState<Record<string, number | string>>({
    width: 50, height: 20, length: 100, quantity: 1,
  });
  const [materialSurfaceTreatment, setMaterialSurfaceTreatment] = useState('无');
  const [materialColor, setMaterialColor] = useState('');
  const [processes, setProcesses] = useState<ProcessSelection[]>([]);
  const [productSurfaceTreatment, setProductSurfaceTreatment] = useState('无');
  const [productColor, setProductColor] = useState('');
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);

  // Get current config
  const productConfig = PRODUCT_TYPES[productType];
  const categoryConfig = productConfig?.materialCategories[materialCategory];

  // Reset material category when product type changes
  useEffect(() => {
    const config = PRODUCT_TYPES[productType];
    if (config) {
      const firstCat = Object.keys(config.materialCategories)[0];
      setMaterialCategory(firstCat);
      resetCategoryState(firstCat);
    }
  }, [productType]);

  // Reset dependent states when material category changes
  const resetCategoryState = (catKey: string) => {
    const cat = PRODUCT_TYPES[productType]?.materialCategories[catKey];
    if (!cat) return;

    // Reset fields
    const defaultFields: Record<string, number | string> = { quantity: 1 };
    if (cat.fields.includes('width')) defaultFields.width = 50;
    if (cat.fields.includes('height')) defaultFields.height = 20;
    if (cat.fields.includes('length')) defaultFields.length = 100;
    if (cat.fields.includes('thickness')) defaultFields.thickness = 2;
    if (cat.fields.includes('productSize')) defaultFields.productSize = '';
    if (cat.fields.includes('meterWeight')) defaultFields.meterWeight = '';
    if (cat.fields.includes('netWeight')) defaultFields.netWeight = '';
    setFields(defaultFields);

    // Reset material surface treatment
    if (cat.materialSurfaceTreatment) {
      setMaterialSurfaceTreatment('无');
      setMaterialColor('');
    } else {
      setMaterialSurfaceTreatment('');
      setMaterialColor('');
    }

    // Reset processes
    setProcesses([]);

    // Reset product surface treatment
    setProductSurfaceTreatment('');
    setProductColor('');

    // Set defaults for product surface treatment
    if (cat.productSurfaceTreatment && cat.productSurfaceTreatment.length > 0) {
      setProductSurfaceTreatment(cat.productSurfaceTreatment[0].name);
    } else if (cat.productSurfaceTreatmentMap) {
      const mst = cat.materialSurfaceTreatment ? '无' : '';
      const opts = cat.productSurfaceTreatmentMap[mst];
      if (opts && opts.length > 0) {
        setProductSurfaceTreatment(opts[0].name);
      }
    }
  };

  // Get available product surface treatments based on material surface treatment
  const getProductSurfaceOptions = (): ProductSurfaceOption[] => {
    if (!categoryConfig) return [];
    if (productType === '注塑') return [];
    if (categoryConfig.productSurfaceTreatmentMap) {
      return categoryConfig.productSurfaceTreatmentMap[materialSurfaceTreatment] || [];
    }
    if (categoryConfig.productSurfaceTreatment) {
      return categoryConfig.productSurfaceTreatment;
    }
    return [];
  };

  // Get material colors based on surface treatment
  const getMaterialColorOptions = (): string[] => {
    if (!categoryConfig?.materialColorMap) return [];
    return categoryConfig.materialColorMap[materialSurfaceTreatment] || [];
  };

  // Get product color options
  const getProductColorOptions = (): string[] => {
    const opts = getProductSurfaceOptions();
    const selected = opts.find(o => o.name === productSurfaceTreatment);
    return selected?.colors || [];
  };

  // Handle product type change
  const handleProductTypeChange = (pt: string) => {
    setProductType(pt);
  };

  // Handle material category change
  const handleMaterialCategoryChange = (mc: string) => {
    setMaterialCategory(mc);
    resetCategoryState(mc);
  };

  // Toggle process
  const toggleProcess = (procName: string) => {
    if (procName === '无') {
      setProcesses([]);
      return;
    }
    setProcesses(prev => {
      const exists = prev.find(p => p.name === procName);
      if (exists) {
        return prev.filter(p => p.name !== procName);
      }
      return [...prev, { name: procName }];
    });
  };

  // Update process quantity
  const updateProcessQuantity = (procName: string, qty: number) => {
    setProcesses(prev => prev.map(p => p.name === procName ? { ...p, quantity: qty } : p));
  };

  // Handle product surface treatment change
  const handleProductSurfaceChange = (val: string) => {
    setProductSurfaceTreatment(val);
    setProductColor('');
  };

  // Sync AI data
  useEffect(() => {
    if (!aiData || aiData === prevAiDataRef.current) return;
    prevAiDataRef.current = aiData;

    if (aiData.productType) {
      const ptMap: Record<string, string> = {
        '挤压铝型材': '挤出', '挤出': '挤出', '铝型材': '挤出',
        '铝板/铝平板': '板材', '板材': '板材', '铝板': '板材',
        '压铸铝件': '压铸', '压铸': '压铸',
        '注塑': '注塑', '注塑件': '注塑',
      };
      const mapped = ptMap[aiData.productType] || aiData.productType;
      if (PRODUCT_TYPES[mapped]) {
        setProductType(mapped);
      }
    }
    if (aiData.materialCategory) {
      setMaterialCategory(aiData.materialCategory);
    }
    if (aiData.quantity) {
      setFields(prev => ({ ...prev, quantity: aiData.quantity! }));
    }
    if (aiData.width) {
      setFields(prev => ({ ...prev, width: aiData.width! }));
    }
    if (aiData.height) {
      setFields(prev => ({ ...prev, height: aiData.height! }));
    }
    if (aiData.length) {
      setFields(prev => ({ ...prev, length: aiData.length! }));
    }
    if (aiData.surfaceTreatment) {
      setMaterialSurfaceTreatment(aiData.surfaceTreatment);
    }

    setAiSynced(true);
    const timer = setTimeout(() => setAiSynced(false), 2000);
    return () => clearTimeout(timer);
  }, [aiData]);

  // Sync pricing result from parent
  useEffect(() => {
    if (pricingResultProp) {
      setPricingResult(pricingResultProp);
    }
  }, [pricingResultProp]);

  // Calculate
  const handleCalculate = async () => {
    setLoading(true);
    try {
      const payload = {
        productType,
        materialCategory,
        quantity: fields.quantity || 1,
        width: fields.width || 0,
        height: fields.height || 0,
        length: fields.length || 0,
        thickness: fields.thickness || 0,
        productSize: fields.productSize || '',
        meterWeight: fields.meterWeight || 0,
        netWeight: fields.netWeight || 0,
        materialSurfaceTreatment,
        materialColor,
        processes,
        productSurfaceTreatment,
        productColor,
      };

      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setPricingResult(data.data);
        }
      }
    } catch (error) {
      console.error('报价计算失败:', error);
    } finally {
      setLoading(false);
    }

    if (onCalculate) {
      onCalculate({
        productType,
        materialCategory,
        quantity: (fields.quantity as number) || 1,
        width: fields.width as number,
        height: fields.height as number,
        length: fields.length as number,
        thickness: fields.thickness as number,
        productSize: fields.productSize as string,
        meterWeight: fields.meterWeight as number,
        netWeight: fields.netWeight as number,
        materialSurfaceTreatment,
        materialColor,
        processes,
        productSurfaceTreatment,
        productColor,
      });
    }
  };

  // Helper: render field inputs
  const renderFields = () => {
    if (!categoryConfig) return null;
    const fieldOrder = ['width', 'height', 'length', 'meterWeight', 'thickness', 'productSize', 'quantity', 'netWeight'];
    const visibleFields = fieldOrder.filter(f => categoryConfig.fields.includes(f));

    return (
      <div className="space-y-2">
        {visibleFields.map(fieldKey => {
          if (fieldKey === 'productSize') {
            return (
              <div key={fieldKey}>
                <label className="block text-[11px] font-medium text-gray-500 mb-0.5">
                  {FIELD_LABELS[fieldKey]}
                </label>
                <input
                  type="text"
                  placeholder="如 100×50×30"
                  value={(fields[fieldKey] as string) || ''}
                  onChange={e => setFields(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                  className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                />
              </div>
            );
          }

          const label = FIELD_LABELS[fieldKey] || fieldKey;
          const isOptional = fieldKey === 'netWeight';

          return (
            <div key={fieldKey}>
              <label className="block text-[11px] font-medium text-gray-500 mb-0.5">
                {label}
              </label>
              <input
                type="number"
                min={0}
                value={(fields[fieldKey] as number) ?? ''}
                onChange={e => setFields(prev => ({ ...prev, [fieldKey]: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
              />
            </div>
          );
        })}
      </div>
    );
  };

  // Get available product types
  const productTypeOptions = Object.entries(PRODUCT_TYPES).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    icon: cfg.icon,
  }));

  // Get available material categories for current product type
  const materialCategoryOptions = productConfig
    ? Object.entries(productConfig.materialCategories).map(([key, cfg]) => ({ key, label: cfg.label }))
    : [];

  // Product surface treatment options
  const productSurfaceOpts = getProductSurfaceOptions();
  const materialColorOpts = getMaterialColorOptions();
  const productColorOpts = getProductColorOptions();

  // Determine if we should show material surface treatment section
  const showMaterialSurface = categoryConfig?.materialSurfaceTreatment && categoryConfig.materialSurfaceTreatment.length > 0;
  const showProductSurface = productType !== '注塑' && (productSurfaceOpts.length > 0);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-gray-800 text-sm">报价参数</h3>
          </div>
          {aiSynced && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium animate-pulse">
              <Sparkles className="w-2.5 h-2.5" />
              AI 已填入
            </div>
          )}
        </div>

        {/* ---- 产品类型 ---- */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">产品类型</label>
          <div className="grid grid-cols-2 gap-1.5">
            {productTypeOptions.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleProductTypeChange(opt.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs transition-all ${
                  productType === opt.key
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-sm">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 材料类别 ---- */}
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">材料类别</label>
          <div className="flex flex-wrap gap-1.5">
            {materialCategoryOptions.map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleMaterialCategoryChange(opt.key)}
                className={`px-2.5 py-1 rounded-md border text-[11px] transition-all ${
                  materialCategory === opt.key
                    ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 参数输入区 ---- */}
        <div className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100">
          <label className="block text-[11px] font-medium text-gray-500 mb-1.5">基本参数</label>
          {renderFields()}
        </div>

        {/* ---- 材料表面处理 (仅挤出有) ---- */}
        {showMaterialSurface && categoryConfig?.materialSurfaceTreatment && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">材料表面处理</label>
            <CustomSelect
              value={materialSurfaceTreatment}
              options={categoryConfig.materialSurfaceTreatment}
              onChange={val => {
                setMaterialSurfaceTreatment(val);
                setMaterialColor('');
              }}
            />
          </div>
        )}

        {/* ---- 材料颜色 (跟材料表面处理联动) ---- */}
        {showMaterialSurface && materialColorOpts.length > 0 && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">材料颜色</label>
            <CustomSelect
              value={materialColor}
              options={materialColorOpts}
              onChange={setMaterialColor}
            />
          </div>
        )}

        {/* ---- 加工工艺 ---- */}
        {categoryConfig && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">加工工艺（可多选）</label>
            <div className="flex flex-wrap gap-1.5">
              {categoryConfig.processes.map(proc => {
                const isNone = proc.name === '无';
                const isSelected = isNone
                  ? processes.length === 0
                  : processes.some(p => p.name === proc.name);

                return (
                  <div key={proc.name}>
                    <button
                      type="button"
                      onClick={() => toggleProcess(proc.name)}
                      className={`px-2 py-1 text-[11px] rounded-md border transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {proc.name}
                    </button>
                    {/* Show quantity input if selected and has unit */}
                    {isSelected && proc.unit && !isNone && (
                      <div className="mt-1">
                        <input
                          type="number"
                          min={0}
                          placeholder={`数量(${proc.unit})`}
                          value={processes.find(p => p.name === proc.name)?.quantity ?? ''}
                          onChange={e => updateProcessQuantity(proc.name, parseFloat(e.target.value) || 0)}
                          className="w-full rounded border border-gray-200 px-2 py-1 text-[11px] bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none"
                        />
                        <span className="text-[10px] text-gray-400">{proc.unit}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- 产品表面处理 ---- */}
        {showProductSurface && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">产品表面处理</label>
            <CustomSelect
              value={productSurfaceTreatment}
              options={productSurfaceOpts.map(o => o.name)}
              onChange={handleProductSurfaceChange}
            />
          </div>
        )}

        {/* ---- 产品颜色 ---- */}
        {showProductSurface && productColorOpts.length > 0 && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">产品颜色</label>
            <CustomSelect
              value={productColor}
              options={productColorOpts}
              onChange={setProductColor}
            />
          </div>
        )}

        {/* ---- 计算按钮 ---- */}
        <button
          onClick={handleCalculate}
          disabled={loading}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-xs hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              计算中...
            </>
          ) : (
            <>
              <Calculator className="w-3.5 h-3.5" />
              计算报价
            </>
          )}
        </button>

        {/* ---- 报价结果 ---- */}
        {pricingResult && (
          <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-2.5 space-y-1.5">
            <h4 className="text-xs font-bold text-emerald-700">报价结果</h4>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
              <span className="text-gray-500">单件重量</span>
              <span className="text-right font-medium text-gray-800">{pricingResult.unitWeight.toFixed(3)} kg</span>
              <span className="text-gray-500">材料费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.materialCost.toFixed(2)}</span>
              <span className="text-gray-500">加工费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.processingCost.toFixed(2)}</span>
              <span className="text-gray-500">表面处理费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.surfaceCost.toFixed(2)}</span>
              <span className="text-gray-500">包装费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.packagingCost.toFixed(2)}</span>
              <span className="text-gray-500">运费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.shippingCost.toFixed(2)}</span>
              <span className="text-gray-500">管理费</span>
              <span className="text-right font-medium text-gray-800">¥{pricingResult.managementFee.toFixed(2)}</span>
            </div>
            <div className="pt-1.5 border-t border-emerald-200">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-gray-700">单价</span>
                <span className="text-base font-bold text-emerald-600">¥{pricingResult.unitPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Custom Select Component ====================

function CustomSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-md border border-gray-200 px-2.5 py-1.5 text-xs bg-gray-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none text-left"
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>{value || '请选择'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 transition-colors ${
                value === opt ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
