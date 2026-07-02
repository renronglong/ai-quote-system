import { NextRequest } from 'next/server';

// ============ 报价计算引擎 /api/quote ============

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://br-lush-teal-829ebb2c.supabase2.aidap-global.cn-beijing.volces.com';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNjA2MjY2ODUsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.bQyLDE94ExM0a31w640N0GPzg0ppRJu_-z12vR1RLhY';

// ============ 数据查询 ============

async function supabaseSelect(table: string, query: string = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table} query failed: ${res.status}`);
  return res.json();
}

// 查材料价格
async function getMaterialPrice(category: string, grade: string) {
  const data = await supabaseSelect('material_prices', `?category=eq.${encodeURIComponent(category)}&grade=eq.${encodeURIComponent(grade)}&is_active=eq.true&limit=1`);
  return data[0] || null;
}

// 查工艺费率
async function getProcessRates(processType: string) {
  return supabaseSelect('process_rates', `?process_type=eq.${encodeURIComponent(processType)}&is_active=eq.true`);
}

// 查表面处理费
async function getSurfacePrice(treatmentType: string, itemName: string) {
  const data = await supabaseSelect('surface_treatment_prices', `?treatment_type=eq.${encodeURIComponent(treatmentType)}&item_name=eq.${encodeURIComponent(itemName)}&is_active=eq.true&limit=1`);
  return data[0] || null;
}

// 查报价配置
async function getConfig(key: string) {
  const data = await supabaseSelect('quotation_config', `?config_key=eq.${key}&is_active=eq.true&limit=1`);
  return data[0]?.config_value || null;
}

// 查市场实时价
async function getMarketPrice(material: string): Promise<number | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://www.baojia.bond'}/api/market-price?material=${encodeURIComponent(material)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.prices?.length > 0) {
      // 取第一个有价格的数据，转成元/kg（市场价是元/吨）
      const price = parseInt(data.prices[0].price);
      return isNaN(price) ? null : price / 1000; // 元/吨 → 元/kg
    }
  } catch {}
  return null;
}

// ============ 报价计算 ============

interface QuoteInput {
  material: string;           // 材质大类：铝型材/冷轧板/不锈钢/压铸铝/塑胶
  grade: string;              // 牌号：6063-T5, 304, ADC12 等
  process: string;            // 加工工艺：铝挤压/冲压/铝压铸/注塑/CNC加工/车加工/塑料挤出
  surface_treatment?: string; // 表面处理：氧化-本色阳极氧化/喷涂-粉末喷涂 等（格式：类型-项目名）
  weight?: number;            // 零件净重(kg)
  length?: number;            // 长度(mm)，挤出用
  width?: number;             // 宽度(mm)
  height?: number;            // 高度(mm)
  quantity: number;           // 订单数量
  mold_cost?: number;         // 模具费用(元)，不填则用默认值
  surface_area?: number;      // 表面积(dm²)，表面处理用
  cnc_hours?: number;         // CNC加工工时(h)
  cnc_type?: string;          // CNC类型：三轴/四轴/五轴
  precision_level?: string;   // 精度：普通/精密/高精密
  is_urgent?: boolean;        // 是否加急
  urgent_days?: number;       // 加急交付天数
  notes?: string;             // 备注
}

interface QuoteBreakdown {
  item: string;
  calculation: string;
  amount: number;
}

interface QuoteResult {
  success: boolean;
  input: QuoteInput;
  breakdown: QuoteBreakdown[];
  subtotal: number;
  management_fee: number;
  profit: number;
  unit_price_ex_tax: number;
  unit_price_in_tax: number;
  total_ex_tax: number;
  total_in_tax: number;
  mold_amortize_per_unit: number;
  market_price_used: boolean;
  warnings: string[];
}

function num(val: any, fallback: number = 0): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function getBatchCoefficient(quantity: number, config: any[]): number {
  if (!config || !Array.isArray(config)) return 1.0;
  for (const tier of config) {
    if (tier.range === '5000+' && quantity >= 5000) return tier.coefficient;
    const [low, high] = tier.range.replace('+', '').split('-').map(Number);
    if (quantity >= low && quantity <= (high || Infinity)) return tier.coefficient;
  }
  return 1.0;
}

function getPrecisionSurcharge(level: string, config: any[]): number {
  if (!config || !Array.isArray(config)) return 0;
  const item = config.find((c: any) => c.label === level);
  return item ? item.rate : 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as QuoteInput;
    const { material, grade, process, quantity } = body;

    // 基础校验
    if (!material || !grade || !process || !quantity) {
      return Response.json({
        success: false,
        error: '缺少必填参数',
        required: ['material', 'grade', 'process', 'quantity'],
        optional: ['weight', 'surface_treatment', 'surface_area', 'mold_cost', 'cnc_hours', 'precision_level'],
      });
    }

    const warnings: string[] = [];

    // 1. 查材料价格
    const matPrice = await getMaterialPrice(material, grade);
    if (!matPrice) {
      return Response.json({ success: false, error: `未找到材料价格: ${material} ${grade}` });
    }

    // 尝试获取市场实时价（元/kg）
    let materialUnitPrice = num(matPrice.price_mid);
    let marketPriceUsed = false;
    const marketPrice = await getMarketPrice(material);
    if (marketPrice && marketPrice > 0) {
      materialUnitPrice = marketPrice;
      marketPriceUsed = true;
    } else {
      warnings.push('市场实时价获取失败，使用规则参数表参考价');
    }

    // 2. 查工艺费率
    const processRates = await getProcessRates(process);
    const rateMap: Record<string, any> = {};
    for (const r of processRates) {
      rateMap[r.item_name] = r;
    }

    // 3. 查报价配置
    const [lossRateConfig, mgmtFeeConfig, profitConfig, vatConfig, batchConfig, precisionConfig, urgentConfig] = await Promise.all([
      getConfig('loss_rate'),
      getConfig('management_fee'),
      getConfig('profit_rate'),
      getConfig('vat_rate'),
      getConfig('batch_discount'),
      getConfig('precision_surcharge'),
      getConfig('urgent_surcharge'),
    ]);

    const lossRate = num(lossRateConfig?.default, 5) / 100;
    const mgmtFeeRate = num(mgmtFeeConfig?.default, 10) / 100;
    const profitRate = num(profitConfig?.default, 15) / 100;
    const vatRate = num(vatConfig?.rate, 13) / 100;

    // ============ 计算各项费用 ============
    const breakdown: QuoteBreakdown[] = [];

    // 2.1 材料费
    let partWeight = num(body.weight);
    if (partWeight <= 0 && body.length && body.width && body.height) {
      // 估算重量 = 体积 × 密度（cm³ → kg）
      const volumeCm3 = (num(body.length) / 10) * (num(body.width) / 10) * (num(body.height) / 10);
      partWeight = volumeCm3 * num(matPrice.density, 2.7) / 1000;
      warnings.push(`重量估算: ${partWeight.toFixed(3)}kg (基于尺寸计算)`);
    }
    if (partWeight <= 0) {
      return Response.json({ success: false, error: '请提供零件重量(weight)或尺寸(length/width/height)' });
    }

    const materialCost = partWeight * materialUnitPrice * (1 + lossRate);
    breakdown.push({
      item: '材料费',
      calculation: `${partWeight.toFixed(3)}kg × ¥${materialUnitPrice.toFixed(2)}/kg × (1+${(lossRate*100).toFixed(0)}%损耗)`,
      amount: Math.round(materialCost * 100) / 100,
    });

    // 2.2 加工费
    let processCost = 0;

    if (process === '铝挤压') {
      const extrusionFee = num(rateMap['挤压加工费']?.price_mid, 4000) / 1000; // 元/吨→元/kg
      const processCostPerKg = partWeight * extrusionFee;
      processCost += processCostPerKg;
      breakdown.push({
        item: '挤压加工费',
        calculation: `${partWeight.toFixed(3)}kg × ¥${extrusionFee.toFixed(2)}/kg`,
        amount: Math.round(processCostPerKg * 100) / 100,
      });
    } else if (process === '冲压') {
      const stampingFee = num(rateMap['单件加工费']?.price_mid, 2);
      processCost += stampingFee;
      breakdown.push({
        item: '冲压加工费',
        calculation: `¥${stampingFee.toFixed(2)}/件`,
        amount: stampingFee,
      });
      if (quantity <= 500) {
        const startupFee = num(rateMap['开机费']?.price_mid, 300);
        processCost += startupFee / quantity;
        breakdown.push({
          item: '开机费摊销',
          calculation: `¥${startupFee} ÷ ${quantity}件`,
          amount: Math.round(startupFee / quantity * 100) / 100,
        });
      }
    } else if (process === '铝压铸') {
      const dieCastFee = num(rateMap['单件加工费']?.price_mid, 1);
      processCost += dieCastFee;
      breakdown.push({
        item: '压铸加工费',
        calculation: `¥${dieCastFee.toFixed(2)}/件`,
        amount: dieCastFee,
      });
    } else if (process === '注塑') {
      const injectionFee = num(rateMap['单件加工费']?.price_mid, 1);
      processCost += injectionFee;
      breakdown.push({
        item: '注塑加工费',
        calculation: `¥${injectionFee.toFixed(2)}/件`,
        amount: injectionFee,
      });
    } else if (process === 'CNC加工') {
      const cncTypeMap: Record<string, string> = { '三轴': '三轴CNC费率', '四轴': '四轴CNC费率', '五轴': '五轴CNC费率' };
      const rateKey = cncTypeMap[body.cnc_type || '三轴'] || '三轴CNC费率';
      const hourlyRate = num(rateMap[rateKey]?.price_mid, 110);
      const hours = num(body.cnc_hours, 1);
      const cncCost = hourlyRate * hours;
      processCost += cncCost;
      breakdown.push({
        item: `CNC加工费(${body.cnc_type || '三轴'})`,
        calculation: `¥${hourlyRate}/h × ${hours}h`,
        amount: Math.round(cncCost * 100) / 100,
      });
      // 编程准备费
      const progFee = num(rateMap['编程准备费-中等']?.price_mid, 350);
      const progAmortize = progFee / quantity;
      processCost += progAmortize;
      breakdown.push({
        item: '编程准备费摊销',
        calculation: `¥${progFee} ÷ ${quantity}件`,
        amount: Math.round(progAmortize * 100) / 100,
      });
      // 刀具损耗
      const toolWearKey = material.includes('铝') ? '刀具损耗-铝合金' : '刀具损耗-不锈钢';
      const toolWearRate = num(rateMap[toolWearKey]?.price_mid, 6) / 100;
      const toolCost = materialCost * toolWearRate;
      processCost += toolCost;
      breakdown.push({
        item: '刀具损耗',
        calculation: `材料费 ¥${materialCost.toFixed(2)} × ${num(rateMap[toolWearKey]?.price_mid, 6)}%`,
        amount: Math.round(toolCost * 100) / 100,
      });
    } else if (process === '车加工') {
      const rateKey = '数控车床费率';
      const hourlyRate = num(rateMap[rateKey]?.price_mid, 75);
      const hours = num(body.cnc_hours, 0.5);
      const latheCost = hourlyRate * hours;
      processCost += latheCost;
      breakdown.push({
        item: '车加工费',
        calculation: `¥${hourlyRate}/h × ${hours}h`,
        amount: Math.round(latheCost * 100) / 100,
      });
    } else if (process === '塑料挤出') {
      const extrusionFee = num(rateMap['挤出加工费']?.price_mid, 1.5);
      const len = num(body.length, 1000) / 1000; // mm → m
      processCost += extrusionFee * len;
      breakdown.push({
        item: '挤出加工费',
        calculation: `¥${extrusionFee.toFixed(2)}/m × ${len.toFixed(2)}m`,
        amount: Math.round(extrusionFee * len * 100) / 100,
      });
    }

    // 2.3 表面处理费
    let surfaceCost = 0;
    if (body.surface_treatment) {
      const [stType, stName] = body.surface_treatment.split('-');
      const stPrice = await getSurfacePrice(stType, stName);
      if (stPrice) {
        const area = num(body.surface_area, 10); // 默认10dm²
        if (stPrice.unit.includes('dm') || stPrice.unit.includes('㎡')) {
          // 按面积计价
          const areaM2 = stPrice.unit.includes('dm') ? area / 100 : area; // dm²→㎡
          surfaceCost = num(stPrice.price_mid) * (stPrice.unit.includes('dm') ? area : areaM2);
          breakdown.push({
            item: `表面处理-${stName}`,
            calculation: `¥${num(stPrice.price_mid)}/${stPrice.unit} × ${stPrice.unit.includes('dm') ? area : areaM2.toFixed(2)}${stPrice.unit.includes('dm') ? 'dm²' : '㎡'}`,
            amount: Math.round(surfaceCost * 100) / 100,
          });
        } else {
          // 按件计价
          surfaceCost = num(stPrice.price_mid);
          breakdown.push({
            item: `表面处理-${stName}`,
            calculation: `¥${num(stPrice.price_mid)}/件`,
            amount: surfaceCost,
          });
        }
      } else {
        warnings.push(`未找到表面处理价格: ${body.surface_treatment}`);
      }
    }

    // 2.4 模具摊销
    let moldAmortize = 0;
    if (body.mold_cost && body.mold_cost > 0) {
      moldAmortize = body.mold_cost / quantity;
      breakdown.push({
        item: '模具摊销',
        calculation: `¥${body.mold_cost.toLocaleString()} ÷ ${quantity.toLocaleString()}件`,
        amount: Math.round(moldAmortize * 100) / 100,
      });
    } else if (process === '铝压铸' || process === '注塑' || process === '冲压') {
      // 自动估算模具费
      let defaultMoldCost = 0;
      if (process === '铝压铸') defaultMoldCost = num(rateMap['简单压铸模']?.price_mid, 30000);
      else if (process === '注塑') defaultMoldCost = num(rateMap['中等钢模P20']?.price_mid, 18000);
      else if (process === '冲压') defaultMoldCost = num(rateMap['简单冲压模']?.price_mid, 25000);
      
      if (defaultMoldCost > 0) {
        moldAmortize = defaultMoldCost / quantity;
        warnings.push(`模具费未提供，自动估算: ¥${defaultMoldCost.toLocaleString()}`);
        breakdown.push({
          item: '模具摊销(估算)',
          calculation: `¥${defaultMoldCost.toLocaleString()} ÷ ${quantity.toLocaleString()}件`,
          amount: Math.round(moldAmortize * 100) / 100,
        });
      }
    }

    // 2.5 小计
    const subtotal = materialCost + processCost + surfaceCost + moldAmortize;

    // 2.6 管销费
    const managementFee = subtotal * mgmtFeeRate;
    breakdown.push({
      item: '管销费',
      calculation: `小计 ¥${subtotal.toFixed(2)} × ${(mgmtFeeRate*100).toFixed(0)}%`,
      amount: Math.round(managementFee * 100) / 100,
    });

    // 2.7 利润
    const beforeProfit = subtotal + managementFee;
    const profit = beforeProfit * profitRate;
    breakdown.push({
      item: '利润',
      calculation: `(小计+管销) ¥${beforeProfit.toFixed(2)} × ${(profitRate*100).toFixed(0)}%`,
      amount: Math.round(profit * 100) / 100,
    });

    // 2.8 单价（不含税）
    let unitPriceExTax = beforeProfit + profit;

    // 2.9 批量折扣
    const batchCoeff = getBatchCoefficient(quantity, batchConfig);
    if (batchCoeff !== 1.0) {
      const original = unitPriceExTax;
      unitPriceExTax = unitPriceExTax * batchCoeff;
      breakdown.push({
        item: `批量折扣(×${batchCoeff})`,
        calculation: `¥${original.toFixed(2)} × ${batchCoeff}`,
        amount: Math.round((unitPriceExTax - original) * 100) / 100,
      });
    }

    // 2.10 精度加价
    if (body.precision_level && body.precision_level !== '普通') {
      const precSurcharge = getPrecisionSurcharge(body.precision_level, precisionConfig);
      if (precSurcharge > 0) {
        const addAmount = unitPriceExTax * precSurcharge / 100;
        unitPriceExTax += addAmount;
        breakdown.push({
          item: `精度加价(${body.precision_level} +${precSurcharge}%)`,
          calculation: `¥${(unitPriceExTax - addAmount).toFixed(2)} × ${precSurcharge}%`,
          amount: Math.round(addAmount * 100) / 100,
        });
      }
    }

    // 2.11 加急加价
    if (body.is_urgent && urgentConfig) {
      const days = body.urgent_days || 5;
      let urgentRate = 0;
      if (days <= 3) urgentRate = num(urgentConfig['3day'], 35);
      else if (days <= 5) urgentRate = num(urgentConfig['5day'], 20);
      if (urgentRate > 0) {
        const addAmount = unitPriceExTax * urgentRate / 100;
        unitPriceExTax += addAmount;
        breakdown.push({
          item: `加急加价(${days}天交付 +${urgentRate}%)`,
          calculation: `¥${(unitPriceExTax - addAmount).toFixed(2)} × ${urgentRate}%`,
          amount: Math.round(addAmount * 100) / 100,
        });
      }
    }

    // 含税单价
    const unitPriceInTax = unitPriceExTax * (1 + vatRate);

    // 总价
    const totalExTax = unitPriceExTax * quantity;
    const totalInTax = unitPriceInTax * quantity;

    // 汇总
    breakdown.push({
      item: '═══ 合计 ═══',
      calculation: '',
      amount: Math.round(unitPriceExTax * 100) / 100,
    });

    const result: QuoteResult = {
      success: true,
      input: body,
      breakdown,
      subtotal: Math.round(subtotal * 100) / 100,
      management_fee: Math.round(managementFee * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      unit_price_ex_tax: Math.round(unitPriceExTax * 100) / 100,
      unit_price_in_tax: Math.round(unitPriceInTax * 100) / 100,
      total_ex_tax: Math.round(totalExTax * 100) / 100,
      total_in_tax: Math.round(totalInTax * 100) / 100,
      mold_amortize_per_unit: Math.round(moldAmortize * 100) / 100,
      market_price_used: marketPriceUsed,
      warnings,
    };

    return Response.json(result);

  } catch (error) {
    console.error('[quote] Error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '报价计算失败',
    });
  }
}

// GET：返回报价参数说明
export async function GET() {
  return Response.json({
    endpoint: '/api/quote',
    method: 'POST',
    description: '制造业零配件报价计算引擎',
    required_params: {
      material: '材质大类：铝型材/冷轧板/不锈钢/压铸铝/塑胶',
      grade: '牌号：6063-T5, 304, ADC12 等',
      process: '加工工艺：铝挤压/冲压/铝压铸/注塑/CNC加工/车加工/塑料挤出',
      quantity: '订单数量（件）',
    },
    optional_params: {
      weight: '零件净重(kg)，不填则用尺寸估算',
      length: '长度(mm)',
      width: '宽度(mm)',
      height: '高度(mm)',
      surface_treatment: '表面处理，格式：类型-项目名，如 氧化-本色阳极氧化',
      surface_area: '表面积(dm²)',
      mold_cost: '模具费用(元)，不填则自动估算',
      cnc_hours: 'CNC/车加工工时(h)',
      cnc_type: 'CNC类型：三轴/四轴/五轴',
      precision_level: '精度等级：普通/精密/高精密',
      is_urgent: '是否加急',
      urgent_days: '加急交付天数',
    },
    example: {
      material: '铝型材',
      grade: '6063-T5',
      process: '铝挤压',
      quantity: 1000,
      weight: 0.5,
      surface_treatment: '氧化-本色阳极氧化',
      surface_area: 8,
    },
  });
}
