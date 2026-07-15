import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { calculatePrice } from '@/lib/pricing/engine';
import type { PricingInput, ExtrusionInput, PlateInput } from '@/lib/pricing/types';

const execFileAsync = promisify(execFile);

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
 * POST /api/pricing/step-quote
 * 
 * 一步到位：上传 STEP 文件 → 解析 → 报价
 * 
 * 参数:
 * - file: STEP 文件
 * - quantity: 数量（默认 1）
 * - surfaceTreatment: 表面处理（默认 '氧化本色'）
 */
export async function POST(request: Request) {
  let tmpFilePath: string | null = null;
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const quantity = parseInt(formData.get('quantity') as string || '1');
    const surfaceTreatment = (formData.get('surfaceTreatment') as string) || '氧化本色';
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: '请上传 STEP 文件' },
        { status: 400 }
      );
    }
    
    // 验证文件
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.step') && !fileName.endsWith('.stp')) {
      return NextResponse.json(
        { success: false, error: '仅支持 .step 或 .stp 格式' },
        { status: 400 }
      );
    }
    
    // 保存临时文件
    const buffer = Buffer.from(await file.arrayBuffer());
    tmpFilePath = join(tmpdir(), `step_${randomUUID()}.step`);
    await writeFile(tmpFilePath, buffer);
    
    // 调用 Python 解析
    const scriptPath = join(process.cwd(), 'scripts', 'parse_step.py');
    
    const { stdout } = await execFileAsync(
      'python3',
      [scriptPath, tmpFilePath],
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    
    const parseResult = JSON.parse(stdout);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error },
        { status: 400 }
      );
    }
    
    // 获取铝价
    const aluminumPricePerTon = await getAluminumPrice();
    
    // 构造报价输入
    const pricingParams = parseResult.pricingParams;
    let pricingInput: PricingInput;
    
    if (pricingParams.productType === 'extrusion') {
      pricingInput = {
        productType: 'extrusion',
        outerWidth: pricingParams.outerWidth,
        outerHeight: pricingParams.outerHeight,
        length: pricingParams.length,
        quantity,
        isHollow: pricingParams.isHollow,
        surfaceTreatment: surfaceTreatment as ExtrusionInput['surfaceTreatment'],
        sectionComplexity: pricingParams.sectionComplexity as ExtrusionInput['sectionComplexity'],
        aluminumPricePerTon,
      } as ExtrusionInput;
    } else {
      pricingInput = {
        productType: 'plate',
        width: pricingParams.width,
        height: pricingParams.height,
        thickness: pricingParams.thickness,
        quantity,
        surfaceTreatment: surfaceTreatment as PlateInput['surfaceTreatment'],
        aluminumPricePerTon,
      } as PlateInput;
    }
    
    // 计算报价
    const pricingResult = calculatePrice(pricingInput);
    
    return NextResponse.json({
      success: true,
      data: {
        parseResult: {
          boundingBox: parseResult.boundingBox,
          volume: parseResult.volume,
          surfaceArea: parseResult.surfaceArea,
          weight: parseResult.weight,
          topology: parseResult.topology,
          extrusion: parseResult.extrusion,
        },
        pricingResult,
        fileName: file.name,
      },
    });
    
  } catch (error) {
    console.error('[step-quote] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '处理失败',
      },
      { status: 500 }
    );
  } finally {
    if (tmpFilePath) {
      try { await unlink(tmpFilePath); } catch { /* ignore */ }
    }
  }
}

// 允许大文件上传
export const maxDuration = 30;
