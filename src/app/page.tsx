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

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);

  // 认证拦截：未登录跳转登录页
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

  // 加载中
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

  // 未登录，不渲染（等待跳转）
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-[#1a2a4a] text-white px-6 py-3 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold tracking-wide">碧利莱 AI报价</span>
          <div className="h-5 w-px bg-white/20" />
          <div className="flex items-center gap-1.5 text-sm">
            <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-gray-300 text-xs">铝锭价</span>
            {aluminumPrice ? (
              <>
                <span className="font-semibold text-orange-400">¥{aluminumPrice.price.toLocaleString()}</span>
                <span className={`text-xs ${aluminumPrice.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-gray-500 text-xs">加载中...</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/products" className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors shadow-sm">
            <Package className="w-4 h-4" />
            产品库 ({totalProducts})
          </Link>
          <Link href="/history" className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors">
            <FileText className="w-4 h-4" />
            报价历史
          </Link>
        </div>
      </header>

      {/* 主体：直接显示聊天报价 */}
      <main className="flex-1 overflow-hidden">
        <ChatPanel />
      </main>
    </div>
  );
}
