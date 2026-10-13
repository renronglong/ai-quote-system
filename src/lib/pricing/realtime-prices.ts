// ============================================================
// 实时基准价（期货连续合约 + lvdingjia ADC12 现货）
// ------------------------------------------------------------
// 原则：公式不动，只把 route.ts 里写死的基准价换成实时值；
//       任何数据源失败都回退默认值（与原静态值一致），零阻断报价。
// 源：新浪期货 hq.sinajs.cn（需 Referer，GBK 编码）
//     nf_HC0 热轧卷板 / nf_SS0 不锈钢 / nf_ZN0 沪锌 / nf_AL0 铝 / nf_PP0 聚丙烯
// 缓存：2 小时（与铝锭价同策略）
// ============================================================

export interface RealtimeBasePrices {
  hotRoll: number;      // 热卷期货 元/吨 → 冷轧板/钢板/镀锌板 = hotRoll × 1.05
  ss304: number;        // 不锈钢期货 元/吨 → 不锈钢 = ss304 × 牌号ratio × 1.05
  zinc: number;         // 沪锌连续 元/吨   → 锌合金单价基准
  adc12: number;        // 压铸铝(ADC12) 元/吨（lvdingjia 现货，失败回退铝期货×0.95）
  pp: number;           // 聚丙烯期货 元/吨 → PP 单价基准
  updatedAt: string;
  sources: Record<string, string>;
}

// 回退默认值 = 原写死值（数据源全挂时行为与旧版完全一致）
const FALLBACK: RealtimeBasePrices = {
  hotRoll: 3800,
  ss304: 14500,
  zinc: 24000,
  adc12: 22000,
  pp: 9300,
  updatedAt: 'fallback',
  sources: {},
};

const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 小时
let cached: { data: RealtimeBasePrices; timestamp: number } | null = null;

const FUTURES = [
  ['hotRoll', 'nf_HC0'],
  ['ss304', 'nf_SS0'],
  ['zinc', 'nf_ZN0'],
  ['al', 'nf_AL0'],
  ['pp', 'nf_PP0'],
] as const;

async function fetchFutures(): Promise<Partial<RealtimeBasePrices>> {
  const symbols = FUTURES.map(([, s]) => s).join(',');
  const res = await fetch(`https://hq.sinajs.cn/list=${symbols}`, {
    headers: { Referer: 'https://finance.sina.com.cn', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`sina futures HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = new TextDecoder('gbk').decode(buf);
  const out: Partial<RealtimeBasePrices> = {};
  const sources: Record<string, string> = {};
  for (const m of text.matchAll(/hq_str_nf_(\w+)="([^"]*)"/g)) {
    const sym = m[1];
    const parts = m[2].split(',');
    // nf_ 格式: 0名称 1时间 2开盘 3最高 4最低 ... 8最新价 9结算 10昨结算
    const last = parseFloat(parts[8]) || parseFloat(parts[9]) || parseFloat(parts[10]);
    if (!isNaN(last) && last > 0) {
      const key = FUTURES.find(([, s]) => s === sym)?.[0];
      if (key) {
        (out as unknown as Record<string, number>)[key] = last;
        sources[key] = `sina:${sym}`;
      }
    }
  }
  (out as Record<string, unknown>).sources = sources;
  return out;
}

// lvdingjia ADC12/压铸铝锭现货（解析失败返回 null，由调用方回退）
async function fetchAdc12Spot(): Promise<number | null> {
  try {
    const res = await fetch('https://www.lvdingjia.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const rowRegex = /<a\s+href="\/price\/[^"]*"\s+class="dali-mq6ulu">\s*([^<]+?)\s*<\/a>[\s\S]*?data-diff="([^"]*)"[^>]*>[\s\S]*?<\/span>[\s\S]*?data-avg="([^"]*)"/g;
    const candidates: { name: string; avg: number; prio: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(html)) !== null) {
      const name = m[1].trim();
      const avg = parseInt(m[3]);
      if (isNaN(avg) || avg < 10000 || avg > 50000) continue;
      let prio = -1;
      if (name.includes('标准ADC12') || name.includes('ADC12')) prio = 0;
      else if (name.includes('压铸铝锭')) prio = 1;
      else if (name.includes('保太')) prio = 2;
      if (prio >= 0) candidates.push({ name, avg, prio });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.prio - b.prio);
    return candidates[0].avg;
  } catch {
    return null;
  }
}

export async function getRealtimeBasePrices(): Promise<RealtimeBasePrices> {
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;
  const out: RealtimeBasePrices = { ...FALLBACK };
  const sources: Record<string, string> = {};
  try {
    const fut = await fetchFutures();
    const futRec = fut as unknown as Record<string, number>;
    for (const key of ['hotRoll', 'ss304', 'zinc', 'al', 'pp'] as const) {
      const v = futRec[key];
      if (typeof v === 'number' && v > 0) {
        (out as unknown as Record<string, number>)[key] = v;
        sources[key] = `sina:${FUTURES.find(([k]) => k === key)?.[1] ?? ''}`;
      }
    }
  } catch { /* 回退默认 */ }
  // ADC12：优先现货，失败回退铝期货×0.95，再回退 22000
  const adc12Spot = await fetchAdc12Spot();
  if (adc12Spot) {
    out.adc12 = adc12Spot;
    sources.adc12 = 'lvdingjia:ADC12';
  } else {
    const alPrice = (out as unknown as Record<string, number>).al;
    if (typeof alPrice === 'number' && alPrice > 0) {
      out.adc12 = Math.round(alPrice * 0.95);
      sources.adc12 = 'sina:AL0×0.95';
    }
  }
  out.sources = sources;
  out.updatedAt = new Date().toISOString();
  cached = { data: out, timestamp: Date.now() };
  return out;
}
