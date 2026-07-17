import { NextResponse } from 'next/server';
import { calculatePrice, calculatePriceFull } from '@/lib/pricing/engine';
import type { PricingInput, ExtrusionInput, FullPricingInput, AssemblyInput } from '@/lib/pricing/types';

// 获取实时铝价（返回 元/吨）
async function getAluminumPrice(): Promise<number> {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const url = `http://www.lvdingjia.com/zhishu/${dateStr}.html`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 },
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

  return 23530; // 默认 23.53 元/kg × 1000
}

/**
 * 验证挤压铝型材必填参数（质稳 v4 公式）
 */
function validateExtrusionInput(body: Record<string, unknown>): string[] {
  const errors: string[] = [];

  // crossSectionArea 为必填（质稳公式核心输入）
  if (body.crossSectionArea === undefined || body.crossSectionArea === null) {
    errors.push('缺少必填参数: 截面面积 (crossSectionArea)，单位 mm²');
  } else if (typeof body.crossSectionArea === 'number' && body.crossSectionArea <= 0) {
    errors.push('截面面积必须大于 0');
  }

  const required: Array<{ key: string; label: string }> = [
    { key: 'length', label: '长度 (length)' },
    { key: 'quantity', label: '数量 (quantity)' },
    { key: 'surfaceTreatment', label: '表面处理类型 (surfaceTreatment)' },
  ];

  for (const { key, label } of required) {
    if (body[key] === undefined || body[key] === null) {
      errors.push(`缺少必填参数: ${label}`);
    }
  }

  if (typeof body.length === 'number' && body.length <= 0) {
    errors.push('长度必须大于 0');
  }
  if (typeof body.quantity === 'number' && body.quantity <= 0) {
    errors.push('数量必须大于 0');
  }

  // 验证表面处理类型
  const validTreatments = ['无', '白色哑光', '阳极氧化', '阳极氧化原色', '氧化银白', '氧化黑色', '喷涂', '电泳'];
  if (body.surfaceTreatment && !validTreatments.includes(body.surfaceTreatment as string)) {
    errors.push(`不支持的表面处理类型: ${body.surfaceTreatment}，可选值: ${validTreatments.join(', ')}`);
  }

  return errors;
}

/**
 * 验证通用必填参数
 */
function validateInput(body: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!body.productType) {
    errors.push('缺少必填参数: 产品类型 (productType)，可选值: extrusion, plate, die_casting, assembly');
    return errors;
  }

  if (!['extrusion', 'plate', 'die_casting', 'assembly'].includes(body.productType as string)) {
    errors.push(`不支持的产品类型: ${body.productType}，可选值: extrusion, plate, die_casting, assembly`);
    return errors;
  }

  // 装配体模式：需要parts数组
  if (body.productType === 'assembly') {
    if (!body.parts || !Array.isArray(body.parts) || body.parts.length === 0) {
      errors.push('装配体模式需要提供 parts 数组');
    }
    return errors;
  }

  if (body.productType === 'extrusion') {
    errors.push(...validateExtrusionInput(body));
  }

  if (body.quantity === undefined || body.quantity === null) {
    errors.push('缺少必填参数: 数量 (quantity)');
  }

  return errors;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;

    // 参数校验
    const validationErrors = validateInput(body);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: '参数校验失败',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    // 获取实时铝价（元/吨），用于没有显式传入铝价的情况
    const aluminumPricePerTon = await getAluminumPrice();

    // 构造输入
    const input: FullPricingInput = {
      productType: body.productType as FullPricingInput['productType'],
      ...body,
    } as FullPricingInput;

    // 如果没有显式传入铝锭价，使用实时价格
    if (input.productType === 'extrusion') {
      const extInput = input as ExtrusionInput;
      if (!extInput.aluminumPricePerKg && !extInput.aluminumPricePerTon) {
        // 优先使用 aluminumPricePerKg，如果没有则从实时吨价换算
        extInput.aluminumPricePerKg = aluminumPricePerTon / 1000;
      } else if (!extInput.aluminumPricePerKg && extInput.aluminumPricePerTon) {
        extInput.aluminumPricePerKg = extInput.aluminumPricePerTon / 1000;
      }
    } else if (input.productType === 'assembly') {
      const asmInput = input as AssemblyInput;
      if (!asmInput.aluminumPricePerKg && !asmInput.aluminumPricePerTon) {
        asmInput.aluminumPricePerKg = aluminumPricePerTon / 1000;
      } else if (!asmInput.aluminumPricePerKg && asmInput.aluminumPricePerTon) {
        asmInput.aluminumPricePerKg = asmInput.aluminumPricePerTon / 1000;
      }
    }

    // 计算（支持装配体）
    const result = calculatePriceFull(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Pricing calculation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '报价计算失败',
      },
      { status: 400 }
    );
  }
}
