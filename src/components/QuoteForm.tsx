"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Plus, Loader2, CheckCircle2 } from 'lucide-react';
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
  aiData?: AiFormUpdate | Record<string, any> | null;
  loadQuoteData?: Record<string, any> | null;
  onDrawingData?: (data: Record<string, any>) => void;
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

export interface ProductTypeConfig {
  label: string;
  icon: string;
  materialCategories: Record<string, MaterialCategoryConfig>;
}

const ALL_COLORS_OXIDATION = ['本色', '红色', '黑色', '金色', '铁灰色'];

export const PRODUCT_TYPES: Record<string, ProductTypeConfig> = {
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

// ==================== Component ====================

export default function QuoteForm({ onCalculate, onResult, onProductInfoChange, onMoldInfoChange, onSaveVariant, onNewQuote, aiData, loadQuoteData, onDrawingData }: QuoteFormProps) {
  // ===== 登录 + 识图额度 =====
  const { user } = useAuth();

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

  // Recognition data from DrawingRecognition component
  const [recognitionId, setRecognitionId] = useState<string | null>(null);
  const [recogResult, setRecogResult] = useState<Record<string, any> | null>(null);

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

  const handleProductTypeChange = (pt: string) => {
    setProductType(pt);
    if (pt === '板材') setMaterialGrade('5052');
  };
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
          // 加工时间(分钟)：有识别结果时预填，否则留空让用户填
          if (param.type === 'number' && param.name === 'minutes') {
            const recogMin = recogResult?.machining_time_min || recogResult?.process?.machining_time_min;
            subParams[param.name] = recogMin ?? '';
          } else if (param.type === 'number') subParams[param.name] = '';
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

    // If raw recognition data (snake_case fields), use applyRecogToForm directly
    const raw = aiData as Record<string, any>;
    const hasRawFields = raw.product_type || raw.perimeter !== undefined || raw.meter_weight !== undefined || raw.die_type !== undefined;
    const hasSheetFields = raw.thickness_mm !== undefined || raw.unfold_length_mm !== undefined || raw.unfold_width_mm !== undefined || raw.is_sheet_metal !== undefined;
    console.log('[QuoteForm] aiData received:', { hasRawFields, hasSheetFields, thickness_mm: raw.thickness_mm, unfold_length_mm: raw.unfold_length_mm, unfold_width_mm: raw.unfold_width_mm, quantity: raw.quantity, product_type: raw.product_type });
    if (hasRawFields || hasSheetFields) {
      applyRecogToForm(raw);
      return;
    }

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
    // 表面处理：camelCase 分支也需要处理
    if (aiData.surfaceTreatment && aiData.surfaceTreatment !== '无' && aiData.surfaceTreatment !== '') {
      const st = String(aiData.surfaceTreatment);
      const stMap: Record<string,string> = {
        '阳极氧化': '氧化', '氧化本色': '氧化', '本色氧化': '氧化', '硬质氧化': '氧化',
        '喷砂': '喷砂氧化', '喷砂阳极氧化': '喷砂氧化',
        '抛光': '抛光氧化', '抛光阳极氧化': '抛光氧化',
        '拉丝': '拉丝氧化', '拉丝阳极氧化': '拉丝氧化',
        '喷粉': '喷涂', '粉末喷涂': '喷涂', '喷漆': '喷涂',
        '氧化': '氧化', '喷涂': '喷涂', '电泳': '电泳',
      };
      const mappedSt = stMap[st] || (['氧化','喷砂氧化','抛光氧化','拉丝氧化','喷涂','电泳'].includes(st) ? st : '');
      if (mappedSt) {
        setMaterialSurfaceTreatment(mappedSt);
        setProductSurfaceTreatment(mappedSt);
        setSurfaceTreatment(mappedSt);
      }
    }
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

  // Load saved quote data into form
  useEffect(() => {
    if (!loadQuoteData) return;
    const p = loadQuoteData.params || loadQuoteData;
    const r = loadQuoteData.result || {};

    // Restore product type
    if (p.productType) setProductType(p.productType);
    else if (p.product_type) {
      const typeMap: Record<string, string> = { extrusion: '挤出', sheet: '板材', die_casting: '压铸', injection: '注塑' };
      setProductType(typeMap[p.product_type] || p.product_type);
    }

    // Restore material category
    if (p.materialCategory) setMaterialCategory(p.materialCategory);
    else if (p.material_category) setMaterialCategory(p.material_category);
    else if (p.standardCategory) setStandardCategory(p.standardCategory);

    // Restore fields
    const fieldKeys = ['width', 'height', 'length', 'thickness', 'perimeter', 'innerPerimeter', 'meterWeight', 'quantity', 'productSize', 'diameter', 'hexFlat', 'outerDiameter', 'innerDiameter', 'area', 'netWeight', 'grossWeight'];
    const newFields: Record<string, number | string> = {};
    for (const k of fieldKeys) {
      if (p[k] !== undefined) newFields[k] = p[k];
    }
    if (Object.keys(newFields).length > 0) setFields(prev => ({ ...prev, ...newFields }));

    // Restore surface treatments
    if (p.materialSurfaceTreatment) setMaterialSurfaceTreatment(p.materialSurfaceTreatment);
    if (p.productSurfaceTreatment) setProductSurfaceTreatment(p.productSurfaceTreatment);
    if (p.surfaceTreatment) setSurfaceTreatment(p.surfaceTreatment);
    if (p.materialColor) setMaterialColor(p.materialColor);
    if (p.productColor) setProductColor(p.productColor);
    if (p.surfaceColor) setSurfaceColor(p.surfaceColor);

    // Restore processes
    if (Array.isArray(p.processes) && p.processes.length > 0) {
      setProcesses(p.processes.map((proc: any) => ({
        name: proc.name || proc.process_name,
        quantity: proc.quantity || 1,
        params: proc.params || {},
      })));
    }

    // Restore product name/code
    if (p.productName) setProductName(p.productName);
    if (p.productCode) setProductCode(p.productCode);

    // Restore material grade
    if (p.materialGrade) setMaterialGrade(p.materialGrade);

    // Restore selected mold（选中现有模具的报价，恢复模具完整信息，重新计算时仍能带出编号/名称/规格）
    if (p.moldNumber || p.moldCrossSection) {
      setUseExistingMold(true);
      setSelectedMold({
        mold_number: p.moldNumber || '',
        product_name: p.moldProductName || '',
        cross_section_mm: p.moldCrossSection || '',
        surface_treatments: p.moldSurface ? [p.moldSurface] : [],
      });
    }
  }, [loadQuoteData]);

  // Notify parent of product info changes
  useEffect(() => {
    onProductInfoChange?.({ productName, productCode });
  }, [productName, productCode]);

  // Notify parent when mold selection changes
  useEffect(() => {
    onMoldInfoChange?.({ useExistingMold, selectedMoldId });
  }, [useExistingMold, selectedMoldId]);

  // ==================== Mapping Helpers ====================

  const mapProductType = (): string => {
    if (productType === '挤出') return 'extrusion';
    if (productType === '板材') return 'sheet_metal';
    if (productType === '压铸') {
      return materialCategory === '锌合金' ? 'zinc_alloy' : 'die_casting';
    }
    if (productType === '注塑') return 'injection';
    if (productType === '钢材') return 'steel_standard';
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
    // 使用合并后的统一表面处理：优先用户手动选的，其次AI识别的
    const effectiveST = (surfaceTreatment && surfaceTreatment !== '无')
      ? surfaceTreatment
      : ((materialSurfaceTreatment && materialSurfaceTreatment !== '无') ? materialSurfaceTreatment
        : (productSurfaceTreatment && productSurfaceTreatment !== '无') ? productSurfaceTreatment : '');
    if (effectiveST) {
      let mapped = surfaceMap[effectiveST];
      if (!mapped) return null;
      if (effectiveST === '氧化') {
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
    let bendCount: number | undefined;

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
      } else if (proc.name === '折弯') {
        secondaryOps.push('折弯');
        bendCount = Number(proc.quantity) || 1;
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
    if (bendCount !== undefined) result.bend_count = bendCount;
    return result;
  };

  const calcWeightKg = (): number | undefined => {
    if (productType === '挤出') {
      // 挤出：始终用米重×长度计算型材消耗重量（净重用于计算利用率，不覆盖重量）
      const meterWeight = fields.meterWeight as number;
      const length = fields.length as number;
      if (meterWeight && length) return (meterWeight * length) / 1000;
    }
    if (productType === '钢材') {
      // 钢材：用米重×长度计算单件重量
      const mw = fields.meterWeight as number;
      const len = fields.length as number;
      if (mw && len) return (mw * len) / 1000;
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
        cross_section_area_mm2: num(fields.crossSectionArea),
        net_weight_g: num(fields.netWeight),
        die_steel_price: dieSteelPrice ? parseFloat(dieSteelPrice) : undefined,
      };
    }
    if (productType === '板材') {
      const thickness = fields.thickness as number;
      const num = (v: unknown): number | undefined => {
        const n = typeof v === 'number' ? v : parseFloat(String(v));
        return Number.isFinite(n) && n > 0 ? n : undefined;
      };
      const bL = num(fields.length);
      const bW = num(fields.width);
      if (bL && bW) return { length_mm: bL, width_mm: bW, wall_thickness_mm: thickness || undefined };
      // 兼容旧 productSize 字段
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
          if (val === '' || val === undefined || val === null) return false;
          // productSize 是复合字符串如 "100×200"，需要 parseProductSize 解析
          if (f === 'productSize') return parseProductSize(String(val)) !== null;
          return Number(val) > 0;
        });
      }
      if (!allFilled) {
        onResult?.(null);
        return;
      }
    }

    // ===== 钢材标准件：前端直接算（后端暂不支持） =====
    if (productType === '钢材') {
      const grade = (fields.materialGrade as string) || materialGrade || 'Q235';
      const pricePerTon = STEEL_DEFAULT_PRICES[grade] || 3700;
      const density = getSteelDensity(grade);
      const mw = Number(fields.meterWeight) || 0;
      const len = Number(fields.length) || 0;
      const qty = Number(fields.quantity) || 1;
      if (!mw || !len) { onResult?.(null); return; }

      const weightPerPiece = (mw * len) / 1000; // kg
      const totalWeight = weightPerPiece * qty;
      const materialCost = totalWeight * pricePerTon / 1000;

      // 锯切费：0.5元/刀（临时，后续费率确认后再调）
      const cutCount = processes.some(p => p.name === '锯切') ? (Number((processes.find(p => p.name === '锯切') as any)?.quantity) || 1) : 0;
      const processingCost = cutCount > 0 ? cutCount * qty * 0.5 : 0;

      const subtotal = materialCost + processingCost;
      const mgmtFee = subtotal * 0.13;
      const unitPrice = Math.round((subtotal + mgmtFee) * 100) / 100;
      const totalPrice = Math.round(unitPrice * qty * 100) / 100;

      onResult?.({
        quotation_id: `STEEL-${Date.now()}`,
        material_cost: Math.round(materialCost * 100) / 100,
        processing_cost: processingCost,
        surface_treatment_cost: 0,
        secondary_operations_cost: 0,
        packaging_cost: 0,
        transport_cost: 0,
        management_fee: Math.round(mgmtFee * 100) / 100,
        unit_price: unitPrice,
        unit_price_ex_tax: unitPrice,
        unit_price_in_tax: Math.round(unitPrice * 1.13 * 100) / 100,
        total_price: totalPrice,
        weight_per_piece_kg: Math.round(weightPerPiece * 1000) / 1000,
        breakdown: {
          material: { formula: `${weightPerPiece.toFixed(2)}kg×${pricePerTon}元/吨×${qty}件`, detail: `材料费: ${grade} ${pricePerTon}元/吨 × ${weightPerPiece.toFixed(2)}kg/件 × ${qty}件 = ${Math.round(materialCost)}元` },
          ...(cutCount > 0 ? { processing: { formula: `${cutCount}刀×${qty}件×0.5元`, detail: `锯切: ${cutCount}×${qty}×0.5 = ${processingCost}元` } } : {}),
          management: { formula: `管理费13%`, detail: `管理费: (${Math.round(materialCost)}+${processingCost})×13% = ${Math.round(mgmtFee)}元` },
        },
        aluminum_index: 0,
        notes: [`${grade}圆钢参考价 ${pricePerTon}元/吨（2026-09-10 上海）`, '加工费率待确认，当前仅含材料费+锯切'],
        mold_cost: 0,
        mold_spec: '',
        min_order_qty: 1,
        min_order_weight_kg: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const surfaceTreatmentPayload = mapSurfaceTreatment();
      const processInfo = mapProcesses();

      // ---- Normal (single) mode ----
      const weightKg = calcWeightKg();
      const dimensions = buildDimensions();
      const payload: Record<string, any> = {
        product_type: mapProductType(),
        material: { category: mapMaterialCategory(), grade: materialGrade || (productType === '板材' ? '5052' : undefined) },
        quantity: (fields.quantity as number) || 1,
      };
      if (productName) payload.product_name = productName;
      if (productCode) payload.product_code = productCode;
      if (useExistingMold === true) payload.use_existing_mold = true;
      if (dimensions) {
        if (productType === '挤出') (dimensions as any).material_size_type = materialSizeType;
        payload.dimensions = dimensions;
      }
      if (weightKg !== undefined) payload.weight_per_piece_kg = weightKg;
      if (surfaceTreatmentPayload) payload.surface_treatment = surfaceTreatmentPayload;
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
            mold_spec: data.mold_spec || '',
            min_order_qty: data.min_order_qty || 0,
            min_order_weight_kg: data.min_order_weight_kg || 0,
          };
          onResult?.(result);
          reportRecognitionFeedback();
          if (onCalculate) {
            onCalculate({
              productType, materialCategory, standardCategory,
              quantity: (fields.quantity as number) || 1,
              width: fields.width as number, height: fields.height as number,
              length: fields.length as number, thickness: fields.thickness as number,
              productSize: (fields.productSize as string) || ((fields.length ? String(fields.length) : '') + (fields.width ? '×' + fields.width : '')),
              meterWeight: fields.meterWeight as number, netWeight: fields.netWeight as number,
              materialSurfaceTreatment, materialColor, processes,
              productSurfaceTreatment, productColor,
              surfaceTreatment, surfaceColor,
              // 材质牌号（挤出铝型材默认 6063-T5 在出单侧兜底）
              materialGrade: materialGrade || undefined,
              // 选中现有模具：带出产品管理中的模具编号/名称/规格/表面处理，出单直接使用
              moldNumber: useExistingMold === true && selectedMold ? (selectedMold.mold_number || '') : '',
              moldProductName: useExistingMold === true && selectedMold ? (standardCategory === '异型材' ? realMoldProductName(selectedMold.product_name) : '') : '',
              moldCrossSection: useExistingMold === true && selectedMold ? (selectedMold.cross_section_mm || '') : '',
              moldSurface: useExistingMold === true && selectedMold && Array.isArray(selectedMold.surface_treatments)
                ? (selectedMold.surface_treatments.map((x: string) => String(x || '').trim()).filter((x: string) => x && x !== '素材' && x !== '无').join('、'))
                : '',
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

  const applyRecogToForm = (d: Record<string, any>) => {
    // 钣金件优先：is_sheet_metal=true 或 area_method=sheet_metal 时强制切板材
    const isSheet = d.is_sheet_metal === true || d.area_method === 'sheet_metal' || d.product_type === 'sheet_metal';
    if (isSheet) {
      d.product_type = 'sheet_metal';
      d.material_category = d.material_category || '铝板';
    }
    // 如果当前是板材tab，强制覆盖AI可能返回的错误product_type
    if (productType === '板材' && !isSheet) {
      d.product_type = d.product_type || 'stamping';
      d.material_category = d.material_category || '铝板';
    }
    // 产品类型映射
    if (d.product_type) {
      const ptMap: Record<string,string> = {
        extrusion: '挤出', stamping: '板材', sheet_metal: '板材', die_casting: '压铸',
        zinc_alloy: '压铸', cnc: '挤出', injection: '注塑',
      };
      const mapped = ptMap[String(d.product_type).toLowerCase()] || ptMap[d.product_type];
      if (mapped && PRODUCT_TYPES[mapped] && productType !== mapped) setProductType(mapped);
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
      // 但如果当前是板材tab，不要因为材料含"铝"就跳到异型材
      const mc = String(d.material_category);
      if (productType === '板材') {
        // 板材模式下，直接用material_category作为板材的细分类
        const catMap: Record<string,string> = {
          '铝板': '铝板', '铝合金': '铝板', '铝': '铝板',
          '不锈钢': '不锈钢', '冷轧板': '冷轧板', '冷板': '冷轧板', '镀锌板': '镀锌板',
        };
        const mapped = catMap[mc] || mc;
        if (mapped) setMaterialCategory(mapped);
      } else if (/铝合金|铝型材|^铝$|挤压|挤出/.test(mc)) {
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

    // 产品名称/编号：兼容 product_name/product_code 和 part_name/part_number 以及 _partName
    const resolvedName = d.product_name || d.part_name || d._partName || '';
    const resolvedCode = d.product_code || d.part_number || '';
    if (resolvedCode) setProductCode(resolvedCode);
    if (resolvedName) setProductName(resolvedName);

    // 字段统一最后填，避免被类别切换的 reset 清掉
    // toNum: 兼容AI返回的字符串数字（如 "28.5" → 28.5）
    const toNum = (v: unknown): number | null => {
      if (typeof v === 'number' && !isNaN(v)) return v;
      if (typeof v === 'string' && v.trim() !== '') { const n = parseFloat(v); return isNaN(n) ? null : n; }
      return null;
    };
    // 板材分支：延迟设置字段，避免被 resetCategoryState 覆盖
    const isSheet = d.is_sheet_metal === true || d.area_method === 'sheet_metal' || d.product_type === 'sheet_metal';
    if (isSheet) {
      setTimeout(() => {
        setFields(prev => {
          const next = { ...prev };
          const wt = toNum(d.wall_thickness) ?? toNum(d.thickness) ?? toNum(d.sheet_thickness) ?? toNum(d.thickness_mm);
          if (wt !== null) next.thickness = wt;
          const sheetL = toNum(d.unfold_length) ?? toNum(d.unfold_length_mm) ?? toNum(d.sheet_length);
          const sheetW = toNum(d.unfold_width) ?? toNum(d.unfold_width_mm) ?? toNum(d.sheet_width);
          if (sheetL !== null) next.length = sheetL;
          if (sheetW !== null) next.width = sheetW;
          const qty = toNum(d.quantity) ?? toNum(d._quantity);
          if (qty !== null) next.quantity = qty;
          return next;
        });
      }, 300);
    } else {
    setFields(prev => {
      const next = { ...prev };
      const w = toNum(d.width); if (w !== null) next.width = w;
      const h = toNum(d.height); if (h !== null) next.height = h;
      const l = toNum(d.length); if (l !== null) next.length = l;
      const p = toNum(d.perimeter); if (p !== null) next.perimeter = p;
      const ip = toNum(d.inner_perimeter); if (ip !== null) next.innerPerimeter = ip;
      const nc = toNum(d.num_cavities); if (nc !== null) next.num_cavities = nc;
      const csa = toNum(d.crossSectionArea); if (csa !== null) next.crossSectionArea = csa;
      // 模具类型兼容英文/中文/中空描述
      const dt = String(d.die_type || '').toLowerCase();
      if (d.die_type === 'flat' || dt === 'flat' || d.die_type === '平模' || d.die_type === '实心') next.die_type = 'flat';
      else if (d.die_type === 'split' || dt === 'split' || d.die_type === '分流模' || d.die_type === '中空' || d.die_type === '空心') next.die_type = 'split';
      // 按内腔数兜底：有内腔=分流模，实心=平模
      if (nc !== null && !next.die_type) {
        next.die_type = nc >= 1 ? 'split' : 'flat';
      }
      const mw = toNum(d.meter_weight); if (mw !== null) next.meterWeight = mw;
      const qty = toNum(d.quantity) ?? toNum(d._quantity); if (qty !== null) next.quantity = qty;
      const wt = toNum(d.wall_thickness) ?? toNum(d.thickness) ?? toNum(d.sheet_thickness) ?? toNum(d.thickness_mm); if (wt !== null) next.thickness = wt;
      // 板材专用：展开尺寸 → length + width 独立字段（兼容 _mm 后缀）
      const sheetL = toNum(d.unfold_length) ?? toNum(d.unfold_length_mm) ?? toNum(d.sheet_length);
      const sheetW = toNum(d.unfold_width) ?? toNum(d.unfold_width_mm) ?? toNum(d.sheet_width);
      if (sheetL !== null) next.length = sheetL;
      if (sheetW !== null) next.width = sheetW;
      // 标准件专属尺寸（前端 width/height 复用槽位：圆棒直径、六角对边、圆管外径→width；内径→height）
      const dAny = d as Record<string, unknown>;
      const num = (v: unknown) => toNum(v) ?? (toNum(v) !== null && (toNum(v) as number) > 0 ? toNum(v) : null);
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
    }
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
    // 工序：支持字符串格式 "锯切,冲压(3次)" 和 数组格式 ["激光切割","折弯"]
    if (d.processes && d.processes !== '无') {
      let procs: ProcessSelection[] = [];
      if (Array.isArray(d.processes)) {
        // 板材API返回数组格式 或 3D CAD传入的对象数组
        procs = d.processes.map((p: any) => {
          if (typeof p === 'string') return { name: p.trim() };
          return { name: p.name, quantity: p.quantity, subParams: p.subParams };
        }).filter((p: ProcessSelection) => p.name);
      } else if (typeof d.processes === 'string') {
        procs = d.processes.split(/[,，、]/).map((p: string) => {
          const m = p.trim().match(/^(.+?)(?:\((\d+)(分钟|次|mm|个)?\))?$/);
          if (m) return { name: m[1], quantity: m[2] ? parseInt(m[2]) : undefined };
          return { name: p.trim() };
        }).filter((p: ProcessSelection) => p.name);
      }
      if (procs.length > 0) setProcesses(procs);
    }
    // 二次加工工序：从 process.secondary_operations 读取
    const secOps = d.process?.secondary_operations || d.secondary_operations;
    if (secOps && Array.isArray(secOps) && secOps.length > 0) {
      const secProcs = secOps.map((op: any) => ({
        name: op.name || op,
        quantity: op.quantity,
      })).filter((p: ProcessSelection) => p.name);
      if (secProcs.length > 0) {
        setProcesses(prev => {
          const existingNames = new Set(prev.map(p => p.name));
          const newProcs = secProcs.filter(p => !existingNames.has(p.name));
          return newProcs.length > 0 ? [...prev, ...newProcs] : prev;
        });
      }
    }
    // CNC 加工：直接从 STP/CAD 解析结果自动添加（有孔位或有加工时间均触发）
    // 钣金件：仅当有明确CNC孔数或加工时间时才加CNC；零孔+无加工时间的纯折弯件不加
    const cncHoles = d.cnc_holes || d.process?.cnc_holes;
    const cncTotalHoles = toNum(d.cnc_total_holes) || toNum(d.all_holes_total) || 0;
    const machiningTime = toNum(d.machining_time_min) || d.process?.machining_time_min;
    const isSheetPart = d.is_sheet_metal === true || d.area_method === 'sheet_metal' || productType === '板材';
    // 钣金件：仅当is_cnc=true的孔>0时加CNC；cnc_total_holes=0说明所有孔都是挤压工艺孔，不加CNC
    // （后端machining_time可能错误把侧向挤压工艺孔计入，钣金件不以此为依据）
    const hasCncData = isSheetPart
      ? (cncTotalHoles > 0 || (Array.isArray(cncHoles) && cncHoles.length > 0))
      : ((cncHoles && Array.isArray(cncHoles) && cncHoles.length > 0) || cncTotalHoles > 0 || !!machiningTime);
    if (hasCncData) {
      setProcesses(prev => {
        const existingNames = new Set(prev.map(p => p.name));
        const newProcs = [];
        if (!existingNames.has('CNC加工')) {
          const cncProc: any = { name: 'CNC加工' };
          if (machiningTime) cncProc.subParams = { minutes: machiningTime };
          else if (cncTotalHoles > 0) cncProc.quantity = cncTotalHoles;
          newProcs.push(cncProc);
        }
        if (!existingNames.has('钻孔') && cncTotalHoles > 0) {
          newProcs.push({ name: '钻孔', quantity: cncTotalHoles, subParams: { hole_count: cncTotalHoles } });
        }
        return newProcs.length > 0 ? [...prev, ...newProcs] : prev;
      });
    }
    // 钣金折弯：bend_count>0时自动勾选折弯工序
    const bendCount = toNum(d.bend_count) || 0;
    if (bendCount > 0 && (isSheetPart || productType === '板材')) {
      setProcesses(prev => {
        const existingNames = new Set(prev.map(p => p.name));
        if (!existingNames.has('折弯')) {
          return [...prev, { name: '折弯', quantity: bendCount }];
        }
        return prev;
      });
    }
    setAiSynced(true);
    setTimeout(() => setAiSynced(false), 2500);
  };

  // Handler for DrawingRecognition component callback
  const handleDrawingData = (data: { recogData: Record<string, any> | null; recognitionId?: string; checkAnswers?: Record<string, any> }) => {
    if (data.recogData) {
      applyRecogToForm(data.recogData);
    }
    if (data.recognitionId) {
      setRecognitionId(data.recognitionId);
    }
    if (data.recogData) {
      setRecogResult(data.recogData);
    }
    if (onDrawingData) {
      onDrawingData(data.recogData || {});
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
    const fieldOrder = ['thickness', 'length', 'width', 'height', 'perimeter', 'num_cavities', 'die_type', 'meterWeight', 'crossSectionArea', 'productSize', 'quantity', 'netWeight'];
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
                    <label className="block text-sm text-slate-600 mb-1">{getFieldLabel(productType, fieldKey)}</label>
                    <input
                      type="text"
                      placeholder={productType === '板材' ? '如 500×300' : '如 100×50×30'}
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
                    <label className="block text-sm text-slate-600 mb-1">
                      {getFieldLabel(productType, fieldKey)}
                      <span className="ml-1 text-xs text-blue-500">({cavLabel})</span>
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
                    <label className="block text-sm text-slate-600 mb-1">{getFieldLabel(productType, fieldKey)}</label>
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
                    <label className="block text-sm text-slate-600 mb-1">
                      {getFieldLabel(productType, fieldKey)}
                      <span className="ml-1 text-xs text-blue-400">点＋把当前长度存入报价池（同副模具只算一次模具费）</span>
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
                  <label className="block text-sm text-slate-600 mb-1">{getFieldLabel(productType, fieldKey)}</label>
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
                          if (val > 0) { setQuantityManual(false); setAreaManual(false); }
                        }
                        if (fieldKey === 'crossSectionArea') {
                          setAreaManual(val > 0);
                          if (val > 0) { setMeterWeightManual(false); setQuantityManual(false); }
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
          const bL = parseFloat(fields.length as string) || 0;
          const bW = parseFloat(fields.width as string) || 0;
          const t = Number(fields.thickness) || 0;
          // 兼容旧 productSize
          const parsed = (bL <= 0 || bW <= 0) ? parseProductSize(fields.productSize as string) : null;
          const l = bL > 0 ? bL : (parsed?.l || 0);
          const w = bW > 0 ? bW : (parsed?.w || 0);
          const wg = (l > 0 && w > 0) ? calcSheetWeightG(materialCategory, l, w, t) : null;
          if (wg === null) return null;
          const densityTxt = materialCategory === '铝板' ? '2.7' : materialCategory === '不锈钢' ? '7.93' : '7.85';
          return (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-sm text-blue-700">
              <span className="font-semibold">单件理论重量</span>
              <span className="font-mono font-semibold text-blue-800">{wg} g</span>
              <span className="text-blue-400">（{l}×{w}×{t}mm × {densityTxt}g/cm³ 自动计算，直接用于报价）</span>
            </div>
          );
        })()}
      </div>
    );
  };

  const inputBaseClass = "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]";

  return (
    <div className="h-full">
      {/* ===== CENTER COLUMN: 参数设置 ===== */}
      <div style={{ overflow: 'auto', padding: '16px 20px', background: '#fff', borderRadius: 12, border: '1px solid #e8ecf1' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⚙️</span>
          参数设置
        </div>

        {/* ---- 模具组工具条：点「新建报价」=开一副新模具 ---- */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50/70 border border-blue-100">
          <div className="text-sm text-blue-700 leading-snug">
            当前为<b>同一副模具</b>：改长度后点长度框旁的<b>＋</b>存入报价池，出单时模具费只算一次。
          </div>
          <button
            type="button"
            onClick={onNewQuote}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-blue-300 text-blue-700 text-sm font-semibold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
            title="清空表单，开始一副新模具的报价"
          >
            <span className="text-sm leading-none">＋</span> 新建报价
          </button>
        </div>

        {/* AI synced indicator */}
        {aiSynced && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            AI 已自动填入参数
          </div>
        )}

        {/* ---- 产品名称 & 编号 ---- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-slate-600 mb-1">产品名称</label>
              <input
                type="text"
                placeholder="输入产品名称"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none transition-all duration-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 min-h-[36px]"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">产品编号</label>
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
                className={`relative px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  productType === key
                    ? 'text-blue-600'
                    : 'text-slate-600 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-base">{cfg.icon}</span>
                  {cfg.label}
                  {key === '注塑' && (
                    <span className="ml-0.5 px-1 py-0.5 rounded bg-amber-100 text-amber-600 text-[11px] font-normal leading-none">待开发</span>
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
          <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">材料类别</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(productConfig?.materialCategories || {}).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleMaterialCategoryChange(key)}
                className={`px-2.5 py-1 rounded-lg border text-sm transition-all duration-200 ${
                  materialCategory === key
                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- 铝板牌号选择（仅板材·铝板；默认5052） ---- */}
        {productType === '板材' && materialCategory === '铝板' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              铝板牌号 <span className="normal-case text-slate-600">（铝锭价+牌号加价，元/吨）</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { g: '1060', label: '1060 纯铝', add: '+1000' },
                { g: '3003', label: '3003 防锈', add: '+2000' },
                { g: '5052', label: '5052 镁铝', add: '+3000' },
                { g: '5083', label: '5083 海洋级', add: '+3000' },
                { g: '7075', label: '7075 航空铝', add: '+4000' },
              ] as const).map(opt => (
                <button
                  key={opt.g}
                  type="button"
                  onClick={() => setMaterialGrade(opt.g)}
                  className={`px-2.5 py-1 rounded-lg border text-sm transition-all duration-200 ${
                    (materialGrade || '5052') === opt.g
                      ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {opt.label} <span className="opacity-60">{opt.add}</span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-xs text-slate-600">默认 5052；整板规格 2440×1220mm，按展开尺寸排版算材料费</div>
          </div>
        )}

        {/* ---- 标准件种类选择 (仅挤出·标准件；异型材唯一分类无需再点) ---- */}
        {productType === '挤出' && materialCategory === '标准件' && (() => {
          const STD_PARTS = ['铝圆棒', '铝方/扁棒', '铝六角棒', '角铝', '铝圆管', '铝六角管', '铝方管'];
          const visibleCats = standardCategories.filter(c => STD_PARTS.includes(c.key));
          if (visibleCats.length === 0) return null;
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
              <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                标准件种类
              </label>
              <div className="flex flex-wrap gap-1.5">
                {visibleCats.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => { setStandardCategory(cat.key); resetProfileState(); setMeterWeightManual(false); setAreaManual(false); setPerimeterManual(false); setFields(prev => ({ ...prev, die_type: ['铝圆管','铝六角管','铝方管'].includes(cat.key) ? 'split' : 'flat' })); }}
                    className={`px-2.5 py-1.5 rounded-lg border text-sm transition-all duration-200 ${
                      standardCategory === cat.key
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {cat.label}
                    <span className="ml-1 text-xs opacity-60">({cat.count})</span>
                    <span className={`ml-1 text-xs ${cat.mold_type === '分流模' ? 'text-red-400' : 'text-slate-600'}`}>
                      {cat.mold_type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ---- 钢材标准件种类选择 ---- */}
        {productType === '钢材' && (() => {
          const STEEL_CATS = ['圆钢', '方钢', '六角钢', '角钢', '圆钢管', '方管', '槽钢', '工字钢'];
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
              <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                钢材截面
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STEEL_CATS.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setStandardCategory(cat); setMeterWeightManual(false); setFields(prev => ({ ...prev, width: '', height: '', thickness: '' })); }}
                    className={`px-2.5 py-1.5 rounded-lg border text-sm transition-all duration-200 ${
                      standardCategory === cat
                        ? 'bg-orange-50 border-orange-300 text-orange-700 font-semibold'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* 材质选择 */}
              <div className="mt-2">
                <label className="block text-sm font-semibold text-slate-600 mb-1">材质</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                  defaultValue=""
                  onChange={(e) => {
                    const mat = e.target.value;
                    if (!mat) return;
                    setMaterialCategory('钢标准件');
                    // 更新密度用于米重计算
                    setFields(prev => ({ ...prev, materialGrade: mat }));
                  }}
                >
                  <option value="" disabled>-- 选择材质 --</option>
                  <option value="Q235">Q235（普通碳钢，7.85）</option>
                  <option value="45#">45#钢（中碳钢，7.85）</option>
                  <option value="40Cr">40Cr（合金钢，7.85）</option>
                  <option value="304">304不锈钢（7.93）</option>
                  <option value="316">316不锈钢（7.93）</option>
                  <option value="黄铜H59">黄铜H59（8.5）</option>
                </select>
              </div>
                            {/* 规格选择下拉 - 选规格自动填尺寸和米重 */}
              {standardCategory && STEEL_STANDARD_SPECS && (() => {
                const prefix = standardCategory === '圆钢管' ? '圆管-' : 
                               standardCategory === '方管' ? '方管-' :
                               standardCategory + '-';
                const specs = Object.entries(STEEL_STANDARD_SPECS).filter(([k]) => k.startsWith(prefix));
                if (specs.length === 0) return null;
                return (
                  <div className="mt-3">
                    <label className="block text-sm font-semibold text-slate-600 mb-1">选择规格（自动填尺寸+米重）</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                      defaultValue=""
                      onChange={(e) => {
                        const key = e.target.value;
                        if (!key) return;
                        const spec = STEEL_STANDARD_SPECS[key];
                        if (!spec) return;
                        setMeterWeightManual(false);
                        setFields(prev => ({
                          ...prev,
                          diameter: spec.dims.diameter ?? '',
                          hex: spec.dims.hex ?? '',
                          width: spec.dims.width ?? '',
                          height: spec.dims.height ?? '',
                          thickness: spec.dims.thickness ?? '',
                          meterWeight: spec.weight,
                        }));
                      }}
                    >
                      <option value="" disabled>-- 选择国标规格 --</option>
                      {specs.map(([k, v]) => (
                        <option key={k} value={k}>{v.label}（{v.weight} kg/m）</option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ---- 异型材模具类型选择 (仅挤出·异型材，上移直接选) ---- */}
        {productType === '挤出' && materialCategory === '异型材' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
            <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              模具类型（先选再填尺寸）
            </label>
            <div className="flex gap-2">
              {([{ v: 'flat', label: '平模（实心）' }, { v: 'split', label: '分流模（中空）' }] as const).map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => { setFields(prev => ({ ...prev, die_type: opt.v })); setSelectedMoldId(null); setUseExistingMold(null); setSelectedMold(null); setMoldMatches([]); }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    fields.die_type === opt.v
                      ? opt.v === 'split'
                        ? 'bg-red-50 border-red-300 text-red-600'
                        : 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-slate-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {!fields.die_type && (
              <div className="mt-1.5 text-sm text-amber-500">请先选择模具类型，再填尺寸点搜索</div>
            )}
          </div>
        )}

        {/* ---- 尺寸输入 + 模具匹配 ---- */}
        {productType === '挤出' && standardCategory && (() => {
          const dimFields = CATEGORY_DIM_FIELDS[standardCategory];
          if (!dimFields) return null;
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 transition-shadow duration-200 hover:shadow-md">
              <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">
                输入尺寸 · 填完点按钮匹配模具
              </label>
              <div className={`grid ${dimFields.length >= 3 ? 'grid-cols-3' : dimFields.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                {dimFields.map(df => {
                  const fieldMap: Record<string, string> = { diameter: 'width', hex: 'width', outer: 'width', inner: 'height' };
                  const stateKey = fieldMap[df.key] || df.key;
                  return (
                    <div key={df.key}>
                      <label className="block text-xs text-slate-600 mb-0.5">{df.label}</label>
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
                          // 米重↔截面积 手动标记（触发自动互算）
                          if (stateKey === 'meterWeight') {
                            setMeterWeightManual(val > 0);
                            if (val > 0) setAreaManual(false);
                          } else if (stateKey === 'crossSectionArea') {
                            setAreaManual(val > 0);
                            if (val > 0) setMeterWeightManual(false);
                          } else {
                            setMeterWeightManual(false);
                          }
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
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1.5 text-sm text-blue-700">
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
                className="mt-2 w-full px-3 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-200 disabled:text-slate-600 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
              >
                {moldMatchLoading ? (<><span className="inline-block animate-spin">⟳</span> 正在匹配现有模具...</>) : (<>🔍 搜索现有模具</>)}
              </button>

              {!moldMatchLoading && moldMatches.length > 0 && !(selectedMoldId && useExistingMold) && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-sm font-medium text-gray-600 flex items-center gap-1">
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
                          setSelectedMold(m);
                          // 按产品管理带出：编号=模具编号，名称=产品名称
                          if (m.mold_number) setProductCode(m.mold_number);
                          if (standardCategory === '异型材' && realMoldProductName(m.product_name)) setProductName(realMoldProductName(m.product_name));
                          // 注：表面处理不改表单选择（表面处理费按用户实际选择计算）；
                          // 产品库登记的表面处理原文通过 selectedMold → moldSurface 带到报价单显示
                          const dims = parseMoldDimensions(standardCategory, m.cross_section_mm);
                          setFields(prev => ({
                            ...prev,
                            ...dims,
                            die_type: m.mold_type === '分流模' ? 'split' : 'flat',
                            perimeter: m.perimeter || prev.perimeter,
                            meterWeight: m.weight_per_meter || prev.meterWeight,
                            // 模具库带米重时，若截面积为空则自动反算（米重×1000/2.7）
                            crossSectionArea: prev.crossSectionArea
                              ? prev.crossSectionArea
                              : (m.weight_per_meter
                                  ? String(Math.round(parseFloat(m.weight_per_meter) * 1000 / 2.7 * 100) / 100)
                                  : prev.crossSectionArea),
                          }));
                          setPerimeterManual(true);
                          setMeterWeightManual(true);
                          setAreaManual(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-sm transition-all flex items-center justify-between ${
                          selectedMoldId === m.id
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-green-50/50 hover:border-green-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* 任务1：异型材显示模具编号，标准件无编号不显示 */}
                          {standardCategory === '异型材' && m.mold_number && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono text-xs font-medium">{m.mold_number}</span>
                          )}
                          <span className="font-medium shrink-0">{m.cross_section_mm}</span>
                          <span className="text-slate-600 shrink-0">·</span>
                          <span className="text-slate-600 truncate">{m.weight_per_meter}kg/m</span>
                          <span className={`shrink-0 px-1 py-0.5 rounded text-[11px] ${
                            m.mold_type === '分流模' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-slate-600'
                          }`}>{m.mold_type}</span>
                        </div>
                        <span className={`shrink-0 ml-1.5 font-bold ${
                          m.match_score >= 95 ? 'text-green-600' : m.match_score >= 80 ? 'text-amber-600' : 'text-slate-600'
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
                          <span className="text-green-600 text-sm">✓</span>
                          {sel?.mold_number && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-mono text-xs font-medium">{sel.mold_number}</span>
                          )}
                          <span className="text-sm font-medium text-green-700 truncate">{sel?.cross_section_mm || '已选模具'}</span>
                          <span className="text-xs text-slate-600">{sel?.weight_per_meter}kg/m</span>
                        </div>
                        <button type="button" onClick={() => { setSelectedMoldId(null); setUseExistingMold(null); setSelectedMold(null); }} className="text-xs text-blue-500 hover:text-blue-700 shrink-0 ml-2">更换</button>
                      </div>
                    );
                  })()}

                  {/* 选择：使用现有模具 or 开新模 */}
                  {!(selectedMoldId && useExistingMold) && (
                  <div className="flex gap-2 pt-1.5 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setUseExistingMold(true)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        useExistingMold === true
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-white border-gray-200 text-slate-600 hover:border-green-200'
                      }`}
                    >
                      ✓ 用现有模具（免模具费）
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUseExistingMold(false); setSelectedMoldId(null); setSelectedMold(null); }}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        useExistingMold === false
                          ? 'bg-orange-50 border-orange-300 text-orange-700'
                          : 'bg-white border-gray-200 text-slate-600 hover:border-orange-200'
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
                  <span className="text-sm text-orange-600">未找到相近现有模具</span>
                  <button
                    type="button"
                    onClick={() => setUseExistingMold(false)}
                    className={`px-2 py-1 rounded text-sm font-semibold border transition-all ${
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
          <label className="block text-sm font-semibold text-slate-600 mb-2 uppercase tracking-wide">基本参数</label>
          {renderFields()}
        </div>

        {/* ---- 加工工艺（合并工艺+表面处理+参数） ---- */}
        {categoryConfig && (
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f3f4f6', padding: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>加工工艺</label>

            {/* === 上半部分：2列 grid === */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* 左列 - 工艺选择 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 8 }}>工艺选择</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categoryConfig.processes.map(proc => {
                    const isNone = proc.name === '无';
                    const isSelected = isNone ? processes.length === 0 : processes.some(p => p.name === proc.name);
                    return (
                      <button
                        key={proc.name}
                        type="button"
                        onClick={() => toggleProcess(proc.name)}
                        style={{
                          padding: '6px 10px',
                          fontSize: 14,
                          borderRadius: 20,
                          border: isSelected ? '1px solid #2563eb' : '1px solid #d1d5db',
                          background: isSelected ? '#eff6ff' : '#fff',
                          color: isSelected ? '#2563eb' : '#475569',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {proc.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 中列 - 表面处理 */}
              {(showMaterialSurface || showProductSurface) && (
                <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 8 }}>表面处理</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {getSurfaceTreatmentOptions().map(o => {
                      const isSelected = surfaceTreatment === o.name;
                      return (
                        <button
                          key={o.name}
                          type="button"
                          onClick={() => { setSurfaceTreatment(o.name); setSurfaceColor(''); }}
                          style={{
                            padding: '6px 10px',
                            fontSize: 14,
                            borderRadius: 20,
                            border: isSelected ? '1px solid #2563eb' : '1px solid #d1d5db',
                            background: isSelected ? '#eff6ff' : '#fff',
                            color: isSelected ? '#2563eb' : '#475569',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {o.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* === 下半部分：4列 grid 子参数卡片 === */}
            {(() => {
              const hasAnySubCard = processes.some(p => PROCESS_SUB_PARAMS[p.name])
                || (surfaceTreatment && surfaceTreatment !== '无' && getSurfaceColorOptions().length > 0)
                || (productType === '挤出' && surfaceTreatment && surfaceTreatment !== '无');
              if (!hasAnySubCard) return null;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                  {/* CNC加工卡片 */}
                  {processes.some(p => p.name === 'CNC加工') && (() => {
                    const proc = processes.find(p => p.name === 'CNC加工');
                    const subDef = PROCESS_SUB_PARAMS['CNC加工'];
                    return (
                      <div key="cnc_card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>CNC加工</div>
                        {subDef?.map(param => (
                          <div key={param.name} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#475569' }}>{param.label}:</span>
                            <input
                              type="number"
                              min={0}
                              placeholder={param.label}
                              value={proc?.subParams?.[param.name] ?? ''}
                              onChange={e => updateSubParam('CNC加工', param.name, parseFloat(e.target.value) || '')}
                              style={{ flex: 1, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 钻孔卡片 */}
                  {processes.some(p => p.name === '钻孔') && (() => {
                    const proc = processes.find(p => p.name === '钻孔');
                    const subDef = PROCESS_SUB_PARAMS['钻孔'];
                    return (
                      <div key="drill_card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>钻孔</div>
                        {subDef?.map(param => (
                          <div key={param.name} style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>{param.label}</span>
                            {param.type === 'select' && param.options ? (
                              <select
                                value={proc?.subParams?.[param.name] ?? param.options[0]}
                                onChange={e => updateSubParam('钻孔', param.name, e.target.value)}
                                style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                              >
                                {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                placeholder={param.label}
                                value={proc?.subParams?.[param.name] ?? ''}
                                onChange={e => updateSubParam('钻孔', param.name, parseFloat(e.target.value) || '')}
                                style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 攻牙卡片 */}
                  {processes.some(p => p.name === '攻牙') && (() => {
                    const proc = processes.find(p => p.name === '攻牙');
                    const subDef = PROCESS_SUB_PARAMS['攻牙'];
                    return (
                      <div key="tap_card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>攻牙</div>
                        {subDef?.map(param => (
                          <div key={param.name} style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>{param.label}</span>
                            {param.type === 'select' && param.options ? (
                              <select
                                value={proc?.subParams?.[param.name] ?? param.options[0]}
                                onChange={e => updateSubParam('攻牙', param.name, e.target.value)}
                                style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                              >
                                {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                placeholder={param.label}
                                value={proc?.subParams?.[param.name] ?? ''}
                                onChange={e => updateSubParam('攻牙', param.name, parseFloat(e.target.value) || '')}
                                style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 冲压卡片 */}
                  {processes.some(p => p.name === '冲压') && (() => {
                    const proc = processes.find(p => p.name === '冲压');
                    const subDef = PROCESS_SUB_PARAMS['冲压'];
                    return (
                      <div key="stamp_card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>冲压</div>
                        {/* 冲次 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, color: '#475569' }}>冲次:</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="次数"
                            value={proc?.quantity ?? ''}
                            onChange={e => updateProcessQuantity('冲压', e.target.value)}
                            style={{ flex: 1, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                          />
                          <span style={{ fontSize: 12, color: '#475569' }}>次</span>
                        </div>
                        {/* 吨位 */}
                        {subDef?.map(param => (
                          <div key={param.name} style={{ marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 2 }}>{param.label}</span>
                            {param.type === 'select' && param.options ? (
                              <select
                                value={proc?.subParams?.[param.name] ?? param.options[0]}
                                onChange={e => updateSubParam('冲压', param.name, e.target.value)}
                                style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                              >
                                {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                placeholder={param.label}
                                value={proc?.subParams?.[param.name] ?? ''}
                                onChange={e => updateSubParam('冲压', param.name, parseFloat(e.target.value) || '')}
                                style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 车加工卡片 */}
                  {processes.some(p => p.name === '车加工') && (() => {
                    const proc = processes.find(p => p.name === '车加工');
                    const subDef = PROCESS_SUB_PARAMS['车加工'];
                    return (
                      <div key="turning_card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>车加工</div>
                        {subDef?.map(param => (
                          <div key={param.name} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: '#475569' }}>{param.label}:</span>
                            <input
                              type="number"
                              min={0}
                              placeholder={param.label}
                              value={proc?.subParams?.[param.name] ?? ''}
                              onChange={e => updateSubParam('车加工', param.name, parseFloat(e.target.value) || '')}
                              style={{ flex: 1, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', padding: '4px 6px', fontSize: 13, color: '#1f2937', outline: 'none', minHeight: 28, boxSizing: 'border-box' }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* 颜色选择卡片 */}
                  {surfaceTreatment && surfaceTreatment !== '无' && getSurfaceColorOptions().length > 0 && (
                    <div key="color_card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>颜色选择</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {getSurfaceColorOptions().map(colorName => {
                          const isSel = surfaceColor === colorName;
                          return (
                            <button
                              key={colorName}
                              type="button"
                              onClick={() => setSurfaceColor(colorName)}
                              style={{
                                padding: '4px 8px',
                                fontSize: 13,
                                borderRadius: 16,
                                border: isSel ? '1px solid #2563eb' : '1px solid #d1d5db',
                                background: isSel ? '#eff6ff' : '#fff',
                                color: isSel ? '#2563eb' : '#475569',
                                fontWeight: isSel ? 600 : 400,
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s',
                              }}
                            >
                              {colorName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 材料规格卡片（挤出专用） */}
                  {productType === '挤出' && surfaceTreatment && surfaceTreatment !== '无' && (
                    <div key="material_card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 6 }}>材料规格</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setMaterialSizeType('short')}
                          style={{
                            padding: '5px 8px',
                            fontSize: 13,
                            borderRadius: 16,
                            border: materialSizeType === 'short' ? '1px solid #2563eb' : '1px solid #d1d5db',
                            background: materialSizeType === 'short' ? '#eff6ff' : '#fff',
                            color: materialSizeType === 'short' ? '#2563eb' : '#475569',
                            fontWeight: materialSizeType === 'short' ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                        >
                          小料 (&lt;3000mm)
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaterialSizeType('long')}
                          style={{
                            padding: '5px 8px',
                            fontSize: 13,
                            borderRadius: 16,
                            border: materialSizeType === 'long' ? '1px solid #2563eb' : '1px solid #d1d5db',
                            background: materialSizeType === 'long' ? '#eff6ff' : '#fff',
                            color: materialSizeType === 'long' ? '#2563eb' : '#475569',
                            fontWeight: materialSizeType === 'long' ? 600 : 400,
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                        >
                          长料 (≥3000mm)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 隐藏的模具钢价输入（挤出专用，后端使用默认值 18000 元/吨） */}
            {productType === '挤出' && (
              <div style={{ display: 'none' }}>
                <label style={{ display: 'block', fontSize: 13, color: '#475569', marginBottom: 4 }}>
                  模具钢价(元/吨)
                  <span style={{ marginLeft: 4, fontSize: 12, color: '#475569' }}>选填，默认18000(H13均价)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="18000"
                  value={dieSteelPrice}
                  onChange={e => setDieSteelPrice(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    padding: '6px 12px',
                    fontSize: 14,
                    color: '#1f2937',
                    outline: 'none',
                    minHeight: 36,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-500">
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
        <span className={value ? 'text-gray-800' : 'text-slate-600'}>{value || '请选择'}</span>
        <svg className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                value === opt ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
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

