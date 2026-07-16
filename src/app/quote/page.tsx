'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import {
  TrendingUp,
  LogOut,
  Menu,
  X,
  Loader2,
  Factory,
  Upload,
  History,
  User,
} from 'lucide-react';

const ChatPanel = dynamic(() => import('@/components/ChatPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">加载AI报价助手...</p>
      </div>
    </div>
  ),
});

interface AluminumPrice {
  price: number;
  change: number;
  changePercent: number;
}

export default function QuotePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 获取实时铝价
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
    fetchAluminumPrice();
    const interval = setInterval(fetchAluminumPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0F2040] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <Factory className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white">工品报价</span>
                <span className="hidden sm:inline text-xs text-white/60 ml-1">gyparts.cn</span>
              </div>
            </Link>

            {/* 桌面导航菜单 */}
            <nav className="hidden lg:flex items-center gap-5">
              <Link href="/#ai-quote" className="text-sm text-white/80 hover:text-white transition-colors">
                AI 智能报价
              </Link>
              <Link href="/products" className="text-sm text-white/80 hover:text-white transition-colors">
                产品库
              </Link>
              <Link href="/market" className="text-sm text-white/80 hover:text-white transition-colors">
                实时金属行情
              </Link>
              <Link href="/help" className="text-sm text-white/80 hover:text-white transition-colors">
                帮助中心
              </Link>

              {/* 行情小标签 */}
              {aluminumPrice && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10">
                  <TrendingUp className="w-3.5 h-3.5 text-orange-300" />
                  <span className="text-xs text-white/60">铝锭价</span>
                  <span className="text-xs font-semibold text-orange-300">¥{aluminumPrice.price.toLocaleString()}</span>
                  <span className={`text-xs ${aluminumPrice.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                  </span>
                </div>
              )}
            </nav>

            {/* 右侧操作区 */}
            <div className="hidden lg:flex items-center gap-3">
              {authLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-white/60" />
              ) : user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/profile"
                    className="p-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="p-2 text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                    title="退出登录"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
                    登录
                  </Link>
                  <span className="text-white/30">/</span>
                  <Link href="/register" className="text-sm text-white/70 hover:text-white transition-colors">
                    注册
                  </Link>
                </div>
              )}
            </div>

            {/* 移动端菜单按钮 */}
            <button
              className="lg:hidden text-white p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0F2040] border-t border-white/10 px-4 py-3 space-y-2">
            <Link href="/products" className="block text-sm text-white/80 py-2" onClick={() => setMobileMenuOpen(false)}>产品库</Link>
            <Link href="/market" className="block text-sm text-white/80 py-2" onClick={() => setMobileMenuOpen(false)}>实时金属行情</Link>
            <Link href="/help" className="block text-sm text-white/80 py-2" onClick={() => setMobileMenuOpen(false)}>帮助中心</Link>
            {!user && (
              <div className="flex gap-3 pt-2 border-t border-white/10">
                <Link href="/login" className="text-sm text-white/70" onClick={() => setMobileMenuOpen(false)}>登录</Link>
                <Link href="/register" className="text-sm text-white/70" onClick={() => setMobileMenuOpen(false)}>注册</Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* 主内容区：AI报价助手 */}
      <main className="flex-1 pt-16 flex flex-col">
        {/* 页面标题栏 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-800">AI 智能报价</h1>
              <p className="text-sm text-slate-500 mt-0.5">上传图纸 / 描述需求，实时核算全工序成本</p>
            </div>
            <div className="flex items-center gap-3">
              {aluminumPrice && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200">
                  <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs text-slate-500">铝锭价</span>
                  <span className="text-sm font-bold text-slate-800">¥{aluminumPrice.price.toLocaleString()}/吨</span>
                  <span className={`text-xs font-medium ${aluminumPrice.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ChatPanel - 占满剩余空间 */}
        <div className="flex-1 px-4 py-4">
          <div className="max-w-4xl mx-auto h-full">
            <ChatPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
