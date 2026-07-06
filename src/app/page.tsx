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
  Link2,
  ChevronLeft,
  ChevronRight,
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
  const [supplierCollapsed, setSupplierCollapsed] = useState(false);

  // 认证拦截：未登录跳转登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // 已登录才获取数据
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
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success) setTotalProducts(data.data.length);
      } catch (error) {
        console.error('获取产品统计失败:', error);
      }
    };

    fetchAluminumPrice();
    fetchProducts();
  }, [user]);

  // 加载中状态
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

  // 未登录，不渲染内容（等待跳转）
  if (!user) {
    return null;
  }

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
      
      {/* 主内容区 - 左侧供应商链接 + 右侧ChatPanel */}
      <div className="flex-1 overflow-hidden flex">
        {/* 供应商链接区域 */}
        <div className={`shrink-0 border-r bg-white flex flex-col transition-all duration-300 ${supplierCollapsed ? 'w-10' : 'w-52'}`}>
          {/* 折叠/展开按钮 */}
          <button
            onClick={() => setSupplierCollapsed(!supplierCollapsed)}
            className="flex items-center justify-center h-9 hover:bg-gray-100 border-b transition-colors"
            title={supplierCollapsed ? '展开供应商链接' : '收起供应商链接'}
          >
            {supplierCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {!supplierCollapsed && (
            <>
              <div className="px-3 py-2.5 border-b bg-gray-50/50">
                <div className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-semibold text-gray-700">供应商链接</span>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-3 py-2 space-y-1">
                <div className="flex items-center justify-center h-24 border-2 border-dashed border-gray-200 rounded-lg">
                  <p className="text-xs text-gray-400 text-center px-2">供应商链接即将添加<br/>敬请期待</p>
                </div>
              </div>
            </>
          )}

          {supplierCollapsed && (
            <div className="flex-1 flex items-start justify-center pt-3">
              <Link2 className="w-4 h-4 text-gray-300" />
            </div>
          )}
        </div>

        {/* 聊天区域 */}
        <div className="flex-1 overflow-hidden p-4">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
