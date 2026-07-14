import { NextResponse } from 'next/server';

interface PricingInput {
  material: string;
  weight?: number; // kg
  length?: number; // mm
  crossSectionArea?: number; // mm²
  quantity: number;
  surfaceTreatment?: string;
  surfaceArea?: number; // m²
  processType: 'extrusion' | 'cnc' | 'stamping' | 'die_casting' | 'injection';
  cncTime?: number; // minutes
  hasChamfer?: boolean;
  isHollow?: boolean;
}

interface PricingResult {
  materialCost: number;
  extrusionCost: number;
  cncCost: number;
  surfaceTreatmentCost: number;
  packagingCost: number;
  transportationCost: number;
  totalCost: number;
  unitCost: number;
  breakdown: {
    item: string;
    calculation: string;
    cost: number;
  }[];
}

// 获取实时铝价
async function getAluminumPrice(): Promise<number> {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const url = `http://www.lvdingjia.com/zhishu/${dateStr}.html`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 }, // 缓存1小时
    });
    
    if (response.ok) {
      const html = await response.text();
      const match = html.match(/南海(?!灵通)[^<]*?(\d+)~(\d+)/);
      if (match) {
        const low = parseInt(match[1]);
        const high = parseInt(match[2]);
        return Math.round((low + high) / 2);
      }
    }
  } catch (error) {
    console.error('Failed to fetch aluminum price:', error);
  }
  
  return 23530; // 默认值（元/吨）
}

// 挤压铝型材报价
function calculateExtrusionPricing(input: PricingInput, aluminumPricePerKg: number): PricingResult {
  const breakdown: { item: string; calculation: string; cost: number }[] = [];
  
  // 计算重量
  let weight = input.weight || 0;
  if (!weight && input.crossSectionArea && input.length) {
    // 米重 = 截面积(mm²) × 2.7(g/cm³) / 1000 = kg/m
    const weightPerMeter = (input.crossSectionArea * 2.7) / 1000;
    weight = weightPerMeter * (input.length / 1000);
  }
  
  if (!weight) {
    throw new Error('无法计算重量，请提供重量、截面积+长度等参数');
  }
  
  // 1. 铝材费
  const materialCost = weight * aluminumPricePerKg;
  breakdown.push({
    item: '铝材费',
    calculation: `${weight.toFixed(3)}kg × ¥${aluminumPricePerKg.toFixed(2)}/kg`,
    cost: materialCost,
  });
  
  // 2. 挤压加工费
  let extrusionRate = 3.0; // 实心简单截面
  if (input.isHollow) {
    extrusionRate = 2.5;
  }
  const extrusionCost = weight * extrusionRate;
  breakdown.push({
    item: '挤压加工费',
    calculation: `${weight.toFixed(3)}kg × ¥${extrusionRate}/kg`,
    cost: extrusionCost,
  });
  
  // 3. CNC加工费
  let cncCost = 0;
  if (input.processType === 'cnc' && input.cncTime) {
    // 机时法：80元/小时
    cncCost = (input.cncTime / 60) * 80;
  } else {
    // 简单切割+去毛刺
    cncCost = input.isHollow ? 0.8 : 1.5;
  }
  breakdown.push({
    item: 'CNC加工费',
    calculation: input.cncTime 
      ? `${input.cncTime}分钟 × (¥80/60分钟)`
      : '切割+去毛刺（标准）',
    cost: cncCost,
  });
  
  // 4. 表面处理费
  let surfaceTreatmentCost = 0;
  if (input.surfaceTreatment && input.surfaceTreatment !== '无') {
    let surfaceRate = 8; // 默认氧化本色
    if (input.surfaceTreatment === '氧化黑色') {
      surfaceRate = 10;
    } else if (input.surfaceTreatment === '喷涂') {
      surfaceRate = 20;
    } else if (input.surfaceTreatment === '电泳') {
      surfaceRate = 15;
    }
    
    let surfaceArea = input.surfaceArea || 0;
    if (!surfaceArea && input.crossSectionArea && input.length) {
      // 估算表面积：周长 × 长度
      // 假设矩形截面，周长 = 2 × (宽 + 高)
      // 这里简化处理，实际应该根据具体截面计算
      const perimeter = Math.sqrt(input.crossSectionArea) * 4; // 近似
      surfaceArea = (perimeter * input.length) / 1000000; // 转换为m²
    }
    
    if (surfaceArea > 0) {
      surfaceTreatmentCost = surfaceArea * surfaceRate;
      breakdown.push({
        item: `表面处理费（${input.surfaceTreatment}）`,
        calculation: `${surfaceArea.toFixed(4)}m² × ¥${surfaceRate}/m²`,
        cost: surfaceTreatmentCost,
      });
    }
  }
  
  // 5. 包装费
  const packagingCost = weight * 0.5;
  breakdown.push({
    item: '包装费',
    calculation: `${weight.toFixed(3)}kg × ¥0.5/kg`,
    cost: packagingCost,
  });
  
  // 6. 运输费
  const transportationCost = weight * 0.5;
  breakdown.push({
    item: '运输费',
    calculation: `${weight.toFixed(3)}kg × ¥0.5/kg`,
    cost: transportationCost,
  });
  
  // 总计
  const totalCost = materialCost + extrusionCost + cncCost + surfaceTreatmentCost + packagingCost + transportationCost;
  const unitCost = totalCost;
  
  return {
    materialCost,
    extrusionCost,
    cncCost,
    surfaceTreatmentCost,
    packagingCost,
    transportationCost,
    totalCost,
    unitCost,
    breakdown,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input: PricingInput = body;
    
    // 获取实时铝价
    const aluminumPricePerTon = await getAluminumPrice();
    const aluminumPricePerKg = aluminumPricePerTon / 1000;
    
    let result: PricingResult;
    
    switch (input.processType) {
      case 'extrusion':
        result = calculateExtrusionPricing(input, aluminumPricePerKg);
        break;
      // TODO: 添加其他工艺类型的计算
      default:
        result = calculateExtrusionPricing(input, aluminumPricePerKg);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        aluminumPrice: {
          pricePerTon: aluminumPricePerTon,
          pricePerKg: aluminumPricePerKg.toFixed(2),
          source: '南海铝锭价',
        },
        quantity: input.quantity,
        totalPrice: result.unitCost * input.quantity,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '报价计算失败',
      },
      { status: 400 }
    );
  }
}
