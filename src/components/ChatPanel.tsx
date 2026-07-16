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
  FileImage,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDxfFile, parseStepOrIgesFile, CadParseResult, CadDiagnostic } from '@/lib/cad-parser';
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
  // 装配体报价结果
  assemblyPricingResult?: AssemblyPricingData | null;
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

// 装配体报价数据接口
interface AssemblyPartData {
  partId: string;
  quantity: number;
  dimensions: number[];
  volume: number;
  weight: number;
  isExtrusion: boolean;
  crossSectionArea: number;
  length: number;
  unitCost: number;
  partTotalCost: number;
  breakdown: Array<{ item: string; calculation: string; cost: number }>;
}

interface AssemblyPricingData {
  productType: 'assembly';
  partsCount: number;
  uniqueParts: AssemblyPartData[];
  partsPricing: AssemblyPartData[];
  totalCost: number;
  aluminumPrice: {
    pricePerTon: number;
    pricePerKg: number;
    source: string;
  };
}

// 装配体BOM报价卡片
function AssemblyPricingCard({ data }: { data: AssemblyPricingData }) {
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  const togglePart = (partId: string) => {
    setExpandedParts(prev => {
      const next = new Set(prev);
      if (next.has(partId)) {
        next.delete(partId);
      } else {
        next.add(partId);
      }
      return next;
    });
  };

  return (
    <div className="mt-3 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200 overflow-hidden shadow-sm">
      {/* 标题 */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔧</span>
            <span className="text-white font-bold text-base">装配体报价</span>
          </div>
          <span className="text-white/80 text-sm">{data.partsCount} 个零件 · {data.uniqueParts.length} 种</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* 零件明细列表 */}
        <div>
          <div className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2">零件明细（BOM）</div>
          <div className="bg-white rounded-lg border border-violet-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-violet-50 border-b border-violet-100">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-violet-600">零件</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-violet-600">数量</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-violet-600">尺寸(mm)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-violet-600">单件价</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-violet-600">小计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-50">
                {data.partsPricing.flatMap((part) => {
                  const isExpanded = expandedParts.has(part.partId);
                  const rows = [
                    <tr
                      key={part.partId}
                      className="hover:bg-violet-50/50 cursor-pointer transition-colors"
                      onClick={() => togglePart(part.partId)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-violet-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                          <span className="font-bold text-violet-700">{part.partId}</span>
                          <span className="text-xs text-gray-400">{part.isExtrusion ? '挤压件' : '板材件'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-medium text-gray-700">×{part.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 text-xs">
                        {part.dimensions.length === 3
                          ? `${part.dimensions[0]}×${part.dimensions[1]}×${part.dimensions[2]}`
                          : `${part.crossSectionArea}mm² L${part.length}mm`}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">¥{part.unitCost.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-violet-700">¥{part.partTotalCost.toFixed(2)}</td>
                    </tr>
                  ];
                  if (isExpanded) {
                    rows.push(
                      <tr key={`${part.partId}-detail`}>
                        <td colSpan={5} className="px-3 py-2 bg-violet-50/30">
                          <div className="text-xs space-y-1 pl-6">
                            {part.breakdown.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-gray-500">
                                <span>{item.item}</span>
                                <span>¥{item.cost.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 总价 */}
        <div className="flex justify-between items-center bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg px-4 py-3 shadow-sm">
          <span className="text-white font-medium">装配体总价（{data.partsCount}件）</span>
          <span className="text-xl font-bold text-white">
            ¥{data.totalCost.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
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
  surfaceTreatment: '无' | '氧化本色' | '氧化黑色' | '喷涂' | '电泳' | '拉丝' | '喷砂' | '磷化' | '镀锌' | '镀镍' | '抛光' | '镀铬';
  drillingHoles?: number;
  tappingHoles?: number;
  unitWeight?: number;
  crossSectionArea?: number;
}

function extractPricingParams(text: string): ExtractedPricingParams | null {
  console.log("[DEBUG] extractPricingParams v2.0 called with:", text);
  // ---- 宽度 / 高度 / 长度 ----
  let outerWidth: number | undefined;
  let outerHeight: number | undefined;
  let length: number | undefined;

  // 模式0: 三维格式 "100*20*3mm" / "100×20×3" (长*宽*高)
  const dim3Match = text.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
  if (dim3Match) {
    length = parseFloat(dim3Match[1]);
    outerWidth = parseFloat(dim3Match[2]);
    outerHeight = parseFloat(dim3Match[3]);
  } else {
    // 模式1: "38.7×21.7mm" / "38.7x21.7" / "38.7X21.7" (两维 W*H)
    const dimMulMatch = text.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
    if (dimMulMatch) {
      outerWidth = parseFloat(dimMulMatch[1]);
      outerHeight = parseFloat(dimMulMatch[2]);
    }
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

  // ---- 长度（如果三维匹配未设置则从文字提取） ----
  // "长100mm" / "长度100" / "L=100mm" / "长：100"
  const lenMatch = text.match(/(?:长(?:度)?|L)\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)?/);
  if (lenMatch) {
    length = parseFloat(lenMatch[1]);
  }

  // ---- 数量 ----
  let quantity: number | undefined;
  // 方法1: "数量5000" / "数量5000件" / "qty 5000"（有前缀的优先匹配）
  const qtyMatch1 = text.match(/(?:数(?:量)?|qty|QTY)\s*[：:=]?\s*(\d+(?:\.\d+)?)/i);
  if (qtyMatch1) {
    quantity = parseFloat(qtyMatch1[1]);
  } else {
    // 方法2: "5000件" / "5000支" / "5000套" / "5000PCS"（不含"个"，避免与"4个R0.5"冲突）
    const qtyMatch2 = text.match(/(\d+(?:\.\d+)?)\s*(?:件|支|套|pcs|PCS)/i);
    if (qtyMatch2) {
      quantity = parseInt(qtyMatch2[1]);
    }
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

// 从Bot回复文本中提取产品参数（用于自动报价）
function extractPricingParamsFromBotReply(text: string): ExtractedPricingParams | null {
  // 检查是否包含产品参数相关内容（Bot回复通常有"参数"、尺寸数值等）
  const hasProductInfo = text.includes('产品参数识别结果') || text.includes('📋') ||
    (/\d+(?:\.\d+)?\s*mm/i.test(text) && /(?:截面|尺寸|型材|铝|产品|编号|数量|重量)/.test(text));
  if (!hasProductInfo) return null;

  // 先尝试简单格式（用户直接输入的参数）
  const simpleResult = extractPricingParams(text);
  if (simpleResult) return simpleResult;

  // ---- Bot冗余格式提取 ----
  // Bot输出格式如：
  // ### 3. 截面尺寸（实心矩形）
  // **参数值**：38.7mm（宽）×21.7mm（高）
  // ### 4. 单根长度
  // **参数值**：100mm
  // ### 5. 订单数量
  // **参数值**：5000件

  let outerWidth: number | undefined;
  let outerHeight: number | undefined;
  let length: number | undefined;
  let quantity: number | undefined;
  let isHollow = false;
  let unitWeight: number | undefined;

  // 1. 截面尺寸：从"截面尺寸"段落提取
  // 匹配 "38.7mm（宽）×21.7mm（高）" 或 "38.7×21.7mm" 或 "宽38.7 高21.7"
  const sectionBlock = text.match(/截面尺寸[\s\S]*?(?=###|$)/);
  if (sectionBlock) {
    const block = sectionBlock[0];
    // "38.7mm（宽）×21.7mm（高）"
    const wxhMatch = block.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[（(]\s*宽\s*[）)]\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[（(]\s*高\s*[）)]/);
    if (wxhMatch) {
      outerWidth = parseFloat(wxhMatch[1]);
      outerHeight = parseFloat(wxhMatch[2]);
    } else {
      // "38.7×21.7mm" 或 "38.7 × 21.7"
      const mulMatch = block.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
      if (mulMatch) {
        outerWidth = parseFloat(mulMatch[1]);
        outerHeight = parseFloat(mulMatch[2]);
      } else {
        // "宽38.7 高21.7"
        const wMatch = block.match(/宽\s*[：:=]?\s*(\d+(?:\.\d+)?)/);
        const hMatch = block.match(/高\s*[：:=]?\s*(\d+(?:\.\d+)?)/);
        if (wMatch) outerWidth = parseFloat(wMatch[1]);
        if (hMatch) outerHeight = parseFloat(hMatch[1]);
      }
    }
    if (/实心|无内腔/.test(block)) isHollow = false;
    if (/空心|有内腔|中空/.test(block)) isHollow = true;
  }

  // Fallback: 从全文找 宽×高
  if (outerWidth === undefined) {
    const globalMul = text.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[（(]\s*宽\s*[）)]\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[（(]\s*高\s*[）)]/);
    if (globalMul) {
      outerWidth = parseFloat(globalMul[1]);
      outerHeight = parseFloat(globalMul[2]);
    }
  }

  // 2. 长度：从"长度"段落提取
  const lengthBlock = text.match(/(?:单根)?长度[\s\S]*?(?=###|$)/);
  if (lengthBlock) {
    const lenMatch = lengthBlock[0].match(/(\d+(?:\.\d+)?)\s*(?:mm|毫米)/);
    if (lenMatch) length = parseFloat(lenMatch[1]);
  }
  // Fallback
  if (length === undefined) {
    const lenFallback = text.match(/(?:长(?:度)?|L)\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)/);
    if (lenFallback) length = parseFloat(lenFallback[1]);
  }

  // 3. 数量：从"数量"段落提取
  const qtyBlock = text.match(/(?:订单)?数量[\s\S]*?(?=###|$)/);
  if (qtyBlock) {
    const qtyMatch = qtyBlock[0].match(/(\d+(?:\.\d+)?)/);
    if (qtyMatch) quantity = parseInt(qtyMatch[1]);
  }
  // Fallback
  if (quantity === undefined) {
    const qtyFallback = text.match(/(\d+(?:\.\d+)?)\s*(?:件|支|套|pcs|PCS)/i);
    if (qtyFallback) quantity = parseInt(qtyFallback[1]);
  }

  // 4. 净重/理论重量
  const weightBlock = text.match(/(?:理论重量|净重|单根.*?重量)[\s\S]*?(?=###|$)/);
  if (weightBlock) {
    // "227g = 0.227kg" 或 "0.227kg" 或 "227g"
    const kgMatch = weightBlock[0].match(/(\d+(?:\.\d+)?)\s*kg/);
    const gMatch = weightBlock[0].match(/(\d+(?:\.\d+)?)\s*g(?!B)/);
    if (kgMatch) {
      unitWeight = parseFloat(kgMatch[1]);
    } else if (gMatch) {
      unitWeight = parseFloat(gMatch[1]) / 1000;
    }
  }

  // 5. 表面处理
  let surfaceTreatment: ExtractedPricingParams['surfaceTreatment'] = '无';
  const surfaceBlock = text.match(/表面处理[\s\S]*?(?=###|$)/);
  const surfaceText = surfaceBlock ? surfaceBlock[0] : text;
  if (/氧化本色|本色氧化/.test(surfaceText)) {
    surfaceTreatment = '氧化本色';
  } else if (/氧化黑/.test(surfaceText)) {
    surfaceTreatment = '氧化黑色';
  } else if (/喷涂|喷粉|粉体/.test(surfaceText)) {
    surfaceTreatment = '喷涂';
  } else if (/电泳/.test(surfaceText)) {
    surfaceTreatment = '电泳';
  } else if (/拉丝/.test(surfaceText)) {
    surfaceTreatment = '拉丝';
  } else if (/喷砂/.test(surfaceText)) {
    surfaceTreatment = '喷砂';
  } else if (/抛光/.test(surfaceText)) {
    surfaceTreatment = '抛光';
  } else if (/镀[锌镍铬]/.test(surfaceText)) {
    surfaceTreatment = /镀[锌镍]/.test(surfaceText) ? (/[镍]/.test(surfaceText) ? '镀镍' : '镀锌') : '镀铬';
  } else if (/磷化/.test(surfaceText)) {
    surfaceTreatment = '磷化';
  } else if (/氧化(?!黑)/.test(surfaceText)) {
    surfaceTreatment = '氧化本色';
  }

  // 6. 截面面积（Bot有时会直接给出）
  let crossSectionArea: number | undefined;
  const areaMatch = text.match(/截面面积\s*[：:=]?\s*(\d+(?:\.\d+)?)\s*mm/);
  if (areaMatch) {
    crossSectionArea = parseFloat(areaMatch[1]);
  }

  // 必要参数校验
  if (outerWidth === undefined || outerHeight === undefined || length === undefined || quantity === undefined) {
    return null;
  }

  return {
    productType: 'extrusion',
    outerWidth,
    outerHeight,
    isHollow,
    length,
    quantity,
    surfaceTreatment,
    unitWeight,
    crossSectionArea,
  };
}

function MessageContent({ message }: { message: Message }) {
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
  
  // 图片识别结果，显示保存按钮
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
  
  // 如果是assistant消息且有关联的报价结果，附加显示
  if (message.role === 'assistant' && (message.pricingResult || message.pricingLoading || message.pricingError || message.assemblyPricingResult)) {
    return (
      <div>
        <div className="whitespace-pre-wrap">{cleanContent}</div>
        {message.pricingLoading && (
          <div className="mt-3 flex items-center gap-2 bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-200">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span className="text-sm text-emerald-700">正在从识别的参数计算报价...</span>
          </div>
        )}
        {message.pricingError && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 rounded-lg px-4 py-3 border border-red-200">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">自动报价失败：{message.pricingError}</span>
          </div>
        )}
        {message.pricingResult && <PricingResultCard data={message.pricingResult} />}
        {message.assemblyPricingResult && <AssemblyPricingCard data={message.assemblyPricingResult} />}
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


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
            // CAD文件：优先后端解析STEP，否则客户端解析
            const format = isStep ? 'step' : isIges ? 'iges' : 'dxf';
            let parsedOk = false;
            
            // STEP 文件：尝试后端精确解析
            if (isStep) {
              try {
                const fd = new FormData();
                fd.append('file', extractedFile);
                fd.append('quantity', '1');
                fd.append('surfaceTreatment', '氧化本色');
                const resp = await fetch('/api/pricing/step-quote', { method: 'POST', body: fd });
                const stepData = await resp.json();
                if (stepData.success && stepData.data) {
                  if (stepData.data.isAssembly) {
                    // 装配体模式
                    const pr = stepData.data.parseResult;
                    const pricing = stepData.data.pricingResult;
                    let cadText = `\n--- ${baseName} (STEP装配体解析) ---\n零件总数：${pr.partsCount}个（${pr.uniqueParts.length}种）\n总体积(mm³)：${pr.totalVolume}\n总重量(g)：${pr.totalWeight}\n`;
                    for (const part of pr.uniqueParts) {
                      cadText += `零件${part.id}（×${part.quantity}）：${part.dimensions[0]}×${part.dimensions[1]}×${part.dimensions[2]}mm，截面${part.crossSectionArea}mm²，长度${part.length}mm\n`;
                    }
                    cadText += `加工工艺：铝挤压+焊接装配\n表面处理：氧化本色\n`;
                    for (const part of pricing.partsPricing) {
                      cadText += `零件${part.partId}报价：¥${part.unitCost.toFixed(2)}/件 ×${part.quantity} = ¥${part.partTotalCost.toFixed(2)}\n`;
                    }
                    cadText += `装配体总价：¥${pricing.totalCost.toFixed(2)}\n`;
                    allExtractedTexts.push(cadText);
                    fileSummaries.push(`🔧 ${baseName} (装配体${pr.partsCount}件)`);
                  } else {
                    const pr = stepData.data.parseResult;
                    const ext = pr.extrusion;
                    const cadText = `\n--- ${baseName} (STEP精确解析) ---\n材质：铝合金 (${pr.weight.material})\n产品类型：${ext.isExtrusion ? '铝挤压型材' : '铝板/块'}\n包围盒：${pr.boundingBox.x}×${pr.boundingBox.y}×${pr.boundingBox.z} mm\n体积(mm³)：${pr.volume}\n表面积(mm²)：${pr.surfaceArea}\n重量(g)：${pr.weight.grams}\n面数/边数：${pr.topology.faceCount}/${pr.topology.edgeCount}\n米重(kg/m)：${ext.weightPerMeter}\n截面尺寸(mm)：${ext.crossWidth}×${ext.crossHeight}\n截面积(mm²)：${ext.crossSectionArea}\n长度(mm)：${ext.length}\n是否空心：${ext.isHollow ? '是' : '否'}\n加工工艺：铝挤压\n表面处理：氧化本色\n`;
                    allExtractedTexts.push(cadText);
                    fileSummaries.push(`📐 ${baseName} (STEP精确解析)`);
                  }
                  parsedOk = true;
                }
              } catch {
                // 降级到客户端解析
              }
            }
            
            if (!parsedOk) {
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
      // ===== STEP 文件：优先使用后端精确解析 =====
      const isStepFile = format === 'step';
      let backendParseSuccess = false;
      
      if (isStepFile) {
        try {
          setStatusMessage('正在使用后端引擎精确解析 STEP 文件...');
          const fd = new FormData();
          fd.append('file', file);
          fd.append('quantity', '1');
          fd.append('surfaceTreatment', '氧化本色');
          
          const resp = await fetch('/api/pricing/step-quote', {
            method: 'POST',
            body: fd,
          });
          const data = await resp.json();
          
          if (data.success && data.data) {
            backendParseSuccess = true;
            const { isAssembly, parseResult, pricingResult } = data.data;
            
            // ===== 装配体模式 =====
            if (isAssembly && parseResult.assembly) {
              let cadContent = `📐 STEP 装配体解析完成！\n\n`;
              cadContent += `**文件名称：** ${file.name}\n`;
              cadContent += `**类型：** 装配体（挤压型材切割+焊接）\n\n`;
              cadContent += `📏 **总体参数**\n`;
              cadContent += `- 零件总数：${parseResult.partsCount} 个\n`;
              cadContent += `- 去重后：${parseResult.uniqueParts.length} 种零件\n`;
              cadContent += `- 总体积：${parseResult.totalVolume.toLocaleString()} mm³\n`;
              cadContent += `- 总重量：${parseResult.totalWeight} g\n\n`;
              
              cadContent += `🔧 **零件明细**\n`;
              for (const part of parseResult.uniqueParts) {
                const dims = part.dimensions;
                cadContent += `- **零件${part.id}**（×${part.quantity}）：${dims[0]}×${dims[1]}×${dims[2]} mm`;
                cadContent += `，截面${part.crossSectionArea}mm²，长度${part.length}mm`;
                cadContent += `，重量${part.weight}g\n`;
              }
              cadContent += `\n`;
              
              cadContent += `💰 **装配体报价**\n`;
              for (const part of pricingResult.partsPricing) {
                cadContent += `- 零件${part.partId}（×${part.quantity}）：¥${part.unitCost.toFixed(2)}/件 → 小计 ¥${part.partTotalCost.toFixed(2)}\n`;
              }
              cadContent += `- **装配体总价：¥${pricingResult.totalCost.toFixed(2)}**\n`;
              
              const assistantMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: cadContent,
                timestamp: new Date(),
                assemblyPricingResult: pricingResult as AssemblyPricingData,
              };
              setMessages(prev => [...prev, assistantMsg]);
              
              setStatusMessage(null);
              setIsLoading(false);
              return;
            }
            
            // ===== 单件模式（原有逻辑）=====
            const ext = parseResult.extrusion;
            
            let cadContent = `📐 STEP 文件精确解析完成！\n\n`;
            cadContent += `**文件名称：** ${file.name}\n`;
            cadContent += `**产品类型：** ${ext.isExtrusion ? '铝挤压型材' : '铝板/块'}\n\n`;
            cadContent += `📏 **几何参数**\n`;
            cadContent += `- 包围盒尺寸：${parseResult.boundingBox.x} × ${parseResult.boundingBox.y} × ${parseResult.boundingBox.z} mm\n`;
            cadContent += `- 体积：${parseResult.volume.toLocaleString()} mm³\n`;
            cadContent += `- 表面积：${parseResult.surfaceArea.toLocaleString()} mm²\n`;
            cadContent += `- 面数量：${parseResult.topology.faceCount}，边数量：${parseResult.topology.edgeCount}\n`;
            cadContent += `- 重量：${parseResult.weight.grams} g（${parseResult.weight.material}，密度 ${parseResult.weight.density} g/cm³）\n\n`;
            
            if (ext.isExtrusion) {
              cadContent += `🔧 **挤压件参数**\n`;
              cadContent += `- 挤压方向：${ext.axis?.toUpperCase()} 轴\n`;
              cadContent += `- 挤压长度：${ext.length} mm\n`;
              cadContent += `- 截面尺寸：${ext.crossWidth} × ${ext.crossHeight} mm\n`;
              cadContent += `- 截面面积：${ext.crossSectionArea} mm²\n`;
              cadContent += `- 米重：${ext.weightPerMeter} kg/m\n`;
              cadContent += `- 是否空心：${ext.isHollow ? '是' : '否'}\n`;
              cadContent += `- 截面复杂度：${ext.complexity}\n\n`;
            }
            
            cadContent += `💰 **自动报价结果**\n`;
            cadContent += `- 单件成本：¥${pricingResult.unitCost.toFixed(2)}\n`;
            cadContent += `- 总价(1件)：¥${pricingResult.totalCost.toFixed(2)}\n\n`;
            
            const assistantMsg: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: cadContent,
              timestamp: new Date(),
              pricingResult: pricingResult,
            };
            setMessages(prev => [...prev, assistantMsg]);
            
            setCadResult({
              success: true,
              format: 'step',
              weightPerMeter: ext.weightPerMeter,
              width: ext.crossWidth,
              height: ext.crossHeight,
              length: ext.length,
              crossSectionArea: ext.crossSectionArea,
              volume: parseResult.volume,
              meshCount: parseResult.topology.faceCount,
            });
            
            setStatusMessage(null);
            setIsLoading(false);
            return;
          }
        } catch (backendErr) {
          console.warn('[CAD] 后端STEP解析失败，降级到客户端解析:', backendErr);
          // 继续降级到客户端解析
        }
      }
      
      // ===== 降级：客户端文本解析（DXF / IGES / STEP fallback）=====
      if (!backendParseSuccess) {
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
          let cadContent = `📐 ${result.format.toUpperCase()}文件解析成功！\n\n`;
          cadContent += `【产品参数开始】\n`;
          cadContent += `材质：铝合金\n`;
          cadContent += `米重(kg/m)：${result.weightPerMeter}\n`;
          if (result.width > 0) cadContent += `宽度(mm)：${result.width}\n`;
          if (result.height > 0) cadContent += `高度(mm)：${result.height}\n`;
          if (result.length > 0) cadContent += `长度(mm)：${result.length}\n`;
          cadContent += `加工工艺：铝挤压\n`;
          cadContent += `表面处理：无\n`;
          cadContent += `【产品参数结束】\n\n`;
          cadContent += `截面积：${result.crossSectionArea} mm²\n`;
          if (result.volume) cadContent += `体积：${result.volume} mm³\n`;
          cadContent += `实体数量：${result.meshCount || 0}\n`;
          if (result.entityNames && result.entityNames.length > 0) {
            cadContent += `实体名称：${result.entityNames.join(', ')}\n`;
          }
          if (result.parts && result.parts.length > 1) {
            cadContent += `\n--- 各部件明细 ---\n`;
            for (const part of result.parts) {
              cadContent += `· ${part.name}：截面积${part.crossSectionArea}mm²，米重${part.weightPerMeter}kg/m\n`;
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

          // ===== 客户端解析成功后，自动调用报价API =====
          if (isStepFile || format === 'dxf') {
            try {
              const pricingParams = {
                productType: 'extrusion' as const,
                outerWidth: result.width,
                outerHeight: result.height,
                length: result.length || 1000,
                quantity: 1,
                isHollow: false,
                surfaceTreatment: '氧化本色' as const,
                sectionComplexity: 'simple' as const,
              };
              
              const pricingRes = await fetch('/api/pricing/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pricingParams),
              });
              const pricingData = await pricingRes.json();
              
              if (pricingData.success && pricingData.data) {
                // 在上一条消息后追加报价结果卡片
                setMessages(prev => {
                  const msgs = [...prev];
                  const lastMsg = msgs[msgs.length - 1];
                  if (lastMsg && lastMsg.role === 'assistant') {
                    msgs[msgs.length - 1] = {
                      ...lastMsg,
                      pricingResult: pricingData.data,
                    };
                  }
                  return msgs;
                });
              }
            } catch (pricingErr) {
              console.warn('[CAD] 自动报价失败:', pricingErr);
            }
          }
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
    
    
    // CAD文件优先判断，避免浏览器误识别MIME类型走错路径
    if (isZip) {
      handleZipUpload(file);
    } else if (isCad) {
      const format = isStep ? 'step' : isIges ? 'iges' : 'dxf';
      handleCadUpload(file, format);
    } else if (isImage) {
      handleImageUpload(file);
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

      // ===== SSE流结束后，检查Bot回复中是否包含产品参数，自动报价 =====
      if (assistantContent) {
        const botPricingParams = extractPricingParamsFromBotReply(assistantContent);
        if (botPricingParams) {
          // 标记assistant消息为加载中
          setMessages((prev) => prev.map((m) =>
            m.id === assistantMessageId ? { ...m, pricingLoading: true } : m
          ));
          try {
            const pricingRes = await fetch('/api/pricing/calculate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(botPricingParams),
            });
            const pricingData = await pricingRes.json();
            if (pricingData.success && pricingData.data) {
              setMessages((prev) => prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, pricingLoading: false, pricingResult: pricingData.data }
                  : m
              ));
            } else {
              setMessages((prev) => prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, pricingLoading: false, pricingError: pricingData.error || '报价计算失败' }
                  : m
              ));
            }
          } catch (pricingErr) {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, pricingLoading: false, pricingError: pricingErr instanceof Error ? pricingErr.message : '请求失败' }
                : m
            ));
          }
        }
      }
      // ===== Bot回复自动报价结束 =====
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
                <MessageContent message={message} />
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

        </div>
      </div>

    </div>
  );
}// Deployment trigger: 1784160033
