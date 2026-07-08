'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import {
  Package,
  TrendingUp,
  RefreshCw,
  FileText,
  Loader2,
  Store,
  Search,
  Settings,
  Upload,
  Send,
  Bot,
  Image,
  Database,
  Calculator,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const ChatPanel = dynamic(() => import('@/components/ChatPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50/50 rounded-xl">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">加载AI助手...</p>
      </div>
    </div>
  ),
});

interface AluminumPrice {
  price: number;
  change: number;
  changePercent: number;
  source: string;
  date: string;
}

const FEATURE_CARDS = [
  { icon: Image, label: '上传图片识别材质', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-600', action: 'upload' },
  { icon: Database, label: '查询产品库存', color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600', action: 'inventory' },
  { icon: Calculator, label: '自动计算报价', color: 'from-orange-500 to-orange-600', bg: 'bg-orange-50', text: 'text-orange-600', action: 'calculate' },
  { icon: FileSpreadsheet, label: '解析PDF/Excel', color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', text: 'text-purple-600', action: 'parse' },
];

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [chatStarted, setChatStarted] = useState(false);

  // 认证拦截
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchAluminumPrice = async () => {
      try {
        const res = await fetch(`/api/market-price?material=${encodeURIComponent('铝型材')}`);
        const data = await res.json();
        if (data.success) setAluminumPrice(data.data);
      } catch (error) {
        console.error('获取铝锭价失败:', error);
      }
    };

    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams();
        if (user?.id) params.append('user_id', user.id);
        const res = await fetch(`/api/products?${params.toString()}`);
        const data = await res.json();
        if (data.success) setTotalProducts(data.data.length);
      } catch (error) {
        console.error('获取产品统计失败:', error);
      }
    };

    fetchAluminumPrice();
    fetchProducts();
  }, [user]);

  const handleFeatureClick = (action: string) => {
    setChatStarted(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">正在加载...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 深蓝顶部导航栏 */}
      <header className="bg-[#1a2a4a] text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-wide">铝庭价</span>
          {aluminumPrice && (
            <div className="flex items-center gap-1.5 ml-4 text-sm opacity-90">
              <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-semibold text-orange-400">¥{aluminumPrice.price.toLocaleString()}</span>
              <span className={`text-xs ${aluminumPrice.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/products" className="flex items-center gap-1.5 text-sm opacity-80 hover:opacity-100 transition-opacity">
            <Package className="w-4 h-4" />
            产品库 <Badge variant="secondary" className="bg-white/20 text-white border-0 font-medium">{totalProducts}</Badge>
          </Link>
          <Link href="/history" className="flex items-center gap-1.5 text-sm opacity-80 hover:opacity-100 transition-opacity">
            <FileText className="w-4 h-4" />
            报价历史
          </Link>
          <Settings className="w-5 h-5 opacity-60 hover:opacity-100 cursor-pointer transition-opacity" />
        </div>
      </header>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧供应商栏 */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">供应商</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索供应商..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto px-3 py-2">
            <div className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-200 rounded-lg">
              <Store className="w-5 h-5 text-gray-300 mb-2" />
              <p className="text-xs text-gray-400 text-center">供应商即将添加</p>
            </div>
          </div>
        </aside>

        {/* 右侧主区域 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!chatStarted ? (
            <>
              {/* 欢迎区 */}
              <div className="flex-1 overflow-auto flex items-start justify-center pt-8 px-6">
                <div className="w-full max-w-2xl">
                  {/* 标题 */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
                      <Bot className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">AI智能报价助手</h1>
                      <p className="text-sm text-gray-500">图纸上传 · 智能报价</p>
                    </div>
                  </div>

                  {/* 功能卡片 */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                    <p className="text-sm text-gray-600 mb-4">
                      您好！我是AI智能报价助手，专门帮助您进行制造业产品报价。
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {FEATURE_CARDS.map((card) => {
                        const Icon = card.icon;
                        return (
                          <button
                            key={card.action}
                            onClick={() => handleFeatureClick(card.action)}
                            className={`flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left group`}
                          >
                            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                              <Icon className={`w-5 h-5 ${card.text}`} />
                            </div>
                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{card.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 输入框 */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex items-center gap-2">
                    <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                      <Upload className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      placeholder="输入您的需求，或直接上传图纸..."
                      className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
                      onKeyDown={(e) => e.key === 'Enter' && handleFeatureClick('upload')}
                    />
                    <button
                      onClick={() => handleFeatureClick('upload')}
                      className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors"
                    >
                      <ArrowRight className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* 快捷按钮 */}
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <button
                      onClick={() => handleFeatureClick('upload')}
                      className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      上传报价
                    </button>
                    <button
                      onClick={() => handleFeatureClick('calculate')}
                      className="px-5 py-2 rounded-full border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                    >
                      快速估算
                    </button>
                    <button
                      onClick={() => handleFeatureClick('calculate')}
                      className="px-5 py-2 rounded-full border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
                    >
                      非标材报价
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-hidden p-4">
              <ChatPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
