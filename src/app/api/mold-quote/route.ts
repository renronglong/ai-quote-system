import { NextRequest } from 'next/server';
import {
  calcMoldQuote,
  MOLD_FRAMES,
  MATERIAL_PARAMS,
  MATERIAL_NAMES,
  recommendMoldFrame,
} from '@/lib/mold-quote/engine';

// ============================================================
// 模具报价 API /api/mold-quote
// 压铸/注塑模具：布局链（滑块→穴数→穴排→机台吨位）+ 成本五块
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = calcMoldQuote(body);
    return Response.json(result);
  } catch (error) {
    console.error('[mold-quote] Error:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : '模具报价计算失败',
    });
  }
}

export async function GET() {
  return Response.json({
    endpoint: '/api/mold-quote',
    method: 'POST',
    description: '压铸/注塑模具报价：布局链自动推导 + 五块成本 + 三材质对比 + 市场钢板价联动',
    required_params: {
      L: '产品外廓L(滑块向·mm)',
      W: '产品宽W(mm)',
      H: '产品高H(mm)',
    },
    optional_params: {
      netWeightG: '净重(g)',
      removalVolume: '去除量(mm³)',
      cncCycleMin: 'CNC节拍(min)',
      sideCount: '侧面数N（决定滑块数：0→0, ≤2→1, ≤4→2, >4→4）',
      material: `材质：${MATERIAL_NAMES.join(' / ')}（默认铝压铸）`,
      moldFrame: `模架规格：${MOLD_FRAMES.map(f => f.spec).join(' / ')}（默认按产品外廓推荐）`,
      steelPrice: '市场钢板价(元/kg)，默认7，模架费联动',
    },
    example: {
      L: 32, W: 14, H: 16,
      netWeightG: 9.14, removalVolume: 3784.48, cncCycleMin: 3.59,
      sideCount: 2, material: '铝压铸', moldFrame: '2535', steelPrice: 7,
    },
    reference: {
      moldFrames: MOLD_FRAMES,
      materialParams: MATERIAL_PARAMS,
      recommend: '可调 /api/mold-quote/recommend?L=..&W=.. 获取推荐模架',
    },
  });
}
