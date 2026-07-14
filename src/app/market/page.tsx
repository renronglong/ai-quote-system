'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Factory,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface PriceItem {
  name: string;
  price: string;
  change: string;
  source: string;
  unit: string;
}

interface MarketData {
  success: boolean;
  material: string;
  prices: PriceItem[];
  data?: { price: number; change: number; changePercent: number };
  updatedAt: string;
  cached?: boolean;
  error?: string;
}

// 分类配置：将价格项归入不同板块
const PRICE_SECTIONS = [
  {
    title: '铝锭价',
    subtitle: '南海 · 长江 · 南储',
    keywords: ['南海铝锭', '长江铝锭', '南储', '上海铝锭'],
    accent: 'blue',
  },
  {
    title: '铝型材',
    subtitle: '电泳 · 喷涂 · 磨砂',
    keywords: ['电泳铝', '喷涂铝', '磨砂铝'],
    accent: 'emerald',
  },
  {
    title: '压铸铝',
    subtitle: 'ADC12 系列',
    keywords: ['ADC12', '压铸铝', '铝圆管'],
    accent: 'orange',
  },
];

function parseChange(changeStr: string): { value: number; direction: 'up' | 'down' | 'flat'; display: string } {
  const isDown = changeStr.includes('↓');
  const isUp = changeStr.includes('↑');
  const raw = parseInt(changeStr.replace(/[↑↓→]/g, '')) || 0;
  const value = isDown ? -raw : raw;
  return {
    value,
    direction: isDown ? 'down' : isUp ? 'up' : 'flat',
    display: value === 0 ? '持平' : `${isDown ? '-' : '+'}${Math.abs(value)}`,
  };
}

function getCardColor(direction: 'up' | 'down' | 'flat') {
  if (direction === 'up') return { bg: 'bg-red-50', border: 'border-red-100', badge: 'bg-red-100 text-red-700', text: 'text-red-600', arrow: 'text-red-500' };
  if (direction === 'down') return { bg: 'bg-green-50', border: 'border-green-100', badge: 'bg-green-100 text-green-700', text: 'text-green-600', arrow: 'text-green-500' };
  return { bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', text: 'text-slate-500', arrow: 'text-slate-400' };
}

function getAccentClasses(accent: string) {
  const map: Record<string, { header: string; dot: string }> = {
    blue: { header: 'from-blue-600 to-blue-700', dot: 'bg-blue-500' },
    emerald: { header: 'from-emerald-600 to-emerald-700', dot: 'bg-emerald-500' },
    orange: { header: 'from-orange-500 to-orange-600', dot: 'bg-orange-500' },
  };
  return map[accent] || map.blue;
}

function PriceCard({ item }: { item: PriceItem }) {
  const { value, direction, display } = parseChange(item.change);
  const colors = getCardColor(direction);
  const price = parseInt(item.price);

  return (
    <div className={`relative overflow-hidden rounded-xl border ${colors.border} ${colors.bg} p-5 transition-all hover:shadow-md hover:-translate-y-0.5 group`}>
      {/* 涨跌指示条 */}
      <div className={`absolute top-0 left-0 w-1 h-full ${
        direction === 'up' ? 'bg-red-400' : direction === 'down' ? 'bg-green-400' : 'bg-slate-300'
      }`} />

      <div className="pl-3">
        {/* 名称 */}
        <div className="text-sm text-slate-600 font-medium mb-3 truncate" title={item.name}>
          {item.name}
        </div>

        {/* 价格 */}
        <div className="flex items-end gap-1.5 mb-2">
          <span className="text-2xl sm:text-3xl font-bold text-slate-800 tabular-nums">
            {price.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 pb-1">{item.unit}</span>
        </div>

        {/* 涨跌 */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
            {direction === 'up' && <TrendingUp className="w-3 h-3" />}
            {direction === 'down' && <TrendingDown className="w-3 h-3" />}
            {direction === 'flat' && <Minus className="w-3 h-3" />}
            {display}
          </span>
          {value !== 0 && (
            <span className={`text-xs ${colors.text}`}>
              {((value / price) * 100).toFixed(2)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionBlock({ title, subtitle, items, accent }: {
  title: string;
  subtitle: string;
  items: PriceItem[];
  accent: string;
}) {
  const accentClasses = getAccentClasses(accent);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-1.5 h-6 rounded-full ${accentClasses.dot}`} />
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="text-xs text-slate-400 ml-auto">{items.length} 项</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, idx) => (
          <PriceCard key={idx} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function MarketPage() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market-price?material=${encodeURIComponent('铝型材')}`);
      const json = await res.json();

      // 同时获取压铸铝数据
      const res2 = await fetch(`/api/market-price?material=${encodeURIComponent('压铸铝')}`);
      const json2 = await res2.json();

      // 合并两个结果
      const allPrices: PriceItem[] = [...(json.prices || []), ...(json2.prices || [])];
      const updatedAt = json.updatedAt || json2.updatedAt || new Date().toISOString();

      if (allPrices.length > 0) {
        setData({
          success: true,
          material: '铝型材',
          prices: allPrices,
          data: json.data,
          updatedAt,
          cached: json.cached,
        });
        setLastFetch(new Date().toLocaleString('zh-CN'));
      } else {
        setError(json.error || json2.error || '未获取到价格数据');
      }
    } catch (err) {
      setError('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 按板块分类价格项
  const categorized: Record<string, PriceItem[]> = {};
  const uncategorized: PriceItem[] = [];

  if (data?.prices) {
    for (const item of data.prices) {
      let matched = false;
      for (const section of PRICE_SECTIONS) {
        if (section.keywords.some((kw) => item.name.includes(kw))) {
          if (!categorized[section.title]) categorized[section.title] = [];
          categorized[section.title].push(item);
          matched = true;
          break;
        }
      }
      if (!matched) uncategorized.push(item);
    }
  }

  // 概览卡片数据
  const summary = data?.data;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                  <Factory className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold text-slate-800">工品报价</span>
                  <span className="hidden sm:inline text-xs ml-1 text-slate-400">gyparts.cn</span>
                </div>
              </Link>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                返回首页
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 flex items-center gap-3">
              铝价行情
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                实时
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              数据来源：南海铝锭价 · 长江有色金属 · 行业公开报价
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '加载中...' : '刷新数据'}
          </button>
        </div>

        {/* 加载状态 */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-500">正在获取最新铝价数据...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && !data && (
          <div className="flex flex-col items-center justify-center py-24">
            <AlertCircle className="w-10 h-10 text-amber-500 mb-4" />
            <p className="text-slate-600 mb-2">{error}</p>
            <p className="text-sm text-slate-400 mb-4">可能是数据源暂时无法访问，请稍后重试</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              重新获取
            </button>
          </div>
        )}

        {/* 概览卡片 */}
        {summary && data && (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden">
              {/* 背景装饰 */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full -translate-y-32 translate-x-32" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-slate-400">今日铝锭参考价</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-300">
                    {data.cached ? '缓存' : '最新'}
                  </span>
                </div>
                <div className="flex items-end gap-3 mb-4">
                  <span className="text-4xl sm:text-5xl font-bold tabular-nums">
                    ¥{summary.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-slate-400 pb-2">元/吨</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    summary.change > 0
                      ? 'bg-red-500/20 text-red-300'
                      : summary.change < 0
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-slate-500/20 text-slate-300'
                  }`}>
                    {summary.change > 0 && <TrendingUp className="w-4 h-4" />}
                    {summary.change < 0 && <TrendingDown className="w-4 h-4" />}
                    {summary.change === 0 && <Minus className="w-4 h-4" />}
                    {summary.change > 0 ? '+' : ''}{summary.change} 元
                  </span>
                  <span className={`text-sm ${
                    summary.change > 0 ? 'text-red-400' : summary.change < 0 ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {summary.change > 0 ? '+' : ''}{summary.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 分类价格板块 */}
        {data && data.prices.length > 0 && (
          <>
            {PRICE_SECTIONS.map((section) => {
              const items = categorized[section.title];
              if (!items || items.length === 0) return null;
              return (
                <SectionBlock
                  key={section.title}
                  title={section.title}
                  subtitle={section.subtitle}
                  items={items}
                  accent={section.accent}
                />
              );
            })}

            {/* 未分类项 */}
            {uncategorized.length > 0 && (
              <SectionBlock
                title="其他"
                subtitle="更多铝价参考"
                items={uncategorized}
                accent="slate"
              />
            )}
          </>
        )}

        {/* 底部更新时间 */}
        {data && (
          <div className="mt-10 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>
                  数据更新时间：{new Date(data.updatedAt).toLocaleString('zh-CN')}
                </span>
              </div>
              <span>
                每 5 分钟自动刷新 · 数据仅供参考，实际以市场行情为准
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Factory className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">工品报价</span>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} 工品报价 gyparts.cn — 铝价行情数据仅供参考
          </p>
        </div>
      </footer>
    </div>
  );
}
