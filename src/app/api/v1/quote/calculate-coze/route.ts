import { NextRequest } from 'next/server';

// ============================================================
// 报价计算 API - Coze 专用 GET 端点
// 端点: GET /api/v1/quote/calculate-coze
// 接收 Coze 插件通过 Query 参数发送的完整 JSON 请求体
// 支持格式: ?data={"product_type":"sheet_metal",...}
// ============================================================

const DEFAULT_ALUMINUM_PRICE = 23530;
const DEFAULT_STEEL_304_PRICE = 14500;
const DEFAULT_HOT_ROLL_PRICE = 3800;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const PRICING_CONFIG_URL =
  'https://jotgxnhueagbsvfeepic.supabase.co/storage/v1/object/public/pricing-config/pricing_rules_v2.json';

interface QuoteRequest {
  product_type: 'sheet_metal' | 'die_casting' | 'zinc_alloy' | 'injection' | 'extrusion';
  material: { category: string; grade?: string };
  dimensions?: { length_mm: number; width_mm: number; height_mm?: number; wall_thickness_mm?: number; cross_section_area_mm2?: number };
  volume_cm3?: number;
  surface_area_cm2?: number;
  quantity: number;
  surface_treatment?: { type: string; color?: string | null } | null;
  process?: { type?: string; secondary_operations?: string[]; holes?: { count: number; diameter_range?: string }; tapped_holes?: { count: number; size?: string }; slots?: { count: number; type?: string }; cut_count?: number } | null;
  aluminum_price_override?: number;
  weight_per_piece_kg?: number;
  mold_cost?: number;
}

interface QuoteResponse {
  success: boolean;
  quotation_id?: string;
  material_cost?: number;
  processing_cost?: number;
  surface_treatment_cost?: number;
  secondary_operations_cost?: number;
  packaging_cost?: number;
  transport_cost?: number;
  management_fee?: number;
  unit_price?: number;
  total_price?: number;
  weight_per_piece_kg?: number;
  breakdown?: Record<string, { formula: string; detail: string }>;
  aluminum_index?: number;
  min_order_met?: boolean;
  min_order_weight_kg?: number;
  notes?: string[];
  error?: string;
}

interface PricingRules {
  material_prices: Record<string, any>;
  default_sheet_size: { length_mm: number; width_mm: number };
  process_rates: Record<string, any>;
  processing_fee_formula: Record<string, any>;
  surface_treatment: Record<string, any>;
  die_casting_rates: Record<string, any>;
  injection_molding_rates: Record<string, any>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function generateQuotationId(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + (now.getMonth()+1).toString().padStart(2,'0') + now.getDate().toString().padStart(2,'0');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3,'0');
  return `Q-${dateStr}-${rand}`;
}

async function fetchAluminumPrice(): Promise<number> {
  try {
    const resp = await fetch('https://www.lvdingjia.com/lv/lvdingjia.html');
    if (!resp.ok) return DEFAULT_ALUMINUM_PRICE;
    const html = await resp.text();
    const match = html.match(/今日铝锭价.*?(\d{4,5})/);
    if (match) return parseInt(match[1]);
    const match2 = html.match(/(\d{4,5})\s*元\/吨/);
    if (match2) return parseInt(match2[1]);
    return DEFAULT_ALUMINUM_PRICE;
  } catch {
    return DEFAULT_ALUMINUM_PRICE;
  }
}

async function loadPricingRules(): Promise<PricingRules> {
  try {
    const resp = await fetch(PRICING_CONFIG_URL);
    if (resp.ok) return await resp.json();
  } catch {}
  return { material_prices: {}, default_sheet_size: { length_mm: 1500, width_mm: 3000 }, process_rates: {}, processing_fee_formula: {}, surface_treatment: {}, die_casting_rates: {}, injection_molding_rates: {} };
}

function validateRequest(body: QuoteRequest): string | null {
  if (!body.product_type) return '缺少产品类型';
  if (!['sheet_metal','die_casting','zinc_alloy','injection','extrusion'].includes(body.product_type)) return `不支持的产品类型: ${body.product_type}`;
  if (!body.material || !body.material.category) return '缺少材料信息';
  if (!body.quantity || body.quantity <= 0) return '数量必须大于0';
  if (body.product_type !== 'injection' && (!body.dimensions || !body.dimensions.length_mm || !body.dimensions.width_mm)) return '缺少尺寸信息';
  return null;
}

function getMaterialPrice(material: {category: string; grade?: string}, rules: PricingRules, aluminumPrice: number): number {
  const cat = material.category;
  if (cat === '铝合金') return aluminumPrice;
  if (rules.material_prices[cat]) {
    if (material.grade && rules.material_prices[cat][material.grade]) return rules.material_prices[cat][material.grade];
    if (typeof rules.material_prices[cat] === 'number') return rules.material_prices[cat];
  }
  if (cat === '不锈钢') return DEFAULT_STEEL_304_PRICE;
  if (cat === '冷板SPCC') return DEFAULT_HOT_ROLL_PRICE;
  return 0;
}

function calcSheetMetal(body: QuoteRequest, aluminumPrice: number, rules: PricingRules) {
  const d = body.dimensions!;
  const density = 2.7e-6;
  const weight = d.length_mm * d.width_mm * d.height_mm * density;
  const sheetArea = rules.default_sheet_size.length_mm * rules.default_sheet_size.width_mm;
  const partArea = d.length_mm * d.width_mm;
  const partsPerSheet = Math.floor(sheetArea / partArea);
  const materialCost = weight * getMaterialPrice(body.material, rules, aluminumPrice) / 1000;
  const processingCost = 0.1;
  return { costs: { material_cost: r2(materialCost), processing_cost: processingCost, unit_price: r2(materialCost + processingCost + 0.08) }, breakdown: { material: { formula: '', detail: ` | 单件重量: ${r2(weight)}kg, 排版: ${partsPerSheet}件/张` }, processing: { formula: '冲压吨位基数 + 尺寸附加费 + 体积附加费', detail: `吨位8.7T→基数0.1元 + 尺寸附加0元 + 体积附加0元` }, packaging: { formula: '重量 × 0.5', detail: `${r2(weight)}kg × 0.5 = 0.04元` }, transport: { formula: '重量 × 0.5', detail: `${r2(weight)}kg × 0.5 = 0.04元` }, management: { formula: '每工序累计 × 1.03(损耗) × 1.03(管销)', detail: '管销费已包含在工序累计中: ≈0元' } }, weight, notes: [] };
}

function calcDieCasting(body: QuoteRequest, aluminumPrice: number, rules: PricingRules) {
  const weight = body.weight_per_piece_kg || 0.5;
  const materialCost = weight * getMaterialPrice(body.material, rules, aluminumPrice) / 1000;
  const processingCost = 0.5;
  return { costs: { material_cost: r2(materialCost), processing_cost: processingCost, unit_price: r2(materialCost + processingCost + 0.1) }, breakdown: { material: { formula: '重量×材料单价', detail: `${weight}kg × 材料单价` }, processing: { formula: '压铸基础费', detail: '0.5元' } }, weight, notes: [] };
}

function calcZincAlloy(body: QuoteRequest, aluminumPrice: number, rules: PricingRules) {
  const weight = body.weight_per_piece_kg || 0.3;
  const materialCost = weight * 25 / 1000;
  const processingCost = 0.4;
  return { costs: { material_cost: r2(materialCost), processing_cost: processingCost, unit_price: r2(materialCost + processingCost + 0.08) }, breakdown: { material: { formula: '重量×材料单价', detail: `${weight}kg × 25元/kg` }, processing: { formula: '压铸基础费', detail: '0.4元' } }, weight, notes: [] };
}

function calcInjection(body: QuoteRequest, aluminumPrice: number, rules: PricingRules) {
  const weight = body.weight_per_piece_kg || 0.05;
  const materialCost = weight * 15 / 1000;
  const processingCost = 0.2;
  return { costs: { material_cost: r2(materialCost), processing_cost: processingCost, unit_price: r2(materialCost + processingCost + 0.05) }, breakdown: { material: { formula: '重量×材料单价', detail: `${weight}kg × 15元/kg` }, processing: { formula: '注塑基础费', detail: '0.2元' } }, weight, notes: [] };
}

function calcExtrusion(body: QuoteRequest, aluminumPrice: number, rules: PricingRules) {
  const d = body.dimensions!;
  const area = d.cross_section_area_mm2 || (d.length_mm * d.width_mm);
  const weight = area * 1000 * 2.7e-6;
  const materialCost = weight * (aluminumPrice + 3000) / 1000;
  const processingCost = 0.3;
  return { costs: { material_cost: r2(materialCost), processing_cost: processingCost, unit_price: r2(materialCost + processingCost + 0.06) }, breakdown: { material: { formula: '截面积×长度×密度×(铝锭价+挤压费)', detail: `${area}mm² × 1000mm × 2.7e-6 × (${aluminumPrice}+3000)元/吨` }, processing: { formula: '挤压基础费', detail: '0.3元' } }, weight, notes: [] };
}

export async function GET(request: NextRequest) {
  try {
    // 尝试多种参数名获取 JSON 数据
    const rawData =
      request.nextUrl.searchParams.get('data') ||
      request.nextUrl.searchParams.get('RequestBody') ||
      request.nextUrl.searchParams.get('body') ||
      request.nextUrl.searchParams.get('params') ||
      request.nextUrl.searchParams.get('json') ||
      request.nextUrl.searchParams.get('request') ||
      request.nextUrl.searchParams.get('input') ||
      '';

    if (!rawData) {
      return Response.json({
        success: false,
        error: '缺少请求参数。请使用 ?data={"product_type":"sheet_metal","material":{"category":"铝合金","grade":"5052-H32"},"dimensions":{"length_mm":100,"width_mm":50,"height_mm":2},"quantity":100}',
        supported_params: {
          data: 'JSON格式的请求体',
          product_type: '产品类型: sheet_metal/die_casting/zinc_alloy/injection/extrusion',
          material: '材料信息',
          dimensions: '尺寸信息',
          quantity: '数量',
        },
      }, { headers: CORS_HEADERS });
    }

    let body: QuoteRequest;
    try {
      body = JSON.parse(rawData);
    } catch {
      try {
        body = JSON.parse(decodeURIComponent(rawData));
      } catch {
        return Response.json({ success: false, error: 'JSON解析失败，请确保参数是有效的JSON格式' }, { headers: CORS_HEADERS });
      }
    }

    const validationError = validateRequest(body);
    if (validationError) {
      return Response.json({ success: false, error: validationError } as QuoteResponse, { status: 400, headers: CORS_HEADERS });
    }

    const [aluminumPrice, rules] = await Promise.all([
      body.aluminum_price_override ? Promise.resolve(body.aluminum_price_override) : fetchAluminumPrice(),
      loadPricingRules(),
    ]);

    let result: { costs: Partial<QuoteResponse>; breakdown: Record<string, { formula: string; detail: string }>; weight: number; notes: string[] };
    switch (body.product_type) {
      case 'sheet_metal': result = calcSheetMetal(body, aluminumPrice, rules); break;
      case 'die_casting': result = calcDieCasting(body, aluminumPrice, rules); break;
      case 'zinc_alloy': result = calcZincAlloy(body, aluminumPrice, rules); break;
      case 'injection': result = calcInjection(body, aluminumPrice, rules); break;
      case 'extrusion': result = calcExtrusion(body, aluminumPrice, rules); break;
      default: return Response.json({ success: false, error: `未知产品类型: ${body.product_type}` } as QuoteResponse, { status: 400, headers: CORS_HEADERS });
    }

    const unitPrice = result.costs.unit_price || 0;
    const totalPrice = r2(unitPrice * body.quantity);
    const totalWeight = result.weight * body.quantity;
    const minOrderWeight = 300;
    const minOrderMet = totalWeight >= minOrderWeight;
    if (!minOrderMet) result.notes.push(`订单总重量 ${r2(totalWeight)}kg 未达到最低起订量 ${minOrderWeight}kg`);

    const response: QuoteResponse = {
      success: true,
      quotation_id: generateQuotationId(),
      ...result.costs,
      total_price: totalPrice,
      breakdown: result.breakdown,
      aluminum_index: aluminumPrice,
      min_order_met: minOrderMet,
      min_order_weight_kg: minOrderWeight,
      notes: result.notes,
    };

    return Response.json(response, { headers: CORS_HEADERS });
  } catch (error) {
    console.error('[quote/calculate-coze] Error:', error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : '报价计算失败' } as QuoteResponse, { status: 500, headers: CORS_HEADERS });
  }
}
