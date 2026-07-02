'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { 
  Package,
  TrendingUp,
  RefreshCw,
  FileText,
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
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
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
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success) setTotalProducts(data.data.length);
      } catch (error) {
        console.error('获取产品统计失败:', error);
      }
    };

    fetchAluminumPrice();
    fetchProducts();
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* 顶部信息栏 */}
      <div className="bg-white border-b px-6 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-100">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-gray-500">铝锭价</span>
            {aluminumPrice ? (
              <>
                <span className="font-bold text-orange-600">¥{aluminumPrice.price.toLocaleString()}</span>
                <span className={`text-xs ${aluminumPrice.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-gray-400 text-xs">加载中...</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Package className="w-4 h-4" />
            <span>产品库 <Badge variant="secondary" className="font-medium">{totalProducts}</Badge></span>
          </div>
        </div>
        <Link href="/history" className="text-sm text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1.5">
          <FileText className="w-4 h-4" />
          报价历史
        </Link>
      </div>
      
      {/* 主内容区 - 全屏ChatPanel */}
      <div className="flex-1 overflow-hidden p-4">
        <ChatPanel />
      </div>
    </div>
  );
}
