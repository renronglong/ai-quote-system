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
  breakdown: Record<string, { formula: string; detail: string }>;
  aluminum_index: number;
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
  thickness: '厚度(mm)',
  productSize: '产品尺寸(长×宽×高mm)',
  quantity: '数量(件)',
  meterWeight: '米重(g/m)',
  netWeight: '产品净重(g)(选填)',
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
    width: 50, height: 20, length: 100, quantity: 1,
  });
  const [materialSurfaceTreatment, setMaterialSurfaceTreatment] = useState('无');
  const [materialColor, setMaterialColor] = useState('');
  const [processes, setProcesses] = useState<ProcessSelection[]>([]);
  const [productSurfaceTreatment, setProductSurfaceTreatment] = useState('无');
  const [productColor, setProductColor] = useState('');

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
    const defaultFields: Record<string, number | string> = { quantity: 1 };
    if (cat.fields.includes('width')) defaultFields.width = 50;
    if (cat.fields.includes('height')) defaultFields.height = 20;
    if (cat.fields.includes('length')) defaultFields.length = 100;
    if (cat.fields.includes('thickness')) defaultFields.thickness = 2;
    if (cat.fields.includes('productSize')) defaultFields.productSize = '';
    if (cat.fields.includes('meterWeight')) defaultFields.meterWeight = '';
    if (cat.fields.includes('netWeight')) defaultFields.netWeight = '';
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

  // ==================== Auto-calculate with debounce ====================
  const triggerCalculate = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      doCalculate();
    }, 500);
  }, [productType, materialCategory, fields, materialSurfaceTreatment, materialColor, processes, productSurfaceTreatment, productColor]);

  // Trigger on any field change
  useEffect(() => {
    triggerCalculate();
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [productType, materialCategory, fields, materialSurfaceTreatment, materialColor, processes, productSurfaceTreatment, productColor]);

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
      return [...prev, { name: procName }];
    });
  };

  const updateProcessQuantity = (procName: string, qty: number) => {
    setProcesses(prev => prev.map(p => p.name === procName ? { ...p, quantity: qty } : p));
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
    };
    if (materialSurfaceTreatment && materialSurfaceTreatment !== '无') {
      const mapped = surfaceMap[materialSurfaceTreatment];
      if (mapped) return { type: mapped, color: materialColor || null };
    }
    if (productSurfaceTreatment && productSurfaceTreatment !== '无' && productSurfaceTreatment !== '除油') {
      let mapped = surfaceMap[productSurfaceTreatment];
      if (!mapped) return null;
      if (productSurfaceTreatment === '氧化') {
        if (productColor && productColor !== '本色') mapped = '氧化上色';
        else mapped = '氧化本色';
      }
      return { type: mapped, color: productColor || null };
    }
    return null;
  };

  const mapProcesses = (): { secondary_operations: string[]; cut_count?: number } => {
    const processMap: Record<string, string> = {
      '冲压': '冲压', 'CNC加工': 'CNC加工', '车加工': '车加工',
      '钻孔': '钻孔', '攻牙': '攻丝', '激光切割': '激光切割',
      '折弯': '折弯', '抛光': '抛光', '除披锋': '去毛刺',
    };
    const secondaryOps: string[] = [];
    let cutCount: number | undefined;
    for (const proc of processes) {
      if (proc.name === '锯切') { cutCount = proc.quantity || 1; }
      else if (processMap[proc.name]) { secondaryOps.push(processMap[proc.name]); }
    }
    return { secondary_operations: secondaryOps, cut_count: cutCount };
  };

  const calcWeightKg = (): number | undefined => {
    const netWeight = fields.netWeight as number;
    if (netWeight && netWeight > 0) return netWeight / 1000;
    if (productType === '挤出') {
      const meterWeight = fields.meterWeight as number;
      const length = fields.length as number;
      if (meterWeight && length) return (meterWeight * length) / 1000000;
    }
    return undefined;
  };

  const buildDimensions = () => {
    const parsed = parseProductSize(fields.productSize as string);
    if (productType === '挤出') {
      const width = fields.width as number;
      const height = fields.height as number;
      const length = fields.length as number;
      if (width || height || length) return { length_mm: length || 0, width_mm: width || 0, height_mm: height || undefined };
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
            breakdown: data.breakdown || {},
            aluminum_index: data.aluminum_index || 0,
            notes: data.notes || [],
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
    const fieldOrder = ['width', 'height', 'length', 'meterWeight', 'thickness', 'productSize', 'quantity', 'netWeight'];
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
              return (
                <div key={fieldKey}>
                  <label className="block text-[11px] text-gray-500 mb-1">{FIELD_LABELS[fieldKey]}</label>
                  <input
                    type="number"
                    min={0}
                    value={(fields[fieldKey] as number) ?? ''}
                    onChange={e => setFields(prev => ({ ...prev, [fieldKey]: parseFloat(e.target.value) || 0 }))}
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

        {/* ---- 材料表面处理 (仅挤出) ---- */}
        {showMaterialSurface && categoryConfig?.materialSurfaceTreatment && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">材料表面处理</label>
            <CustomSelect
              value={materialSurfaceTreatment}
              options={categoryConfig.materialSurfaceTreatment}
              onChange={val => { setMaterialSurfaceTreatment(val); setMaterialColor(''); }}
            />
            {materialColorOpts.length > 0 && (
              <div className="mt-2">
                <label className="block text-[11px] text-gray-500 mb-1">材料颜色</label>
                <CustomSelect value={materialColor} options={materialColorOpts} onChange={setMaterialColor} />
              </div>
            )}
          </div>
        )}

        {/* ---- 加工工艺 ---- */}
        {categoryConfig && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">加工工艺（可多选）</label>
            <div className="flex flex-wrap gap-1.5">
              {categoryConfig.processes.map(proc => {
                const isNone = proc.name === '无';
                const isSelected = isNone ? processes.length === 0 : processes.some(p => p.name === proc.name);
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
                    {isSelected && proc.unit && !isNone && (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          min={0}
                          placeholder="数量"
                          value={processes.find(p => p.name === proc.name)?.quantity ?? ''}
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
          </div>
        )}

        {/* ---- 产品表面处理 + 颜色 ---- */}
        {showProductSurface && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">产品表面处理</label>
            <CustomSelect
              value={productSurfaceTreatment}
              options={productSurfaceOpts.map(o => o.name)}
              onChange={handleProductSurfaceChange}
            />
            {productColorOpts.length > 0 && (
              <div className="mt-2">
                <label className="block text-[11px] text-gray-500 mb-1">产品颜色</label>
                <CustomSelect value={productColor} options={productColorOpts} onChange={setProductColor} />
              </div>
            )}
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
