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
  meterWeight?: number;
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

export interface PricingResult {
  quotation_id?: string;
  material_cost?: number;
  processing_cost?: number;
  surface_treatment_cost?: number;
  secondary_operations_cost?: number;
  packaging_cost?: number;
  transport_cost?: number;
  management_fee?: number;
  unit_price?: number;
  total_price?: number;
  weight_per_piece_kg?: number;
  breakdown?: Record<string, { formula: string; detail: string }>;
  aluminum_index?: number;
  notes?: string[];
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
  meterWeight: '米重(g/m)',
  netWeight: '产品净重(g)(选填)',
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

  // ==================== Mapping Helpers ====================

  // Map productType + materialCategory → API product_type
  const mapProductType = (): string => {
    if (productType === '挤出') return 'extrusion';
    if (productType === '板材') return 'sheet_metal';
    if (productType === '压铸') {
      return materialCategory === '锌合金' ? 'zinc_alloy' : 'die_casting';
    }
    if (productType === '注塑') return 'injection';
    return 'sheet_metal';
  };

  // Map materialCategory → API material.category
  const mapMaterialCategory = (): string => {
    const map: Record<string, string> = {
      '铝型材': '挤压铝型材',
      '铝板': '铝板',
      '冷轧板': '冷板SPCC',
      '不锈钢': '不锈钢',
      '镀锌板': '冷板SPCC',
      '铝': '压铸铝ADC12',
      '锌合金': '锌合金ZA-8',
      'ABS': 'ABS',
      'PP': 'PP',
      'PC': 'PC',
      'PA': 'PA',
      'POM': 'POM',
      'PMMA': 'PMMA',
    };
    return map[materialCategory] || materialCategory;
  };

  // Parse productSize string like "100×200×50" or "100x200x50"
  const parseProductSize = (size: string): { l: number; w: number; h: number } | null => {
    if (!size || typeof size !== 'string') return null;
    const cleaned = size.replace(/[×xX*]/g, ' ').trim();
    const parts = cleaned.split(/\s+/).map(Number).filter(n => !isNaN(n) && n > 0);
    if (parts.length >= 3) return { l: parts[0], w: parts[1], h: parts[2] };
    if (parts.length === 2) return { l: parts[0], w: parts[1], h: 0 };
    return null;
  };

  // Map surface treatment to API format
  const mapSurfaceTreatment = (): { type: string; color?: string | null } | null => {
    const surfaceMap: Record<string, string> = {
      '喷砂氧化': '喷砂',
      '抛光氧化': '抛光/镀铬',
      '拉丝氧化': '拉丝',
      '喷涂': '喷涂/喷粉',
      '氧化': '氧化本色',
      '电镀': '镀锌/镀镍',
    };

    // Material surface treatment takes priority (only for extrusion)
    if (materialSurfaceTreatment && materialSurfaceTreatment !== '无') {
      const mapped = surfaceMap[materialSurfaceTreatment];
      if (mapped) {
        const color = materialColor || null;
        return { type: mapped, color };
      }
    }

    // Fallback to product surface treatment
    if (productSurfaceTreatment && productSurfaceTreatment !== '无' && productSurfaceTreatment !== '除油') {
      let mapped = surfaceMap[productSurfaceTreatment];
      if (!mapped) return null;

      // For oxidation, determine color
      if (productSurfaceTreatment === '氧化') {
        if (productColor && productColor !== '本色') {
          mapped = '氧化上色';
        } else {
          mapped = '氧化本色';
        }
      }

      const color = productColor || null;
      return { type: mapped, color };
    }

    return null;
  };

  // Map processes to API secondary_operations
  const mapProcesses = (): { secondary_operations: string[]; cut_count?: number } => {
    const processMap: Record<string, string> = {
      '冲压': '冲压',
      'CNC加工': 'CNC加工',
      '车加工': '车加工',
      '钻孔': '钻孔',
      '攻牙': '攻丝',
      '激光切割': '激光切割',
      '折弯': '折弯',
      '抛光': '抛光',
      '除披锋': '去毛刺',
    };

    const secondaryOps: string[] = [];
    let cutCount: number | undefined;

    for (const proc of processes) {
      if (proc.name === '锯切') {
        cutCount = proc.quantity || 1;
      } else if (processMap[proc.name]) {
        secondaryOps.push(processMap[proc.name]);
      }
    }

    return { secondary_operations: secondaryOps, cut_count: cutCount };
  };

  // Calculate weight_per_piece_kg
  const calcWeightKg = (): number | undefined => {
    const netWeight = fields.netWeight as number;
    if (netWeight && netWeight > 0) {
      return netWeight / 1000;
    }

    // For extrusion with meterWeight
    if (productType === '挤出') {
      const meterWeight = fields.meterWeight as number;
      const length = fields.length as number;
      if (meterWeight && length) {
        return (meterWeight * length) / 1000000;
      }
    }

    return undefined;
  };

  // Build dimensions object
  const buildDimensions = () => {
    const parsed = parseProductSize(fields.productSize as string);

    if (productType === '挤出') {
      const width = fields.width as number;
      const height = fields.height as number;
      const length = fields.length as number;
      if (width || height || length) {
        return {
          length_mm: length || 0,
          width_mm: width || 0,
          height_mm: height || undefined,
        };
      }
    }

    if (productType === '板材') {
      const thickness = fields.thickness as number;
      if (parsed) {
        return {
          length_mm: parsed.l,
          width_mm: parsed.w,
          wall_thickness_mm: thickness || undefined,
        };
      }
    }

    if (productType === '压铸' || productType === '注塑') {
      if (parsed) {
        return {
          length_mm: parsed.l,
          width_mm: parsed.w,
          height_mm: parsed.h || undefined,
        };
      }
    }

    return undefined;
  };

  // Calculate
  const handleCalculate = async () => {
    setLoading(true);
    setPricingResult(null);
    try {
      const surfaceTreatment = mapSurfaceTreatment();
      const processInfo = mapProcesses();
      const weightKg = calcWeightKg();
      const dimensions = buildDimensions();

      const payload: Record<string, any> = {
        product_type: mapProductType(),
        material: {
          category: mapMaterialCategory(),
        },
        quantity: (fields.quantity as number) || 1,
      };

      if (dimensions) payload.dimensions = dimensions;
      if (weightKg !== undefined) payload.weight_per_piece_kg = weightKg;
      if (surfaceTreatment) payload.surface_treatment = surfaceTreatment;
      if (processInfo.secondary_operations.length > 0 || processInfo.cut_count !== undefined) {
        payload.process = processInfo;
      }

      const res = await fetch('/api/v1/quote/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPricingResult({
            quotation_id: data.quotation_id || '',
            material_cost: data.material_cost || 0,
            processing_cost: data.processing_cost || 0,
            surface_treatment_cost: data.surface_treatment_cost || 0,
            secondary_operations_cost: data.secondary_operations_cost || 0,
            packaging_cost: data.packaging_cost || 0,
            transport_cost: data.transport_cost || 0,
            management_fee: data.management_fee || 0,
            unit_price: data.unit_price || 0,
            total_price: data.total_price || 0,
            weight_per_piece_kg: data.weight_per_piece_kg || 0,
            breakdown: data.breakdown || {},
            aluminum_index: data.aluminum_index || 0,
            notes: data.notes || [],
          });
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
          <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-2.5 space-y-2">
            <h4 className="text-xs font-bold text-emerald-700">📋 报价明细</h4>

            {/* Cost breakdown items */}
            <div className="space-y-1">
              {[
                { label: '材料费', value: pricingResult.material_cost, key: 'material_cost' },
                { label: '加工费', value: pricingResult.processing_cost, key: 'processing_cost' },
                { label: '表面处理费', value: pricingResult.surface_treatment_cost, key: 'surface_treatment_cost' },
                { label: '二次加工费', value: pricingResult.secondary_operations_cost, key: 'secondary_operations_cost' },
                { label: '包装费', value: pricingResult.packaging_cost, key: 'packaging_cost' },
                { label: '运输费', value: pricingResult.transport_cost, key: 'transport_cost' },
                { label: '管理费', value: pricingResult.management_fee, key: 'management_fee' },
              ].map((item) => (
                <div key={item.key} className="text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="font-medium text-gray-800">¥{item.value.toFixed(2)}</span>
                  </div>
                  {pricingResult.breakdown?.[item.key] && (
                    <div className="text-[10px] text-gray-400 ml-2 mt-0.5">
                      {pricingResult.breakdown[item.key].formula && (
                        <span className="italic">{pricingResult.breakdown[item.key].formula}</span>
                      )}
                      {pricingResult.breakdown[item.key].detail && (
                        <span className="ml-1">— {pricingResult.breakdown[item.key].detail}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-emerald-200" />

            {/* Unit price */}
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-medium text-gray-700">单价</span>
              <span className="text-sm font-bold text-emerald-600">¥{pricingResult.unit_price.toFixed(2)}</span>
            </div>

            {/* Total price */}
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-medium text-gray-700">总价 (×{(fields.quantity as number) || 1})</span>
              <span className="text-base font-bold text-red-600">¥{pricingResult.total_price.toFixed(2)}</span>
            </div>

            {/* Weight info */}
            {pricingResult.weight_per_piece_kg > 0 && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500">单件重量</span>
                <span className="font-medium text-gray-700">{pricingResult.weight_per_piece_kg.toFixed(3)} kg</span>
              </div>
            )}

            {/* Aluminum index */}
            {pricingResult.aluminum_index > 0 && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-gray-500">铝锭指数</span>
                <span className="font-medium text-gray-700">¥{pricingResult.aluminum_index.toLocaleString()}/吨</span>
              </div>
            )}

            {/* Notes */}
            {pricingResult.notes && pricingResult.notes.length > 0 && (
              <div className="mt-1 pt-1 border-t border-emerald-100">
                {pricingResult.notes.map((note, i) => (
                  <div key={i} className="text-[10px] text-amber-600">⚠ {note}</div>
                ))}
              </div>
            )}
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
