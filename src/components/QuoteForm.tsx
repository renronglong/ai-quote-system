"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, X, Sparkles, Loader2, AlertTriangle, Plus, User, CheckCircle2, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

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
  quantity?: number | string;
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


interface QuoteFormProps {
  onCalculate?: (data: QuoteFormData) => void;
  onResult?: (result: PricingResult | null) => void;
  onProductInfoChange?: (info: { productName: string; productCode: string }) => void;
  onSaveVariant?: () => Promise<boolean>;
  onNewQuote?: () => void;
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
    label: '挤出铝型材',
    icon: '⊞',
    materialCategories: {
      '异型材': {
        label: '异型材',
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
      '标准件': {
        label: '标准件',
        fields: ['width', 'height', 'length', 'perimeter', 'meterWeight', 'quantity', 'netWeight'],
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
        fields: ['thickness', 'productSize', 'quantity'],
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
        fields: ['thickness', 'productSize', 'quantity'],
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
        fields: ['thickness', 'productSize', 'quantity'],
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
        fields: ['thickness', 'productSize', 'quantity'],
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
    icon: '🧪',
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
  perimeter: '外周长(mm)',
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
  '铝方管': [
    { key: 'width', label: '宽(mm)', placeholder: '如 30' },
    { key: 'height', label: '高(mm)', placeholder: '如 20' },
    { key: 'thickness', label: '壁厚(mm)', placeholder: '如 1.5' },
  ],
  '异型材': [
    { key: 'width', label: '宽度(mm)', placeholder: '如 30' },
    { key: 'height', label: '高度(mm)', placeholder: '如 15' },
    { key: 'meterWeight', label: '米重(kg/m)', placeholder: '如 0.5' },
    { key: 'perimeter', label: '外周长(mm)', placeholder: '如 100（只算外轮廓）' },
  ],
  // 异型材需要额外选择模具类型
};

const CATEGORY_NEEDS_DIE_SELECTION = ['异型材'];

// 标准件理论米重（与后端 /api/v1/quote/calculate 公式一致，6063铝密度2.7g/cm³）
// 前端字段映射：diameter/hex/outer 都存入 width，inner 存入 height
function calcStdMeterWeight(cat: string, width?: number|string, height?: number|string, thickness?: number|string): number | null {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const t = Number(thickness) || 0;
  let area = 0;
  switch (cat) {
    case '铝圆棒': if (!(w > 0)) return null; area = Math.PI * w * w / 4; break;
    case '铝方/扁棒': if (!(w > 0 && h > 0)) return null; area = w * h; break;
    case '铝六角棒': if (!(w > 0)) return null; area = 2.598 * w * w; break;
    case '角铝': if (!(w > 0 && h > 0 && t > 0)) return null; area = t * (w + h - t); break;
    case '铝圆管': if (!(w > 0)) return null; area = h > 0 ? Math.PI * (w * w - h * h) / 4 : Math.PI * w * w / 4; break;
    case '铝六角管': if (!(w > 0)) return null; area = 2.598 * w * w - (h > 0 ? Math.PI * h * h / 4 : 0); break;
    case '铝方管': if (!(w > 0 && h > 0 && t > 0 && w > 2 * t && h > 2 * t)) return null; area = w * h - (w - 2 * t) * (h - 2 * t); break;
    default: return null;
  }
  if (!(area > 0)) return null;
  return Math.round((area * 2.7 / 1000) * 1000) / 1000;
}

// 标准件几何周长(mm)：外周长（周长框自动填）+ 内孔周长（分流模模具费，随请求传后端）
function calcStdPerimeters(cat: string, width?: number|string, height?: number|string, thickness?: number|string): { outer: number; inner: number } | null {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const t = Number(thickness) || 0;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  switch (cat) {
    case '铝圆棒': if (!(w > 0)) return null; return { outer: r1(Math.PI * w), inner: 0 };
    case '铝方/扁棒': if (!(w > 0 && h > 0)) return null; return { outer: 2 * (w + h), inner: 0 };
    case '铝六角棒': if (!(w > 0)) return null; return { outer: r1(6 * w / Math.sqrt(3)), inner: 0 };
    case '角铝': if (!(w > 0 && h > 0)) return null; return { outer: 2 * (w + h), inner: 0 };
    case '铝圆管': if (!(w > 0)) return null; return { outer: r1(Math.PI * w), inner: h > 0 ? r1(Math.PI * h) : 0 };
    case '铝六角管': if (!(w > 0)) return null; return { outer: r1(6 * w / Math.sqrt(3)), inner: h > 0 ? r1(Math.PI * h) : 0 };
    case '铝方管': {
      if (!(w > 0 && h > 0 && t > 0 && w > 2 * t && h > 2 * t)) return null;
      const iw = w - 2 * t, ih = h - 2 * t;
      return { outer: 2 * (w + h), inner: iw > 0 && ih > 0 ? 2 * (iw + ih) : 0 };
    }
    default: return null;
  }
}

// 板材单件理论重量(g)：长×宽×厚(mm) × 密度(g/cm³) / 1000
// 密度：铝板2.7，冷轧板/镀锌板7.85，不锈钢7.93
function calcSheetWeightG(materialCategory: string, l: number, w: number, t: number): number | null {
  if (!(l > 0 && w > 0 && t > 0)) return null;
  const density = materialCategory === '铝板' ? 2.7 : materialCategory === '不锈钢' ? 7.93 : 7.85;
  return Math.round((l * w * t * density / 1000) * 100) / 100; // g
}



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

export default function QuoteForm({ onCalculate, onResult, onProductInfoChange, onSaveVariant, onNewQuote, aiData }: QuoteFormProps) {
  // ===== 登录 + 识图额度 =====
  const { user, quota, checkQuota, referralLink, ensureReferralLink } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [aiSynced, setAiSynced] = useState(false);
  const prevAiDataRef = useRef<AiFormUpdate | null | undefined>(null);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  // 请求序号：防止旧响应覆盖新结果（防抖并发时，晚返回的中间态请求直接丢弃）
  const calcReqSeq = useRef(0);

  // Product info state
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');

  // Core form state
  const [productType, setProductType] = useState('挤出');
  const [materialCategory, setMaterialCategory] = useState('异型材');
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
  const [variantSavedTick, setVariantSavedTick] = useState(false);

  // Standard parts state (异型材/标准件 toggle)
  // 统一流程：不再区分异型材/标准件，所有挤出型材走品类选择+模具匹配
  const [standardCategory, setStandardCategory] = useState('');
  const [standardCategories, setStandardCategories] = useState<{key:string;label:string;count:number;mold_type:string}[]>([]);

  // Mold matching state (尺寸匹配现有模具)
  const [moldMatches, setMoldMatches] = useState<any[]>([]);
  const [moldMatchLoading, setMoldMatchLoading] = useState(false);
  const [selectedMoldId, setSelectedMoldId] = useState<string | null>(null);
  const [useExistingMold, setUseExistingMold] = useState<boolean | null>(null); // null=未选择, true=现有, false=新开

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
  const [recognitionId, setRecognitionId] = useState<string | null>(null);

  // 上报识别反馈：AI识别值 vs 用户最终确认值
  const reportRecognitionFeedback = useCallback(() => {
    if (!recognitionId || !recogResult) return;
    const confirmedValues: Record<string, any> = {};
    if (fields.width) confirmedValues.width = fields.width;
    if (fields.height) confirmedValues.height = fields.height;
    if (fields.length) confirmedValues.length = fields.length;
    if (fields.thickness) confirmedValues.wall_thickness = fields.thickness;
    if (fields.quantity) confirmedValues.quantity = fields.quantity;
    if (fields.meterWeight) confirmedValues.meter_weight = fields.meterWeight;
    if (fields.perimeter) confirmedValues.perimeter = fields.perimeter;
    confirmedValues.product_type = productType;
    confirmedValues.material_category = materialCategory;
    confirmedValues.surface_treatment = productSurfaceTreatment;
    fetch("/api/recognize-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recognition_id: recognitionId,
        ai_values: recogResult,
        user_confirmed_values: confirmedValues,
        user_id: user?.id || null,
      }),
    }).catch(() => {});
  }, [recognitionId, recogResult, fields, productType, materialCategory, productSurfaceTreatment, user]);
  const [recogError, setRecogError] = useState<string | null>(null);
  const [deepQuoteLoading, setDeepQuoteLoading] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
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
      setStandardCategory(firstCat === '异型材' ? '异型材' : '');
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

  // 标准件：理论米重自动填入米重框（用户手填或匹配到库存模具后不覆盖；改尺寸/切种类恢复自动）
  useEffect(() => {
    if (productType !== '挤出' || materialCategory !== '标准件' || meterWeightManual) return;
    const mw = calcStdMeterWeight(standardCategory, fields.width as number, fields.height as number, fields.thickness as number);
    if (mw !== null) {
      setFields(prev => (String(prev.meterWeight ?? '') === String(mw) ? prev : { ...prev, meterWeight: mw }));
    }
  }, [productType, materialCategory, standardCategory, fields.width, fields.height, fields.thickness, meterWeightManual]);

  // 标准件：单件净重(g) = 米重(kg/m) × 长度(mm)，自动填入（规则截面棒/管按长度切割，净重≈消耗重量）
  useEffect(() => {
    if (productType !== '挤出' || materialCategory !== '标准件') return;
    const mw = parseFloat(String(fields.meterWeight)) || 0;
    const len = parseFloat(String(fields.length)) || 0;
    if (mw > 0 && len > 0) {
      const g = Math.round(mw * len);
      setFields(prev => (parseFloat(String(prev.netWeight)) === g ? prev : { ...prev, netWeight: g }));
    }
  }, [productType, materialCategory, fields.meterWeight, fields.length]);

  // 标准件：外周长自动填入周长框、内孔周长写入隐藏字段（分流模模具费外+内周长；手填周长后不覆盖）
  useEffect(() => {
    if (productType !== '挤出' || materialCategory !== '标准件' || perimeterManual) return;
    const per = calcStdPerimeters(standardCategory, fields.width as number, fields.height as number, fields.thickness as number);
    if (per) {
      setFields(prev => {
        const changed = parseFloat(String(prev.perimeter)) !== per.outer || parseFloat(String(prev.innerPerimeter ?? '')) !== per.inner;
        return changed ? { ...prev, perimeter: per.outer, innerPerimeter: per.inner } : prev;
      });
    }
  }, [productType, materialCategory, standardCategory, fields.width, fields.height, fields.thickness, perimeterManual]);

  // 手动触发模具匹配（用户点击搜索按钮才搜索，不自动触发）
  const runMoldSearch = async () => {
    if (productType !== '挤出' || !standardCategory) return;
    const dimFields = CATEGORY_DIM_FIELDS[standardCategory];
    if (!dimFields) return;
    const cur = fieldsRef.current;
    // 异型材必须先选模具类型再搜索
    if (standardCategory === '异型材' && !cur.die_type) return;
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
    setSelectedMoldId(null);
    setUseExistingMold(null);
    try {
      const res = await fetch(`/api/mold-match?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setMoldMatches(data.matches || []);
      }
    } catch (e) {
      console.error('Mold match failed:', e);
    } finally {
      setMoldMatchLoading(false);
    }
  };


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
      // 与API口径一致：单件重量含+5mm锯切余量，再按数量级向上取整到十位
      const singleWeightKg = mw * (Number(len) + 5) / 1000;
      if (singleWeightKg > 0) {
        const raw = Math.ceil(300 / singleWeightKg);
        let minQty = raw;
        if (raw > 10) {
          const digits = Math.floor(Math.log10(raw));
          const unit = Math.pow(10, digits - 2);
          minQty = Math.ceil(raw / unit) * unit;
        }
        setFields(prev => ({ ...prev, quantity: minQty }));
      }
    }
  }, [fields.meterWeight, fields.length, productType]);

  // ==================== Auto-calculate with debounce ====================
  // triggerCalculate 定义在 doCalculate 之后（见文件下方），用 ref 持有最新实现，
  // 避免闭包捕获旧 state（历史bug：选「分流模」后自动报价仍按旧 die_type='flat' 计算）
  const doCalculateRef = useRef<() => void>(() => {});

  const triggerCalculate = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      doCalculateRef.current();
    }, 500);
  }, []);

  // Trigger on any field change
  useEffect(() => {
    triggerCalculate();
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [productType, materialCategory, fields, materialSurfaceTreatment, materialColor, processes, productSurfaceTreatment, productColor, surfaceTreatment, surfaceColor, materialSizeType, dieSteelPrice, materialGrade, triggerCalculate]);

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
    // 异型材是唯一细分类，直接选中，免去多余的二次点击；标准件则需再选具体种类
    setStandardCategory(mc === '异型材' ? '异型材' : '');
    setMoldMatches([]);
    setSelectedMoldId(null);
    setUseExistingMold(null);
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

  const updateProcessQuantity = (procName: string, qty: number | string) => {
    setProcesses(prev => prev.map(p => p.name === procName ? { ...p, quantity: qty as any } : p));
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

  // Sync AI data（图纸识别参数回填）
  useEffect(() => {
    if (!aiData || aiData === prevAiDataRef.current) return;
    prevAiDataRef.current = aiData;

    // 产品类型：英文key / 中文别名 → 表单tab key
    if (aiData.productType) {
      const ptMap: Record<string, string> = {
        'extrusion': '挤出', '挤压铝型材': '挤出', '挤出铝型材': '挤出', '挤出': '挤出', '挤压': '挤出', '铝型材': '挤出',
        'sheet_metal': '板材', '铝板/铝平板': '板材', '板材': '板材', '铝板': '板材', '钣金': '板材',
        'die_casting': '压铸', '压铸铝件': '压铸', '压铸': '压铸', '压铸铝': '压铸',
        'zinc_alloy': '压铸',
        'injection': '注塑', '注塑': '注塑', '注塑件': '注塑',
        'cnc': '挤出', 'stamping': '板材',
      };
      const mapped = ptMap[aiData.productType] || aiData.productType;
      if (PRODUCT_TYPES[mapped]) setProductType(mapped);
    }

    // 挤出类材料大类：异型材 / 标准件
    if (productType === '挤出' || aiData.productType) {
      if (aiData.materialCategory === '标准件') {
        setMaterialCategory('标准件');
        // 标准件细分类由下方 aiData.standardCategory 分支设置
      } else if (aiData.materialCategory) {
        // 异型材（含 '铝合金'/'铝型材' 等旧值兼容）：唯一细分类直接选中
        setMaterialCategory('异型材');
        setStandardCategory('异型材');
      }
    } else if (aiData.materialCategory) {
      setMaterialCategory(aiData.materialCategory);
    }

    // 标准件小类：铝圆棒/铝方管/角铝...
    if (aiData.standardCategory) {
      const STD_KEYS = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管', '异型材'];
      const stdMap: Record<string, string> = {
        '铝方': '铝方/扁棒', '扁棒': '铝方/扁棒', '铝棒': '铝圆棒', '圆棒': '铝圆棒',
        '方管': '铝方管', '圆管': '铝圆管', '六角棒': '铝六角棒', '六角管': '铝六角管', '角铝': '角铝',
      };
      const key = STD_KEYS.includes(aiData.standardCategory)
        ? aiData.standardCategory
        : (stdMap[aiData.standardCategory] || '');
      if (key) {
        setMaterialCategory('标准件');
        setStandardCategory(key);
      }
    }

    if (aiData.materialGrade) setMaterialGrade(aiData.materialGrade);
    if (aiData.quantity) setFields(prev => ({ ...prev, quantity: aiData.quantity! }));
    if (aiData.width) setFields(prev => ({ ...prev, width: aiData.width! }));
    if (aiData.height) setFields(prev => ({ ...prev, height: aiData.height! }));
    if (aiData.length) setFields(prev => ({ ...prev, length: aiData.length! }));
    if (aiData.wallThickness) setFields(prev => ({ ...prev, thickness: aiData.wallThickness! }));
    if (aiData.surfaceTreatment && aiData.surfaceTreatment !== '无') {
      const st = String(aiData.surfaceTreatment);
      const stMap: Record<string,string> = {
        '阳极氧化': '氧化', '氧化本色': '氧化', '本色氧化': '氧化', '阳极氧化-自然色': '氧化', '阳极氧化-黑色': '喷砂氧化',
        '喷砂': '喷砂氧化', '喷砂阳极氧化': '喷砂氧化',
        '抛光': '抛光氧化', '抛光阳极氧化': '抛光氧化',
        '拉丝': '拉丝氧化', '拉丝阳极氧化': '拉丝氧化',
        '喷粉': '喷涂', '粉末喷涂': '喷涂', '喷漆': '喷涂',
      };
      const mapped = stMap[st] || (['氧化','喷砂氧化','抛光氧化','拉丝氧化','喷涂'].includes(st) ? st : '');
      if (mapped) setMaterialSurfaceTreatment(mapped);
    }
    setAiSynced(true);
    const timer = setTimeout(() => setAiSynced(false), 3000);
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
        cutCount = Number(proc.quantity) || 1;
      } else if (proc.name === '冲压') {
        secondaryOps.push('冲压');
        if (proc.subParams?.tonnage) stampingTonnage = proc.subParams.tonnage;
        stampingCount = Number(proc.quantity) || 1;
      } else if (proc.name === '钻孔') {
        secondaryOps.push('钻孔');
        const hc = Number(proc.subParams?.hole_count ?? proc.quantity) || 0;
        const dr = proc.subParams?.diameter_range || 'ø6~10';
        if (hc > 0) holes = { count: hc, diameter_range: dr };
      } else if (proc.name === '攻牙') {
        secondaryOps.push('攻丝');
        const hc = Number(proc.subParams?.hole_count ?? proc.quantity) || 0;
        const sz = proc.subParams?.size || 'M5~M6';
        if (hc > 0) tappedHoles = { count: hc, size: sz };
      } else if (proc.name === 'CNC加工') {
        secondaryOps.push('CNC加工');
        const mins = Number(proc.subParams?.minutes ?? proc.quantity) || 0;
        if (mins > 0) cncTime = { minutes: mins };
      } else if (proc.name === '车加工') {
        secondaryOps.push('车加工');
        const mins = Number(proc.subParams?.minutes ?? proc.quantity) || 0;
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
    // 输入框存的是字符串，统一转 number（空串/NaN → undefined）
    const num = (v: unknown): number | undefined => {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    if (productType === '挤出') {
      const width = num(fields.width);
      const height = num(fields.height);
      const length = num(fields.length);
      if (width || height || length || num(fields.thickness)) return {
        length_mm: length || 0,
        width_mm: width || 0,
        height_mm: height || undefined,
        standard_category: standardCategory || undefined,
        wall_thickness_mm: num(fields.thickness),
        diameter_mm: standardCategory === '铝圆棒' ? (width || undefined) : undefined,
        hex_flat_mm: (standardCategory === '铝六角棒' || standardCategory === '铝六角管') ? (width || undefined) : undefined,
        outer_diameter_mm: standardCategory === '铝圆管' ? (width || undefined) : undefined,
        inner_diameter_mm: (standardCategory === '铝圆管' || standardCategory === '铝六角管') ? (height || undefined) : undefined,
        perimeter_mm: num(fields.perimeter),
        inner_perimeter_mm: num(fields.innerPerimeter),
        num_cavities: parseInt(String(fields.num_cavities)) || 1,
        die_type: (fields.die_type === 'flat' || fields.die_type === 'split') ? fields.die_type as 'flat' | 'split' : undefined,
        meter_weight_kg_per_m: num(fields.meterWeight),
        net_weight_g: num(fields.netWeight),
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
      const isStdMode = productType === '挤出';
      let allFilled: boolean;
      if (isStdMode) {
        // 挤出模式：长度非必填（模具费只看截面，无长度也能算）
        if (standardCategory === '异型材') {
          // 异型材：宽度+高度必填，且米重或周长至少填一个
          allFilled = !!(fields.width && fields.height && (fields.meterWeight || fields.perimeter));
        } else if (standardCategory) {
          // 标准件：该类别尺寸字段全部填齐（才能算理论米重）
          const dimDefs = CATEGORY_DIM_FIELDS[standardCategory] || [];
          const fieldMap: Record<string, string> = { diameter: 'width', hex: 'width', outer: 'width', inner: 'height' };
          allFilled = dimDefs.every(df => {
            const sk = fieldMap[df.key] || df.key;
            const v = fields[sk];
            return v !== '' && v !== undefined && v !== null && Number(v) > 0;
          });
        } else {
          allFilled = false; // 还没选异型材/标准件类别
        }
      } else {
        allFilled = cat.fields.filter(f => ['width', 'height', 'length', 'thickness', 'productSize'].includes(f)).every(f => {
          const val = fields[f];
          return val !== '' && val !== undefined && val !== null && Number(val) > 0;
        });
      }
      if (!allFilled) {
        onResult?.(null);
        return;
      }
    }

    setLoading(true);
    try {
      const surfaceTreatment = mapSurfaceTreatment();
      const processInfo = mapProcesses();

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
      const mySeq = ++calcReqSeq.current;
      const res = await fetch('/api/v1/quote/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // 已有更新的请求发出 → 本次结果过期，丢弃，避免旧中间态覆盖新结果
      if (mySeq !== calcReqSeq.current) { setLoading(false); return; }
      if (res.ok) {
        const data = await res.json();
        if (mySeq !== calcReqSeq.current) { setLoading(false); return; }
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
          reportRecognitionFeedback();
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
  // 每次渲染同步最新的 doCalculate 到 ref，供防抖定时器调用
  doCalculateRef.current = doCalculate;

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
        extrusion: '挤出', stamping: '板材', sheet_metal: '板材', die_casting: '压铸',
        zinc_alloy: '压铸', cnc: '挤出', injection: '注塑',
      };
      const mapped = ptMap[String(d.product_type).toLowerCase()] || ptMap[d.product_type];
      if (mapped && PRODUCT_TYPES[mapped]) setProductType(mapped);
    }

    // 型材细分类别（必须在填字段之前处理：resetProfileState 会清空截面字段）
    const VALID_CATS = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管', '异型材'];
    const stdAlias: Record<string,string> = {
      '铝方': '铝方/扁棒', '扁棒': '铝方/扁棒', '铝棒': '铝圆棒', '圆棒': '铝圆棒',
      '方管': '铝方管', '圆管': '铝圆管', '六角棒': '铝六角棒', '六角管': '铝六角管',
    };
    let resolvedCat = '';
    if (d.profile_category) {
      resolvedCat = VALID_CATS.includes(d.profile_category)
        ? d.profile_category
        : (stdAlias[d.profile_category] || '');
    }
    if (resolvedCat) {
      // 先清空旧类别状态（含截面字段），稍后再统一填值
      setMoldMatches([]);
      setSelectedMoldId(null);
      setUseExistingMold(null);
      setMaterialCategory(resolvedCat === '异型材' ? '异型材' : '标准件');
      setStandardCategory(resolvedCat);
    } else if (d.material_category) {
      // 归一化：挤出铝型材类 → 异型材；板材/压铸等保持各自key
      const mc = String(d.material_category);
      if (/铝合金|铝型材|^铝$|挤压|挤出/.test(mc)) {
        setMaterialCategory('异型材');
        setStandardCategory('异型材');
      } else {
        const catMap: Record<string,string> = {
          '不锈钢': '不锈钢', '冷轧板': '冷轧板', '冷板': '冷轧板', '镀锌板': '镀锌板',
          '压铸铝': '压铸铝', '锌合金': '锌合金', '塑胶': '塑胶',
          'ABS': 'ABS', 'PP': 'PP', 'PC': 'PC',
        };
        const mapped = catMap[mc] || mc;
        setMaterialCategory(mapped);
      }
    }

    if (d.product_code) setProductCode(d.product_code);
    if (d.product_name) setProductName(d.product_name);

    // 字段统一最后填，避免被类别切换的 reset 清掉
    setFields(prev => {
      const next = { ...prev };
      if (typeof d.width === 'number') next.width = d.width;
      if (typeof d.height === 'number') next.height = d.height;
      if (typeof d.length === 'number') next.length = d.length;
      if (typeof d.perimeter === 'number') next.perimeter = d.perimeter;
      if (typeof d.inner_perimeter === 'number') next.innerPerimeter = d.inner_perimeter;
      if (typeof d.num_cavities === 'number') next.num_cavities = d.num_cavities;
      // 模具类型兼容英文/中文/中空描述
      const dt = String(d.die_type || '').toLowerCase();
      if (d.die_type === 'flat' || dt === 'flat' || d.die_type === '平模' || d.die_type === '实心') next.die_type = 'flat';
      else if (d.die_type === 'split' || dt === 'split' || d.die_type === '分流模' || d.die_type === '中空' || d.die_type === '空心') next.die_type = 'split';
      // 按内腔数兜底：有内腔=分流模，实心=平模
      if (typeof d.num_cavities === 'number' && !next.die_type) {
        next.die_type = d.num_cavities >= 1 ? 'split' : 'flat';
      }
      if (typeof d.meter_weight === 'number') next.meterWeight = d.meter_weight;
      if (typeof d.quantity === 'number') next.quantity = d.quantity;
      if (typeof d.wall_thickness === 'number') next.thickness = d.wall_thickness;
      // 标准件专属尺寸（前端 width/height 复用槽位：圆棒直径、六角对边、圆管外径→width；内径→height）
      const dAny = d as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : null);
      const diam = num(dAny.diameter) ?? num(dAny.diameter_mm);
      const hexFlat = num(dAny.hex_flat) ?? num(dAny.hex_flat_mm) ?? num(dAny.hex) ?? num(dAny.hex_flat_distance);
      const outerD = num(dAny.outer_diameter) ?? num(dAny.outer_diameter_mm) ?? num(dAny.outer) ?? num(dAny.outer_dia);
      const innerD = num(dAny.inner_diameter) ?? num(dAny.inner_diameter_mm) ?? num(dAny.inner) ?? num(dAny.inner_dia);
      if (resolvedCat === '铝圆棒' && diam) next.width = diam;
      if ((resolvedCat === '铝六角棒' || resolvedCat === '铝六角管') && hexFlat) next.width = hexFlat;
      if (resolvedCat === '铝圆管' && outerD) next.width = outerD;
      if ((resolvedCat === '铝圆管' || resolvedCat === '铝六角管') && innerD) next.height = innerD;
      return next;
    });
    if (d.material_grade) setMaterialGrade(d.material_grade);
    if (d.surface_treatment && d.surface_treatment !== '无') {
      // 归一化到表单表面处理选项
      const st = String(d.surface_treatment);
      const stMap: Record<string,string> = {
        '阳极氧化': '氧化', '氧化本色': '氧化', '本色氧化': '氧化', '硬质氧化': '氧化',
        '喷砂': '喷砂氧化', '喷砂阳极氧化': '喷砂氧化',
        '抛光': '抛光氧化', '抛光阳极氧化': '抛光氧化',
        '拉丝': '拉丝氧化', '拉丝阳极氧化': '拉丝氧化',
        '喷粉': '喷涂', '粉末喷涂': '喷涂', '喷漆': '喷涂',
      };
      const mappedSt = stMap[st] || (['氧化','喷砂氧化','抛光氧化','拉丝氧化','喷涂'].includes(st) ? st : '');
      if (mappedSt) {
        setMaterialSurfaceTreatment(mappedSt);
        setProductSurfaceTreatment(mappedSt);
      }
    }
    // 工序：Bot返回格式如 "锯切,冲压(3次),CNC加工(10分钟)"
    if (d.processes && typeof d.processes === 'string' && d.processes !== '无') {
      const procs: ProcessSelection[] = d.processes.split(/[,，、]/).map((p: string) => {
        const m = p.trim().match(/^(.+?)(?:\((\d+)(分钟|次|mm|个)?\))?$/);
        if (m) return { name: m[1], quantity: m[2] ? parseInt(m[2]) : undefined };
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
    // ===== 登录检查 =====
    if (!user) {
      setPendingFile(file);
      setShowLoginModal(true);
      return;
    }
    // ===== 额度检查 =====
    if (quota && quota.remaining <= 0) {
      setPendingFile(file);
      setShowQuotaModal(true);
      return;
    }
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
      const resp = await fetch('/api/recognize-drawing?userId=' + user!.id, { method: 'POST', body: fd });
      const json = await resp.json();
      if (resp.status === 429 || json.quotaExceeded) {
        checkQuota();
        setShowQuotaModal(true);
        return;
      }
      if (resp.status === 401) {
        setShowLoginModal(true);
        return;
      }
      if (!resp.ok || !json.success) {
        setRecogError(json.error || '识别失败');
        return;
      }
      const d = json.data || {};
      setRecogResult(d);
      checkQuota(); // 刷新额度
      // 识别ID用于后续反馈追踪（优先用服务端日志ID）
      setRecognitionId(json.recognition_id || ("rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)));
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
              // Length field with "+" button: save this length as one quote-pool entry (same mold group)
              if (fieldKey === 'length' && productType === '挤出') {
                const lengthVal = parseFloat(fields.length as string) || 0;
                const mwVal = parseFloat(fields.meterWeight as string) || 0;
                const calcWeight = lengthVal > 0 && mwVal > 0 ? Math.round(mwVal * lengthVal / 1000 * 1000) / 1000 : 0;
                const canAdd = lengthVal > 0 && calcWeight > 0;
                return (
                  <div key={fieldKey}>
                    <label className="block text-[11px] text-gray-500 mb-1">
                      {FIELD_LABELS[fieldKey]}
                      <span className="ml-1 text-[10px] text-blue-400">点＋把当前长度存入报价池（同副模具只算一次模具费）</span>
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        value={(fields[fieldKey] as number | string) ?? ''}
                        onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setFields(prev => ({ ...prev, [fieldKey]: val }));
                          }}
                        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                      />
                      <button
                        type="button"
                        disabled={!canAdd || !onSaveVariant}
                        onClick={async () => {
                          if (!onSaveVariant) return;
                          const ok = await onSaveVariant();
                          if (ok) {
                            setFields(prev => ({ ...prev, length: '' }));
                            setVariantSavedTick(true);
                            setTimeout(() => setVariantSavedTick(false), 2000);
                          }
                        }}
                        className={`shrink-0 rounded-lg px-3 text-sm font-bold transition-all min-h-[36px] ${
                          variantSavedTick
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : canAdd && onSaveVariant
                            ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm'
                            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                        title="把当前长度保存进报价池"
                      >
                        {variantSavedTick ? '✓已存' : '+'}
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
                    value={(fields[fieldKey] as number | string) ?? ''}
                    onChange={e => {
                        const raw = e.target.value;
                        const val = parseFloat(raw) || 0;
                        setFields(prev => ({ ...prev, [fieldKey]: raw }));
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
        {/* 板材：长×宽×厚自动算单件理论重量 */}
        {productType === '板材' && (() => {
          const parsed = parseProductSize(fields.productSize as string);
          const t = Number(fields.thickness) || 0;
          const wg = parsed ? calcSheetWeightG(materialCategory, parsed.l, parsed.w, t) : null;
          if (wg === null) return null;
          const densityTxt = materialCategory === '铝板' ? '2.7' : materialCategory === '不锈钢' ? '7.93' : '7.85';
          return (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-[11px] text-blue-700">
              <span className="font-semibold">单件理论重量</span>
              <span className="font-mono font-semibold text-blue-800">{wg} g</span>
              <span className="text-blue-400">（{parsed!.l}×{parsed!.w}×{t}mm × {densityTxt}g/cm³ 自动计算，直接用于报价）</span>
            </div>
          );
        })()}
      </div>
    );
  };

  const inputBaseClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* ---- 模具组工具条：点「新建报价」=开一副新模具 ---- */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50/70 border border-blue-100">
          <div className="text-[11px] text-blue-700 leading-snug">
            当前为<b>同一副模具</b>：改长度后点长度框旁的<b>＋</b>存入报价池，出单时模具费只算一次。
          </div>
          <button
            type="button"
            onClick={onNewQuote}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-blue-700 text-xs font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
            title="清空表单，开始一副新模具的报价"
          >
            <span className="text-sm leading-none">＋</span> 新建报价
          </button>
        </div>

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
                  {key === '注塑' && (
                    <span className="ml-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-600 text-[9px] font-normal leading-none">待开发</span>
                  )}
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

        {/* ---- 标准件种类选择 (仅挤出·标准件；异型材唯一分类无需再点) ---- */}
        {productType === '挤出' && materialCategory === '标准件' && (() => {
          const STD_PARTS = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管'];
          const visibleCats = standardCategories.filter(c => STD_PARTS.includes(c.key));
          if (visibleCats.length === 0) return null;
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
              <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                标准件种类
              </label>
              <div className="flex flex-wrap gap-1.5">
                {visibleCats.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => { setStandardCategory(cat.key); resetProfileState(); setMeterWeightManual(false); setPerimeterManual(false); setFields(prev => ({ ...prev, die_type: ['铝圆管','铝六角管','铝方管'].includes(cat.key) ? 'split' : 'flat' })); }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs transition-all duration-200 ${
                      standardCategory === cat.key
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {cat.label}
                    <span className="ml-1 text-[10px] opacity-60">({cat.count})</span>
                    <span className={`ml-1 text-[10px] ${cat.mold_type === '分流模' ? 'text-red-400' : 'text-gray-400'}`}>
                      {cat.mold_type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ---- 异型材模具类型选择 (仅挤出·异型材，上移直接选) ---- */}
        {productType === '挤出' && materialCategory === '异型材' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              模具类型（先选再填尺寸）
            </label>
            <div className="flex gap-2">
              {([{ v: 'flat', label: '平模（实心）' }, { v: 'split', label: '分流模（中空）' }] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => { setFields(prev => ({ ...prev, die_type: opt.v })); setSelectedMoldId(null); setUseExistingMold(null); setMoldMatches([]); }}
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
            {!fields.die_type && (
              <div className="mt-1.5 text-[11px] text-amber-500">请先选择模具类型，再填尺寸点搜索</div>
            )}
          </div>
        )}

        {/* ---- 尺寸输入 + 模具匹配 ---- */}
        {productType === '挤出' && standardCategory && (() => {
          const dimFields = CATEGORY_DIM_FIELDS[standardCategory];
          if (!dimFields) return null;
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
              <label className="block text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                输入尺寸 · 填完点按钮匹配模具
              </label>
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
                        value={(fields[stateKey] as number | string) ?? ''}
                        onChange={e => {
                          const raw = e.target.value;
                          const val = parseFloat(raw) || 0;
                          setFields(prev => ({ ...prev, [stateKey]: raw }));
                          setSelectedMoldId(null);
                          setUseExistingMold(null);
                          setMoldMatches([]);
                          setPerimeterManual(false);
                          setMeterWeightManual(false);
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
                      />
                    </div>
                  );
                })}
              </div>

              {/* 标准件理论米重（规则截面自动计算，无需库存） */}
              {!CATEGORY_NEEDS_DIE_SELECTION.includes(standardCategory) && (() => {
                const mw = calcStdMeterWeight(standardCategory, fields.width as number, fields.height as number, fields.thickness as number);
                return mw !== null ? (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-[11px] text-blue-700">
                    <span className="font-semibold">理论米重</span>
                    <span className="font-mono font-semibold text-blue-800">{mw} kg/m</span>
                    <span className="text-blue-400">（按6063铝密度2.7g/cm³自动计算，直接用于报价）</span>
                  </div>
                ) : null;
              })()}

              {/* 模具匹配结果 */}
              <button
                type="button"
                onClick={runMoldSearch}
                disabled={moldMatchLoading || (CATEGORY_NEEDS_DIE_SELECTION.includes(standardCategory) && !fields.die_type)}
                className="mt-2 w-full px-3 py-2 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {moldMatchLoading ? (<><span className="inline-block animate-spin">⟳</span> 正在匹配现有模具...</>) : (<>🔍 搜索现有模具</>)}
              </button>

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
                          {/* 任务1：异型材显示模具编号，标准件无编号不显示 */}
                          {standardCategory === '异型材' && m.mold_number && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono text-[10px] font-medium">{m.mold_number}</span>
                          )}
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
                      onClick={() => { setUseExistingMold(false); setSelectedMoldId(null); }}
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
                          onChange={e => updateProcessQuantity(proc.name, e.target.value)}
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
                          onChange={e => updateProcessQuantity(proc.name, e.target.value)}
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
                {recogResult.perimeter != null && <div>外周长: <b>{recogResult.perimeter}mm</b></div>}
                {recogResult.inner_perimeter != null && <div>内周长: <b>{recogResult.inner_perimeter}mm</b></div>}
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

        {/* ===== 登录提示弹窗 ===== */}
        {showLoginModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">登录后使用图纸识别</h3>
                <p className="text-sm text-gray-500 mt-2">注册即送 100 积分，图纸识别自动填入报价表</p>
              </div>
              <div className="flex gap-3">
                <a href="/login" className="flex-1 text-center py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">去登录</a>
                <a href="/register" className="flex-1 text-center py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition">注册</a>
              </div>
              <button onClick={() => setShowLoginModal(false)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">取消</button>
            </div>
          </div>
        )}

        {/* ===== 额度超限弹窗 ===== */}
        {showQuotaModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">积分不足</h3>
                <p className="text-sm text-gray-500 mt-2">图纸识别每次消耗 10 积分。邀请好友注册，双方各得 100 积分</p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    const link = await ensureReferralLink();
                    if (!link) return;
                    try {
                      await navigator.clipboard.writeText(link);
                    } catch {
                      // 非 HTTPS 或旧浏览器兜底
                      const ta = document.createElement('textarea');
                      ta.value = link;
                      ta.style.position = 'fixed';
                      ta.style.opacity = '0';
                      document.body.appendChild(ta);
                      ta.select();
                      try { document.execCommand('copy'); } catch { /* ignore */ }
                      document.body.removeChild(ta);
                    }
                    setCopiedInvite(true);
                    setTimeout(() => setCopiedInvite(false), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  <Share2 className="w-4 h-4" />
                  {copiedInvite ? '已复制，去发给好友吧' : '复制邀请链接'}
                </button>
                <button
                  onClick={() => {
                    setShowQuotaModal(false);
                    if (!uploadedFile) {
                      setRecogError('请先上传图纸文件，再申请深度报价（工程师人工报价）');
                      return;
                    }
                    requestDeepQuote();
                  }}
                  className="w-full text-center py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                >
                  申请深度报价
                </button>
              </div>
              <button onClick={() => setShowQuotaModal(false)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">关闭</button>
            </div>
          </div>
        )}

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

