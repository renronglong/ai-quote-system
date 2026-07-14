'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Upload, 
  X, 
  Loader2, 
  Bot, 
  User,
  Calculator,
  Package,
  CheckCircle,
  AlertCircle,
  Plus,
  Save,
  Trash2,
  FileImage,
  Download,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDxfFile, parseStepOrIgesFile, CadParseResult, CadDiagnostic } from '@/lib/cad-parser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';

// 消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
  // 报价计算相关（用户消息发送时自动提取参数并调用API）
  pricingResult?: PricingResultData | null;
  pricingLoading?: boolean;
  pricingError?: string | null;
}

interface ToolCall {
  tool: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
}

// 报价卡片组件
function QuotationCard({ data }: { data: Record<string, string> }) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 mt-2 border border-blue-100">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-gray-800">报价单</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {data.material && <div className="text-gray-600">材质：<span className="font-medium text-gray-800">{data.material}</span></div>}
        {data.process && <div className="text-gray-600">工艺：<span className="font-medium text-gray-800">{data.process}</span></div>}
        {data.surfaceTreatment && <div className="text-gray-600">表面处理：<span className="font-medium text-gray-800">{data.surfaceTreatment}</span></div>}
        {data.costPrice && <div className="text-gray-600">成本单价：<span className="font-medium text-gray-800">¥{data.costPrice}</span></div>}
        {data.quantity && <div className="text-gray-600">数量：<span className="font-medium text-gray-800">{data.quantity}件</span></div>}
        {data.taxRate && <div className="text-gray-600">税率：<span className="font-medium text-gray-800">{data.taxRate}%</span></div>}
        {data.discount && data.discount !== '0' && <div className="text-gray-600">折扣：<span className="font-medium text-gray-800">{data.discount}%</span></div>}
        {data.grossMargin && <div className="text-gray-600">毛利率：<span className="font-medium text-gray-800">{data.grossMargin}%</span></div>}
        {data.priceBeforeTax && <div className="text-gray-600">税前总价：<span className="font-medium text-gray-800">¥{data.priceBeforeTax}</span></div>}
        {data.taxAmount && <div className="text-gray-600">税额：<span className="font-medium text-gray-800">¥{data.taxAmount}</span></div>}
        {data.totalPrice && (
          <div className="col-span-2 bg-blue-600 text-white rounded p-2 mt-2">
            最终总价：<span className="font-bold text-lg">¥{data.totalPrice}</span>
            {data.unitPrice && <span className="ml-2 text-blue-100">({data.unitPrice}/件)</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// 产品列表卡片
function ProductCard({ products: productList }: { products: Array<{
  product_code: string;
  name: string;
  material: string;
  process: string;
  surface_treatment: string;
  cost_price: string;
  oxidation_color?: string | null;
}> }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 mt-2 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b flex items-center gap-2">
        <Package className="w-4 h-4 text-gray-600" />
        <span className="font-medium text-gray-700">产品列表 ({productList.length}个)</span>
      </div>
      <div className="divide-y max-h-60 overflow-auto">
        {productList.map((p, i) => (
          <div key={i} className="p-3 hover:bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-gray-800">{p.name}</div>
                <div className="text-sm text-gray-500">{p.product_code}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-blue-600">¥{p.cost_price}</div>
                <div className="text-xs text-gray-500">{p.material}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="bg-gray-100 px-2 py-0.5 rounded">{p.process}</span>
              <span className="bg-gray-100 px-2 py-0.5 rounded">{p.surface_treatment}</span>
              {p.oxidation_color && <span className="bg-blue-100 px-2 py-0.5 rounded">{p.oxidation_color}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// 报价计算结果卡片组件
interface PricingResultData {
  productType: string;
  quantity: number;
  section?: {
    outerArea: number;
    crossSectionArea: number;
    weightPerMeter: number;
    unitWeight: number;
  };
  materialCost: number;
  extrusionCost: number;
  cncCost: number;
  surfaceTreatmentCost: number;
  packagingCost: number;
  transportationCost: number;
  unitCost: number;
  totalCost: number;
  breakdown: Array<{ item: string; calculation: string; cost: number }>;
  aluminumPrice: {
    pricePerTon: number;
    pricePerKg: number;
    source: string;
  };
}

function PricingResultCard({ data }: { data: PricingResultData }) {
  return (
    <div className="mt-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 overflow-hidden shadow-sm">
      {/* 标题 */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <span className="text-white font-bold text-base">报价计算结果</span>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* 截面信息 */}
        {data.section && (
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">截面信息</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                <div className="text-xs text-gray-500">截面面积</div>
                <div className="text-sm font-semibold text-gray-800">{data.section.crossSectionArea.toFixed(2)} mm²</div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                <div className="text-xs text-gray-500">米重</div>
                <div className="text-sm font-semibold text-gray-800">{data.section.weightPerMeter.toFixed(2)} kg/m</div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                <div className="text-xs text-gray-500">单件重量</div>
                <div className="text-sm font-semibold text-gray-800">{data.section.unitWeight.toFixed(3)} kg</div>
              </div>
            </div>
          </div>
        )}
        
        {/* 成本明细 */}
        <div>
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">成本明细</div>
          <div className="bg-white rounded-lg border border-emerald-100 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-emerald-50">
                {data.breakdown.map((item, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/50 transition-colors">
                    <td className="px-3 py-2.5 font-medium text-gray-700 w-24">{item.item}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{item.calculation}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800 whitespace-nowrap">¥{item.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* 汇总 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center bg-white rounded-lg px-4 py-3 border border-emerald-100">
            <span className="text-gray-600 font-medium">单件报价</span>
            <span className="text-xl font-bold text-emerald-600">¥{data.unitCost.toFixed(2)}<span className="text-sm font-normal text-gray-500">/件</span></span>
          </div>
          <div className="flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg px-4 py-3 shadow-sm">
            <span className="text-white font-medium">批量总价 ({data.quantity.toLocaleString()}件)</span>
            <span className="text-xl font-bold text-white">¥{data.totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        
        {/* 铝价信息 */}
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <span>💰</span>
          <span>铝锭价：¥{data.aluminumPrice.pricePerKg.toFixed(2)}/kg（{data.aluminumPrice.pricePerTon.toLocaleString()}元/吨，来源：{data.aluminumPrice.source}）</span>
        </div>
      </div>
    </div>
  );
}

// 解析报价数据
function parseQuotationData(text: string): Record<string, string> | null {
  const data: Record<string, string> = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/[-•]\s*(.+?)[:：]\s*(.+)/);
    if (match) {
      const key = match[1].replace(/\*\*/g, '').trim();
      const value = match[2].replace(/\*\*/g, '').replace(/[¥￥]/g, '').replace(/\/件$/, '').trim();
      data[key] = value;
    }
  }
  return Object.keys(data).length > 0 ? data : null;
}

// 解析产品列表
function parseProductList(text: string): Array<{
  product_code: string;
  name: string;
  material: string;
  process: string;
  surface_treatment: string;
  cost_price: string;
  oxidation_color?: string | null;
}> | null {
  try {
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].product_code) {
        return parsed;
      }
    }
  } catch {
    // JSON解析失败，返回null
  }
  return null;
}

// 加工类型预设
const PROCESS_TYPES = ['铝挤压', '冲压', '铝压铸', '注塑', '塑料挤出', 'CNC加工', '车加工'];
const SURFACE_OPTIONS = ['氧化', '喷涂', '电泳', '电镀', '无'];
const PRODUCT_TYPES = ['铝型材', '板材件'] as const;
type ProductType = typeof PRODUCT_TYPES[number];

// 板材材料类别
const PLATE_MATERIALS = ['铝板', '冷板', '不锈钢304', '不锈钢201', '不锈钢430', '不锈钢316L'] as const;
// 铝板牌号加价（元/吨）
const AL_GRADE_MARKUP: Record<string, number> = { '1系': 1000, '3系': 2000, '5系': 3000, '7系': 4000 };
const AL_GRADE_OPTIONS = ['1系(1050/1060/1100)', '3系(3003)', '5系(5052/5083)', '7系(7075)'] as const;
// 板材表面处理选项
const PLATE_SURFACE_OPTIONS_AL = ['氧化本色', '氧化上色', '喷砂', '拉丝', '无'];
const PLATE_SURFACE_OPTIONS_OTHER = ['喷涂/喷粉', '磷化', '镀锌/镀镍', '抛光/镀铬', '无'];
// 冲压吨位费率表（元/次）
const STAMPING_RATES: Record<number, number> = { 35: 0.10, 45: 0.24, 60: 0.30, 80: 0.40, 110: 0.50, 160: 0.60, 200: 1.00, 250: 1.80 };
const STAMPING_TONNAGES = Object.keys(STAMPING_RATES).map(Number);

// 异型材表单数据
interface YixingFormData {
  productType: string;
  productCode: string;
  productName: string;
  material: string;
  // 板材专用字段
  plateMaterial: string;      // 板材材料：铝板/冷板/不锈钢304/...
  alGrade: string;            // 铝板牌号系列：1系/3系/5系/7系
  thickness: string;          // 板厚(mm)
  nestingCount: string;       // 排版数量
  stampingTonnage: string;    // 冲压吨位(T)
  maxDimension: string;       // 最大尺寸(mm)
  volume: string;             // 体积(mm³)
  laserCutLength: string;     // 激光切割总长(m)
  // 铝型材字段
  meterWeight: string;
  length: string;
  width: string;
  height: string;
  processes: Array<{ type: string; order: string }>;
  surfaceTreatment: string;
  moldFee: string;
  minOrderQty: string;
  unit: string;
  remarks: string;
}

const defaultFormData = (): YixingFormData => ({
  productType: '铝型材',
  productCode: '',
  productName: '',
  material: '铝',
  plateMaterial: '铝板',
  alGrade: '5系(5052/5083)',
  thickness: '',
  nestingCount: '1',
  stampingTonnage: '35',
  maxDimension: '',
  volume: '',
  laserCutLength: '',
  meterWeight: '',
  length: '',
  width: '',
  height: '',
  processes: [{ type: '铝挤压', order: '1' }],
  surfaceTreatment: '无',
  moldFee: '',
  minOrderQty: '100',
  unit: '件',
  remarks: '',
});

// 成本分析数据
interface CostAnalysis {
  aluminumPrice: number;
  grossWeight: number;
  netWeight: number;
  volume: number;
  materialCost: number;
  processCost: number;
  surfaceCost: number;
  totalCost: number;
  managementFee: number;
  priceBeforeTax: number;
  priceWithTax: number;
  processCount: number;
}

function calculateCostAnalysis(fd: YixingFormData, alPrice: number): CostAnalysis {
  const mw = parseFloat(fd.meterWeight) || 0; // kg/m
  const len = parseFloat(fd.length) || 0; // mm
  const wid = parseFloat(fd.width) || 0; // mm
  const hgt = parseFloat(fd.height) || 0; // mm
  const qty = parseFloat(fd.minOrderQty) || 100;
  const processCount = fd.processes.length;

  const lenM = (len + 5) / 1000; // mm+5 → m
  const netWeight = mw * (len / 1000) * 1000; // kg/m × m × 1000 = g
  const grossWeight = mw * lenM * 1000; // 米重 × (长度+5mm换算为m) × 1000 = g
  const volume = (len * wid * hgt) / 1000; // mm³ → cm³ (÷1000)
  const materialCost = (alPrice + 2000) / 1000000 * grossWeight;
  const processCost = (materialCost * 0.05 + 0.1) * processCount;
  const surfaceCost = fd.surfaceTreatment === '无' ? 0 : (netWeight * 0.002 + volume * 0.0000003 + 0.1);
  const totalCost = materialCost + surfaceCost + processCost;
  const managementFee = totalCost * 0.1 + 500 / qty;
  const priceBeforeTax = totalCost + managementFee;
  const priceWithTax = priceBeforeTax * 1.13;

  return {
    aluminumPrice: alPrice, grossWeight, netWeight, volume,
    materialCost, processCost, surfaceCost, totalCost,
    managementFee, priceBeforeTax, priceWithTax, processCount,
  };
}

// ============ 板材报价计算 ============
interface PlateCostAnalysis {
  plateMaterial: string;
  thickness: number;
  sheetLength: number;  // 2440mm
  sheetWidth: number;   // 1220mm
  nestingCount: number;
  materialCostPerSheet: number;
  materialCostPerPiece: number;
  stampingBaseFee: number;
  sizeSurcharge: number;
  volumeSurcharge: number;
  processFeePerStep: number;
  cumulativeAfterProcesses: number;
  processBreakdown: Array<{ name: string; base: number; size: number; vol: number; total: number; cumAfter: number }>;
  surfaceTreatmentType: string;
  surfaceCost: number;
  quoteMain: number;       // (累计+表面处理) × 1.05
  packaging: number;       // 重量 × 0.5
  transport: number;       // 重量 × 0.5
  totalPrice: number;      // 报价主体 + 包装 + 运输
  weightPerPiece: number;  // 单件重量(kg)
  density: number;
  materialPricePerKg: number;
  moldCostPerProcess: number;
  totalMoldCost: number;
  warnings: string[];
}

function getPlateDensity(mat: string): number {
  if (mat.includes('铝')) return 2.7;
  return 7.85; // 冷板和不锈钢密度相同
}

function getPlateMaterialPrice(mat: string, alGrade: string, alPrice: number): number {
  // alPrice: 南海灵通铝锭价（元/吨）
  if (mat.includes('铝')) {
    // 铝板单价 = (铝锭价 + 牌号加价) / 1000  → 元/kg
    const gradeKey = Object.keys(AL_GRADE_MARKUP).find(k => alGrade.includes(k)) || '5系';
    const markup = AL_GRADE_MARKUP[gradeKey] || 3000;
    return (alPrice + markup) / 1000;
  } else if (mat.includes('304')) {
    // 不锈钢304参考价：约15元/kg（可根据市场调整）
    return 15;
  } else if (mat.includes('201') || mat.includes('430')) {
    return 15 * 0.50; // 304价格 × 0.50
  } else if (mat.includes('316')) {
    return 15 * 2;    // 304价格 × 2
  } else {
    // 冷板 SPCC：热卷期货价 × 1.05，简化取4.5元/kg
    return 4.5;
  }
}

function calculatePlateCostAnalysis(fd: YixingFormData, alPrice: number): PlateCostAnalysis {
  const warnings: string[] = [];
  const thickness = parseFloat(fd.thickness) || 1;
  const nestingCount = Math.max(1, parseInt(fd.nestingCount) || 1);
  const stampingTonnage = parseInt(fd.stampingTonnage) || 35;
  const maxDimension = parseFloat(fd.maxDimension) || 0;
  const pieceVolume = parseFloat(fd.volume) || 0; // mm³
  const laserCutLen = parseFloat(fd.laserCutLength) || 0; // m
  const qty = parseInt(fd.minOrderQty) || 100;
  
  const plateMat = fd.plateMaterial || '铝板';
  const density = getPlateDensity(plateMat);
  const pricePerKg = getPlateMaterialPrice(plateMat, fd.alGrade, alPrice);
  
  // 板材尺寸：标准 2440 × 1220
  const sheetLength = 2440;
  const sheetWidth = 1220;
  
  // ① 材料费 = 整张板价格 ÷ 排版数量
  // 整张板价格 = 2440 × 1220 × 厚度 × 密度 ÷ 1000000 × 单价(元/kg)
  const sheetVolume_cm3 = sheetLength * sheetWidth * thickness / 1000; // mm³ → cm³
  const sheetWeight_kg = sheetVolume_cm3 * density / 1000; // cm³ × g/cm³ ÷ 1000 = kg
  const sheetPrice = sheetWeight_kg * pricePerKg;
  const materialCostPerPiece = sheetPrice / nestingCount;
  
  // 单件重量估算（用于包装和运输费）
  const pieceWeight_kg = pieceVolume > 0 
    ? (pieceVolume / 1000) * density / 1000  // mm³ → cm³ → kg
    : sheetWeight_kg / nestingCount;
  
  // ② 工序费：逐级累加 ×1.03×1.03
  let cumulative = materialCostPerPiece;
  const processBreakdown: PlateCostAnalysis['processBreakdown'] = [];
  
  // 获取冲压吨位费率
  const baseTonnageRate = STAMPING_RATES[stampingTonnage] || STAMPING_RATES[35];
  
  // 尺寸附加费 = floor((最大尺寸-1)/100) × 0.01
  const sizeSurcharge = maxDimension > 100 ? Math.floor((maxDimension - 1) / 100) * 0.01 : 0;
  
  // 体积附加费 = 体积 × 0.00000003
  const volSurcharge = pieceVolume * 0.00000003;
  
  // 冲压附加费（用于表面处理计算）= 尺寸附加费 + 体积附加费
  const stampingSurcharge = sizeSurcharge + volSurcharge;
  
  // 为每道工序计算
  const processes = fd.processes.length > 0 ? fd.processes : [{ type: '冲压', order: '1' }];
  
  for (const proc of processes) {
    let processFee = 0;
    let procName = proc.type;
    
    if (proc.type === '冲压' || proc.type === '折弯' || proc.type === '钻孔' || proc.type === '攻丝') {
      // 冲压/折弯/钻孔/攻丝：吨位基数 + 尺寸附加 + 体积附加
      processFee = baseTonnageRate + sizeSurcharge + volSurcharge;
    } else if (proc.type === '激光切割') {
      // 激光切割费：按材料×厚度，单价元/米
      let cutRatePerMeter = 0;
      if (plateMat.includes('铝')) cutRatePerMeter = thickness * 4;
      else if (plateMat.includes('不锈钢')) cutRatePerMeter = thickness * 2.5;
      else cutRatePerMeter = thickness * 1.5; // 冷板
      processFee = cutRatePerMeter * (laserCutLen || 1);
      procName = `激光切割(${plateMat.includes('铝') ? '铝板' : plateMat.includes('不锈钢') ? '不锈钢' : '冷板'} ${thickness}mm)`;
    } else if (proc.type === '焊接') {
      // 焊接按道次估算
      processFee = baseTonnageRate * 2;
    } else {
      // 默认其他工序用冲压费率
      processFee = baseTonnageRate + sizeSurcharge + volSurcharge;
    }
    
    const newCumulative = (cumulative + processFee) * 1.03 * 1.03;
    processBreakdown.push({
      name: procName,
      base: baseTonnageRate,
      size: sizeSurcharge,
      vol: volSurcharge,
      total: processFee,
      cumAfter: Math.round(newCumulative * 10000) / 10000,
    });
    cumulative = newCumulative;
  }
  
  // ③ 表面处理费
  let surfaceCost = 0;
  const surfType = fd.surfaceTreatment;
  
  if (surfType && surfType !== '无') {
    if (plateMat.includes('铝')) {
      // 铝板表面处理
      if (surfType === '氧化本色') {
        surfaceCost = 0.2 + stampingSurcharge * 2 + pieceWeight_kg * 2;
      } else if (surfType === '氧化上色' || surfType === '拉丝') {
        surfaceCost = 0.3 + stampingSurcharge * 3 + pieceWeight_kg * 3;
      } else if (surfType === '喷砂') {
        surfaceCost = stampingSurcharge * 2 + pieceWeight_kg * 1;
      }
    } else {
      // 冷板/不锈钢表面处理
      if (surfType === '喷涂/喷粉' || surfType === '磷化') {
        surfaceCost = 0.2 + stampingSurcharge * 2 + pieceWeight_kg * 2;
      } else if (surfType === '镀锌/镀镍') {
        surfaceCost = stampingSurcharge * 2 + pieceWeight_kg * 1.5;
      } else if (surfType === '抛光/镀铬') {
        surfaceCost = 0.3 + stampingSurcharge * 3 + pieceWeight_kg * 3;
      }
    }
  }
  
  // ④ 报价主体 = (工序累计 + 表面处理) × 1.05
  const quoteMain = (cumulative + surfaceCost) * 1.05;
  
  // ⑤ 包装 = 重量 × 0.5
  const packaging = pieceWeight_kg * 0.5;
  
  // ⑥ 运输 = 重量 × 0.5
  const transport = pieceWeight_kg * 0.5;
  
  // ⑦ 总报价
  const totalPrice = quoteMain + packaging + transport;
  
  // ⑧ 模具费（可选）
  const moldFeeInput = parseFloat(fd.moldFee) || 0;
  const moldPerPiece = moldFeeInput > 0 ? moldFeeInput / qty : 0;
  
  return {
    plateMaterial: plateMat,
    thickness,
    sheetLength,
    sheetWidth,
    nestingCount,
    materialCostPerSheet: Math.round(sheetPrice * 100) / 100,
    materialCostPerPiece: Math.round(materialCostPerPiece * 10000) / 10000,
    stampingBaseFee: baseTonnageRate,
    sizeSurcharge: Math.round(sizeSurcharge * 10000) / 10000,
    volumeSurcharge: Math.round(volSurcharge * 10000) / 10000,
    processFeePerStep: Math.round((baseTonnageRate + sizeSurcharge + volSurcharge) * 10000) / 10000,
    cumulativeAfterProcesses: Math.round(cumulative * 10000) / 10000,
    processBreakdown,
    surfaceTreatmentType: surfType,
    surfaceCost: Math.round(surfaceCost * 10000) / 10000,
    quoteMain: Math.round(quoteMain * 10000) / 10000,
    packaging: Math.round(packaging * 10000) / 10000,
    transport: Math.round(transport * 10000) / 10000,
    totalPrice: Math.round(totalPrice * 10000) / 10000,
    weightPerPiece: Math.round(pieceWeight_kg * 1000) / 1000,
    density,
    materialPricePerKg: Math.round(pricePerKg * 100) / 100,
    moldCostPerProcess: 0,
    totalMoldCost: moldFeeInput,
    warnings,
  };
}

// 解析图片识别结果中的产品信息 - 增强版（放宽匹配条件）
interface ParsedProductInfo {
  material: string;
  process: string;
  surfaceTreatment: string;
  productName?: string;
  productCode?: string;
  meterWeight?: string;
  length?: string;
  width?: string;
  height?: string;
  specs?: string;
  description?: string;
}
function parseImageRecognitionResult(content: string): ParsedProductInfo | null {
  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // ===== 第一优先：结构化【产品参数】块 =====
  const paramBlockMatch = content.match(/【产品参数开始】([\s\S]*?)【产品参数结束】/);
  if (paramBlockMatch) {
    const block = paramBlockMatch[1];
    const getRawVal = (key: string) => {
      const escaped = escapeRegex(key);
      const m = block.match(new RegExp(escaped + '[：:]\\s*([^\\n]*?)(?:\\n|$)'));
      return m ? m[1].trim() : '';
    };
    const getNumVal = (key: string) => {
      const raw = getRawVal(key);
      if (!raw) return '';
      const numMatch = raw.match(/(-?\d+\.?\d*)/);
      return numMatch ? numMatch[1] : '';
    };
    const getMeterWeight = (): string | undefined => {
      const raw = getRawVal('米重(kg/m)') || getRawVal('米重(g/m)') || getRawVal('米重');
      if (!raw) return undefined;
      if (/g\/m|克\/米/i.test(raw) && !/kg\/m|千克\/米/i.test(raw)) {
        // g/m → kg/m
        const num = raw.match(/(-?\d+\.?\d*)/);
        return num ? (parseFloat(num[1]) / 1000).toFixed(3) : undefined;
      }
      if (/kg\/m|千克\/米/i.test(raw)) {
        const num = raw.match(/(-?\d+\.?\d*)/);
        return num ? num[1] : undefined;
      }
      // 无单位标记，值>1假设是g/m，值<1假设是kg/m
      const num = raw.match(/(-?\d+\.?\d*)/);
      if (num) {
        const val = parseFloat(num[1]);
        return val > 1 ? (val / 1000).toFixed(3) : num[1];
      }
      return undefined;
    };
    const getDimVal = (keyWithUnit: string, keyWithoutUnit: string): string | undefined => {
      return getNumVal(keyWithUnit) || getNumVal(keyWithoutUnit) || undefined;
    };
    const material = getRawVal('材质') || '未知';
    const process = getRawVal('加工工艺') || '未知';
    const surfaceTreatment = getRawVal('表面处理') || '无';
    if (material === '未知' && process === '未知' && !getMeterWeight()) return null;
    return {
      material,
      process,
      surfaceTreatment,
      productName: getRawVal('产品名称') || undefined,
      productCode: getRawVal('产品编号') || undefined,
      meterWeight: getMeterWeight(),
      length: getDimVal('长度(mm)', '长度'),
      width: getDimVal('宽度(mm)', '宽度'),
      height: getDimVal('高度(mm)', '高度'),
      specs: '',
      description: content.substring(0, 200),
    };
  }
  
  // ===== 第二优先：从AI自由文本中智能提取 =====
  // 提取材质
  const materialMatch = content.match(/(?:材质(?:及规格|规格|类型)?|材料(?:类型)?|材料)[：:]\s*([^\n,，。；;\s]+)/);
  const material = materialMatch ? materialMatch[1].trim() : '';
  
  // 如果没有明确的材质标签，尝试从内容中识别常见材质
  const fallbackMaterial = !material ? (() => {
    const patterns = [/铝合金/i, /铝型材/i, /不锈钢/i, /碳钢/i, /铸铁/i, /黄铜/i, /紫铜/i, /6063/i, /6061/i, /铝/i];
    for (const p of patterns) {
      const m = content.match(p);
      if (m) return m[0];
    }
    return '';
  })() : '';
  
  // 提取加工工艺
  const processMatch = content.match(/(?:加工工艺|加工方式|工艺|加工)[：:]\s*([^\n,，。；;\s]+)/);
  const process = processMatch ? processMatch[1].trim() : '';
  
  // 提取表面处理
  const surfaceMatch = content.match(/(?:表面处理|表面工艺|处理)[：:]\s*([^\n,，。；;\s]+)/);
  const surfaceTreatment = surfaceMatch ? surfaceMatch[1].trim() : '无';
  
  // 提取产品编号
  const codeMatch = content.match(/(?:产品编号|图号|编号|型号)[：:]\s*([^\n,，\s]+)/);
  const productCode = codeMatch ? codeMatch[1].trim() : undefined;
  
  // 提取产品名称
  const nameMatch = content.match(/(?:产品名称|名称)[：:]\s*([^\n,，。]+)/);
  const productName = nameMatch ? nameMatch[1].trim() : undefined;
  
  // 提取米重（统一转kg/m）
  const mwKgMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:kg\/m|千克\/米)/i);
  const mwGMatch = !mwKgMatch ? content.match(/(\d+(?:\.\d+)?)\s*(?:g\/m|克\/米)/i) : null;
  const meterWeight = mwKgMatch ? mwKgMatch[1] : (mwGMatch ? (parseFloat(mwGMatch[1]) / 1000).toFixed(3) : undefined);
  
  // 提取尺寸
  const dim3Match = content.match(/(\d+(?:\.\d+)?)\s*mm\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm/);
  const dim2Match = !dim3Match ? content.match(/(\d+(?:\.\d+)?)\s*mm\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm/) : null;
  
  // 提取规格
  const specsMatch = content.match(/(?:规格|尺寸|大小)[：:]\s*([^\n,，。]+)/);
  const specs = specsMatch ? specsMatch[1].trim() : undefined;
  
  const finalMaterial = material || fallbackMaterial;
  
  // 只要有材质信息就算识别成功（大幅放宽条件）
  if (!finalMaterial && !process) return null;
  
  return {
    material: finalMaterial || '未知',
    process: process || '未知',
    surfaceTreatment,
    productName,
    productCode,
    meterWeight,
    length: dim3Match ? dim3Match[1] : (dim2Match ? dim2Match[1] : undefined),
    width: dim3Match ? dim3Match[2] : (dim2Match ? dim2Match[2] : undefined),
    height: dim3Match ? dim3Match[3] : undefined,
    specs,
    description: content.substring(0, 200),
  };
}

// 保存产品到数据库的函数
async function saveProductToDatabase(productInfo: ParsedProductInfo): Promise<{ success: boolean; error?: string }> {
  try {
    // 生成产品编码
    const productCode = `PRD-${Date.now().toString(36).toUpperCase()}`;
    const productName = productInfo.productName || `${productInfo.material}-${productInfo.process}`;
    
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_code: productCode,
        name: productName,
        material: productInfo.material,
        process: productInfo.process,
        surface_treatment: productInfo.surfaceTreatment || '无',
        specs: productInfo.specs || '',
        cost_price: 0,
        min_price: 0,
        description: productInfo.description || '',
      }),
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      // 如果API报错，尝试保存到本地localStorage作为降级方案
      const localProducts = JSON.parse(localStorage.getItem('local_products') || '[]');
      const newProduct = {
        id: Date.now(),
        product_code: productCode,
        name: productName,
        material: productInfo.material,
        process: productInfo.process,
        surface_treatment: productInfo.surfaceTreatment || '无',
        specs: productInfo.specs || '',
        cost_price: 0,
        created_at: new Date().toISOString(),
      };
      localProducts.push(newProduct);
      localStorage.setItem('local_products', JSON.stringify(localProducts));
      // 同时保存库存记录到localStorage
      const localInventory = JSON.parse(localStorage.getItem('local_inventory') || '[]');
      localInventory.push({
        id: Date.now() + 1,
        product_id: newProduct.id,
        quantity: 100,
        warehouse_location: '',
        batch_number: '',
        notes: '',
        created_at: new Date().toISOString(),
        products: {
          id: newProduct.id,
          product_code: newProduct.product_code,
          name: newProduct.name,
          material: newProduct.material,
          process: newProduct.process,
          surface_treatment: newProduct.surface_treatment,
          cost_price: '0',
        },
      });
      localStorage.setItem('local_inventory', JSON.stringify(localInventory));
      return { success: true };
    }
    
    return { success: true };
  } catch (error) {
    // 网络错误也降级到本地存储
    try {
      const productCode = `PRD-${Date.now().toString(36).toUpperCase()}`;
      const productName = productInfo.productName || `${productInfo.material}-${productInfo.process}`;
      const localProducts = JSON.parse(localStorage.getItem('local_products') || '[]');
      const newProduct = {
        id: Date.now(),
        product_code: productCode,
        name: productName,
        material: productInfo.material,
        process: productInfo.process,
        surface_treatment: productInfo.surfaceTreatment || '无',
        specs: productInfo.specs || '',
        cost_price: 0,
        created_at: new Date().toISOString(),
      };
      localProducts.push(newProduct);
      localStorage.setItem('local_products', JSON.stringify(localProducts));
      // 同时保存库存记录到localStorage
      const localInventory = JSON.parse(localStorage.getItem('local_inventory') || '[]');
      localInventory.push({
        id: Date.now() + 1,
        product_id: newProduct.id,
        quantity: 100,
        warehouse_location: '',
        batch_number: '',
        notes: '',
        created_at: new Date().toISOString(),
        products: {
          id: newProduct.id,
          product_code: newProduct.product_code,
          name: newProduct.name,
          material: newProduct.material,
          process: newProduct.process,
          surface_treatment: newProduct.surface_treatment,
          cost_price: '0',
        },
      });
      localStorage.setItem('local_inventory', JSON.stringify(localInventory));
      return { success: true };
    } catch {
      return { success: false, error: error instanceof Error ? error.message : '保存失败' };
    }
  }
}

// 消息渲染组件

// ============ 从用户输入文本中提取报价参数 ============
interface ExtractedPricingParams {
  productType: 'extrusion';
  outerWidth: number;
  outerHeight: number;
  chamfer?: { count: number; size: number };
  isHollow: boolean;
  cavity?: { width: number; height: number };
  length: number;
  quantity: number;
  surfaceTreatment: '无' | '氧化本色' | '氧化黑色' | '喷涂' | '电泳';
  drillingHoles?: number;
  tappingHoles?: number;
}

function extractPricingParams(text: string): ExtractedPricingParams | null {
  // ---- 宽度 / 高度 ----
  let outerWidth: number | undefined;
  let outerHeight: number | undefined;

  // 模式1: "38.7×21.7mm" / "38.7x21.7" / "38.7X21.7" (乘号或x)
  const dimMulMatch = text.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
  if (dimMulMatch) {
    outerWidth = parseFloat(dimMulMatch[1]);
    outerHeight = parseFloat(dimMulMatch[2]);
  }

  // 模式2: "宽38.7 高21.7" / "外宽38.7 外高21.7" / "宽度38.7 高度21.7"
  if (outerWidth === undefined) {
    const wMatch = text.match(/(?:外?宽(?:度)?|W)\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
    const hMatch = text.match(/(?:外?高(?:度)?|H)\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
    if (wMatch) outerWidth = parseFloat(wMatch[1]);
    if (hMatch) outerHeight = parseFloat(hMatch[1]);
  }

  // 模式3: 直径 → 外宽=外高=直径 (如 "φ20" / "Φ20" / "直径20mm")
  if (outerWidth === undefined) {
    const diaMatch = text.match(/[φΦ⌀]\s*(\d+(?:\.\d+)?)|直(?:径|径)\s*[：:=]?\s*(\d+(?:\.\d+)?)/);
    if (diaMatch) {
      const dia = parseFloat(diaMatch[1] || diaMatch[2]);
      outerWidth = dia;
      outerHeight = dia;
    }
  }

  // ---- 长度 ----
  let length: number | undefined;
  // "长100mm" / "长度100" / "L=100mm" / "长：100"
  const lenMatch = text.match(/(?:长(?:度)?|L)\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
  if (lenMatch) {
    length = parseFloat(lenMatch[1]);
  }

  // ---- 数量 ----
  let quantity: number | undefined;
  // "5000件" / "数量5000" / "5000个" / "5000PCS" / "5000 pcs"
  const qtyMatch = text.match(/(?:数(?:量)?|qty|QTY)\s*[：:=]?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:件|个|pcs|PCS|套|支)/);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1] || qtyMatch[2]);
  }

  // ---- 必要参数校验 ----
  if (outerWidth === undefined || outerHeight === undefined || length === undefined || quantity === undefined) {
    return null;
  }
  if (outerWidth <= 0 || outerHeight <= 0 || length <= 0 || quantity <= 0) {
    return null;
  }

  // ---- 倒角/圆角 ----
  let chamfer: { count: number; size: number } | undefined;
  // "4个R0.5" / "4×R0.5" / "R0.5圆角" / "4个R0.5圆角" / "倒角R0.5×4"
  const chamferMatch1 = text.match(/(\d+)\s*(?:个|×|x|X)?\s*R(\d+(?:\.\d+)?)/);
  const chamferMatch2 = text.match(/R(\d+(?:\.\d+)?)\s*(?:圆角|倒角)/);
  const chamferMatch3 = text.match(/(\d+)\s*(?:个|×|x|X)?\s*(?:圆角|倒角)/);
  if (chamferMatch1) {
    chamfer = { count: parseInt(chamferMatch1[1]), size: parseFloat(chamferMatch1[2]) };
  } else if (chamferMatch2) {
    // "R0.5圆角" - 没有数量，默认4个
    chamfer = { count: 4, size: parseFloat(chamferMatch2[1]) };
  } else if (chamferMatch3) {
    // "4个圆角" - 没有尺寸，默认0.5
    chamfer = { count: parseInt(chamferMatch3[1]), size: 0.5 };
  }

  // ---- 表面处理 ----
  let surfaceTreatment: ExtractedPricingParams['surfaceTreatment'] = '无';
  if (/氧化本色|本色氧化/.test(text)) {
    surfaceTreatment = '氧化本色';
  } else if (/氧化黑(?:色|色)/.test(text)) {
    surfaceTreatment = '氧化黑色';
  } else if (/喷涂|喷粉|粉体/.test(text)) {
    surfaceTreatment = '喷涂';
  } else if (/电泳/.test(text)) {
    surfaceTreatment = '电泳';
  } else if (/氧化(?!黑)/.test(text)) {
    // 只写"氧化"没有颜色，默认本色
    surfaceTreatment = '氧化本色';
  }

  // ---- 是否空心 ----
  let isHollow = false;
  if (/空心|有内腔|有腔体|中空|空心型材/.test(text)) {
    isHollow = true;
  }
  // "实心" 明确为 false
  if (/实心/.test(text)) {
    isHollow = false;
  }

  // ---- 内腔尺寸（可选） ----
  let cavity: { width: number; height: number } | undefined;
  if (isHollow) {
    const cavityMatch = text.match(/(?:内(?:宽|腔宽)|内腔宽)\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?[\s,，/]*(?:内(?:高|腔高)|内腔高)\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
    if (cavityMatch) {
      cavity = { width: parseFloat(cavityMatch[1]), height: parseFloat(cavityMatch[2]) };
    }
  }

  // ---- 钻孔 ----
  let drillingHoles: number | undefined;
  // "3×φ5" / "3个φ5孔" / "3个5mm孔" / "3×Φ5" / "钻孔3个"
  const drillMatch1 = text.match(/(\d+)\s*(?:×|x|X|个)?\s*[φΦ⌀]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?\s*(?:孔|钻孔|通孔|盲孔)/);
  const drillMatch2 = text.match(/钻(?:孔|孔)\s*(\d+)\s*(?:个|孔)?/);
  if (drillMatch1) {
    drillingHoles = parseInt(drillMatch1[1]);
  } else if (drillMatch2) {
    drillingHoles = parseInt(drillMatch2[1]);
  }

  // ---- 攻丝 ----
  let tappingHoles: number | undefined;
  // "2×M4" / "2个M4螺纹孔" / "攻丝2×M4" / "2个M4"
  const tapMatch1 = text.match(/(\d+)\s*(?:×|x|X|个)?\s*M(\d+(?:\.\d+)?)\s*(?:螺纹孔|螺纹|攻丝|丝锥)?/);
  const tapMatch2 = text.match(/攻(?:丝|牙)\s*(\d+)\s*(?:个|孔)?/);
  if (tapMatch1) {
    tappingHoles = parseInt(tapMatch1[1]);
  } else if (tapMatch2) {
    tappingHoles = parseInt(tapMatch2[1]);
  }

  return {
    productType: 'extrusion',
    outerWidth,
    outerHeight,
    chamfer,
    isHollow,
    cavity,
    length,
    quantity,
    surfaceTreatment,
    drillingHoles,
    tappingHoles,
  };
}

function MessageContent({ message, onFillForm }: { message: Message; onFillForm?: (info: ParsedProductInfo, content: string) => void }) {
  const content = message.content;
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // 使用 useMemo 缓存解析结果
  const parsedContent = useMemo(() => {
    // 检测报价卡片
    const quotationMatch = content.match(/---\s*\*\*📋 报价单\*\*\s*([\s\S]*?)---/);
    if (quotationMatch && message.role === 'assistant') {
      const quotationData = parseQuotationData(quotationMatch[1]);
      if (quotationData) {
        const beforeQuotation = content.substring(0, content.indexOf('---'));
        const afterQuotation = content.substring(content.lastIndexOf('---') + 3);
        return { type: 'quotation', data: quotationData, before: beforeQuotation, after: afterQuotation };
      }
    }
    
    // 检测产品列表
    if (content.includes('"product_code"') && content.includes('"material"')) {
      const products = parseProductList(content);
      if (products && products.length > 0) {
        const startIdx = content.indexOf('[');
        const endIdx = content.lastIndexOf(']') + 1;
        const before = content.substring(0, startIdx);
        const after = content.substring(endIdx);
        return { type: 'products', products, before, after };
      }
    }
    
    // 检测图片识别结果 - 尝试结构化解析
    if (message.role === 'assistant') {
      const productInfo = parseImageRecognitionResult(content);
      if (productInfo) {
        return { type: 'recognition', productInfo };
      }
      
      // 如果结构化解析失败，但内容中包含图纸相关关键词，也显示填入按钮
      const drawingKeywords = /图纸|型材|铝|挤压|规格|尺寸|mm|kg|m|米重|壁厚|表面处理|氧化|喷涂|6063|6061|编号|图号/i;
      if (drawingKeywords.test(content) && content.length > 20) {
        // 从自由文本中尽量提取信息
        const fallbackInfo: ParsedProductInfo = {
          material: (() => {
            const m = content.match(/6063/i); if (m) return '6063铝型材';
            const m2 = content.match(/6061/i); if (m2) return '6061铝型材';
            const m3 = content.match(/铝/i); if (m3) return '铝';
            return '未知';
          })(),
          process: (() => {
            const m = content.match(/挤压/); if (m) return '铝挤压';
            return '未知';
          })(),
          surfaceTreatment: (() => {
            if (/氧化/.test(content)) return '氧化';
            if (/喷涂/.test(content)) return '喷涂';
            if (/电泳/.test(content)) return '电泳';
            return '无';
          })(),
          meterWeight: (() => {
            const m = content.match(/(\d+\.?\d*)\s*(?:kg\/m|g\/m|千克\/米|克\/米)/i); 
            return m ? m[1] : undefined;
          })(),
          length: (() => {
            const m = content.match(/(\d+\.?\d*)\s*mm/);
            return m ? m[1] : undefined;
          })(),
          description: content.substring(0, 200),
        };
        return { type: 'recognition', productInfo: fallbackInfo };
      }
    }
    
    return { type: 'text' };
  }, [content, message.role]);
  
  // 保存识别结果到产品库
  const handleSaveProduct = async () => {
    if (parsedContent.type !== 'recognition') return;
    
    setIsSaving(true);
    setSaveResult(null);
    
    const result = await saveProductToDatabase(parsedContent.productInfo!);
    
    if (result.success) {
      setSaveResult({ success: true, message: '✅ 已保存到产品库' });
    } else {
      setSaveResult({ success: false, message: `❌ 保存失败: ${result.error}` });
    }
    
    setIsSaving(false);
  };
  
  // 检测工具调用JSON块并隐藏
  const cleanContent = (() => {
    let result = content;
    // 移除代码块中的JSON
    result = result.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '');
    return result.trim();
  })();
  
  if (parsedContent.type === 'quotation') {
    return (
      <div>
        {parsedContent.before && <div className="whitespace-pre-wrap">{parsedContent.before}</div>}
        <QuotationCard data={parsedContent.data!} />
        {parsedContent.after && <div className="whitespace-pre-wrap mt-2">{parsedContent.after}</div>}
      </div>
    );
  }
  
  if (parsedContent.type === 'products') {
    return (
      <div>
        {parsedContent.before && <div className="whitespace-pre-wrap">{parsedContent.before}</div>}
        <ProductCard products={parsedContent.products!} />
        {parsedContent.after && <div className="whitespace-pre-wrap mt-2">{parsedContent.after}</div>}
      </div>
    );
  }
  
  // 图片识别结果，显示保存按钮和填入表单按钮
  if (parsedContent.type === 'recognition') {
    const info = parsedContent.productInfo!;
    return (
      <div>
        {/* 识别结果摘要卡片 */}
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-sm font-medium text-slate-700 mb-2">📋 识别结果摘要</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-slate-500">材质：</span>{info.material}</div>
            <div><span className="text-slate-500">工艺：</span>{info.process}</div>
            <div><span className="text-slate-500">表面处理：</span>{info.surfaceTreatment}</div>
            {info.productCode && <div><span className="text-slate-500">编号：</span>{info.productCode}</div>}
            {info.meterWeight && <div><span className="text-slate-500">米重：</span>{info.meterWeight} kg/m</div>}
            {info.length && <div><span className="text-slate-500">长度：</span>{info.length}mm</div>}
            {info.specs && <div><span className="text-slate-500">规格：</span>{info.specs}</div>}
          </div>
        </div>
        
        {/* 操作按钮 */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveProduct}
            disabled={isSaving || saveResult?.success === true}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              saveResult?.success 
                ? 'bg-green-100 text-green-700 cursor-default' 
                : 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-300'
            }`}
          >
            {isSaving ? '保存中...' : saveResult?.success ? '已保存' : '💾 保存到产品库'}
          </button>
          
          {onFillForm && (
            <button
              onClick={() => onFillForm(info, content)}
              className="px-4 py-2 text-sm rounded-md bg-orange-500 text-white hover:bg-orange-600 transition-colors"
            >
              📋 填入表单报价
            </button>
          )}
          
          {saveResult && !saveResult.success && (
            <span className="text-sm text-red-500">{saveResult.message}</span>
          )}
        </div>
      </div>
    );
  }
  
  // 用户消息：如果有关联的报价计算结果，在消息下方显示报价卡片
  if (message.role === 'user' && (message.pricingResult || message.pricingLoading || message.pricingError)) {
    return (
      <div>
        <div className="whitespace-pre-wrap">{cleanContent}</div>
        {message.pricingLoading && (
          <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-200">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span className="text-sm text-emerald-700">正在计算报价...</span>
          </div>
        )}
        {message.pricingError && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">报价计算失败：{message.pricingError}</span>
          </div>
        )}
        {message.pricingResult && <PricingResultCard data={message.pricingResult} />}
      </div>
    );
  }
  
  return <div className="whitespace-pre-wrap">{cleanContent}</div>;
}

export default function ChatPanel() {
  const { user } = useAuth();
  
  // localStorage key 前缀，用于按 conversation_id 存储对话历史
  const CHAT_STORAGE_KEY_PREFIX = 'chat_history_';
  const CURRENT_CONV_KEY = 'current_conversation_id';
  
  // 初始欢迎消息
  const getInitialMessages = (): Message[] => [
    {
      id: '1',
      role: 'assistant',
      content: '您好！我是工品报价AI助手，专注解决铝型材、五金加工厂人工报价慢、成本核算不准、工序漏算的问题。\n\n**您可以直接：**\n• 📷 上传 DWG/DXF/PDF/图片 → 自动识别尺寸、材质、工艺\n• 💬 描述产品需求 → 联动实时铝价，核算全工序成本\n• 📄 上传 Excel BOM → 批量生成多款产品报价\n• 📋 一键导出带工厂抬头的 PDF 正式报价单\n\n请问您今天需要核算什么产品的报价？',
      timestamp: new Date(),
    },
  ];

  const [messages, setMessages] = useState<Message[]>(getInitialMessages);
  const [needsCompanyInfo, setNeedsCompanyInfo] = useState(false);
  const [companyInfoAsked, setCompanyInfoAsked] = useState(false);

  // 检查用户是否有公司信息
  useEffect(() => {
    if (!user) return;
    
    const checkCompanyInfo = async () => {
      try {
        const res = await fetch(`/api/auth/profile?user_id=${user.id}`);
        const data = await res.json();
        if (data.success && !data.data.hasCompanyInfo) {
          setNeedsCompanyInfo(true);
        }
      } catch (err) {
        console.error('[Chat] 检查公司信息失败:', err);
      }
    };
    
    checkCompanyInfo();
  }, [user]);


  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedFileType, setUploadedFileType] = useState<'image' | 'file' | 'cad' | null>(null);
  const [cadResult, setCadResult] = useState<CadParseResult | null>(null);
  const [cozeFileId, setCozeFileId] = useState<string | null>(null);
  const [cozeFileIdsBatch, setCozeFileIdsBatch] = useState<string[]>([]); // 批量文件ID（用于压缩包多文件）
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // 异型材表单相关state
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<YixingFormData>(defaultFormData());
  const [formStep, setFormStep] = useState<'form' | 'analysis' | 'quotation'>('form');
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis | null>(null);
  const [plateCostAnalysis, setPlateCostAnalysis] = useState<PlateCostAnalysis | null>(null);
  const [aluminumPrice, setAluminumPrice] = useState(20000);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取最新铝锭价
  useEffect(() => {
    fetch('/api/aluminum-price')
      .then(r => r.json())
      .then(d => { if (d.price) setAluminumPrice(d.price); })
      .catch(() => {});
  }, []);

  // 监听右侧快捷操作事件
  useEffect(() => {
    const handleQuickAction = (e: CustomEvent<string>) => {
      setInput(e.detail);
      inputRef.current?.focus();
    };
    window.addEventListener('chat-quick-action', handleQuickAction as EventListener);
    return () => window.removeEventListener('chat-quick-action', handleQuickAction as EventListener);
  }, []);

  // 页面加载时从 localStorage 恢复对话历史
  useEffect(() => {
    try {
      // 先恢复 conversation_id
      const savedConvId = localStorage.getItem(CURRENT_CONV_KEY);
      if (savedConvId) {
        setConversationId(savedConvId);
        console.log('[Chat] Restored conversationId:', savedConvId);
        
        // 恢复对应的对话历史
        const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY_PREFIX + savedConvId);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages) as Message[];
          // 恢复时间戳为 Date 对象
          const messagesWithDates = parsed.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          setMessages(messagesWithDates);
          console.log('[Chat] Restored', messagesWithDates.length, 'messages from localStorage');
        }
      }
    } catch (error) {
      console.error('[Chat] Failed to restore from localStorage:', error);
    }
  }, []); // 只在组件挂载时执行一次

  // 当 needsCompanyInfo 变为 true 时，检查是否需要追加引导消息
  useEffect(() => {
    if (needsCompanyInfo && !companyInfoAsked) {
      setCompanyInfoAsked(true);
      // 延迟3秒后追加引导消息，确保 localStorage 恢复已完成
      const timer = setTimeout(() => {
        setMessages(prev => {
          // 检查是否已经有引导消息
          const hasAskMessage = prev.some(m => m.id === 'company-info-ask');
          if (hasAskMessage) return prev;
          
          return [...prev, {
            id: 'company-info-ask',
            role: 'assistant' as const,
            content: '💼 **完善您的企业信息**\n\n为了给您提供更精准的报价服务，请告诉我您的公司信息：\n\n• 公司名称\n• 联系人姓名\n• 联系电话\n• 公司地址（选填）\n\n您可以直接回复文字，或者发送一张名片图片，我会自动识别并保存。',
            timestamp: new Date(),
          }];
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [needsCompanyInfo, companyInfoAsked]);

  // 对话更新时保存到 localStorage
  useEffect(() => {
    // 跳过初始欢迎消息（没有实际对话内容）
    if (messages.length <= 1) return;
    
    // 必须有 conversation_id 才能保存
    if (!conversationId) return;
    
    try {
      localStorage.setItem(CHAT_STORAGE_KEY_PREFIX + conversationId, JSON.stringify(messages));
      localStorage.setItem(CURRENT_CONV_KEY, conversationId);
      console.log('[Chat] Saved', messages.length, 'messages to localStorage for conversation:', conversationId);
    } catch (error) {
      console.error('[Chat] Failed to save to localStorage:', error);
    }
  }, [messages, conversationId]);

  // 新建对话
  const handleNewChat = useCallback(() => {
    // 清除当前对话 ID（但不删除保存的历史）
    localStorage.removeItem(CURRENT_CONV_KEY);
    setConversationId(null);
    // 重置消息为初始欢迎消息
    setMessages(getInitialMessages());
    console.log('[Chat] Started new conversation');
  }, []);

  // 创建任务工单（文件上传时自动触发）
  const createTask = useCallback(async (uploadedFiles: Array<{name: string, size: number, type: string}>, title?: string) => {
    try {
      // 获取当前登录用户
      const { data: { session } } = await import('@/lib/supabase-browser').then(m => m.supabase.auth.getSession());
      const userId = session?.user?.id;
      if (!userId) {
        console.log('[Task] 用户未登录，跳过任务创建');
        return;
      }
      // 收集最近10条对话作为 conversation_log
      const recentMessages = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp?.toISOString?.() || new Date().toISOString(),
      }));
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          title: title || `文件上传 - ${uploadedFiles.map(f => f.name).join(', ')}`,
          files: uploadedFiles,
          conversation_log: recentMessages,
        }),
      });
      if (response.ok) {
        console.log('[Task] 任务创建成功');
      }
    } catch (err) {
      console.error('[Task] 创建任务失败:', err);
      // 不阻断主流程
    }
  }, [messages]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 处理图片上传
  const handleImageUpload = useCallback(async (file: File) => {
    // 设置文件类型为图片
    setUploadedFileType('image');
    
    // 显示预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    // 上传到服务器（服务器会直接上传到Coze，返回cozeFileId）
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setUploadedImageUrl(data.url || null);
        setCozeFileId(data.cozeFileId || null);
        console.log('图片上传成功, cozeFileId:', data.cozeFileId);
      } else {
        alert('图片上传失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('图片上传失败，请重试');
    }
  }, []);

  // 将PDF渲染为图片（动态加载pdf.js 2.x，禁用worker避免CORS问题）
  const renderPdfToImages = useCallback(async (file: File): Promise<string[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    
    // 动态加载pdf.js 2.16.105（如果还没加载）
    if (!w.pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        if (document.querySelector('script[data-pdfjs]')) {
          const check = setInterval(() => {
            if (w.pdfjsLib) { clearInterval(check); resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(check); reject(new Error('PDF.js加载超时')); }, 15000);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.setAttribute('data-pdfjs', 'true');
        script.onload = () => setTimeout(() => resolve(), 300);
        script.onerror = () => reject(new Error('PDF.js CDN加载失败'));
        document.head.appendChild(script);
      });
    }
    
    if (!w.pdfjsLib) {
      throw new Error('PDF.js未加载，请刷新页面重试');
    }
    
    const pdfjsLib = w.pdfjsLib;
    // pdf.js 2.x: 禁用worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    const arrayBuffer = await file.arrayBuffer();
    // pdf.js 2.x 支持 disableWorker 选项
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true }).promise;
    const maxPages = Math.min(pdf.numPages, 5);
    const images: string[] = [];
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toDataURL('image/png'));
    }
    return images;
  }, []);

  // 提取PDF文字内容
  const extractPdfText = useCallback(async (file: File): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    
    // 确保pdf.js已加载
    if (!w.pdfjsLib) {
      await new Promise<void>((resolve, reject) => {
        if (w.pdfjsLib) { resolve(); return; }
        if (document.querySelector('script[data-pdfjs]')) {
          const check = setInterval(() => {
            if (w.pdfjsLib) { clearInterval(check); resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(check); reject(new Error('PDF.js加载超时')); }, 15000);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.setAttribute('data-pdfjs', 'true');
        script.onload = () => setTimeout(() => resolve(), 300);
        script.onerror = () => reject(new Error('PDF.js CDN加载失败'));
        document.head.appendChild(script);
      });
    }
    
    if (!w.pdfjsLib) {
      return '[PDF文字提取失败: PDF.js未加载]';
    }
    
    const pdfjsLib = w.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableWorker: true }).promise;
      const maxPages = Math.min(pdf.numPages, 10);
      let fullText = '';
      
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: { str: string }) => item.str)
          .join(' ');
        if (pageText.trim()) {
          fullText += `\n--- 第${i}页 ---\n${pageText}`;
        }
      }
      
      if (!fullText.trim()) {
        return `[PDF文字提取: 未提取到文字内容，可能是扫描件/图片型PDF，已发送图片供AI识别]`;
      }
      
      return `\n--- ${file.name} (PDF) ---\n${fullText}`;
    } catch (error) {
      console.error('PDF文字提取失败:', error);
      return `[PDF文字提取失败: ${error instanceof Error ? error.message : '未知错误'}]`;
    }
  }, []);

  // 处理PDF文件上传（渲染为图片后按图片方式上传）
  const handlePdfUpload = useCallback(async (file: File) => {
    try {
      setStatusMessage('正在解析PDF文件...');
      
      // 将PDF渲染为图片
      const images = await renderPdfToImages(file);
      
      if (images.length === 0) {
        alert('PDF解析失败，无法渲染页面');
        setStatusMessage(null);
        return;
      }
      
      // 显示第一页作为预览
      setUploadedImage(images[0]);
      setUploadedFileType('image'); // 按图片类型处理
      
      // 将第一页渲染的图片作为文件上传到Coze
      // 把dataURL转为File对象
      const res = await fetch(images[0]);
      const blob = await res.blob();
      const imageFile = new File([blob], file.name.replace('.pdf', '_page1.png'), { type: 'image/png' });
      
      // 上传到服务器
      const formData = new FormData();
      formData.append('file', imageFile);
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadResponse.json();
      
      if (uploadData.success) {
        setCozeFileId(uploadData.cozeFileId || null);
        console.log('PDF渲染图片上传成功, cozeFileId:', uploadData.cozeFileId);
        
        // 如果有多页，将其他页的文字信息附加
        setExtractedText(`[PDF文件: ${file.name}, 共${images.length}页已渲染为图片发送给AI识别]`);
      } else {
        alert('PDF图片上传失败: ' + (uploadData.error || '未知错误'));
        setUploadedImage(null);
      }
      
      setStatusMessage(null);
    } catch (error) {
      console.error('PDF处理失败:', error);
      alert('PDF处理失败，请尝试直接截图上传');
      setUploadedImage(null);
      setStatusMessage(null);
    }
  }, [renderPdfToImages]);

  // 处理非图片文件上传（Excel等）
  const handleFileUpload = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf';
    
    if (isPdf) {
      // PDF走渲染为图片的方案
      await handlePdfUpload(file);
      return;
    }
    
    // 设置文件类型为文件（Excel等）
    setUploadedFileType('file');
    
    // 显示预览（文件名）
    setUploadedImage(`文件: ${file.name}`);
    
    // 上传到服务器（服务器会直接上传到Coze，返回cozeFileId）
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setCozeFileId(data.cozeFileId || null);
        if (data.extractedText) {
          setExtractedText(data.extractedText);
        }
        console.log('文件上传成功, cozeFileId:', data.cozeFileId);
      } else {
        alert('文件上传失败: ' + (data.error || '未知错误'));
        setUploadedImage(null);
      }
    } catch (error) {
      console.error('上传失败:', error);
      alert('文件上传失败，请重试');
      setUploadedImage(null);
    }
  }, [handlePdfUpload]);

  // 动态加载 JSZip
  const loadJSZip = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.JSZip) return w.JSZip;

    // 多个CDN源，国内优先
    const cdnUrls = [
      'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
      'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    ];

    await new Promise<void>((resolve, reject) => {
      if (document.querySelector('script[data-jszip]')) {
        const check = setInterval(() => {
          if (w.JSZip) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); reject(new Error('JSZip加载超时')); }, 15000);
        return;
      }

      let attemptIndex = 0;
      const tryNext = () => {
        if (attemptIndex >= cdnUrls.length) {
          reject(new Error('JSZip所有CDN源均加载失败'));
          return;
        }
        const script = document.createElement('script');
        script.src = cdnUrls[attemptIndex];
        script.setAttribute('data-jszip', 'true');
        script.onload = () => setTimeout(() => resolve(), 200);
        script.onerror = () => {
          script.remove();
          attemptIndex++;
          tryNext();
        };
        document.head.appendChild(script);
      };
      tryNext();
    });

    return (window as any).JSZip;
  }, []);

  // 处理压缩包上传（ZIP/RAR）
  const handleZipUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setStatusMessage(`正在解压 ${file.name}...`);

    try {
      const JSZip = await loadJSZip();
      const zip = await new JSZip().loadAsync(file);
      const fileEntries: string[] = [];

      zip.forEach((relativePath: string) => {
        if (!relativePath.endsWith('/') && !relativePath.startsWith('__MACOSX') && !relativePath.startsWith('.')) {
          fileEntries.push(relativePath);
        }
      });

      if (fileEntries.length === 0) {
        alert('压缩包内没有可处理的文件');
        setIsLoading(false);
        setStatusMessage(null);
        return;
      }

      // 收集所有文件ID和信息
      const collectedFileIds: string[] = [];
      const fileSummaries: string[] = [];
      const allExtractedTexts: string[] = [];
      let firstImagePreview: string | null = null;

      for (let i = 0; i < fileEntries.length; i++) {
        const entryName = fileEntries[i];
        const zipEntry = zip.file(entryName);
        if (!zipEntry) continue;

        const lowerName = entryName.toLowerCase();
        const baseName = entryName.split('/').pop() || entryName;
        setStatusMessage(`正在处理 (${i + 1}/${fileEntries.length}): ${baseName}`);

        const blob = await zipEntry.async('blob');
        // 根据扩展名推断 MIME 类型
        const extToMime: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
          '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
          '.pdf': 'application/pdf',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '.xls': 'application/vnd.ms-excel',
          '.step': 'application/step', '.stp': 'application/step',
          '.iges': 'application/iges', '.igs': 'application/iges',
          '.dxf': 'application/dxf',
        };
        const ext = '.' + (baseName.split('.').pop() || '').toLowerCase();
        const mimeType = extToMime[ext] || blob.type || 'application/octet-stream';
        const extractedFile = new File([blob], baseName, { type: mimeType });

        const isImage = mimeType.startsWith('image/');
        const isPdf = mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
        const isStep = lowerName.endsWith('.step') || lowerName.endsWith('.stp');
        const isIges = lowerName.endsWith('.iges') || lowerName.endsWith('.igs');
        const isDxf = lowerName.endsWith('.dxf');
        const isCad = isStep || isIges || isDxf;

        try {
          if (isImage || isPdf) {
            // 图片和PDF：上传到 Coze 获取 file_id，同时提取PDF文字
            let fileToUpload = extractedFile;
            if (isPdf) {
              // PDF 同时渲染图片 + 提取文字
              const [images, pdfText] = await Promise.all([
                renderPdfToImages(extractedFile),
                extractPdfText(extractedFile),
              ]);
              // 提取文字内容
              if (pdfText && !pdfText.startsWith('[')) {
                allExtractedTexts.push(pdfText);
                fileSummaries.push(`📄 ${baseName} (文字已提取)`);
              } else {
                fileSummaries.push(`📄 ${baseName} (扫描件/图片型PDF)`);
              }
              // 渲染第一页作为图片上传（用于视觉识别）
              if (images.length > 0) {
                const res = await fetch(images[0]);
                const imgBlob = await res.blob();
                fileToUpload = new File([imgBlob], baseName.replace('.pdf', '.png'), { type: 'image/png' });
                if (!firstImagePreview) firstImagePreview = images[0];
              }
            } else {
              if (!firstImagePreview) {
                firstImagePreview = await new Promise(resolve => {
                  const reader = new FileReader();
                  reader.onload = (e) => resolve(e.target?.result as string);
                  reader.readAsDataURL(fileToUpload);
                });
              }
            }

            const fd = new FormData();
            fd.append('file', fileToUpload);
            const resp = await fetch('/api/upload', { method: 'POST', body: fd });
            const data = await resp.json();
            if (data.success && data.cozeFileId) {
              collectedFileIds.push(data.cozeFileId);
              if (!isPdf) fileSummaries[fileSummaries.length - 1] = `📄 ${baseName} (已上传)`;
            } else {
              fileSummaries.push(`⚠️ ${baseName} 上传失败`);
            }
          } else if (isCad) {
            // CAD文件：客户端解析
            const format = isStep ? 'step' : isIges ? 'iges' : 'dxf';
            const result = format === 'dxf'
              ? await parseDxfFile(extractedFile)
              : await parseStepOrIgesFile(extractedFile, format as 'step' | 'iges');

            if (result.success) {
              const cadText = `\n--- ${baseName} (${format.toUpperCase()}) ---\n材质：铝合金\n米重(kg/m)：${result.weightPerMeter}\n宽度(mm)：${result.width}\n高度(mm)：${result.height}\n长度(mm)：${result.length}\n截面积(mm²)：${result.crossSectionArea}\n加工工艺：铝挤压\n表面处理：无\n`;
              allExtractedTexts.push(cadText);
              fileSummaries.push(`📐 ${baseName} (已解析)`);
            } else {
              fileSummaries.push(`⚠️ ${baseName} 解析失败: ${result.error}`);
            }
          } else {
            // 其他文件：直接上传到 Coze
            const fd = new FormData();
            fd.append('file', extractedFile);
            const resp = await fetch('/api/upload', { method: 'POST', body: fd });
            const data = await resp.json();
            if (data.success && data.cozeFileId) {
              collectedFileIds.push(data.cozeFileId);
              fileSummaries.push(`📎 ${baseName} (已上传)`);
            } else {
              fileSummaries.push(`⚠️ ${baseName} 上传失败`);
            }
          }
        } catch (err) {
          console.error(`处理文件 ${baseName} 失败:`, err);
          fileSummaries.push(`❌ ${baseName} 处理出错`);
        }
      }

      // 保存收集到的文件ID
      setCozeFileIdsBatch(collectedFileIds);
      if (firstImagePreview) setUploadedImage(firstImagePreview);

      setStatusMessage(null);
      setIsLoading(false);

      // 显示解压结果摘要
      const summary = `📦 已解压 **${file.name}**，共 ${fileEntries.length} 个文件：\n${fileSummaries.join('\n')}\n\n✅ 已成功处理 ${collectedFileIds.length + allExtractedTexts.length} 个文件，点击下方发送按钮让AI分析报价。`;

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: summary,
        timestamp: new Date(),
      }]);

      // 预填发送内容
      if (collectedFileIds.length > 0 || allExtractedTexts.length > 0) {
        setInput(`请分析压缩包中的${collectedFileIds.length + allExtractedTexts.length}个产品文件，逐一识别材质、尺寸、工艺并报价。`);
        // 如果有CAD解析文本，存到extractedText
        if (allExtractedTexts.length > 0) {
          setExtractedText(allExtractedTexts.join('\n'));
        }
        inputRef.current?.focus();
      }

    } catch (error) {
      console.error('解压失败:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ 解压失败：${(error as Error).message}`,
        timestamp: new Date(),
      }]);
      setIsLoading(false);
      setStatusMessage(null);
    }
  }, [loadJSZip, renderPdfToImages]);

  // 处理CAD文件上传（DXF/STEP/IGES）
  const handleCadUpload = useCallback(async (file: File, format: 'dxf' | 'step' | 'iges') => {
    setUploadedFileType('cad');
    setUploadedImage(`📐 CAD文件: ${file.name}`);
    setIsLoading(true);
    setStatusMessage(`正在解析${format.toUpperCase()}文件...`);

    try {
      let result: CadParseResult;
      if (format === 'dxf') {
        result = await parseDxfFile(file);
      } else {
        result = await parseStepOrIgesFile(file, format);
      }

      setCadResult(result);
      setStatusMessage(null);

      if (result.success) {
        // 构建展示文本
        let cadContent = `📐 ${result.format.toUpperCase()}文件解析成功！

`;
        cadContent += `【产品参数开始】
`;
        cadContent += `材质：铝合金
`;
        cadContent += `米重(kg/m)：${result.weightPerMeter}
`;
        if (result.width > 0) cadContent += `宽度(mm)：${result.width}
`;
        if (result.height > 0) cadContent += `高度(mm)：${result.height}
`;
        if (result.length > 0) cadContent += `长度(mm)：${result.length}
`;
        cadContent += `加工工艺：铝挤压
`;
        cadContent += `表面处理：无
`;
        cadContent += `【产品参数结束】

`;
        cadContent += `截面积：${result.crossSectionArea} mm²
`;
        if (result.volume) cadContent += `体积：${result.volume} mm³
`;
        cadContent += `实体数量：${result.meshCount || 0}
`;
        if (result.entityNames && result.entityNames.length > 0) {
          cadContent += `实体名称：${result.entityNames.join(', ')}
`;
        }
        if (result.parts && result.parts.length > 1) {
          cadContent += `\n--- 各部件明细 ---\n`;
          for (const part of result.parts) {
            cadContent += `· ${part.name}：截面积${part.crossSectionArea}mm²，米重${part.weightPerMeter}kg/m
`;
          }
        }

        // 诊断信息
        if (result.diagnostics && result.diagnostics.length > 0) {
          cadContent += '\n--- 诊断信息 ---\n';
          for (const diag of result.diagnostics) {
            const icon = diag.severity === 'error' ? '❌' : diag.severity === 'warning' ? '⚠️' : 'ℹ️';
            cadContent += icon + ' ' + diag.message + '\n';
          }
        }

        // 添加助手消息
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: cadContent,
          timestamp: new Date(),
        }]);

        // 自动填入表单
        const fd = defaultFormData();
        fd.material = '铝合金';
        fd.meterWeight = String(result.weightPerMeter);
        if (result.width > 0) fd.width = String(result.width);
        if (result.height > 0) fd.height = String(result.height);
        if (result.length > 0) fd.length = String(result.length);
        fd.processes = [{ type: '铝挤压', order: '1' }];
        fd.surfaceTreatment = '无';
        // 从文件名提取产品编号
        const baseName = file.name.replace(/.(step|stp|iges|igs|dxf)$/i, '');
        fd.productCode = baseName;
        fd.productName = '铝合金型材';
        setFormData(fd);
        setFormStep('form');
        setCostAnalysis(null);
        setFormOpen(true);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ CAD文件解析失败：${result.error}${result.diagnostics && result.diagnostics.length > 0 ? '\n\n--- 诊断信息 ---\n' + result.diagnostics.map(d => (d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️' : 'ℹ️') + ' ' + d.message).join('\n') : ''}`,
          timestamp: new Date(),
        }]);
        setUploadedImage(null);
        setUploadedFileType(null);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ CAD文件处理出错：${error.message}`,
        timestamp: new Date(),
      }]);
      setUploadedImage(null);
      setUploadedFileType(null);
    } finally {
      setIsLoading(false);
      setStatusMessage(null);
    }
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    console.log('选择文件:', file.name, file.type, file.size);
    
    // 检查文件类型
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isExcel = file.type.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isStep = file.name.toLowerCase().endsWith('.step') || file.name.toLowerCase().endsWith('.stp');
    const isIges = file.name.toLowerCase().endsWith('.iges') || file.name.toLowerCase().endsWith('.igs');
    const isDxf = file.name.toLowerCase().endsWith('.dxf');
    const isCad = isStep || isIges || isDxf;
    const isZip = file.name.toLowerCase().endsWith('.zip') || file.name.toLowerCase().endsWith('.rar');
    
    
    if (isZip) {
      handleZipUpload(file);
    } else if (isImage) {
      handleImageUpload(file);
    } else if (isCad) {
      const format = isStep ? 'step' : isIges ? 'iges' : 'dxf';
      handleCadUpload(file, format);
    } else {
      // PDF和Excel文件处理
      handleFileUpload(file);
    }
    
    // 清空input，允许重复选择同一文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleImageUpload, handleFileUpload, handleZipUpload, handleCadUpload]);

  // 触发文件选择
  const triggerFileUpload = useCallback(() => {
    console.log('触发文件上传');
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('fileInputRef.current is null');
    }
  }, []);

  // 发送消息
  // 解析公司信息
  const parseCompanyInfo = (text: string) => {
    const info: {
      company_name?: string;
      contact_name?: string;
      contact_phone?: string;
      address?: string;
    } = {};
    
    // 提取公司名称
    const companyMatch = text.match(/([\u4e00-\u9fa5]+(?:有限公司|股份有限公司|集团))/);
    if (companyMatch) {
      info.company_name = companyMatch[1].trim();
    }
    
    // 提取联系人
    const contactMatch = text.match(/(?:联系人|姓名)[：:\s]*([\u4e00-\u9fa5]{2,4})/);
    if (contactMatch) {
      info.contact_name = contactMatch[1].trim();
    }
    
    // 提取电话
    const phoneMatch = text.match(/1[3-9]\d{9}/);
    if (phoneMatch) {
      info.contact_phone = phoneMatch[0];
    }
    
    // 提取地址
    const addressMatch = text.match(/(?:地址)[：:\s]*([^\n]+)/);
    if (addressMatch) {
      info.address = addressMatch[1].trim();
    }
    
    return info;
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() && !uploadedImage && cozeFileIdsBatch.length === 0 && !cozeFileId) return;
    
    // 如果正在收集公司信息，尝试解析
    if (needsCompanyInfo && user) {
      const parsedInfo = parseCompanyInfo(input);
      if (parsedInfo.company_name || parsedInfo.contact_phone) {
        // 尝试保存公司信息
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              ...parsedInfo,
            }),
          });
          const data = await res.json();
          if (data.success) {
            setNeedsCompanyInfo(false);
            // 在消息列表中添加确认消息（延迟到用户消息发送后）
            setTimeout(() => {
              setMessages(prev => [...prev, {
                id: `company-info-confirm-${Date.now()}`,
                role: 'assistant' as const,
                content: `✅ **信息已保存！**\n\n${parsedInfo.company_name ? `• 公司：${parsedInfo.company_name}\n` : ''}${parsedInfo.contact_name ? `• 联系人：${parsedInfo.contact_name}\n` : ''}${parsedInfo.contact_phone ? `• 电话：${parsedInfo.contact_phone}\n` : ''}${parsedInfo.address ? `• 地址：${parsedInfo.address}\n` : ''}\n现在可以开始使用报价功能了，请上传您的产品图片或描述需求。`,
                timestamp: new Date(),
              }]);
            }, 100);
          }
        } catch (err) {
          console.error('[Chat] 保存公司信息失败:', err);
        }
      }
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      imageUrl: uploadedImage || undefined,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // ===== 从用户输入中提取报价参数，尝试调用报价API =====
    const pricingParams = extractPricingParams(input);
    if (pricingParams) {
      // 标记为加载中
      setMessages((prev) => prev.map((m) =>
        m.id === userMessage.id ? { ...m, pricingLoading: true } : m
      ));
      try {
        const pricingRes = await fetch('/api/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pricingParams),
        });
        const pricingData = await pricingRes.json();
        if (pricingData.success && pricingData.data) {
          setMessages((prev) => prev.map((m) =>
            m.id === userMessage.id
              ? { ...m, pricingLoading: false, pricingResult: pricingData.data }
              : m
          ));
        } else {
          setMessages((prev) => prev.map((m) =>
            m.id === userMessage.id
              ? { ...m, pricingLoading: false, pricingError: pricingData.error || pricingData.details?.join('; ') || '报价计算失败' }
              : m
          ));
        }
      } catch (err) {
        setMessages((prev) => prev.map((m) =>
          m.id === userMessage.id
            ? { ...m, pricingLoading: false, pricingError: err instanceof Error ? err.message : '请求失败' }
            : m
        ));
      }
    }
    // ===== 报价参数提取结束 =====

    const currentImageData = uploadedImage; // 图片Base64数据（仅用于预览）
    const currentCozeFileId = cozeFileId; // Coze文件ID（单文件）
    const currentCozeFileIdsBatch = cozeFileIdsBatch; // Coze文件ID列表（压缩包多文件）
    const currentFileType = uploadedFileType; // 文件类型：'image' 或 'file'
    const currentExtractedText = extractedText; // PDF提取的文字内容
    setUploadedImage(null);
    setUploadedImageUrl(null);
    setUploadedFileType(null);
    setCozeFileId(null);
    setCozeFileIdsBatch([]);
    setExtractedText(null);
    setIsLoading(true);
    setStatusMessage(null);

    // 如果有文件上传，自动创建任务工单
    if (currentCozeFileId || currentCozeFileIdsBatch.length > 0) {
      const fileInfoList: Array<{name: string, size: number, type: string}> = [];
      // 收集文件信息（从消息内容或上下文中获取）
      const fileData = currentCozeFileIdsBatch.length > 0
        ? currentCozeFileIdsBatch.map((id, idx) => ({ name: `file_${idx + 1}`, size: 0, type: currentFileType || 'file' }))
        : [{ name: currentCozeFileId || 'file', size: 0, type: currentFileType || 'file' }];
      fileInfoList.push(...fileData);
      createTask(fileInfoList, input || '文件上传处理');
    }
    
    try {
      const requestBody: Record<string, unknown> = {
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        fileType: currentFileType || 'file',
      };
      // 优先使用批量文件ID（压缩包场景），否则使用单文件ID
      if (currentCozeFileIdsBatch.length > 0) {
        requestBody.cozeFileIds = currentCozeFileIdsBatch;
      } else if (currentCozeFileId) {
        requestBody.cozeFileId = currentCozeFileId;
      }
      if (currentExtractedText) {
        requestBody.extractedText = currentExtractedText;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        throw new Error('请求失败');
      }
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');
      
      let assistantContent = '';
      const assistantMessageId = (Date.now() + 1).toString();
      
      // 添加空的助手消息
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        },
      ]);
      
      const decoder = new TextDecoder();
      let buffer = ''; // 累积缓冲区，确保SSE消息完整解析
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 累积数据到缓冲区
        buffer += decoder.decode(value, { stream: true });
        
        // 按双换行符分割完整的SSE事件
        const events = buffer.split('\n\n');
        // 最后一个可能是不完整的，保留在缓冲区
        buffer = events.pop() || '';
        
        for (const event of events) {
          const line = event.trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.type === 'status') {
                // 后端状态提示
                setStatusMessage(data.message || null);
              } else if (data.type === 'text') {
                assistantContent += data.content;
                setStatusMessage(null); // 收到文本后清除状态提示
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: assistantContent }
                      : m
                  )
                );
              } else if (data.type === 'error') {
                // 处理错误
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, content: `错误: ${data.error || '未知错误'}` }
                      : m
                  )
                );
              } else if (data.type === 'tool_start') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolCalls: [{ tool: data.tool, status: 'running' }] }
                      : m
                  )
                );
              } else if (data.type === 'tool_result') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? {
                          ...m,
                          toolCalls: [
                            {
                              tool: m.toolCalls?.[0]?.tool || '',
                              status: data.result.success ? 'success' : 'error',
                              result: data.result.data,
                            },
                          ],
                        }
                      : m
                  )
                );
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: '抱歉，发生了错误，请稍后重试。',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, uploadedImage, cozeFileId, cozeFileIdsBatch, uploadedFileType, extractedText]);

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 从AI识别结果填入表单
  const handleFillFormFromRecognition = useCallback((info: ParsedProductInfo, content: string) => {
    const fd = defaultFormData();
    
    // 产品编号
    if (info.productCode) fd.productCode = info.productCode;
    
    // 产品名称
    if (info.productName) fd.productName = info.productName;
    
    // 材质 → material + productName
    if (info.material) {
      fd.material = info.material;
      if (!fd.productName) fd.productName = info.material + '型材';
    }
    
    // 米重（单位：kg/m）
    if (info.meterWeight) {
      fd.meterWeight = info.meterWeight;
    } else {
      // 尝试从自由文本中提取米重
      const mwKgMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:kg\/m|千克\/米)/i);
      if (mwKgMatch) {
        fd.meterWeight = mwKgMatch[1];
      } else {
        const mwGMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:g\/m|克\/米)/i);
        if (mwGMatch) {
          // g/m → kg/m
          fd.meterWeight = (parseFloat(mwGMatch[1]) / 1000).toFixed(3);
        }
      }
    }
    
    // 尺寸 - 优先使用解析出的字段
    if (info.length) fd.length = info.length;
    if (info.width) fd.width = info.width;
    if (info.height) fd.height = info.height;
    
    // 如果没有从结构化字段获取到，尝试从内容匹配
    if (!fd.length) {
      // 尝试匹配"长度：XXmm"格式
      const lenMatch = content.match(/(?:长度|长)[：:]\s*(\d+(?:\.\d+)?)\s*mm/i);
      if (lenMatch) fd.length = lenMatch[1];
    }
    if (!fd.width) {
      const widMatch = content.match(/(?:宽度|宽)[：:]\s*(\d+(?:\.\d+)?)\s*mm/i);
      if (widMatch) fd.width = widMatch[1];
    }
    if (!fd.height) {
      const hgtMatch = content.match(/(?:高度|高)[：:]\s*(\d+(?:\.\d+)?)\s*mm/i);
      if (hgtMatch) fd.height = hgtMatch[1];
    }
    // 尝试匹配 "XXmm × XXmm × XXmm" 格式
    if (!fd.length) {
      const dimMatch = content.match(/(\d+(?:\.\d+)?)\s*mm\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm/);
      if (dimMatch) {
        fd.length = dimMatch[1];
        if (!fd.width) fd.width = dimMatch[2];
        if (!fd.height) fd.height = dimMatch[3];
      } else {
        const dim2Match = content.match(/(\d+(?:\.\d+)?)\s*mm\s*[×xX]\s*(\d+(?:\.\d+)?)\s*mm/);
        if (dim2Match) {
          fd.length = dim2Match[1];
          if (!fd.width) fd.width = dim2Match[2];
        }
      }
    }
    
    // 加工工艺
    if (info.process) {
      const procs = info.process.split(/[、,，\/]/).map(p => p.trim()).filter(Boolean);
      fd.processes = procs.map((p, i) => ({
        type: PROCESS_TYPES.includes(p) ? p : PROCESS_TYPES[0],
        order: String(i + 1),
      }));
      if (fd.processes.length === 0) fd.processes = [{ type: '铝挤压', order: '1' }];
    }
    
    // 表面处理
    if (info.surfaceTreatment && SURFACE_OPTIONS.includes(info.surfaceTreatment)) {
      fd.surfaceTreatment = info.surfaceTreatment;
    }
    
    setFormData(fd);
    setFormStep('form');
    setCostAnalysis(null);
    setFormOpen(true);
  }, []);

  // 表单提交 → 生成成本分析
  const handleFormSubmit = useCallback(() => {
    const fd = formData;
    if (fd.productType === '板材件') {
      // 板材件计算
      if (!fd.thickness) {
        alert('请填写板厚');
        return;
      }
      const plateAnalysis = calculatePlateCostAnalysis(fd, aluminumPrice);
      setPlateCostAnalysis(plateAnalysis);
      setCostAnalysis(null);
      setFormStep('analysis');
    } else {
      // 铝型材计算（原逻辑）
      if (!fd.meterWeight && !fd.length) {
        alert('请填写米重和长度');
        return;
      }
      const analysis = calculateCostAnalysis(fd, aluminumPrice);
      setCostAnalysis(analysis);
      setPlateCostAnalysis(null);
      setFormStep('analysis');
    }
  }, [formData, aluminumPrice]);

  // 确认成本分析 → 生成报价单Excel
  const handleConfirmAnalysis = useCallback(async () => {
    // 板材报价 → 导出板材报价单
    if (formData.productType === '板材件' && plateCostAnalysis) {
      try {
        const p = plateCostAnalysis;
        const fd = formData;
        const qty = parseInt(fd.minOrderQty) || 100;
        const priceBeforeTax = p.totalPrice;
        const priceWithTax = Math.round(priceBeforeTax * 1.13 * 10000) / 10000;
        
        const response = await fetch('/api/export-quotation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyName: '佛山市质稳五金制品有限公司',
            customerName: '-',
            quotationNo: 'QT-' + Date.now().toString().slice(-8),
            validDays: 15,
            aluminumPrice: aluminumPrice,
            isPlateQuote: true,
            items: [{
              productCode: fd.productCode || 'P-001',
              productName: fd.productName || '-',
              specSize: `${p.plateMaterial} ${p.thickness}mm`,
              unit: fd.unit || '件',
              material: p.plateMaterial,
              surfaceTreatment: p.surfaceTreatmentType,
              weightPerPiece: p.weightPerPiece,
              moldFee: p.totalMoldCost,
              materialCost: p.materialCostPerPiece,
              processCost: p.cumulativeAfterProcesses - p.materialCostPerPiece,
              surfaceCost: p.surfaceCost,
              packagingFee: p.packaging,
              transportFee: p.transport,
              managementFee: 0,
              priceBeforeTax: priceBeforeTax,
              priceWithTax: priceWithTax,
              minOrderQty: qty,
              remarks: fd.remarks || '',
              processSteps: p.processBreakdown.map(pb => pb.name).join(' → '),
              nestingCount: p.nestingCount,
            }],
          }),
        });
        
        if (!response.ok) throw new Error('生成失败');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `板材报价单_${fd.productCode || fd.productName || 'new'}_${new Date().toISOString().slice(0,10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setFormOpen(false);
        setFormStep('form');
        setFormData(defaultFormData());
        setCostAnalysis(null);
        setPlateCostAnalysis(null);
        
        const processDetail = p.processBreakdown.map((pb, i) => `  ${i+1}. ${pb.name}: ¥${pb.total.toFixed(4)}`).join('\n');
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `📋 板材报价单已生成并下载！\n\n**产品**：${fd.productName}\n**材料**：${p.plateMaterial} ${p.thickness}mm\n**排版**：${p.nestingCount}件/张\n**单件重量**：${p.weightPerPiece}kg\n**表面处理**：${p.surfaceTreatmentType}\n\n**成本明细：**\n- 材料费：¥${p.materialCostPerPiece.toFixed(4)}\n- 加工累计：¥${p.cumulativeAfterProcesses.toFixed(4)}\n- 表面处理：¥${p.surfaceCost.toFixed(4)}\n- 报价主体(×1.05)：¥${p.quoteMain.toFixed(4)}\n- 包装+运输：¥${(p.packaging + p.transport).toFixed(4)}\n\n**不含税单价：¥${priceBeforeTax.toFixed(4)}**\n**含税单价(13%)：¥${priceWithTax.toFixed(4)}**\n${p.totalMoldCost > 0 ? `**模具费：¥${p.totalMoldCost.toLocaleString()}**\n` : ''}\n**加工工序：**\n${processDetail}`,
          timestamp: new Date(),
        }]);
      } catch (error) {
        console.error('板材报价单生成失败:', error);
        alert('报价单生成失败：' + (error as Error).message);
      }
      return;
    }
    
    if (!costAnalysis) return;
    
    try {
      const fd = formData;
      const mw = parseFloat(fd.meterWeight) || 0;
      const len = parseFloat(fd.length) || 0;
      const wid = parseFloat(fd.width) || 0;
      const hgt = parseFloat(fd.height) || 0;
      const alPrice = costAnalysis.aluminumPrice || 22.78;
      const isAl5052 = fd.material?.includes('5052') || fd.material?.includes('AL5052');
      const specSize = isAl5052
        ? '冲压件'
        : [fd.length, fd.width, fd.height].filter(Boolean).join('×') + 'mm';

      // 详细成本拆分
      const materialCost = isAl5052
        ? Math.round(mw * alPrice * 2 * 100) / 100  // 侧挡板按件重×铝价×批量系数
        : Math.round(mw * alPrice * (len + 5 + (100 / Math.floor(3100 / (len || 1)))) / 1000 * 100) / 100;
      const packagingFee = Math.round(mw * len / 1000 * 0.5 * 100) / 100;
      const transportFee = packagingFee;
      const surfaceFee = costAnalysis.surfaceCost;
      const machiningFee = costAnalysis.processCost;
      const costBase = materialCost + surfaceFee + packagingFee + machiningFee;
      const lossRate = fd.productName?.includes('支架') && !isAl5052 ? 0.03 : (isAl5052 ? 0.02 : 0.05);
      const lossFee = Math.round(costBase * lossRate * 100) / 100;
      const managementFee = Math.round(costBase * 0.1 * 100) / 100;
      // 挤压费按产品类别（简化：根据截面尺寸判断）
      const crossSection = wid * hgt;
      const extrusionFee = isAl5052 ? 0.05
        : fd.productName?.includes('散热器') ? 0.55
        : fd.productName?.includes('支架') ? 1.15
        : 2.33;
      const priceBeforeTax = costBase + lossFee + managementFee + extrusionFee;
      const priceWithTax = Math.round(priceBeforeTax * 1.13 * 100) / 100;
      const weightPerPiece = isAl5052 ? Math.round(mw * 1000 * 10) / 10 : Math.round(mw * len * 10) / 10;

      const response = await fetch('/api/export-quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: '佛山市质稳五金制品有限公司',
          customerName: '-',
          quotationNo: 'QT-' + Date.now().toString().slice(-8),
          validDays: 15,
          aluminumPrice: alPrice,
          items: [{
            productCode: fd.productCode || 'P-001',
            productName: fd.productName || '-',
            specSize,
            unit: fd.unit || '件',
            material: fd.material || '6063-T5',
            surfaceTreatment: fd.surfaceTreatment || '氧化',
            meterWeight: mw || undefined,
            length: len || undefined,
            width: wid || undefined,
            height: hgt || undefined,
            weightPerPiece,
            moldFee: parseFloat(fd.moldFee) || 0,
            materialCost,
            extrusionFee,
            machiningFee,
            surfaceFee,
            packagingFee,
            transportFee,
            lossFee,
            managementFee,
            priceBeforeTax,
            priceWithTax,
            minOrderQty: parseInt(fd.minOrderQty) || 100,
            remarks: fd.remarks || '',
          }],
        }),
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || '生成失败');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `报价单_${fd.productCode || fd.productName || 'new'}_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setFormOpen(false);
      setFormStep('form');
      setFormData(defaultFormData());
      setCostAnalysis(null);
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `📋 报价单已生成并下载！\n\n**产品**：${fd.productName}\n**规格**：${specSize}\n**材质**：${fd.material}\n**表面处理**：${fd.surfaceTreatment}\n\n**成本明细：**\n- 材料费：¥${materialCost.toFixed(2)}\n- 挤压费：¥${extrusionFee.toFixed(2)}\n- 加工费：¥${machiningFee.toFixed(2)}\n- 表面处理：¥${surfaceFee.toFixed(2)}\n- 损耗：¥${lossFee.toFixed(2)}\n- 管理费利润：¥${managementFee.toFixed(2)}\n\n**不含税单价：¥${priceBeforeTax.toFixed(2)}**\n**含税单价（13%）：¥${priceWithTax.toFixed(2)}**\n**模具费：¥${fd.moldFee || '0'}**`,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error('报价单生成失败:', error);
      alert('报价单生成失败：' + (error as Error).message);
    }
  }, [costAnalysis, formData]);

  // 更新表单字段
  const updateFormField = useCallback((field: keyof YixingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 添加加工行
  const addProcessRow = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      processes: [...prev.processes, { type: PROCESS_TYPES[0], order: String(prev.processes.length + 1) }],
    }));
  }, []);

  // 删除加工行
  const removeProcessRow = useCallback((index: number) => {
    setFormData(prev => {
      if (prev.processes.length <= 1) return prev;
      const newProcs = prev.processes.filter((_, i) => i !== index);
      return { ...prev, processes: newProcs };
    });
  }, []);

  // 更新加工行
  const updateProcessRow = useCallback((index: number, field: 'type' | 'order', value: string) => {
    setFormData(prev => {
      const newProcs = [...prev.processes];
      newProcs[index] = { ...newProcs[index], [field]: value };
      return { ...prev, processes: newProcs };
    });
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-50/30 rounded-xl border border-gray-100 overflow-hidden">
      {/* 头部 - 精简现代风格 */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-sm">AI智能报价助手</h2>
            <p className="text-xs text-gray-400">拖拽上传 · 支持压缩包 · 智能报价</p>
          </div>
        </div>
        {/* 新建对话按钮 */}
        <button
          onClick={handleNewChat}
          className="px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors flex items-center gap-1.5 border border-gray-200"
          title="开始新对话"
        >
          <Plus className="w-3.5 h-3.5" />
          新对话
        </button>
      </div>
      
      {/* 消息区域 - 可滚动，占满剩余空间 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm'
                    : 'bg-gradient-to-br from-gray-100 to-gray-200'
                )}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3',
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-800 border border-gray-100 shadow-xs'
                )}
              >
                {message.imageUrl && (
                  <img
                    src={message.imageUrl}
                    alt="上传的图片"
                    className="max-w-full rounded mb-2"
                    style={{ maxHeight: '200px' }}
                  />
                )}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mb-2 text-xs">
                    {message.toolCalls.map((tool, i) => (
                      <div
                        key={i}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded mr-2',
                          tool.status === 'running'
                            ? 'bg-yellow-100 text-yellow-700'
                            : tool.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        )}
                      >
                        {tool.status === 'running' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : tool.status === 'success' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {tool.tool}
                      </div>
                    ))}
                  </div>
                )}
                <MessageContent message={message} onFillForm={handleFillFormFromRecognition} />
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-gray-500">{statusMessage || '正在思考...'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* 上传预览 - 固定高度 */}
      {uploadedImage && (
        <div className="px-4 py-2 border-t bg-gray-50 shrink-0">
          <div className="relative inline-block">
            <img
              src={uploadedImage}
              alt="预览"
              className="h-16 rounded border"
            />
            <button
              onClick={() => {
                setUploadedImage(null);
                setUploadedImageUrl(null);
                setUploadedFileType(null);
                setCozeFileId(null);
              }}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      )}
      
      {/* 输入区域 - 固定在底部 */}
      <div className="px-4 py-3 border-t bg-white shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={triggerFileUpload}
            disabled={isLoading}
            title="上传图纸/图片"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-200 transition-colors"
          >
            <Upload className="w-4 h-4" />
          </button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述产品需求，如：铝型材 6063-T5，长200mm，氧化黑色，1000件..."
            disabled={isLoading}
            className="flex-1 border-gray-200 focus:border-blue-300 focus:ring-blue-100 rounded-lg"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || (!input.trim() && !uploadedImage)}
            className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={() => setInput('我有一个铝型材产品需要报价，材质6063-T5，请帮我核算成本')}
            className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors border border-blue-100"
          >
            📐 铝型材报价
          </button>
          <button
            onClick={() => setInput('帮我查询今日铝锭价格')}
            className="px-3 py-1.5 text-xs bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100 transition-colors border border-orange-100"
          >
            📈 今日铝价
          </button>
          <button
            onClick={() => setInput('我有一个五金加工件需要报价，材质不锈钢304')}
            className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors border border-green-100"
          >
            🔩 五金件报价
          </button>
          <button
            onClick={() => { setFormData(defaultFormData()); setFormStep('form'); setCostAnalysis(null); setPlateCostAnalysis(null); setFormOpen(true); }}
            className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100 transition-colors border border-purple-100 font-medium"
          >
            📊 异型材报价
          </button>
        </div>
      </div>

      {/* 异型材报价弹窗 - 三步骤 */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) { setFormStep('form'); setCostAnalysis(null); setPlateCostAnalysis(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-orange-500" />
              异型材报价
              <span className="text-xs text-gray-400 ml-2">({formData.productType})</span>
              <div className="flex gap-1 ml-4">
                {['填写信息', '成本分析', '生成报价'].map((step, i) => (
                  <div key={step} className={cn(
                    'px-2 py-0.5 rounded text-xs',
                    (formStep === 'form' && i === 0) || (formStep === 'analysis' && i <= 1) || (formStep === 'quotation' && i <= 2)
                      ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
                  )}>{step}</div>
                ))}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: 填写表单 */}
          {formStep === 'form' && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">产品编号</Label>
                  <Input value={formData.productCode} onChange={(e) => updateFormField('productCode', e.target.value)} placeholder="如: XC-001" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">产品名称</Label>
                  <Input value={formData.productName} onChange={(e) => updateFormField('productName', e.target.value)} placeholder="如: 铝型材" className="mt-1" />
                </div>
              </div>

              {/* 产品形态选择 */}
              <div>
                <Label className="text-xs text-gray-500">产品形态</Label>
                <div className="flex gap-2 mt-1">
                  {PRODUCT_TYPES.map(pt => (
                    <button key={pt} type="button"
                      onClick={() => {
                        updateFormField('productType', pt);
                        if (pt === '板材件') {
                          // 切换到板材默认工序
                        } else {
                          // 切换回铝型材默认工序
                        }
                      }}
                      className={cn('flex-1 py-2 rounded-md border text-sm font-medium transition-colors',
                        formData.productType === pt
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                      )}
                    >{pt}</button>
                  ))}
                </div>
              </div>

              {formData.productType === '铝型材' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-500">材质</Label>
                    <Input value={formData.material} onChange={(e) => updateFormField('material', e.target.value)} placeholder="如: 铝" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">米重 (kg/m)</Label>
                    <Input type="number" value={formData.meterWeight} onChange={(e) => updateFormField('meterWeight', e.target.value)} placeholder="kg/m" className="mt-1" />
                  </div>
                </div>
              )}

              {formData.productType === '板材件' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">板材材料</Label>
                      <select value={formData.plateMaterial} onChange={(e) => updateFormField('plateMaterial', e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        {PLATE_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    {formData.plateMaterial?.includes('铝') && (
                      <div>
                        <Label className="text-xs text-gray-500">铝板牌号</Label>
                        <select value={formData.alGrade} onChange={(e) => updateFormField('alGrade', e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                          {AL_GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    )}
                    {!formData.plateMaterial?.includes('铝') && (
                      <div>
                        <Label className="text-xs text-gray-500">不锈钢牌号</Label>
                        <Input value={formData.material} onChange={(e) => updateFormField('material', e.target.value)} placeholder="如: 304" className="mt-1" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">板厚(mm)</Label>
                      <Input type="number" value={formData.thickness} onChange={(e) => updateFormField('thickness', e.target.value)} placeholder="mm" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">排版数量</Label>
                      <Input type="number" value={formData.nestingCount} onChange={(e) => updateFormField('nestingCount', e.target.value)} placeholder="张出几件" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">最大尺寸(mm)</Label>
                      <Input type="number" value={formData.maxDimension} onChange={(e) => updateFormField('maxDimension', e.target.value)} placeholder="mm" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">冲压吨位(T)</Label>
                      <select value={formData.stampingTonnage} onChange={(e) => updateFormField('stampingTonnage', e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        {STAMPING_TONNAGES.map(t => <option key={t} value={t}>{t}T (¥{STAMPING_RATES[t]}/次)</option>)}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">单件体积(mm³)</Label>
                      <Input type="number" value={formData.volume} onChange={(e) => updateFormField('volume', e.target.value)} placeholder="mm³" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">激光切割长(m)</Label>
                      <Input type="number" value={formData.laserCutLength} onChange={(e) => updateFormField('laserCutLength', e.target.value)} placeholder="m/件" className="mt-1" />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">长(mm)</Label>
                  <Input type="number" value={formData.length} onChange={(e) => updateFormField('length', e.target.value)} placeholder="mm" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">宽(mm)</Label>
                  <Input type="number" value={formData.width} onChange={(e) => updateFormField('width', e.target.value)} placeholder="mm" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">高(mm)</Label>
                  <Input type="number" value={formData.height} onChange={(e) => updateFormField('height', e.target.value)} placeholder="mm" className="mt-1" />
                </div>
              </div>

              {/* 加工类型 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-gray-500">加工类型</Label>
                  <button onClick={addProcessRow} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> 添加加工
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.processes.map((proc, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={proc.type} onChange={(e) => updateProcessRow(idx, 'type', e.target.value)} className="flex-1 h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                        {PROCESS_TYPES.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                      </select>
                      <Input value={proc.order} onChange={(e) => updateProcessRow(idx, 'order', e.target.value)} placeholder="工序次" className="w-24" />
                      {formData.processes.length > 1 && (
                        <button onClick={() => removeProcessRow(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">表面处理</Label>
                  <select value={formData.surfaceTreatment} onChange={(e) => updateFormField('surfaceTreatment', e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                    {(formData.productType === '板材件'
                      ? (formData.plateMaterial?.includes('铝') ? PLATE_SURFACE_OPTIONS_AL : PLATE_SURFACE_OPTIONS_OTHER)
                      : SURFACE_OPTIONS
                    ).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">模具费(元)</Label>
                  <Input type="number" value={formData.moldFee} onChange={(e) => updateFormField('moldFee', e.target.value)} placeholder="元" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">最小起订量</Label>
                  <Input type="number" value={formData.minOrderQty} onChange={(e) => updateFormField('minOrderQty', e.target.value)} placeholder="件" className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">单位</Label>
                  <select value={formData.unit} onChange={(e) => updateFormField('unit', e.target.value)} className="mt-1 w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm">
                    <option value="件">件</option><option value="米">米</option><option value="公斤">公斤</option><option value="套">套</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">备注</Label>
                  <Input value={formData.remarks} onChange={(e) => updateFormField('remarks', e.target.value)} placeholder="备注" className="mt-1" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 板材成本分析表 */}
          {formStep === 'analysis' && plateCostAnalysis && (() => {
            const p = plateCostAnalysis;
            const rows = [
              { label: '板材尺寸', value: `${p.sheetLength}×${p.sheetWidth}`, unit: 'mm', formula: '标准板' },
              { label: '板厚', value: p.thickness, unit: 'mm', formula: '' },
              { label: '材料', value: p.plateMaterial, unit: '', formula: `密度${p.density}g/cm³` },
              { label: '材料单价', value: p.materialPricePerKg, unit: '元/kg', formula: p.plateMaterial.includes('铝') ? `铝锭价+牌号加价` : '参考价' },
              { label: '整张板重', value: (p.sheetLength * p.sheetWidth * p.thickness / 1000 * p.density / 1000).toFixed(2), unit: 'kg', formula: '2440×1220×厚×密度' },
              { label: '整张板价', value: p.materialCostPerSheet, unit: '元', formula: '板重×单价' },
              { label: '排版数量', value: p.nestingCount, unit: '件/张', formula: '' },
              { label: '①材料费/件', value: p.materialCostPerPiece, unit: '元', formula: '整张板价÷排版数', highlight: true },
              { label: '─'.repeat(20), value: '', unit: '', formula: '工序费逐级累加(×1.03×1.03)' },
              ...p.processBreakdown.map((proc, i) => ({
                label: `${i+1}. ${proc.name}`,
                value: proc.total,
                unit: '元',
                formula: `累计后: ¥${proc.cumAfter.toFixed(4)}`,
              })),
              { label: '②加工累计', value: p.cumulativeAfterProcesses, unit: '元', formula: '逐级×1.03×1.03', highlight: true },
              { label: '③表面处理', value: p.surfaceCost, unit: '元', formula: p.surfaceTreatmentType || '无' },
              { label: '④报价主体', value: p.quoteMain, unit: '元', formula: '(②+③)×1.05', highlight: true },
              { label: '⑤包装费', value: p.packaging, unit: '元', formula: `${p.weightPerPiece}kg×0.5` },
              { label: '⑥运输费', value: p.transport, unit: '元', formula: `${p.weightPerPiece}kg×0.5` },
              { label: '═══ 总报价/件 ═══', value: p.totalPrice, unit: '元', formula: '④+⑤+⑥', highlight: true },
              { label: '含税价(13%)', value: Math.round(p.totalPrice * 1.13 * 10000) / 10000, unit: '元', formula: '总报价×1.13', highlight: true },
            ];
            if (p.totalMoldCost > 0) {
              rows.push({ label: '模具费', value: p.totalMoldCost, unit: '元', formula: `摊销: ¥${(p.totalMoldCost / (parseInt(formData.minOrderQty) || 100)).toFixed(2)}/件` });
            }
            return (
              <div className="py-2 overflow-x-auto">
                <div className="mb-2 px-3 py-1 bg-orange-50 rounded text-xs text-orange-700">
                  📐 板材报价（总报价 = (加工累计+表面处理)×1.05 + 包装 + 运输）
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-600">项目</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">数值</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">单位</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className={cn('border-t', row.highlight ? 'bg-blue-50 font-semibold' : '', row.label.startsWith('─') ? 'border-dashed' : '')}>
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2">
                          <span className={row.highlight ? 'text-blue-700 text-base' : ''}>
                            {typeof row.value === 'number' ? row.value.toFixed(row.value < 1 ? 4 : 2) : row.value}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{row.unit}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{row.formula}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Step 2: 铝型材成本分析表 */}
          {formStep === 'analysis' && costAnalysis && (
            <div className="py-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">项目</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">数值</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">单位</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">公式</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const a = costAnalysis;
                    const rows = [
                      { label: '铝锭价', value: a.aluminumPrice, unit: '元/吨', formula: '实时获取', editable: true },
                      { label: '毛重', value: a.grossWeight, unit: 'g', formula: '米重(kg/m)×(长度+5)(m)×1000' },
                      { label: '净重', value: a.netWeight, unit: 'g', formula: '米重(kg/m)×长度(m)×1000' },
                      { label: '体积', value: a.volume, unit: 'cm³', formula: '长×宽×高/1000' },
                      { label: '材料成本', value: a.materialCost, unit: '元', formula: '(铝锭价+2000)/1000000×毛重' },
                      { label: '加工费', value: a.processCost, unit: '元', formula: '(材料成本×0.05+0.1)×工序数' },
                      { label: '表面处理', value: a.surfaceCost, unit: '元', formula: '净重×0.002+体积×0.0000003+0.1' },
                      { label: '合计成本', value: a.totalCost, unit: '元', formula: '材料成本+表面处理+加工费', highlight: true },
                      { label: '管理费用', value: a.managementFee, unit: '元', formula: '合计成本×0.1+500/起订量' },
                      { label: '未税价', value: a.priceBeforeTax, unit: '元', formula: '合计成本+管理费用', highlight: true },
                      { label: '含税价', value: a.priceWithTax, unit: '元', formula: '未税价×1.13', highlight: true },
                    ];
                    return rows.map((row) => (
                      <tr key={row.label} className={cn('border-t', row.highlight ? 'bg-blue-50 font-semibold' : '')}>
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2">
                          {row.editable ? (
                            <Input type="number" value={row.value as number} onChange={(e) => {
                              const p = parseFloat(e.target.value) || 0;
                              setAluminumPrice(p);
                              setCostAnalysis(calculateCostAnalysis(formData, p));
                            }} className="w-28 h-8 text-sm" />
                          ) : (
                            <span className={row.highlight ? 'text-blue-700 text-base' : ''}>
                              {typeof row.value === 'number' ? row.value.toFixed(row.value < 1 ? 6 : row.value < 100 ? 4 : 2) : row.value}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{row.unit}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{row.formula}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Step 3: 板材报价单预览 */}
          {formStep === 'quotation' && plateCostAnalysis && (
            <div className="py-2">
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 border border-orange-100">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4 text-orange-600" />
                  板材报价单预览
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">产品编号：</span>{formData.productCode || '-'}</div>
                  <div><span className="text-gray-500">产品名称：</span>{formData.productName || '-'}</div>
                  <div><span className="text-gray-500">板材材料：</span>{plateCostAnalysis.plateMaterial}</div>
                  <div><span className="text-gray-500">板厚：</span>{plateCostAnalysis.thickness}mm</div>
                  <div><span className="text-gray-500">排版数量：</span>{plateCostAnalysis.nestingCount}件/张</div>
                  <div><span className="text-gray-500">表面处理：</span>{plateCostAnalysis.surfaceTreatmentType}</div>
                  <div><span className="text-gray-500">单件重量：</span>{plateCostAnalysis.weightPerPiece}kg</div>
                  <div><span className="text-gray-500">单位：</span>{formData.unit}</div>
                  <div><span className="text-gray-500">加工工序：</span>{plateCostAnalysis.processBreakdown.map(p => p.name).join(' → ')}</div>
                  <div><span className="text-gray-500">最小起订量：</span>{formData.minOrderQty}件</div>
                  <div className="col-span-2 border-t border-orange-200 pt-2 mt-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">材料费/件</span>
                      <span>¥{plateCostAnalysis.materialCostPerPiece.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">加工累计</span>
                      <span>¥{plateCostAnalysis.cumulativeAfterProcesses.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">表面处理</span>
                      <span>¥{plateCostAnalysis.surfaceCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">报价主体(×1.05)</span>
                      <span>¥{plateCostAnalysis.quoteMain.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">包装+运输</span>
                      <span>¥{(plateCostAnalysis.packaging + plateCostAnalysis.transport).toFixed(4)}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-between items-center bg-white rounded p-2 border border-orange-200">
                    <span className="text-gray-600 font-medium">未税单价：</span>
                    <span className="text-blue-700 font-semibold text-lg">¥{plateCostAnalysis.totalPrice.toFixed(4)}</span>
                  </div>
                  <div className="col-span-2 flex justify-between items-center bg-red-50 rounded p-2 border border-red-200">
                    <span className="text-gray-600 font-medium">含税单价(13%)：</span>
                    <span className="text-red-600 font-bold text-xl">¥{(plateCostAnalysis.totalPrice * 1.13).toFixed(4)}</span>
                  </div>
                  {plateCostAnalysis.totalMoldCost > 0 && (
                    <div className="col-span-2 flex justify-between text-sm">
                      <span className="text-gray-500">模具费(一次性)</span>
                      <span>¥{plateCostAnalysis.totalMoldCost.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 铝型材报价单预览 */}
          {formStep === 'quotation' && costAnalysis && (
            <div className="py-2">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  报价单预览
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">产品编号：</span>{formData.productCode || '-'}</div>
                  <div><span className="text-gray-500">产品名称：</span>{formData.productName || '-'}</div>
                  <div><span className="text-gray-500">规格尺寸：</span>{[formData.length, formData.width, formData.height].filter(Boolean).join('×')}mm</div>
                  <div><span className="text-gray-500">材质：</span>{formData.material}</div>
                  <div><span className="text-gray-500">表面处理：</span>{formData.surfaceTreatment}</div>
                  <div><span className="text-gray-500">单位：</span>{formData.unit}</div>
                  <div className="text-blue-700 font-semibold"><span className="text-gray-500 font-normal">未税价：</span>¥{costAnalysis.priceBeforeTax.toFixed(2)}</div>
                  <div className="text-red-600 font-bold text-base"><span className="text-gray-500 font-normal text-sm">含税价：</span>¥{costAnalysis.priceWithTax.toFixed(2)}</div>
                  <div><span className="text-gray-500">最小起订量：</span>{formData.minOrderQty}件</div>
                  <div><span className="text-gray-500">模具费：</span>¥{formData.moldFee || '0'}</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {formStep === 'form' && (
              <>
                <Button variant="outline" onClick={() => setFormOpen(false)}>取消</Button>
                <Button onClick={handleFormSubmit} className="bg-orange-500 hover:bg-orange-600 text-white">
                  计算成本 <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
            {formStep === 'analysis' && (
              <>
                <Button variant="outline" onClick={() => setFormStep('form')}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> 返回修改
                </Button>
                <Button onClick={() => setFormStep('quotation')} className="bg-orange-500 hover:bg-orange-600 text-white">
                  确认并预览 <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            )}
            {formStep === 'quotation' && (
              <>
                <Button variant="outline" onClick={() => setFormStep('analysis')}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> 返回修改
                </Button>
                <Button onClick={handleConfirmAnalysis} className="bg-green-600 hover:bg-green-700 text-white">
                  <Download className="w-4 h-4 mr-1" /> 下载报价单
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}