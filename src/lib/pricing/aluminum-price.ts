// ============================================================
// 统一铝锭价获取（元/吨）
// 主源：Supabase material_prices 当日「南海铝锭(含票)」（与行情页同源，业主 2026-10-27 定案：材料单价用含票口径）
// 备源：lvdingjia.com 首页「南海铝锭(含票)」均价
// 兜底：Bing 搜索「南海灵通铝锭价 今日价格」
// 缓存：2 小时；抓取失败时若 7 天内有成功价，返回最近价并标记 stale
// ============================================================

let cachedPrice: { price: number; timestamp: number } | null = null;
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 小时
const STALE_LIMIT = 7 * 24 * 60 * 60 * 1000; // 7 天

// ============================================================
// Supabase 直读：material_prices 最近 3 天的「南海铝锭(含票)」
// 报价材料单价统一用含票口径（业主 2026-10-27 定案）
// ============================================================
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function fetchFromDb(): Promise<number | null> {
  if (!SUPABASE_SERVICE_KEY) return null;
  try {
    const since = new Date();
    since.setDate(since.getDate() - 3);
    const sinceStr = since.toISOString().split('T')[0];
    const qs = new URLSearchParams({
      select: 'name,price,price_date',
      material: 'eq.铝型材',
      price_date: `gte.${sinceStr}`,
      order: 'price_date.desc',
      limit: '30',
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/material_prices?${qs.toString()}`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    const hit = rows.find(
      (r: any) => typeof r?.name === 'string' && r.name.includes('南海铝锭') && r.name.includes('含票'),
    );
    const price = Number(hit?.price);
    if (Number.isFinite(price) && price > 10000 && price < 50000) return price;
  } catch (err) {
    console.error('[aluminum-price] DB 读取失败:', err);
  }
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

// 从 lvdingjia 首页提取南海铝锭(含票)均价（与 /api/market-price 同源同正则）
function extractFromLvdingjia(html: string): number | null {
  const rowRegex = /<a\s+href="\/price\/[^"]*"\s+class="dali-mq6ulu">\s*([^<]+?)\s*<\/a>[\s\S]*?data-diff="([^"]*)"[^>]*>[\s\S]*?<\/span>[\s\S]*?data-avg="([^"]*)"/g;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const avgStr = match[3];
    if (name.includes('南海铝锭')) {
      const avg = parseInt(avgStr);
      if (!isNaN(avg) && avg > 10000 && avg < 50000) return avg;
    }
  }
  return null;
}

// Bing 搜索兜底：匹配「南海铝锭/铝锭价格 XXXXX 元/吨」
function extractFromSearch(html: string): number | null {
  const generalRegex = /([^\d\n]{2,20}?)\s*(?:均价|价格|参考价|报价|中间价)\s*[:：]?\s*(\d{4,6})\s*(?:元\/吨|元\/千克)?/g;
  let match;
  const candidates: number[] = [];
  while ((match = generalRegex.exec(html)) !== null) {
    const name = match[1].trim().replace(/[<>]/g, '');
    const price = parseInt(match[2]);
    if (name.length >= 2 && !isNaN(price) && price > 10000 && price < 50000 && name.includes('铝')) {
      candidates.push(price);
    }
  }
  return candidates.length ? Math.round(candidates.reduce((a, b) => a + b, 0) / candidates.length) : null;
}

export interface AluminumPriceResult {
  price: number;
  source: 'db' | 'lvdingjia' | 'bing' | 'stale-cache' | 'fallback';
  stale: boolean;
}

/**
 * 获取南海铝锭价（元/吨）。
 * @param fallbackPrice 全部数据源失败时的兜底价（由调用方传入，lib 内不硬编码价格）
 */
export async function getAluminumPrice(fallbackPrice?: number): Promise<AluminumPriceResult> {
  // 1. 新鲜缓存
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_DURATION) {
    return { price: cachedPrice.price, source: 'lvdingjia', stale: false };
  }

  // 2. 数据库（material_prices 含票口径，最稳）
  const dbPrice = await fetchFromDb();
  if (dbPrice !== null) {
    cachedPrice = { price: dbPrice, timestamp: Date.now() };
    return { price: dbPrice, source: 'db', stale: false };
  }

  // 3. 备源 lvdingjia
  try {
    const html = await fetchWebHTML('https://www.lvdingjia.com/');
    const price = extractFromLvdingjia(html);
    if (price !== null) {
      cachedPrice = { price, timestamp: Date.now() };
      return { price, source: 'lvdingjia', stale: false };
    }
  } catch (err) {
    console.error('[aluminum-price] lvdingjia 抓取失败:', err);
  }

  // 4. Bing 兜底
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent('南海灵通铝锭价 今日价格')}&setlang=zh-CN`;
    const html = await fetchWebHTML(searchUrl);
    const price = extractFromSearch(html);
    if (price !== null) {
      cachedPrice = { price, timestamp: Date.now() };
      return { price, source: 'bing', stale: false };
    }
  } catch (err) {
    console.error('[aluminum-price] bing 兜底失败:', err);
  }

  // 5. 7 天内的陈旧缓存
  if (cachedPrice && Date.now() - cachedPrice.timestamp < STALE_LIMIT) {
    return { price: cachedPrice.price, source: 'stale-cache', stale: true };
  }

  // 6. 调用方兜底
  if (fallbackPrice !== undefined) {
    return { price: fallbackPrice, source: 'fallback', stale: true };
  }

  throw new Error('铝锭价获取失败：所有数据源均不可用');
}
