"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, X, Sparkles, Loader2, AlertTriangle, Plus, User, CheckCircle2, Share2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { STEEL_STANDARD_SPECS } from '@/data/steelStandardSpecs';

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
  surfaceTreatment?: string;
  surfaceColor?: string;
  standardCategory?: string;
  materialGrade?: string;
  moldNumber?: string;
  moldProductName?: string;
  moldCrossSection?: string;
  moldSurface?: string;
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
  mold_spec?: string;
  min_order_weight_kg?: number;
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
  onMoldInfoChange?: (info: { useExistingMold: boolean | null; selectedMoldId: string | null }) => void;
  onSaveVariant?: () => Promise<boolean>;
  onNewQuote?: () => void;
  aiData?: AiFormUpdate | null;
  loadQuoteData?: Record<string, any> | null;
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
        fields: ['width', 'height', 'length', 'perimeter', 'num_cavities', 'die_type', 'meterWeight', 'crossSectionArea', 'quantity', 'netWeight'],
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
        fields: ['width', 'height', 'length', 'perimeter', 'meterWeight', 'crossSectionArea', 'quantity', 'netWeight'],
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
        fields: ['thickness', 'length', 'width', 'quantity'],
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
        fields: ['thickness', 'length', 'width', 'quantity'],
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
        fields: ['thickness', 'length', 'width', 'quantity'],
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
        fields: ['thickness', 'length', 'width', 'quantity'],
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
  '钢材': {
    label: '钢材',
    icon: '⊟',
    materialCategories: {
      '钢标准件': {
        label: '钢材标准件',
        fields: ['width', 'height', 'length', 'thickness', 'quantity', 'netWeight'],
        materialSurfaceTreatment: ['无', '发黑', '镀锌', '镀铬', '镀镍'],
        materialColorMap: {
          '镀锌': ['白色', '蓝色', '彩色'],
          '镀铬': ['亮铬', '哑铬'],
          '镀镍': ['亮镍', '哑镍'],
        },
        processes: [
          { name: '无' },
          { name: '锯切' },
          { name: 'CNC加工', unit: '分钟' },
          { name: '车加工', unit: '分钟' },
          { name: '钻孔', unit: '次' },
          { name: '攻牙', unit: '次' },
          { name: '铣削', unit: '分钟' },
          { name: '磨削', unit: '分钟' },
        ],
        productSurfaceTreatment: [
          { name: '无' },
          { name: '发黑' },
          { name: '镀锌', colors: ['白色', '蓝色', '彩色'] },
          { name: '镀铬' },
          { name: '镀镍' },
          { name: '喷涂' },
          { name: '热浸锌' },
        ],
      },
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
  crossSectionArea: '截面积(mm²)',
  netWeight: '产品净重(g·选填·算利用率)',
};

// 按产品类型覆盖字段标签
const FIELD_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  '板材': { length: '展开长(mm)', width: '展开宽(mm)' },
};

const getFieldLabel = (productType: string, fieldKey: string): string => {
  return FIELD_LABEL_OVERRIDES[productType]?.[fieldKey] || FIELD_LABELS[fieldKey] || fieldKey;
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
    { key: 'meterWeight', label: '米重(kg/m)', placeholder: '填一个自动算另一个' },
    { key: 'perimeter', label: '外周长(mm)', placeholder: '如 100（只算外轮廓）' },
  ],
  // ===== 钢材标准件尺寸配置 =====
  '圆钢': [{ key: 'diameter', label: '直径 Ø(mm)', placeholder: '如 20' }],
  '方钢': [{ key: 'width', label: '边宽(mm)', placeholder: '如 20' }],
  '六角钢': [{ key: 'hex', label: '对边距 H(mm)', placeholder: '如 17' }],
  '角钢': [
    { key: 'width', label: '边宽(mm)', placeholder: '如 30' },
    { key: 'height', label: '边宽(mm)', placeholder: '如 30' },
    { key: 'thickness', label: '边厚(mm)', placeholder: '如 3' },
  ],
  '圆钢管': [
    { key: 'outer', label: '外径(mm)', placeholder: '如 25' },
    { key: 'inner', label: '内径(mm)', placeholder: '如 20' },
  ],
  '方管': [
    { key: 'width', label: '宽(mm)', placeholder: '如 30' },
    { key: 'height', label: '高(mm)', placeholder: '如 30' },
    { key: 'thickness', label: '壁厚(mm)', placeholder: '如 2' },
  ],
  '槽钢': [
    { key: 'height', label: '高度h(mm)', placeholder: '如 100（国标10#）' },
    { key: 'width', label: '腿宽b(mm)', placeholder: '如 48' },
    { key: 'thickness', label: '腰厚d(mm)', placeholder: '如 5.5' },
  ],
  '工字钢': [
    { key: 'height', label: '高度h(mm)', placeholder: '如 160（国标16#）' },
    { key: 'width', label: '腿宽b(mm)', placeholder: '如 88' },
    { key: 'thickness', label: '腰厚d(mm)', placeholder: '如 6.0' },
  ],
  // 异型材需要额外选择模具类型
};

const CATEGORY_NEEDS_DIE_SELECTION = ['异型材'];

// 产品库中个别产品名称被登记成了类别名（如"异型材"），不作为产品名称带出
const GENERIC_PRODUCT_NAMES = new Set([
  '异型材', '标准件', '铝型材', '铝合金', '型材', '挤出', '挤出铝型材', '挤压铝型材',
  '铝圆管', '铝圆棒', '铝方管', '铝六角管', '铝六角棒', '铝方/扁棒', '角铝', '铝板', '不锈钢', '铝',
  '圆钢', '方钢', '六角钢', '角钢', '圆钢管', '方管', '槽钢', '工字钢', '钢材标准件',
]);
function realMoldProductName(n: unknown): string {
  const v = String(n ?? '').trim();
  return v && !GENERIC_PRODUCT_NAMES.has(v) ? v : '';
}

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
    case '铝六角棒': if (!(w > 0)) return null; area = 0.866 * w * w; break;
    case '角铝': if (!(w > 0 && h > 0 && t > 0)) return null; area = t * (w + h - t); break;
    case '铝圆管': if (!(w > 0)) return null; area = h > 0 ? Math.PI * (w * w - h * h) / 4 : Math.PI * w * w / 4; break;
    case '铝六角管': if (!(w > 0)) return null; area = 0.866 * w * w - (h > 0 ? Math.PI * h * h / 4 : 0); break;
    case '铝方管': if (!(w > 0 && h > 0 && t > 0 && w > 2 * t && h > 2 * t)) return null; area = w * h - (w - 2 * t) * (h - 2 * t); break;
    default: return null;
  }
  if (!(area > 0)) return null;
  return Math.round((area * 2.7 / 1000) * 1000) / 1000;
}

// 钢材默认材料价格（元/吨）- 临时前端取值，后续接入实时抓取
const STEEL_DEFAULT_PRICES: Record<string, number> = {
  'Q235': 3700,
  '45#': 3650,
  '40Cr': 3900,
  '304': 15000,
  '316': 17000,
  '黄铜H59': 80000,
};
function getSteelDensity(grade: string): number {
  if (['304', '316'].includes(grade)) return 7.93;
  if (grade === '黄铜H59') return 8.5;
  return 7.85;
}

// 钢材标准件理论米重（碳钢密度7.85g/cm³，不锈钢7.93g/cm³）
function calcSteelMeterWeight(cat: string, width?: number|string, height?: number|string, thickness?: number|string, density: number = 7.85): number | null {
  const w = typeof width === 'string' ? parseFloat(width) : (width || 0);
  const h = typeof height === 'string' ? parseFloat(height) : (height || 0);
  const t = typeof thickness === 'string' ? parseFloat(thickness) : (thickness || 0);
  let area = 0;
  switch (cat) {
    case '圆钢': if (!(w > 0)) return null; area = Math.PI * w * w / 4; break;
    case '方钢': if (!(w > 0)) return null; area = w * w; break;
    case '六角钢': if (!(w > 0)) return null; area = 0.866 * w * w; break;
    case '角钢': if (!(w > 0 && h > 0 && t > 0)) return null; area = t * (w + h - t); break;
    case '圆钢管': if (!(w > 0)) return null; area = h > 0 ? Math.PI * (w * w - h * h) / 4 : Math.PI * w * w / 4; break;
    case '方管': if (!(w > 0 && h > 0 && t > 0 && w > 2 * t && h > 2 * t)) return null; area = w * h - (w - 2 * t) * (h - 2 * t); break;
    case '槽钢': if (!(h > 0 && w > 0 && t > 0)) return null; area = h * t + 2 * (w - t) * t; break;
    case '工字钢': if (!(h > 0 && w > 0 && t > 0)) return null; area = h * t + 2 * (w - t / 2) * t; break;
    default: return null;
  }
  if (!(area > 0)) return null;
  return Math.round((area * density / 1000) * 1000) / 1000;
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

// 钢材标准件几何周长(mm)
function calcSteelPerimeters(cat: string, width?: number|string, height?: number|string, thickness?: number|string): { outer: number; inner: number } | null {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const t = Number(thickness) || 0;
  const r1 = (v: number) => Math.round(v * 10) / 10;
  switch (cat) {
    case '圆钢': if (!(w > 0)) return null; return { outer: r1(Math.PI * w), inner: 0 };
    case '方钢': if (!(w > 0)) return null; return { outer: 4 * w, inner: 0 };
    case '六角钢': if (!(w > 0)) return null; return { outer: r1(6 * w / Math.sqrt(3)), inner: 0 };
    case '角钢': if (!(w > 0 && h > 0)) return null; return { outer: 2 * (w + h), inner: 0 };
    case '圆钢管': if (!(w > 0)) return null; return { outer: r1(Math.PI * w), inner: h > 0 ? r1(Math.PI * h) : 0 };
    case '方管': if (!(w > 0 && h > 0 && t > 0)) return null; return { outer: 2 * (w + h), inner: 2 * (w - 2*t) + 2 * (h - 2*t) };
    case '槽钢': if (!(h > 0 && w > 0)) return null; return { outer: r1(h + 2 * w), inner: 0 };
    case '工字钢': if (!(h > 0 && w > 0)) return null; return { outer: r1(h + 2 * w), inner: 0 };
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
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.dxf', '.dwg', '.stp', '.step', '.igs', '.iges', '.x_t', '.zip', '.rar', '.7z', '.tar', '.gz'];

// ==================== Component ====================

export default function QuoteForm({ onCalculate, onResult, onProductInfoChange, onMoldInfoChange, onSaveVariant, onNewQuote, aiData, loadQuoteData }: QuoteFormProps) {
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
  const skipCategoryResetRef = useRef(false);
  const [productSurfaceTreatment, setProductSurfaceTreatment] = useState('无');
  const [productColor, setProductColor] = useState('');
  const [surfaceTreatment, setSurfaceTreatment] = useState('无');
  const [surfaceColor, setSurfaceColor] = useState('');
  const [materialSizeType, setMaterialSizeType] = useState<'long' | 'short'>('short');
  const [meterWeightManual, setMeterWeightManual] = useState(false);
  const [quantityManual, setQuantityManual] = useState(false);
  const [perimeterManual, setPerimeterManual] = useState(false);
  const [areaManual, setAreaManual] = useState(false);
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
  const [selectedMold, setSelectedMold] = useState<any | null>(null); // 选中的现有模具完整信息（来自产品管理/供应商产品库）

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
  const [recogProducts, setRecogProducts] = useState<Record<string, any>[]>([]);
  const [selectedProductIdx, setSelectedProductIdx] = useState(0);
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
  const [checkQuestions, setCheckQuestions] = useState<any[]>([]);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, any>>({});
  const [showCheckDialog, setShowCheckDialog] = useState(false);
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
      if (!skipCategoryResetRef.current) {
        resetCategoryState(firstCat);
      }
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
    if (cat.fields.includes('crossSectionArea')) defaultFields.crossSectionArea = '';
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
      crossSectionArea: '',
      num_cavities: '',
      die_type: '',
      width: '',
      height: '',
    }));
    setAreaManual(false);
  };

  // 标准件：理论米重自动填入米重框（用户手填或匹配到库存模具后不覆盖；改尺寸/切种类恢复自动）
  useEffect(() => {
    if (productType !== '挤出' || materialCategory !== '标准件' || meterWeightManual) return;
    const mw = calcStdMeterWeight(standardCategory, fields.width as number, fields.height as number, fields.thickness as number);
    if (mw !== null) {
      setFields(prev => (String(prev.meterWeight ?? '') === String(mw) ? prev : { ...prev, meterWeight: mw }));
    }
  }, [productType, materialCategory, standardCategory, fields.width, fields.height, fields.thickness, meterWeightManual]);

  // 异型材：米重 ↔ 截面积 自动互算（铝密度2.7g/cm³）
  // 米重(kg/m) = 截面积(mm²) × 2.7 / 1000
  useEffect(() => {
    if (productType !== '挤出' || materialCategory !== '异型材') return;
    const mw = parseFloat(String(fields.meterWeight)) || 0;
    const area = parseFloat(String(fields.crossSectionArea)) || 0;
    // 用户手动填了米重 → 自动算截面积
    if (meterWeightManual && mw > 0 && !areaManual) {
      const calcArea = Math.round(mw * 1000 / 2.7 * 100) / 100;
      if (String(fields.crossSectionArea) !== String(calcArea)) {
        setFields(prev => ({ ...prev, crossSectionArea: String(calcArea) }));
      }
    }
    // 用户手动填了截面积 → 自动算米重
    else if (areaManual && area > 0 && !meterWeightManual) {
      const calcMw = Math.round(area * 2.7 / 1000 * 100) / 100;
      if (String(fields.meterWeight) !== String(calcMw)) {
        setFields(prev => ({ ...prev, meterWeight: String(calcMw) }));
      }
    }
  }, [productType, materialCategory, fields.meterWeight, fields.crossSectionArea, meterWeightManual, areaManual]);

  // 标准件：单件净重(g) = 米重(kg/m) × 长度(mm)，自动填入（规则截面棒/管按长度切割，净重≈消耗重量）
  useEffect(() => {
    if (productType !== '挤出' || materialCategory !== '标准件') return;
    const mw = parseFloat(String(fields.meterWeight)) || 0;
    const len = parseFloat(St