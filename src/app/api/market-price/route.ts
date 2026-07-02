import { NextRequest } from 'next/server';

interface PriceSource { keywords: string[]; sources: string[]; unit: string }
interface PriceItem { name: string; price: string; change: string; source: string; unit: string }

const MATERIAL_SOURCES: Record<string, PriceSource> = {
  '铝型材': { keywords: ['铝锭价格', '南海灵通铝锭价'], sources: ['https://www.lvdingjia.com/'], unit: '元/吨' },
  '冷轧板': { keywords: ['冷轧板卷价格 今日'], sources: ['https://www.smm.cn', 'https://www.steelhome.cn'], unit: '元/吨' },
  '不锈钢': { keywords: ['不锈钢304价格 今日'], sources: ['https://www.smm.cn', 'https://www.51bxg.com'], unit: '元/吨' },
  '压铸铝': { keywords: ['ADC12价格', '压铸铝合金价格'], sources: ['https://www.lvdingjia.com/'], unit: '元/吨' },
  '塑胶': { keywords: ['工程塑料ABS价格', 'PP塑料价格 今日'], sources: ['https://plas.chem99.com'], unit: '元/吨' },
};

const LVDINGJIA_ITEMS: Record<string, string[]> = {
  '铝型材': ['南海铝锭(含票)', '南海铝锭(不含票)', '长江铝锭', '南储华南', '上海铝锭', '电泳铝型材', '喷涂铝型材', '磨砂铝型材', '6063铝圆管'],
  '压铸铝': ['7号压铸铝锭', '标准ADC12', '环保ADC12', '保太ADC12', '保太A380'],
};

function matchMaterial(query: string): string | null {
  const q = query.trim().toLowerCase();
  for (const [m, c] of Object.entries(MATERIAL_SOURCES)) {
    if (q === m.toLowerCase() || q.includes(m.toLowerCase()) || m.toLowerCase().includes(q)) return m;
    for (const kw of c.keywords) { if (q.includes(kw.toLowerCase()) || kw.toLowerCase().includes(q)) return m; }
  }
  const aliases: Record<string, string> = {
    '铝': '铝型材', '铝合金': '铝型材', '铝锭': '铝型材',
    '冷轧': '冷轧板', '冷轧钢': '冷轧板', '冷板': '冷轧板',
    '不锈钢304': '不锈钢', '304': '不锈钢',
    '压铸': '压铸铝', 'ADC12': '压铸铝',
    '塑料': '塑胶', 'ABS': '塑胶', 'PP': '塑胶', '工程塑料': '塑胶',
  };
  for (const [k, v] of Object.entries(aliases)) { if (q.includes(k.toLowerCase())) return v; }
  return null;
}

async function fetchWebHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function extractPricesFromLvdingjia(html: string, material: string): PriceItem[] {
  const prices: PriceItem[] = [];
  const targetItems = LVDINGJIA_ITEMS[material];
  if (!targetItems) return prices;
  const rowRegex = /<a\s+href="\/price\/[^"]*"\s+class="dali-mq6ulu">\s*([^<]+?)\s*<\/a>[\s\S]*?data-diff="([^"]*)"[^>]*>[\s\S]*?<\/span>[\s\S]*?data-avg="([^"]*)"/g;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const diffStr = match[2];
    const avgStr = match[3];
    if (targetItems.some(item => name.includes(item) || item.includes(name))) {
      const avg = parseInt(avgStr);
      const diff = parseInt(diffStr) || 0;
      if (!isNaN(avg)) {
        prices.push({ name, price: String(avg), change: diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '→0', source: 'lvdingjia.com', unit: '元/吨' });
      }
    }
  }
  return prices;
}

function extractPricesWithRegex(html: string, _material: string): PriceItem[] {
  const prices: PriceItem[] = [];
  const generalRegex = /([^\d\n]{2,20}?)\s*(?:均价|价格|参考价|报价|中间价)\s*[:：]?\s*(\d{4,6})\s*(?:元\/吨|元\/千克)?/g;
  let match;
  while ((match = generalRegex.exec(html)) !== null) {
    const name = match[1].trim().replace(/[<>]/g, '');
    const price = parseInt(match[2]);
    if (name.length >= 2 && !isNaN(price) && price > 1000 && price < 500000) {
      prices.push({ name, price: String(price), change: '→0', source: 'web', unit: '元/吨' });
    }
  }
  return prices;
}

async function extractPrices(material: string, html: string): Promise<PriceItem[]> {
  if (material === '铝型材' || material === '压铸铝') {
    const prices = extractPricesFromLvdingjia(html, material);
    if (prices.length > 0) return prices;
  }
  return extractPricesWithRegex(html, material);
}

async function searchAndExtract(material: string, config: PriceSource): Promise<PriceItem[]> {
  for (const kw of config.keywords) {
    try {
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(kw + ' 今日价格')}&setlang=zh-CN`;
      const html = await fetchWebHTML(searchUrl);
      const prices = await extractPricesWithRegex(html, material);
      if (prices.length > 0) return prices;
    } catch {}
  }
  return [];
}

interface PriceCache { data: PriceItem[]; timestamp: number; material: string }
const priceCache = new Map<string, PriceCache>();
const CACHE_DURATION = 2 * 60 * 60 * 1000;

function buildDataField(prices: PriceItem[]) {
  const primary = prices[0];
  if (!primary) return null;
  const raw = parseInt(primary.change.replace(/[↑↓→]/g, '')) || 0;
  const isDown = primary.change.includes('↓');
  const signed = isDown ? -raw : raw;
  return { price: parseInt(primary.price), change: signed, changePercent: primary.price ? (signed / parseInt(primary.price) * 100) : 0 };
}

export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const mq = sp.get('material') || sp.get('q') || '';
  if (!mq) return Response.json({ success: false, error: '请提供材质参数', supportedMaterials: Object.keys(MATERIAL_SOURCES) });
  const mm = matchMaterial(mq);
  if (!mm) return Response.json({ success: false, error: `不支持的材质: ${mq}`, supportedMaterials: Object.keys(MATERIAL_SOURCES) });

  const cached = priceCache.get(mm);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return Response.json({ success: true, material: mm, prices: cached.data, cached: true, updatedAt: new Date(cached.timestamp).toISOString(), data: buildDataField(cached.data) });
  }

  try {
    const config = MATERIAL_SOURCES[mm];
    let pricedData: PriceItem[] = [];
    if (config.sources[0]) {
      try { const html = await fetchWebHTML(config.sources[0]); pricedData = await extractPrices(mm, html); } catch (err) { console.error('[market-price] 直接抓取失败:', err); }
    }
    if (pricedData.length === 0) { pricedData = await searchAndExtract(mm, config); }

    if (pricedData.length > 0) {
      priceCache.set(mm, { data: pricedData, timestamp: Date.now(), material: mm });
      return Response.json({ success: true, material: mm, prices: pricedData, cached: false, updatedAt: new Date().toISOString(), data: buildDataField(pricedData) });
    }
    return Response.json({ success: false, material: mm, prices: [], error: '未查询到价格数据' });
  } catch (error) {
    return Response.json({ success: false, material: mm, prices: [], error: error instanceof Error ? error.message : '查询异常' });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { materials } = body as { materials?: string[] };
    const queryMaterials = materials && materials.length > 0 ? materials.map(m => matchMaterial(m)).filter(Boolean) as string[] : Object.keys(MATERIAL_SOURCES);
    const results: Record<string, PriceItem[]> = {};
    for (const material of queryMaterials) {
      const cached = priceCache.get(material);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) { results[material] = cached.data; continue; }
      const config = MATERIAL_SOURCES[material];
      let pricedData: PriceItem[] = [];
      if (config.sources[0]) { try { const html = await fetchWebHTML(config.sources[0]); pricedData = await extractPrices(material, html); } catch {} }
      if (pricedData.length === 0) { pricedData = await searchAndExtract(material, config); }
      if (pricedData.length > 0) { priceCache.set(material, { data: pricedData, timestamp: Date.now(), material }); results[material] = pricedData; }
    }
    return Response.json({ success: true, data: results, updatedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : '查询异常' });
  }
}
