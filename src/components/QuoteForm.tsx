"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, X, Sparkles, Loader2, AlertTriangle } from 'lucide-react';

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
  subParams?: Record<string, any>;
}

export interface PricingResult {
  quotation_id: string;
  material_cost: number;
  processing_cost: number;
  surface_treatment_cost: number;
  secondary_operations_cost: number;
  packaging_cost: number;
  transport_cost: number;
  management_fee: number;
  unit_price: number;
  total_price: number;
  weight_per_piece_kg: number;
  material_utilization_rate?: number;
  breakdown: Record<string, { formula: string; detail: string }>;
  aluminum_index: number;
  mold_cost?: number;
  min_order_qty?: number;
  notes: string[];
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
  onResult?: (result: PricingResult | null) => void;
  onProductInfoChange?: (info: { productName: string; productCode: string }) => void;
  aiData?: AiFormUpdate | null;
}

// ==================== Configuration Data ====================

interface ProcessOption {
  name: string;
  unit?: string;
}

interface ProductSurfaceOption {
  name: string;
  colors?: string[];
}

interface MaterialCategoryConfig {
  label: string;
  fields: string[];
  materialSurfaceTreatment?: string[];
  materialColorMap?: Record<string, string[]>;
  processes: ProcessOption[];
  productSurfaceTreatmentMap?: Record<string, ProductSurfaceOption[]>;
  productSurfaceTreatment?: ProductSurfaceOption[];
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
        fields: ['width', 'height', 'length', 'perimeter', 'num_cavities', 'die_type', 'meterWeight', 'quantity', 'netWeight'],
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
    label: '压铸铝',
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
  perimeter: '产品周长(mm)',
  num_cavities: '面域数',
  die_type: '模具类型',
  thickness: '厚度(mm)',
  productSize: '产品尺寸(长×宽×高mm)',
  quantity: '数量(件)',
  meterWeight: '米重(kg/m)',
  netWeight: '产品净重(g·选填·算利用率)',
};


// ==================== Process Sub-Parameters ====================
const PROCESS_SUB_PARAMS: Record<string, { name: string; type: string; label: string; options?: string[] }[]> = {
  '冲压': [
    { name: 'tonnage', type: 'select', label: '吨位', options: ['<=35T', '45T', '60T', '80T', '110T', '160T', '200T', '200T双轴', '250T双轴'] },
  ],
  '钻孔': [
    { name: 'hole_count', type: 'number', label: '孔数量' },
    { name: 'diameter_range', type: 'select', label: '孔径范围', options: ['ø3~6', 'ø6~10', 'ø10~16', 'ø16~25'] },
  ],
  '攻牙': [
    { name: 'hole_count', type: 'number', label: '孔数量' },
    { name: 'size', type: 'select', label: '规格', options: ['M3~M4', 'M5~M6', 'M8~M10', 'M12~M16'] },
  ],
  'CNC加工': [
    { name: 'minutes', type: 'number', label: '加工时间(分钟)' },
  ],
  '车加工': [
    { name: 'minutes', type: 'number', label: '加工时间(分钟)' },
  ],
};

// Allowed upload extensions
const ALLOWED_EXTENSIONS = ['.dxf', '.dwg', '.step', '.stp', '.igs', '.pdf', '.jpg', '.png'];

// ==================== Component ====================

export default function QuoteForm({ onCalculate, onResult, onProductInfoChange, aiData }: QuoteFormProps) {
  const [aiSynced, setAiSynced] = useState(false);
  const prevAiDataRef = useRef<AiFormUpdate | null | undefined>(null);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Product info state
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');

  // Core form state
  const [productType, setProductType] = useState('挤出');
  const [materialCategory, setMaterialCategory] = useState('铝型材');
  const [fields, setFields] = useState<Record<string, number | string>>({
    width: '', height: '', length: '', quantity: '',
  });
  const [materialSurfaceTreatment, setMaterialSurfaceTreatment] = useState('无');
  const [materialColor, setMaterialColor] = useState('');
  const [processes, setProcesses] = useState<ProcessSelection[]>([]);
  const [productSurfaceTreatment, setProductSurfaceTreatment] = useState('无');
  const [productColor, setProductColor] = useState('');
  const [surfaceTreatment, setSurfaceTreatment] = useState('无');
  const [surfaceColor, setSurfaceColor] = useState('');
  const [meterWeightManual, setMeterWeightManual] = useState(false);
  const [quantityManual, setQuantityManual] = useState(false);
  const [perimeterManual, setPerimeterManual] = useState(false);
  const [dieSteelPrice, setDieSteelPrice] = useState<string>('');

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileRemark, setFileRemark] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const defaultFields: Record<string, number | string> = { quantity: '' };
    if (cat.fields.includes('width')) defaultFields.width = '';
    if (cat.fields.includes('height')) defaultFields.height = '';
    if (cat.fields.includes('length')) defaultFields.length = '';
    if (cat.fields.includes('thickness')) defaultFields.thickness = 2;
    if (cat.fields.includes('productSize')) defaultFields.productSize = '';
    if (cat.fields.includes('meterWeight')) defaultFields.meterWeight = '';
    if (cat.fields.includes('netWeight')) defaultFields.netWeight = '';
    if (cat.fields.includes('perimeter')) defaultFields.perimeter = '';
    if (cat.fields.includes('num_cavities')) defaultFields.num_cavities = '';
    if (cat.fields.includes('die_type')) defaultFields.die_type = '';
    setFields(defaultFields);
    if (cat.materialSurfaceTreatment) {
      setMaterialSurfaceTreatment('无');
      setMaterialColor('');
    } else {
      setMaterialSurfaceTreatment('');
      setMaterialColor('');
    }
    setProcesses([]);
    setProductSurfaceTreatment('');
    setProductColor('');
    setSurfaceTreatment('无');
    setSurfaceColor('');
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


  // ==================== Auto-calculate meter weight from cross-section ====================
  useEffect(() => {
    if (productType !== '挤出') return;
    if (meterWeightManual) return;
    const w = fields.width as number;
    const h = fields.height as number;
    if (w && h && w > 0 && h > 0) {
      const meterWeight = w * h * 0.0027;
      const rounded = Math.round(meterWeight * 100) / 100;
      setFields(prev => ({ ...prev, meterWeight: rounded }));
    }
  }, [fields.width, fields.height, productType]);

  // ==================== Auto-calculate perimeter from cross-section ====================
  useEffect(() => {
    if (productType !== '挤出') return;
    if (perimeterManual) return; // 用户手动修改后不再自动更新
    const w = fields.width as number;
    const h = fields.height as number;
    if (w && h && w > 0 && h > 0) {
      const perimeter = 2 * (w + h);
      setFields(prev => ({ ...prev, perimeter }));
    }
  }, [fields.width, fields.height, productType]);

  // ==================== Auto-calculate min order quantity ====================
  useEffect(() => {
    if (productType !== '挤出') return;
    if (quantityManual) return;
    const mw = fields.meterWeight as number;
    const len = fields.length as number;
    if (mw && len && mw > 0 && len > 0) {
      const singleWeightKg = mw * len / 1000;
      if (singleWeightKg > 0) {
        const minQty = Math.ceil(300 / singleWeightKg);
        setFields(prev => ({ ...prev, quantity: minQty }));
      }
    }
  }, [fields.meterWeight, fields.length, productType]);

  // ==================== Auto-calculate with debounce ====================
  const triggerCalculate = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      doCalculate();
    }, 500);
  }, [productType, materialCategory, fields, materialSurfaceTreatment, materialColor, processes, productSurfaceTreatment, productColor, surfaceTreatment, surfaceColor]);

  // Trigger on any field change
  useEffect(() => {
    triggerCalculate();
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [productType, materialCategory, fields, materialSurfaceTreatment, materialColor, processes, productSurfaceTreatment, productColor, surfaceTreatment, surfaceColor]);

  // Get available product surface treatments
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

  const getMaterialColorOptions = (): string[] => {
    if (!categoryConfig?.materialColorMap) return [];
    return categoryConfig.materialColorMap[materialSurfaceTreatment] || [];
  };

  const getProductColorOptions = (): string[] => {
    const opts = getProductSurfaceOptions();
    const selected = opts.find(o => o.name === productSurfaceTreatment);
    return selected?.colors || [];
  };

  // 合并材料表面处理 + 产品表面处理选项（去重，默认"无"）
  const getSurfaceTreatmentOptions = (): { name: string; colors?: string[] }[] => {
    const seen = new Map<string, string[] | undefined>();
    const addOption = (name: string, colors?: string[]) => {
      if (!seen.has(name)) seen.set(name, colors);
    };
    addOption('无');
    if (categoryConfig?.materialSurfaceTreatment) {
      for (const name of categoryConfig.materialSurfaceTreatment) {
        if (name === '无') continue;
        const colorOpts = categoryConfig?.materialColorMap?.[name];
        addOption(name, colorOpts);
      }
    }
    const productOpts = getProductSurfaceOptions();
    for (const opt of productOpts) {
      if (opt.name === '无') continue;
      if (seen.has(opt.name)) {
        // 合并颜色
        const existing = seen.get(opt.name);
        if (opt.colors && existing) {
          const merged = [...existing];
          for (const c of opt.colors) if (!merged.includes(c)) merged.push(c);
          seen.set(opt.name, merged);
        } else if (opt.colors) {
          seen.set(opt.name, opt.colors);
        }
      } else {
        addOption(opt.name, opt.colors);
      }
    }
    return Array.from(seen.entries()).map(([name, colors]) => ({ name, colors }));
  };

  const getSurfaceColorOptions = (): string[] => {
    const opts = getSurfaceTreatmentOptions();
    const selected = opts.find(o => o.name === surfaceTreatment);
    return selected?.colors || [];
  };

  const handleProductTypeChange = (pt: string) => setProductType(pt);
  const handleMaterialCategoryChange = (mc: string) => {
    setMaterialCategory(mc);
    resetCategoryState(mc);
  };

  const toggleProcess = (procName: string) => {
    if (procName === '无') { setProcesses([]); return; }
    setProcesses(prev => {
      const exists = prev.find(p => p.name === procName);
      if (exists) return prev.filter(p => p.name !== procName);
      // Initialize subParams if this process has them
      const subDef = PROCESS_SUB_PARAMS[procName];
      const subParams: Record<string, any> = {};
      if (subDef) {
        for (const param of subDef) {
          if (param.type === 'number') subParams[param.name] = '';
          else if (param.type === 'select' && param.options) subParams[param.name] = param.options[0];
        }
      }
      return [...prev, { name: procName, ...(Object.keys(subParams).length > 0 ? { subParams } : {}) }];
    });
  };

  const updateProcessQuantity = (procName: string, qty: number) => {
    setProcesses(prev => prev.map(p => p.name === procName ? { ...p, quantity: qty } : p));
  };


  const updateSubParam = (procName: string, paramName: string, value: any) => {
    setProcesses(prev => prev.map(p =>
      p.name === procName ? { ...p, subParams: { ...p.subParams, [paramName]: value } } : p
    ));
  };

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
      if (PRODUCT_TYPES[mapped]) setProductType(mapped);
    }
    if (aiData.materialCategory) setMaterialCategory(aiData.materialCategory);
    if (aiData.quantity) setFields(prev => ({ ...prev, quantity: aiData.quantity! }));
    if (aiData.width) setFields(prev => ({ ...prev, width: aiData.width! }));
    if (aiData.height) setFields(prev => ({ ...prev, height: aiData.height! }));
    if (aiData.length) setFields(prev => ({ ...prev, length: aiData.length! }));
    if (aiData.surfaceTreatment) setMaterialSurfaceTreatment(aiData.surfaceTreatment);
    setAiSynced(true);
    const timer = setTimeout(() => setAiSynced(false), 2000);
    return () => clearTimeout(timer);
  }, [aiData]);

  // Notify parent of product info changes
  useEffect(() => {
    onProductInfoChange?.({ productName, productCode });
  }, [productName, productCode]);

  // ==================== Mapping Helpers ====================

  const mapProductType = (): string => {
    if (productType === '挤出') return 'extrusion';
    if (productType === '板材') return 'sheet_metal';
    if (productType === '压铸') {
      return materialCategory === '锌合金' ? 'zinc_alloy' : 'die_casting';
    }
    if (productType === '注塑') return 'injection';
    return 'sheet_metal';
  };

  const mapMaterialCategory = (): string => {
    const map: Record<string, string> = {
      '铝型材': '挤压铝型材', '铝板': '铝板', '冷轧板': '冷板SPCC',
      '不锈钢': '不锈钢', '镀锌板': '冷板SPCC', '铝': '压铸铝ADC12',
      '锌合金': '锌合金ZA-8', 'ABS': 'ABS', 'PP': 'PP', 'PC': 'PC',
      'PA': 'PA', 'POM': 'POM', 'PMMA': 'PMMA',
    };
    return map[materialCategory] || materialCategory;
  };

  const parseProductSize = (size: string): { l: number; w: number; h: number } | null => {
    if (!size || typeof size !== 'string') return null;
    const cleaned = size.replace(/[×xX*]/g, ' ').trim();
    const parts = cleaned.split(/\s+/).map(Number).filter(n => !isNaN(n) && n > 0);
    if (parts.length >= 3) return { l: parts[0], w: parts[1], h: parts[2] };
    if (parts.length === 2) return { l: parts[0], w: parts[1], h: 0 };
    return null;
  };

  const mapSurfaceTreatment = (): { type: string; color?: string | null } | null => {
    const surfaceMap: Record<string, string> = {
      '喷砂氧化': '喷砂', '抛光氧化': '抛光/镀铬', '拉丝氧化': '拉丝',
      '喷涂': '喷涂/喷粉', '氧化': '氧化本色', '电镀': '镀锌/镀镍',
      '除油': '除油',
    };
    // 使用合并后的统一表面处理
    if (surfaceTreatment && surfaceTreatment !== '无') {
      let mapped = surfaceMap[surfaceTreatment];
      if (!mapped) return null;
      if (surfaceTreatment === '氧化') {
        if (surfaceColor && surfaceColor !== '本色') mapped = '氧化上色';
        else mapped = '氧化本色';
      }
      return { type: mapped, color: surfaceColor || null };
    }
    return null;
  };

  const mapProcesses = (): Record<string, any> => {
    const processMap: Record<string, string> = {
      '冲压': '冲压', 'CNC加工': 'CNC加工', '车加工': '车加工',
      '钻孔': '钻孔', '攻牙': '攻丝', '激光切割': '激光切割',
      '折弯': '折弯', '抛光': '抛光', '除披锋': '去毛刺',
    };
    const secondaryOps: string[] = [];
    let cutCount: number | undefined;
    let stampingTonnage: string | undefined;
    let stampingCount: number | undefined;
    let holes: { count: number; diameter_range?: string } | undefined;
    let tappedHoles: { count: number; size?: string } | undefined;
    let cncTime: { minutes: number } | undefined;

    for (const proc of processes) {
      if (proc.name === '锯切') {
        cutCount = proc.quantity || 1;
      } else if (proc.name === '冲压') {
        secondaryOps.push('冲压');
        if (proc.subParams?.tonnage) stampingTonnage = proc.subParams.tonnage;
        stampingCount = proc.quantity || 1;
      } else if (proc.name === '钻孔') {
        secondaryOps.push('钻孔');
        const hc = proc.subParams?.hole_count || proc.quantity || 0;
        const dr = proc.subParams?.diameter_range || 'ø6~10';
        if (hc > 0) holes = { count: hc, diameter_range: dr };
      } else if (proc.name === '攻牙') {
        secondaryOps.push('攻丝');
        const hc = proc.subParams?.hole_count || proc.quantity || 0;
        const sz = proc.subParams?.size || 'M5~M6';
        if (hc > 0) tappedHoles = { count: hc, size: sz };
      } else if (proc.name === 'CNC加工') {
        secondaryOps.push('CNC加工');
        const mins = proc.subParams?.minutes || proc.quantity || 0;
        if (mins > 0) cncTime = { minutes: mins };
      } else if (proc.name === '车加工') {
        secondaryOps.push('车加工');
        const mins = proc.subParams?.minutes || proc.quantity || 0;
        if (mins > 0) cncTime = { minutes: (cncTime?.minutes || 0) + mins };
      } else if (processMap[proc.name]) {
        secondaryOps.push(processMap[proc.name]);
      }
    }

    const result: Record<string, any> = { secondary_operations: secondaryOps };
    if (cutCount !== undefined) result.cut_count = cutCount;
    if (stampingTonnage) result.stamping_tonnage = stampingTonnage;
    if (stampingCount !== undefined) result.stamping_count = stampingCount;
    if (holes) result.holes = holes;
    if (tappedHoles) result.tapped_holes = tappedHoles;
    if (cncTime) result.cnc_time = cncTime;
    return result;
  };

  const calcWeightKg = (): number | undefined => {
    if (productType === '挤出') {
      // 挤出：始终用米重×长度计算型材消耗重量（净重用于计算利用率，不覆盖重量）
      const meterWeight = fields.meterWeight as number;
      const length = fields.length as number;
      if (meterWeight && length) return (meterWeight * length) / 1000;
    }
    // 其他品类：用净重
    const netWeight = fields.netWeight as number;
    if (netWeight && netWeight > 0) return netWeight / 1000;
    return undefined;
  };

  const buildDimensions = () => {
    const parsed = parseProductSize(fields.productSize as string);
    if (productType === '挤出') {
      const width = fields.width as number;
      const height = fields.height as number;
      const length = fields.length as number;
      if (width || height || length) return {
        length_mm: length || 0,
        width_mm: width || 0,
        height_mm: height || undefined,
        perimeter_mm: (fields.perimeter as number) || undefined,
        num_cavities: parseInt(fields.num_cavities as string) || 1,
        die_type: (fields.die_type as 'flat' | 'split') || 'flat',
        meter_weight_kg_per_m: (fields.meterWeight as number) || undefined,
        net_weight_g: (fields.netWeight as number) || undefined,
        die_steel_price: dieSteelPrice ? parseFloat(dieSteelPrice) : undefined,
      };
    }
    if (productType === '板材') {
      const thickness = fields.thickness as number;
      if (parsed) return { length_mm: parsed.l, width_mm: parsed.w, wall_thickness_mm: thickness || undefined };
    }
    if (productType === '压铸' || productType === '注塑') {
      if (parsed) return { length_mm: parsed.l, width_mm: parsed.w, height_mm: parsed.h || undefined };
    }
    return undefined;
  };

  // ==================== Calculate ====================
  const doCalculate = async () => {
    // Check if all required dimension fields are filled
    const cat = categoryConfig;
    if (cat) {
      const requiredDims = cat.fields.filter(f => ['width', 'height', 'length', 'thickness', 'productSize'].includes(f));
      const allFilled = requiredDims.every(f => {
        const val = fields[f];
        return val !== '' && val !== undefined && val !== null && Number(val) > 0;
      });
      if (!allFilled) {
        onResult?.(null);
        return;
      }
    }

    setLoading(true);
    try {
      const surfaceTreatment = mapSurfaceTreatment();
      const processInfo = mapProcesses();
      const weightKg = calcWeightKg();
      const dimensions = buildDimensions();
      const payload: Record<string, any> = {
        product_type: mapProductType(),
        material: { category: mapMaterialCategory() },
        quantity: (fields.quantity as number) || 1,
      };
      if (productName) payload.product_name = productName;
      if (productCode) payload.product_code = productCode;
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
          const result: PricingResult = {
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
            material_utilization_rate: data.material_utilization_rate,
            breakdown: data.breakdown || {},
            aluminum_index: data.aluminum_index || 0,
            notes: data.notes || [],
            mold_cost: data.mold_cost || 0,
            min_order_qty: data.min_order_qty || 0,
          };
          onResult?.(result);
          if (onCalculate) {
            onCalculate({
              productType, materialCategory,
              quantity: (fields.quantity as number) || 1,
              width: fields.width as number, height: fields.height as number,
              length: fields.length as number, thickness: fields.thickness as number,
              productSize: fields.productSize as string,
              meterWeight: fields.meterWeight as number, netWeight: fields.netWeight as number,
              materialSurfaceTreatment, materialColor, processes,
              productSurfaceTreatment, productColor,
            });
          }
          setLoading(false);
          return;
        }
      }
      onResult?.(null);
    } catch (error) {
      console.error('报价计算失败:', error);
      onResult?.(null);
    } finally {
      setLoading(false);
    }
  };

  // ==================== File Upload ====================
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) setUploadedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidFile(file)) setUploadedFile(file);
  };

  const isValidFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==================== Derived state ====================
  const productSurfaceOpts = getProductSurfaceOptions();
  const materialColorOpts = getMaterialColorOptions();
  const productColorOpts = getProductColorOptions();
  const showMaterialSurface = !!(categoryConfig?.materialSurfaceTreatment && categoryConfig.materialSurfaceTreatment.length > 0);
  const showProductSurface = productType !== '注塑' && productSurfaceOpts.length > 0;

  // Field rendering with two-column grid
  const renderFields = () => {
    if (!categoryConfig) return null;
    const fieldOrder = ['width', 'height', 'length', 'perimeter', 'num_cavities', 'die_type', 'meterWeight', 'thickness', 'productSize', 'quantity', 'netWeight'];
    const visibleFields = fieldOrder.filter(f => categoryConfig.fields.includes(f));

    // Group into pairs for two-column layout
    const pairs: string[][] = [];
    for (let i = 0; i < visibleFields.length; i += 2) {
      pairs.push(visibleFields.slice(i, i + 2));
    }

    return (
      <div className="space-y-2">
        {pairs.map((pair, pi) => (
          <div key={pi} className={`grid ${pair.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            {pair.map(fieldKey => {
              if (fieldKey === 'productSize') {
                return (
                  <div key={fieldKey}>
                    <label className="block text-[11px] text-gray-500 mb-1">{FIELD_LABELS[fieldKey]}</label>
                    <input
                      type="text"
                      placeholder="如 100×50×30"
                      value={(fields[fieldKey] as string) || ''}
                      onChange={e => setFields(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                    />
                  </div>
                );
              }
              // num_cavities 用 select 渲染
              if (fieldKey === 'num_cavities') {
                const cavVal = fields[fieldKey] ?? '';
                const cavLabel = !cavVal ? '' : Number(cavVal) >= 2 ? '分流模' : '平模';
                return (
                  <div key={fieldKey}>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      {FIELD_LABELS[fieldKey]}
                      <span className="ml-1 text-[10px] text-blue-500">({cavLabel})</span>
                    </label>
                    <select
                      value={cavVal}
                      onChange={e => {
                        const raw = e.target.value;
                        const val = raw ? (parseInt(raw) || 1) : '';
                        setFields(prev => ({
                          ...prev,
                          [fieldKey]: val,
                          die_type: val === '' ? '' : (val <= 1 ? 'flat' : 'split'),
                        }));
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                    >
                      {['', '1', '2', '3', '4'].map(opt => (
                        opt === '' ? <option key="empty" value="">请选择</option> :
                        <option key={opt} value={opt}>{opt}{parseInt(opt) === 1 ? ' (平模)' : ' (分流模)'}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              // die_type 用 select 渲染
              if (fieldKey === 'die_type') {
                const dtVal = fields[fieldKey] as string;
                return (
                  <div key={fieldKey}>
                    <label className="block text-[11px] text-gray-500 mb-1">{FIELD_LABELS[fieldKey]}</label>
                    <select
                      value={dtVal || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'flat' || val === 'split') {
                          setFields(prev => ({
                            ...prev,
                            [fieldKey]: val,
                            num_cavities: val === 'flat' ? 1 : 2,
                          }));
                        } else {
                          setFields(prev => ({
                            ...prev,
                            [fieldKey]: '',
                            num_cavities: '',
                          }));
                        }
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                    >
                      <option value="">请选择</option>
                      <option value="flat">平模</option>
                      <option value="split">分流模</option>
                    </select>
                  </div>
                );
              }
              return (
                <div key={fieldKey}>
                  <label className="block text-[11px] text-gray-500 mb-1">{FIELD_LABELS[fieldKey]}</label>
                  <input
                    type="number"
                    min={0}
                    value={(fields[fieldKey] as number) ?? ''}
                    onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setFields(prev => ({ ...prev, [fieldKey]: val }));
                        if (fieldKey === 'meterWeight') {
                          setMeterWeightManual(val > 0);
                          if (val > 0) setQuantityManual(false);
                        }
                        if (fieldKey === 'quantity') {
                          setQuantityManual(true);
                        }
                        if (fieldKey === 'width' || fieldKey === 'height') {
                          setPerimeterManual(false);
                          setMeterWeightManual(false);
                          setQuantityManual(false);
                        }
                        if (fieldKey === 'perimeter') {
                          setPerimeterManual(val > 0);
                        }
                      }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const inputBaseClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* AI synced indicator */}
        {aiSynced && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            AI 已自动填入参数
          </div>
        )}

        {/* ---- 产品名称 & 编号 ---- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">产品名称</label>
              <input
                type="text"
                placeholder="输入产品名称"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">产品编号</label>
              <input
                type="text"
                placeholder="输入产品编号"
                value={productCode}
                onChange={e => setProductCode(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
              />
            </div>
          </div>
        </div>

        {/* ---- 产品类型 Tab栏 ---- */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0">
            {Object.entries(PRODUCT_TYPES).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleProductTypeChange(key)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                  productType === key
                    ? 'text-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-base">{cfg.icon}</span>
                  {cfg.label}
                </span>
                {productType === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 材料类别 ---- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">材料类别</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(productConfig?.materialCategories || {}).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleMaterialCategoryChange(key)}
                className={`px-2.5 py-1 rounded-lg border text-xs transition-all duration-200 ${
                  materialCategory === key
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 基本参数 ---- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">基本参数</label>
          {renderFields()}
        </div>

        {/* ---- 加工工艺 ---- */}
        {categoryConfig && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">加工工艺（可多选）</label>
            <div className="flex flex-wrap gap-1.5">
              {categoryConfig.processes.map(proc => {
                const isNone = proc.name === '无';
                const isSelected = isNone ? processes.length === 0 : processes.some(p => p.name === proc.name);
                const hasSubParams = !!PROCESS_SUB_PARAMS[proc.name];
                const selectedProc = processes.find(p => p.name === proc.name);
                const showQuantity = isSelected && proc.unit && !isNone && !hasSubParams;
                const showStampingQty = isSelected && proc.name === '冲压';
                return (
                  <div key={proc.name} className="flex flex-col items-start">
                    <button
                      type="button"
                      onClick={() => toggleProcess(proc.name)}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {proc.name}
                    </button>
                    {showQuantity && (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          min={0}
                          placeholder="数量"
                          value={selectedProc?.quantity ?? ''}
                          onChange={e => updateProcessQuantity(proc.name, parseFloat(e.target.value) || 0)}
                          className="w-16 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-h-[28px]"
                        />
                        <span className="text-[10px] text-gray-400">{proc.unit}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Sub-parameter panels for selected processes */}
            {processes.filter(p => PROCESS_SUB_PARAMS[p.name]).map(proc => {
              const subDef = PROCESS_SUB_PARAMS[proc.name];
              if (!subDef) return null;
              return (
                <div key={proc.name + '_params'} className="mt-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                  <div className="text-[11px] font-medium text-blue-700 mb-1.5">{proc.name} 参数</div>
                  <div className="flex flex-wrap gap-2">
                    {proc.name === '冲压' && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">冲次:</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="次数"
                          value={proc.quantity ?? ''}
                          onChange={e => updateProcessQuantity(proc.name, parseFloat(e.target.value) || 0)}
                          className="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-h-[28px]"
                        />
                        <span className="text-[10px] text-gray-400">次</span>
                      </div>
                    )}
                    {subDef.map(param => (
                      <div key={param.name} className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">{param.label}:</span>
                        {param.type === 'select' && param.options ? (
                          <select
                            value={proc.subParams?.[param.name] ?? param.options[0]}
                            onChange={e => updateSubParam(proc.name, param.name, e.target.value)}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-h-[28px]"
                          >
                            {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            placeholder={param.label}
                            value={proc.subParams?.[param.name] ?? ''}
                            onChange={e => updateSubParam(proc.name, param.name, parseFloat(e.target.value) || '')}
                            className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-h-[28px]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---- 表面处理（合并材料+产品，二选一） ---- */}
        {(showMaterialSurface || showProductSurface) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">表面处理</label>
            <CustomSelect
              value={surfaceTreatment}
              options={getSurfaceTreatmentOptions().map(o => o.name)}
              onChange={val => { setSurfaceTreatment(val); setSurfaceColor(''); }}
            />
            {getSurfaceColorOptions().length > 0 && (
              <div className="mt-2">
                <label className="block text-[11px] text-gray-500 mb-1">颜色</label>
                <CustomSelect value={surfaceColor} options={getSurfaceColorOptions()} onChange={setSurfaceColor} />
              </div>
            )}
          </div>
        )}

        {/* ---- 其他参数（挤出专用） ---- */}
        {productType === '挤出' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">其他参数</label>
            {/* 模具钢价输入框已隐藏，后端使用默认值 18000 元/吨 */}
            <div style={{ display: 'none' }}>
              <label className="block text-[11px] text-gray-500 mb-1">
                模具钢价(元/吨)
                <span className="ml-1 text-[10px] text-gray-400">选填，默认18000(H13均价)</span>
              </label>
              <input
                type="number"
                min={0}
                placeholder="18000"
                value={dieSteelPrice}
                onChange={e => setDieSteelPrice(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
              />
            </div>
          </div>
        )}

        {/* ---- 图纸上传 ---- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
          <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">图纸上传（可选）</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : uploadedFile
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadedFile ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-left">
                  <FileText className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{uploadedFile.name}</div>
                    <div className="text-[10px] text-gray-400">{(uploadedFile.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeFile(); }}
                  className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className={`w-6 h-6 mx-auto mb-1.5 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="text-xs text-gray-500">拖拽文件到此处，或<span className="text-blue-500 font-medium">点击上传</span></p>
                <p className="text-[10px] text-gray-400 mt-1">支持 .dxf .dwg .step .stp .igs .pdf .jpg .png</p>
              </div>
            )}
          </div>
          <input
            type="text"
            placeholder="备注说明（可选）"
            value={fileRemark}
            onChange={e => setFileRemark(e.target.value)}
            className="w-full mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
          />
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-blue-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在计算...
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-left min-h-[36px]"
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>{value || '请选择'}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors ${
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
