'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import ChatPanel from '@/components/ChatPanel';
import QuoteForm from '@/components/QuoteForm';
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
  LayoutGrid,
  Zap,
  Package,
  Warehouse,
  ClipboardList,
} from 'lucide-react';

interface AiFormUpdate {
  productType?: string;
  materialCategory?: string;
  materialGrade?: string;
  quantity?: number;
  length?: number;
  width?: number;
  height?: number;
  surfaceTreatment?: string;
  packaging?: string;
  secondaryProcessing?: string[];
}

interface PricingResult {
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
  notes?: string[];
  // 兼容旧字段
  unitWeight?: number;
  materialCost?: number;
  processingCost?: number;
  surfaceCost?: number;
  packagingCost?: number;
  shippingCost?: number;
  managementFee?: number;
  unitPrice?: number;
}

interface AluminumPrice {
  price: number;
  change: number;
  changePercent: number;
}

export default function QuotePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiFormData, setAiFormData] = useState<AiFormUpdate | null>(null);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const aiDataCounter = useRef(0);

  const handleFormUpdate = useCallback((data: AiFormUpdate) => {
    // 每次都用新对象引用，触发 QuoteForm 的 useEffect
    aiDataCounter.current += 1;
    setAiFormData({ ...data, _v: aiDataCounter.current } as AiFormUpdate);
  }, []);

  const handlePricingResult = useCallback((result: PricingResult) => {
    setPricingResult(result);
  }, []);

  // 登录检查：未登录用户重定向到登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/quote');
    }
  }, [authLoading, user, router]);

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
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* 顶部导航栏 */}
      <header className="shrink-0 bg-[#0F2040] shadow-md">
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

      {/* 主内容区：侧边栏 + 表单 + AI对话 */}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左侧导航栏 */}
        <aside className="hidden lg:flex flex-col w-48 bg-[#1a2940] border-r border-white/5 shrink-0 overflow-y-auto">
          <div className="px-3 py-4 space-y-1">
            {[
              { icon: LayoutGrid, label: '报价工作台', href: '/quote', active: true },
              { icon: Zap, label: '快速估价', href: '/quote?mode=quick' },
              { icon: Package, label: '产品管理', href: '/products' },
              { icon: Warehouse, label: '库存管理', href: '/inventory' },
              { icon: ClipboardList, label: '报价历史', href: '/history' },
            ].map(item => (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  item.active
                    ? 'bg-blue-600/20 text-blue-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        {/* 左栏：报价参数表单 */}
        <div className="hidden md:block w-80 border-r border-gray-200 bg-gray-50/50 overflow-y-auto shrink-0">
          <QuoteForm aiData={aiFormData} pricingResult={pricingResult} />
        </div>

        {/* 右栏：AI报价助手 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white">
          {/* 页面标题栏 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 px-4 py-3 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-slate-800">AI 智能报价</h1>
                <p className="text-xs text-slate-500 mt-0.5">上传图纸 / 描述需求，AI将自动识别并填入参数</p>
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
          <div className="flex-1 p-3 min-h-0 overflow-hidden">
            <ChatPanel onFormUpdate={handleFormUpdate} onPricingResult={handlePricingResult} />
          </div>
        </div>
      </main>
    </div>
  );
}
