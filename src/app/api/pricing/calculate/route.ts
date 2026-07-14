import { NextResponse } from 'next/server';
import { calculatePrice } from '@/lib/pricing/engine';
import type { PricingInput, ExtrusionInput } from '@/lib/pricing/types';

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

  return 23530;
}

/**
 * 验证挤压铝型材必填参数
 */
function validateExtrusionInput(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const required: Array<{ key: string; label: string }> = [
    { key: 'outerWidth', label: '外轮廓宽度 (outerWidth)' },
    { key: 'outerHeight', label: '外轮廓高度 (outerHeight)' },
    { key: 'length', label: '长度 (length)' },
    { key: 'quantity', label: '数量 (quantity)' },
    { key: 'surfaceTreatment', label: '表面处理类型 (surfaceTreatment)' },
    { key: 'isHollow', label: '是否有内腔 (isHollow)' },
  ];

  for (const { key, label } of required) {
    if (body[key] === undefined || body[key] === null) {
      errors.push(`缺少必填参数: ${label}`);
    }
  }

  if (typeof body.outerWidth === 'number' && body.outerWidth <= 0) {
    errors.push('外轮廓宽度必须大于 0');
  }
  if (typeof body.outerHeight === 'number' && body.outerHeight <= 0) {
    errors.push('外轮廓高度必须大于 0');
  }
  if (typeof body.length === 'number' && body.length <= 0) {
    errors.push('长度必须大于 0');
  }
  if (typeof body.quantity === 'number' && body.quantity <= 0) {
    errors.push('数量必须大于 0');
  }

  return errors;
}

/**
 * 验证通用必填参数
 */
function validateInput(body: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (!body.productType) {
    errors.push('缺少必填参数: 产品类型 (productType)，可选值: extrusion, plate, die_casting');
    return errors;
  }

  if (!['extrusion', 'plate', 'die_casting'].includes(body.productType as string)) {
    errors.push(`不支持的产品类型: ${body.productType}，可选值: extrusion, plate, die_casting`);
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

    // 获取实时铝价，用于没有显式传入 aluminumPricePerTon 的情况
    const aluminumPricePerTon = await getAluminumPrice();

    // 构造输入
    const input: PricingInput = {
      productType: body.productType as PricingInput['productType'],
      ...body,
    } as PricingInput;

    // 如果没有显式传入铝锭价，使用实时价格
    if (input.productType === 'extrusion') {
      const extInput = input as ExtrusionInput;
      if (!extInput.aluminumPricePerTon) {
        extInput.aluminumPricePerTon = aluminumPricePerTon;
      }
    }

    // 计算
    const result = calculatePrice(input);

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
