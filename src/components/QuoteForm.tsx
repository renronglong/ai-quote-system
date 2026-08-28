"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, X, Sparkles, Loader2, AlertTriangle, Plus, User, CheckCircle2 } from 'lucide-react';

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
  unit_price_ex_tax?: number;
  unit_price_in_tax?: number;
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

export interface BatchVariantResult {
  name: string;
  length: number;
  weight: number;
  quantity: number;
  surfaceTreatment?: string;
  result: PricingResult;
}

interface QuoteFormProps {
  onCalculate?: (data: QuoteFormData) => void;
  onResult?: (result: PricingResult | null) => void;
  onProductInfoChange?: (info: { productName: string; productCode: string }) => void;
  onBatchResult?: (results: BatchVariantResult[]) => void;
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
        materialSurfaceTreatment: ['无', '氧化', '喷砂氧化', '抛光氧化', '拉丝氧化', '喷涂'],
        materialColorMap: {
          '氧化': ['本色', '红色', '黑色', '金色', '铁灰色'],
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

// 标准件类别 → 尺寸输入配置
const CATEGORY_DIM_FIELDS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  '铝圆棒': [{ key: 'diameter', label: '直径 Ø(mm)', placeholder: '如 10' }],
  '铝方/扁棒': [
    { key: 'width', label: '宽度(mm)', placeholder: '如 20' },
    { key: 'height', label: '高度(mm)', placeholder: '如 10' },
  ],
  '铝六角棒': [{ key: 'hex', label: '对边距 H(mm)', placeholder: '如 10' }],
  '角铝': [
    { key: 'width', label: '边宽(mm)', placeholder: '如 20' },
    { key: 'height', label: '边高(mm)', placeholder: '如 20' },
    { key: 'thickness', label: '壁厚(mm)', placeholder: '如 2' },
  ],
  '铝圆管': [
    { key: 'outer', label: '外径(mm)', placeholder: '如 25' },
    { key: 'inner', label: '内径(mm)', placeholder: '如 23' },
  ],
  '铝六角管': [
    { key: 'hex', label: '对边距(mm)', placeholder: '如 10' },
    { key: 'inner', label: '内径(mm)', placeholder: '如 5' },
  ],
  '异型材': [
    { key: 'width', label: '宽度(mm)', placeholder: '如 30' },
    { key: 'height', label: '高度(mm)', placeholder: '如 15' },
    { key: 'meterWeight', label: '米重(kg/m)', placeholder: '如 0.5' },
    { key: 'perimeter', label: '周长(mm)', placeholder: '如 100' },
  ],
  // 异型材需要额外选择模具类型
};

const CATEGORY_NEEDS_DIE_SELECTION = ['异型材'];


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

export default function QuoteForm({ onCalculate, onResult, onProductInfoChange, onBatchResult, aiData }: QuoteFormProps) {
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
  const [materialGrade, setMaterialGrade] = useState('');
  const [materialColor, setMaterialColor] = useState('');
  const [processes, setProcesses] = useState<ProcessSelection[]>([]);
  const [productSurfaceTreatment, setProductSurfaceTreatment] = useState('无');
  const [productColor, setProductColor] = useState('');
  const [surfaceTreatment, setSurfaceTreatment] = useState('无');
  const [surfaceColor, setSurfaceColor] = useState('');
  const [materialSizeType, setMaterialSizeType] = useState<'long' | 'short'>('short');
  const [meterWeightManual, setMeterWeightManual] = useState(false);
  const [quantityManual, setQuantityManual] = useState(false);
  const [perimeterManual, setPerimeterManual] = useState(false);
  const [dieSteelPrice, setDieSteelPrice] = useState<string>('');

  // Saved variants (multi-length quoting for extrusion)
  const [savedVariants, setSavedVariants] = useState<{id: string, length: number, weight: number, quantity: number}[]>([]);

  // Standard parts state (异型材/标准件 toggle)
  // 统一流程：不再区分异型材/标准件，所有挤出型材走品类选择+模具匹配
  const [standardCategory, setStandardCategory] = useState('');
  const [standardCategories, setStandardCategories] = useState<{key:string;label:string;count:number;mold_type:string}[]>([]);

  // Mold matching state (尺寸匹配现有模具)
  const [moldMatches, setMoldMatches] = useState<any[]>([]);
  const [moldMatchLoading, setMoldMatchLoading] = useState(false);
  const [selectedMoldId, setSelectedMoldId] = useState<string | null>(null);
  const [useExistingMold, setUseExistingMold] = useState<boolean | null>(null); // null=未选择, true=现有, false=新开
  const moldMatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressMoldMatch = useRef(false);

  // Parse cross_section_mm into dimension field values based on category
  const parseMoldDimensions = (category: string, cs: string): Record<string, number> => {
    if (!cs) return {};
    const s = cs.trim();
    const phi = s.match(/[ΦφØ∅]\s*([\d.]+)/);
    if (phi) return { width: parseFloat(phi[1]) }; // 圆棒/六角棒单值→width
    const parts = s.split(/[×xX*]/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n) && n > 0);
    if (category === '角铝' && parts.length >= 3) return { width: parts[0], height: parts[1], thickness: parts[2] };
    // 圆管/六角管/方扁棒 都是两值，统一映射到 width/height
    if (parts.length >= 2) return { width: parts[0], height: parts[1] };
    if (parts.length === 1) return { width: parts[0] };
    return {};
  };
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileRemark, setFileRemark] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recogResult, setRecogResult] = useState<Record<string, any> | null>(null);
  const [recogError, setRecogError] = useState<string | null>(null);
  const [deepQuoteLoading, setDeepQuoteLoading] = useState(false);
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


  // ==================== Fetch standard parts categories on mount ====================
  useEffect(() => {
    fetch('/api/standard-parts')
      .then(r => r.json())
      .then(d => { if (d.success) setStandardCategories(d.categories || []); })
      .catch(e => console.error('Failed to load standard parts:', e));
  }, []);

  // ==================== Fetch specs when category changes ====================


  // 重置型材品类相关状态（切换型材类别时调用）
  const resetProfileState = () => {
    setMoldMatches([]);
    setSelectedMoldId(null);
    setUseExistingMold(null);
    setFields(prev => ({
      ...prev,
      perimeter: '',
      meterWeight: '',
      num_cavities: '',
      die_type: '',
      width: '',
      height: '',
    }));
  };

  // Debounced mold matching when dimensions change in standard mode
  // Build a signature of only the dimension fields that drive mold search
  const moldSearchSig = (() => {
    if (productType !== '挤出' || !standardCategory) return '';
    const dimFields = CATEGORY_DIM_FIELDS[standardCategory];
    if (!dimFields) return '';
    const parts: string[] = [standardCategory];
    const sigFieldMap: Record<string, string> = { diameter: 'width', hex: 'width', outer: 'width', inner: 'height' };
    for (const df of dimFields) {
      const k = sigFieldMap[df.key] || df.key;
      parts.push(`${k}=${fieldsRef.current[k] ?? ''}`);
    }
    if (standardCategory === '异型材') {
      parts.push(`perimeter=${fieldsRef.current.perimeter ?? ''}`);
      parts.push(`meterWeight=${fieldsRef.current.meterWeight ?? ''}`);
      parts.push(`die_type=${fieldsRef.current.die_type ?? ''}`);
    }
    return parts.join('|');
  })();

  useEffect(() => {
    if (productType !== '挤出' || !standardCategory) return;
    if (suppressMoldMatch.current) { suppressMoldMatch.current = false; return; }
    const dimFields = CATEGORY_DIM_FIELDS[standardCategory];
    if (!dimFields) return;

    if (moldMatchTimer.current) clearTimeout(moldMatchTimer.current);
    moldMatchTimer.current = setTimeout(async () => {
      const cur = fieldsRef.current;
      // 异型材必须先选模具类型再搜索
      if (standardCategory === '异型材' && !cur.die_type) {
        setMoldMatches([]);
        setSelectedMoldId(null);
        setUseExistingMold(null);
        return;
      }
      const dimFieldMap: Record<string, string> = { diameter: 'width', hex: 'width', outer: 'width', inner: 'height' };
      const params = new URLSearchParams({ category: standardCategory });
      let hasInput = false;
      for (const df of dimFields) {
        const stateKey = dimFieldMap[df.key] || df.key;
        const val = cur[stateKey] as number;
        if (val && val > 0) {
          params.set(df.key, String(val));
          hasInput = true;
        }
      }
      if (standardCategory === '异型材') {
        if (cur.width) { params.set('width', String(cur.width)); hasInput = true; }
        if (cur.height) { params.set('height', String(cur.height)); hasInput = true; }
        if (cur.meterWeight) { params.set('meter_weight', String(cur.meterWeight)); hasInput = true; }
        if (cur.perimeter) { params.set('perimeter', String(cur.perimeter)); hasInput = true; }
        if (cur.die_type) params.set('die_type', cur.die_type as string);
      } else if (cur.perimeter) {
        params.set('perimeter', String(cur.perimeter));
      }
      if (!hasInput) { setMoldMatches([]); setSelectedMoldId(null); setUseExistingMold(null); return; }

      setMoldMatchLoading(true);
      try {
        const res = await fetch(`/api/mold-match?${params.toString()}`);
        const data = await res.json();
        if (data.success) {
          setMoldMatches(data.matches || []);
          const exact = (data.matches || []).find((m: any) => m.match_score >= 98);
          if (exact) {
            suppressMoldMatch.current = true;
            setSelectedMoldId(exact.id);
            setUseExistingMold(true);
            const dims = parseMoldDimensions(standardCategory, exact.cross_section_mm);
            setFields(prev => ({
              ...prev,
              ...dims,
              die_type: exact.mold_type === '分流模' ? 'split' : 'flat',
              perimeter: exact.perimeter || prev.perimeter,
              meterWeight: exact.weight_per_meter || prev.meterWeight,
            }));
            if (exact.perimeter) setPerimeterManual(true);
            if (exact.weight_per_meter) setMeterWeightManual(true);
          } else {
            setSelectedMoldId(null);
            setUseExistingMold(null);
          }
        }
      } catch (e) {
        console.error('Mold match failed:', e);
      } finally {
        setMoldMatchLoading(false);
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productType, standardCategory, moldSearchSig]);


  // Reset manual flags when switching to standard mode
  useEffect(() => {
    if (productType === '挤出') {
      setPerimeterManual(false);
      setMeterWeightManual(false);
    }
  }, [productType]);

  // ==================== Auto-calculate meter weight from cross-section ====================
  // DISABLED: 米重/重量由用户手动输入，不再根据宽高自动计算
  // useEffect(() => {
  //   if (productType !== '挤出') return;
  //   if (meterWeightManual) return;
  //   ...
  // }, [fields.width, fields.height, productType, materialCategory]);

  // ==================== Perimeter: only auto-fill from DB on spec select; no formula fallback ====================
  // 2*(w+h) is wrong for non-rectangular cross-sections, removed.

  // ==================== Auto 锯切：挤出长度<3000mm 默认勾选锯切 ====================
  // 注意：不再按长度强制切换"小料/长料"按钮，用户可手动选择（<3m也可走长料氧化后加工）
  const autoSawAppliedRef = useRef(false);
  const lastLenRef = useRef(0);
  useEffect(() => {
    if (productType !== '挤出') { autoSawAppliedRef.current = false; return; }
    const len = Number(fields.length) || 0;
    if (len === lastLenRef.current) return;
    lastLenRef.current = len;

    const hasSaw = processes.some(p => p.name === '锯切');
    if (len > 0 && len < 3000) {
      // <3m：默认加锯切（用户可手动取消）
      if (!hasSaw) {
        setProcesses(prev => [...prev, { name: '锯切', quantity: 1 }]);
        autoSawAppliedRef.current = true;
      }
    } else if (len >= 3000) {
      // ≥3m物理长料：移除锯切+二次加工（整根出货，无法再冲压/CNC）
      const blocked = ['锯切','冲压','CNC加工','车加工','钻孔','攻牙'];
      const filtered = processes.filter(p => !blocked.includes(p.name));
      if (filtered.length !== processes.length) setProcesses(filtered);
      autoSawAppliedRef.current = false;
    }
  }, [productType, fields.length]);

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
  }, [productType, materialCategory, fields, materialSurfaceTreatment, materialColor, processes, productSurfaceTreatment, productColor, surfaceTreatment, surfaceColor, materialSizeType, dieSteelPrice, materialGrade]);

  // Trigger on any field change
  useEffect(() => {
    triggerCalculate();
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [productType, materialCategory, fields, materialSurfaceTreatment, materialColor, processes, productSurfaceTreatment, productColor, surfaceTreatment, surfaceColor, materialSizeType, dieSteelPrice, materialGrade]);

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
      '喷涂': '喷涂', '氧化': '氧化本色', '电镀': '镀锌/镀镍',
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
    const hasBatchVariants = productType === '挤出' && savedVariants.length > 0;
    if (cat) {
      const isStdMode = productType === '挤出';
      const requiredDims = isStdMode
        ? ['length']
        : cat.fields.filter(f => ['width', 'height', 'length', 'thickness', 'productSize'].includes(f));
      // In batch mode with saved variants, length in current form is optional
      const dimsToCheck = hasBatchVariants ? requiredDims.filter(f => f !== 'length') : requiredDims;
      const allFilled = dimsToCheck.every(f => {
        const val = fields[f];
        return val !== '' && val !== undefined && val !== null && Number(val) > 0;
      });
      if (!allFilled) {
        onResult?.(null);
        return;
      }
      if (hasBatchVariants) {
        // Need at least some saved variants with valid data
        const hasValid = savedVariants.some(v => v.length > 0 && v.weight > 0);
        if (!hasValid) {
          onResult?.(null);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const surfaceTreatment = mapSurfaceTreatment();
      const processInfo = mapProcesses();

      // ---- Batch mode: saved variants + current form value ----
      if (hasBatchVariants) {
        const baseDimensions = buildDimensions();
        const batchResults: BatchVariantResult[] = [];
        let firstResult: PricingResult | null = null;

        // Build all variants: saved variants + current form (if current length > 0)
        const allVariants: { length: number; weight: number; quantity: number }[] = [...savedVariants];
        const curLen = parseFloat(fields.length as string) || 0;
        const curMw = parseFloat(fields.meterWeight as string) || 0;
        const curWeight = curLen > 0 && curMw > 0 ? Math.round(curMw * curLen / 1000 * 1000) / 1000 : 0;
        const curQty = parseFloat(fields.quantity as string) || 1;
        if (curLen > 0 && curWeight > 0) {
          allVariants.push({ length: curLen, weight: curWeight, quantity: curQty });
        }

        for (let vi = 0; vi < allVariants.length; vi++) {
          const variant = allVariants[vi];
          const vLength = variant.length;
          const vWeight = variant.weight;
          const vQuantity = variant.quantity;
          if (!(vLength > 0) || !(vWeight > 0)) continue;

          const dimensions = baseDimensions ? { ...baseDimensions } : {};
          (dimensions as any).length_mm = vLength;
          if (productType === '挤出') (dimensions as any).material_size_type = materialSizeType;

          const vWeightKg = vWeight / 1000;

          const payload: Record<string, any> = {
            product_type: mapProductType(),
            material: { category: mapMaterialCategory(), grade: materialGrade || undefined },
            quantity: vQuantity,
          };
          if (productName) payload.product_name = productName;
          if (productCode) payload.product_code = productCode;
          payload.dimensions = dimensions;
          payload.weight_per_piece_kg = vWeightKg;
          if (surfaceTreatment) payload.surface_treatment = surfaceTreatment;
          if (processInfo.secondary_operations.length > 0 || processInfo.cut_count !== undefined) {
            payload.process = processInfo;
          }
          // Mold cost only on first variant
          if (vi > 0) {
            payload.skip_mold_cost = useExistingMold === true;
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
                unit_price: data.unit_price_ex_tax || data.unit_price || 0,
                unit_price_ex_tax: data.unit_price_ex_tax || data.unit_price || 0,
                unit_price_in_tax: data.unit_price_in_tax || 0,
                total_price: data.total_price || 0,
                weight_per_piece_kg: data.weight_per_piece_kg || 0,
                material_utilization_rate: data.material_utilization_rate,
                breakdown: data.breakdown || {},
                aluminum_index: data.aluminum_index || 0,
                notes: data.notes || [],
                mold_cost: data.mold_cost || 0,
                min_order_qty: data.min_order_qty || 0,
              };
              batchResults.push({
                name: productName || '产品',
                length: vLength,
                weight: vWeight,
                quantity: vQuantity,
                surfaceTreatment: surfaceTreatment?.type || '',
                result,
              });
              if (!firstResult) firstResult = result;
            }
          }
        }

        if (firstResult) {
          onResult?.(firstResult);
          onBatchResult?.(batchResults);
          if (onCalculate) {
            onCalculate({
              productType, materialCategory,
              quantity: (fields.quantity as number) || 1,
              width: fields.width as number, height: fields.height as number,
              length: allVariants[0]?.length || 0,
              thickness: fields.thickness as number,
              productSize: fields.productSize as string,
              meterWeight: fields.meterWeight as number, netWeight: fields.netWeight as number,
              materialSurfaceTreatment, materialColor, processes,
              productSurfaceTreatment, productColor,
            });
          }
        } else {
          onResult?.(null);
          onBatchResult?.([]);
        }
        setLoading(false);
        return;
      }

      // ---- Normal (single) mode ----
      const weightKg = calcWeightKg();
      const dimensions = buildDimensions();
      const payload: Record<string, any> = {
        product_type: mapProductType(),
        material: { category: mapMaterialCategory(), grade: materialGrade || undefined },
        quantity: (fields.quantity as number) || 1,
      };
      if (productName) payload.product_name = productName;
      if (productCode) payload.product_code = productCode;
      if (dimensions) {
        if (productType === '挤出') (dimensions as any).material_size_type = materialSizeType;
        payload.dimensions = dimensions;
      }
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
            unit_price: data.unit_price_ex_tax || data.unit_price || 0,
            unit_price_ex_tax: data.unit_price_ex_tax || data.unit_price || 0,
            unit_price_in_tax: data.unit_price_in_tax || 0,
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
          onBatchResult?.([]);
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
  // 图片扩展名 — 触发AI识别
  const AI_RECOG_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf'];
  // CAD扩展名 — 本地解析或转发
  const CAD_EXTS = ['.dxf', '.dwg', '.step', '.stp', '.igs'];

  const isValidFile = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  };

  const applyRecogToForm = (d: Record<string, any>) => {
    // 产品类型映射
    if (d.product_type) {
      const ptMap: Record<string,string> = {
        extrusion: '挤出', stamping: '板材', die_casting: '压铸',
        cnc: '板材', injection: '注塑',
      };
      const mapped = ptMap[d.product_type];
      if (mapped && PRODUCT_TYPES[mapped]) setProductType(mapped);
    }
    if (d.material_category) {
      // 归一化：识别返回的类别名映射到表单配置key
      const catMap: Record<string,string> = {
        '铝合金': '铝型材', '铝型材': '铝型材', '铝': '铝型材',
        '不锈钢': '不锈钢', '冷轧板': '冷轧板', '冷板': '冷轧板',
        '压铸铝': '压铸铝', '塑胶': '塑胶',
      };
      setMaterialCategory(catMap[d.material_category] || d.material_category);
    }
    if (d.product_code) setProductCode(d.product_code);
    if (d.product_name) setProductName(d.product_name);
    setFields(prev => {
      const next = { ...prev };
      if (typeof d.width === 'number') next.width = d.width;
      if (typeof d.height === 'number') next.height = d.height;
      if (typeof d.length === 'number') next.length = d.length;
      if (typeof d.perimeter === 'number') next.perimeter = d.perimeter;
      if (typeof d.num_cavities === 'number') next.num_cavities = d.num_cavities;
      if (d.die_type === 'flat' || d.die_type === 'split') next.die_type = d.die_type;
      if (typeof d.meter_weight === 'number') next.meterWeight = d.meter_weight;
      if (typeof d.quantity === 'number') next.quantity = d.quantity;
      if (typeof d.wall_thickness === 'number') next.thickness = d.wall_thickness;
      return next;
    });
    if (d.material_grade) setMaterialGrade(d.material_grade);
    if (d.surface_treatment && d.surface_treatment !== '无') {
      setMaterialSurfaceTreatment(d.surface_treatment);
      setProductSurfaceTreatment(d.surface_treatment);
    }
    // 工序：Bot返回格式如 "锯切,冲压(3次),CNC加工(10分钟)"
    if (d.processes && typeof d.processes === 'string' && d.processes !== '无') {
      const procs: ProcessSelection[] = d.processes.split(/[,，、]/).map((p: string) => {
        const m = p.trim().match(/^(.+?)(?:\((\d+)(分钟|次|mm|个)?\))?$/);
        if (m) return { name: m[1], count: m[2] ? parseInt(m[2]) : undefined, unit: m[3] || undefined };
        return { name: p.trim() };
      }).filter((p: ProcessSelection) => p.name);
      if (procs.length > 0) setProcesses(procs);
    }
    // 备注/说明
    if (d.notes) setFileRemark(prev => prev ? prev + '; ' + d.notes : d.notes);
    setAiSynced(true);
    setTimeout(() => setAiSynced(false), 2500);
  };

  // PDF文件在浏览器端用pdf.js转为PNG，再发给AI识别
  const convertPdfToPng = async (pdfFile: File): Promise<File> => {
    // 动态加载pdf.js（CDN，禁用Worker避免CORS）
    if (!(window as any).pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = () => {
          (window as any).pdfjsLib = (window as any).pdfjsLib || (window as any).pdfjs;
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = '';
          resolve();
        };
        s.onerror = () => reject(new Error('pdf.js加载失败'));
        document.head.appendChild(s);
      });
    }
    const pdfjsLib = (window as any).pdfjsLib;
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true }).promise;
    const page = await pdf.getPage(1);
    const scale = 200 / 72;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], pdfFile.name.replace(/\.pdf$/i, '.png'), { type: 'image/png' }));
        } else {
          reject(new Error('PDF转图片失败'));
        }
      }, 'image/png');
    });
  };

  const recognizeFile = async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!AI_RECOG_EXTS.includes(ext)) return; // 3D CAD走原有解析流程
    setRecognizing(true);
    setRecogError(null);
    setRecogResult(null);
    try {
      let fileToSend = file;
      if (file.name.toLowerCase().endsWith('.pdf')) {
        setRecogError('PDF正在转为图片识别...');
        fileToSend = await convertPdfToPng(file);
        setRecogError(null);
      }
      const fd = new FormData();
      fd.append('file', fileToSend);
      const resp = await fetch('/api/recognize-drawing', { method: 'POST', body: fd });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        setRecogError(json.error || '识别失败');
        return;
      }
      const d = json.data || {};
      setRecogResult(d);
      if (json.autoFill && d.confidence >= 0.75) {
        applyRecogToForm(d);
      }
    } catch (e: any) {
      setRecogError(e?.message || '网络错误');
    } finally {
      setRecognizing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) {
      setUploadedFile(file);
      recognizeFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isValidFile(file)) {
      setUploadedFile(file);
      recognizeFile(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setRecogResult(null);
    setRecogError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const requestDeepQuote = async () => {
    if (!uploadedFile || deepQuoteLoading) return;
    setDeepQuoteLoading(true);
    setRecogError('正在进行深度识别，请稍候（可能需要30-60秒）...');
    try {
      let fileToSend = uploadedFile;
      // PDF需要先在前端转为PNG
      if (uploadedFile.name.toLowerCase().endsWith('.pdf')) {
        setRecogError('PDF正在转为图片识别，请稍候...');
        fileToSend = await convertPdfToPng(uploadedFile);
      }
      const fd = new FormData();
      fd.append('file', fileToSend);
      fd.append('remark', fileRemark || (recogResult?.handoff_reason as string) || '');
      const resp = await fetch('/api/forward-cad', { method: 'POST', body: fd });
      const text = await resp.text();
      let result: any;
      try { result = JSON.parse(text); } catch { result = { success: false, message: '服务器返回异常: ' + text.substring(0, 200) }; }
      if (result.success && result.autoFill && result.data) {
        applyRecogToForm(result.data);
        setRecogResult(result.data);
        setRecogError(null);
        setUploadedFile(null);
      } else {
        setRecogError(result.message || result.error || '深度识别完成，已提交工程师人工报价');
      }
    } catch (e: any) {
      setRecogError('深度报价提交失败: ' + (e?.message || '网络错误'));
    } finally {
      setDeepQuoteLoading(false);
    }
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
    let visibleFields = fieldOrder.filter(f => categoryConfig.fields.includes(f));
    // In standard mode, hide num_cavities, die_type, width, height, perimeter
    // (these are handled by structured dimension inputs + mold matching)
    if (productType === '挤出') {
      visibleFields = visibleFields.filter(f =>
        f !== 'num_cavities' && f !== 'die_type' &&
        f !== 'width' && f !== 'height' && f !== 'perimeter'
      );
    }


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
                const cavLabel = !cavVal ? '' : fields.die_type === 'split' ? '分流模' : '平模';
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
                        <option key={opt} value={opt}>{opt}{fields.die_type === 'split' ? ' (分流模)' : fields.die_type === 'flat' ? ' (平模)' : ''}</option>
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
              // Length field with "+" button for extrusion multi-length
              if (fieldKey === 'length' && productType === '挤出') {
                const lengthVal = parseFloat(fields.length as string) || 0;
                const mwVal = parseFloat(fields.meterWeight as string) || 0;
                const calcWeight = lengthVal > 0 && mwVal > 0 ? Math.round(mwVal * lengthVal / 1000 * 1000) / 1000 : 0;
                const canAdd = lengthVal > 0 && calcWeight > 0;
                return (
                  <div key={fieldKey}>
                    <label className="block text-[11px] text-gray-500 mb-1">{FIELD_LABELS[fieldKey]}</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        value={(fields[fieldKey] as number) ?? ''}
                        onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setFields(prev => ({ ...prev, [fieldKey]: val }));
                          }}
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                      />
                      <button
                        type="button"
                        disabled={!canAdd}
                        onClick={() => {
                          const len = parseFloat(fields.length as string) || 0;
                          const mw = parseFloat(fields.meterWeight as string) || 0;
                          const w = Math.round(mw * len / 1000 * 1000) / 1000;
                          const qty = parseFloat(fields.quantity as string) || 1;
                          if (len > 0 && w > 0) {
                            setSavedVariants(prev => [...prev, { id: 'v' + Date.now(), length: len, weight: w, quantity: qty }]);
                            setFields(prev => ({ ...prev, length: 0 }));
                          }
                        }}
                        className={`shrink-0 rounded-lg px-2 text-sm font-bold transition-all min-h-[36px] ${
                          canAdd
                            ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                        title="保存当前长度到批量列表"
                      >
                        +
                      </button>
                    </div>
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

        {/* ---- 型材类别选择 (仅挤出) ---- */}
        {productType === '挤出' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
              <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">型材类别</label>
              <div className="flex flex-wrap gap-1.5">
                {standardCategories.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => { setStandardCategory(cat.key); resetProfileState(); setFields(prev => ({ ...prev, die_type: CATEGORY_NEEDS_DIE_SELECTION.includes(cat.key) ? '' : (cat.mold_type === '分流模' ? 'split' : 'flat') })); }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs transition-all duration-200 ${
                      standardCategory === cat.key
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {cat.label}
                    <span className="ml-1 text-[10px] opacity-60">({cat.count})</span>
                    {!CATEGORY_NEEDS_DIE_SELECTION.includes(cat.key) && (
                      <span className={`ml-1 text-[10px] ${cat.mold_type === '分流模' ? 'text-red-400' : 'text-gray-400'}`}>
                        {cat.mold_type}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ---- 尺寸输入 + 模具匹配 ---- */}
        {productType === '挤出' && standardCategory && (() => {
          const dimFields = CATEGORY_DIM_FIELDS[standardCategory];
          if (!dimFields) return null;
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
              <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                输入尺寸 · 自动匹配现有模具
              </label>
              {CATEGORY_NEEDS_DIE_SELECTION.includes(standardCategory) && (
                <div className="mb-2">
                  <label className="block text-[10px] text-gray-400 mb-1">模具类型（先选再搜）</label>
                  <div className="flex gap-2">
                    {([{ v: 'flat', label: '平模（实心）' }, { v: 'split', label: '分流模（中空）' }] as const).map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => { setFields(prev => ({ ...prev, die_type: opt.v })); setSelectedMoldId(null); setUseExistingMold(null); }}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          fields.die_type === opt.v
                            ? opt.v === 'split'
                              ? 'bg-red-50 border-red-300 text-red-600'
                              : 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {CATEGORY_NEEDS_DIE_SELECTION.includes(standardCategory) && !fields.die_type && (
                <div className="mb-2 text-[11px] text-amber-500">请先选择模具类型，再输入尺寸匹配</div>
              )}
              <div className={`grid ${dimFields.length >= 3 ? 'grid-cols-3' : dimFields.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                {dimFields.map(df => {
                  const fieldMap: Record<string, string> = { diameter: 'width', hex: 'width', outer: 'width', inner: 'height' };
                  const stateKey = fieldMap[df.key] || df.key;
                  return (
                    <div key={df.key}>
                      <label className="block text-[10px] text-gray-400 mb-0.5">{df.label}</label>
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        placeholder={df.placeholder}
                        value={(fields[stateKey] as number) ?? ''}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setFields(prev => ({ ...prev, [stateKey]: val }));
                          setSelectedMoldId(null);
                          setUseExistingMold(null);
                          setPerimeterManual(false);
                          setMeterWeightManual(false);
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                      />
                    </div>
                  );
                })}
              </div>

              {/* 模具匹配结果 */}
              {moldMatchLoading && (
                <div className="mt-2 text-center text-[11px] text-gray-400 py-2">
                  <span className="inline-block animate-spin mr-1">⟳</span> 正在匹配现有模具...
                </div>
              )}

              {!moldMatchLoading && moldMatches.length > 0 && !(selectedMoldId && useExistingMold) && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[11px] font-medium text-gray-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    找到 {moldMatches.length} 个相近模具（公差≤15%）
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {moldMatches.slice(0, 5).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          suppressMoldMatch.current = true;
                          if (moldMatchTimer.current) clearTimeout(moldMatchTimer.current);
                          setSelectedMoldId(m.id);
                          setUseExistingMold(true);
                          const dims = parseMoldDimensions(standardCategory, m.cross_section_mm);
                          setFields(prev => ({
                            ...prev,
                            ...dims,
                            die_type: m.mold_type === '分流模' ? 'split' : 'flat',
                            perimeter: m.perimeter || prev.perimeter,
                            meterWeight: m.weight_per_meter || prev.meterWeight,
                          }));
                          setPerimeterManual(true);
                          setMeterWeightManual(true);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                          selectedMoldId === m.id
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-green-50/50 hover:border-green-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium shrink-0">{m.cross_section_mm}</span>
                          <span className="text-gray-400 shrink-0">·</span>
                          <span className="text-gray-500 truncate">{m.weight_per_meter}kg/m</span>
                          <span className={`shrink-0 px-1 py-0.5 rounded text-[9px] ${
                            m.mold_type === '分流模' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'
                          }`}>{m.mold_type}</span>
                        </div>
                        <span className={`shrink-0 ml-1.5 font-bold ${
                          m.match_score >= 95 ? 'text-green-600' : m.match_score >= 80 ? 'text-amber-600' : 'text-gray-400'
                        }`}>{m.match_score}%</span>
                      </button>
                    ))}
                  </div>

                  {/* 已选模具提示 */}
                  {selectedMoldId && useExistingMold && (() => {
                    const sel = moldMatches.find((mm: any) => mm.id === selectedMoldId);
                    return (
                      <div className="mt-2 flex items-center justify-between px-2.5 py-1.5 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-green-600 text-xs">✓</span>
                          <span className="text-xs font-medium text-green-700 truncate">{sel?.cross_section_mm || '已选模具'}</span>
                          <span className="text-[10px] text-gray-400">{sel?.weight_per_meter}kg/m</span>
                        </div>
                        <button type="button" onClick={() => { setSelectedMoldId(null); setUseExistingMold(null); }} className="text-[10px] text-blue-500 hover:text-blue-700 shrink-0 ml-2">更换</button>
                      </div>
                    );
                  })()}

                  {/* 选择：使用现有模具 or 开新模 */}
                  {!(selectedMoldId && useExistingMold) && (
                  <div className="flex gap-2 pt-1.5 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setUseExistingMold(true)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                        useExistingMold === true
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-green-200'
                      }`}
                    >
                      ✓ 用现有模具（免模具费）
                    </button>
                    <button
                      type="button"
                      onClick={() => { suppressMoldMatch.current = true; if (moldMatchTimer.current) clearTimeout(moldMatchTimer.current); setUseExistingMold(false); setSelectedMoldId(null); }}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                        useExistingMold === false
                          ? 'bg-orange-50 border-orange-300 text-orange-700'
                          : 'bg-white border-gray-200 text-gray-500 hover:border-orange-200'
                      }`}
                    >
                      ✦ 开新模具
                    </button>
                  </div>
                  )}
                </div>
              )}

              {!moldMatchLoading && moldMatches.length === 0 && standardCategory && (fields.width || fields.height || fields.perimeter || fields.meterWeight) && (
                <div className="mt-2 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <span className="text-[11px] text-orange-600">未找到相近现有模具</span>
                  <button
                    type="button"
                    onClick={() => setUseExistingMold(false)}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-all ${
                      useExistingMold === false
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white border-orange-300 text-orange-600 hover:bg-orange-100'
                    }`}
                  >
                    开新模具
                  </button>
                </div>
              )}
            </div>
          );
        })()}

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
            {/* 长料/小料切换 — 仅挤压铝型材显示 */}
            {productType === '挤出' && surfaceTreatment && surfaceTreatment !== '无' && (
              <div className="mt-2">
                <label className="block text-[11px] text-gray-500 mb-1">材料规格</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMaterialSizeType('short')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                      materialSizeType === 'short'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    小料 (&lt;3000mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialSizeType('long')}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                      materialSizeType === 'long'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    长料 (≥3000mm)
                  </button>
                </div>
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

            {/* 已保存的批量变体标签 */}
            {savedVariants.length > 0 && (
              <div className="mt-2">
                <label className="block text-[11px] text-gray-500 mb-1">
                  已保存长度
                  <span className="ml-1 text-[10px] text-gray-400">(截面参数共用，模具费只算一次)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {savedVariants.map((v, idx) => (
                    <span
                      key={v.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium"
                    >
                      #{idx + 1} {v.length}mm · {Math.round(v.weight)}g
                      {v.quantity > 1 ? ` ×${v.quantity}` : ''}
                      <button
                        type="button"
                        onClick={() => setSavedVariants(prev => prev.filter(sv => sv.id !== v.id))}
                        className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSavedVariants([])}
                  className="mt-1.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                >
                  清空全部
                </button>
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

          {/* 识别中 */}
          {recognizing && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              正在AI识别图纸参数...
            </div>
          )}

          {/* 识别错误 */}
          {recogError && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-amber-700">{recogError}</div>
                {uploadedFile && (
                  <button
                    type="button"
                    onClick={requestDeepQuote}
                    disabled={deepQuoteLoading}
                    className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 text-white text-[11px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deepQuoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
                    {deepQuoteLoading ? '深度识别中...' : '申请深度报价'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 识别结果 */}
          {recogResult && !recogError && (
            <div className={`mt-2 rounded-lg border p-2.5 ${
              recogResult.needs_human
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                {recogResult.needs_human ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span className={`text-[11px] font-semibold ${
                  recogResult.needs_human ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {recogResult.needs_human ? '识别不确定，请确认参数' : 'AI已自动填入参数'}
                  {typeof recogResult.confidence === 'number' && (
                    <span className="ml-1 opacity-70">（置信度{(recogResult.confidence*100).toFixed(0)}%）</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
                {recogResult.width != null && <div>宽: <b>{recogResult.width}mm</b></div>}
                {recogResult.height != null && <div>高: <b>{recogResult.height}mm</b></div>}
                {recogResult.wall_thickness != null && <div>壁厚: <b>{recogResult.wall_thickness}mm</b></div>}
                {recogResult.length != null && <div>长: <b>{recogResult.length}mm</b></div>}
                {recogResult.perimeter != null && <div>周长: <b>{recogResult.perimeter}mm</b></div>}
                {recogResult.meter_weight != null && <div>米重: <b>{recogResult.meter_weight}kg/m</b></div>}
                {recogResult.num_cavities != null && <div>面域: <b>{recogResult.num_cavities}</b></div>}
                {recogResult.material_grade && <div className="col-span-2">材质: <b>{recogResult.material_grade}</b></div>}
                {recogResult.product_code && <div className="col-span-2">图号: <b>{recogResult.product_code}</b></div>}
              </div>
              {recogResult.handoff_reason && (
                <div className="mt-1.5 text-[10px] text-amber-600">{recogResult.handoff_reason}</div>
              )}
              <div className="mt-2 flex gap-2">
                {recogResult.needs_human && (
                  <>
                    <button
                      type="button"
                      onClick={() => applyRecogToForm(recogResult)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500 text-white text-[11px] font-medium hover:bg-emerald-600 transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      确认填入
                    </button>
                    <button
                      type="button"
                      onClick={requestDeepQuote}
                      disabled={deepQuoteLoading}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 text-white text-[11px] font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deepQuoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
                      {deepQuoteLoading ? '深度识别中...' : '申请深度报价'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
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

