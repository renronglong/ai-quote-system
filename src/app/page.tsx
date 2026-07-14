'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import {
  Zap,
  Package,
  TrendingUp,
  Users,
  ArrowRight,
  LogIn,
  UserPlus,
  LogOut,
  Menu,
  X,
  Loader2,
  ChevronRight,
  Clock,
  Shield,
  Calculator,
  Factory,
  BarChart3,
} from 'lucide-react';

const ChatPanel = dynamic(() => import('@/components/ChatPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-slate-50/50 rounded-xl">
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
  source: string;
  date: string;
}

export default function HomePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [aluminumPrice, setAluminumPrice] = useState<AluminumPrice | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showQuotePanel, setShowQuotePanel] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // 监听滚动，切换 header 样式
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 获取实时铝价（无论是否登录都展示）
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
    const interval = setInterval(fetchAluminumPrice, 5 * 60 * 1000); // 5分钟更新一次
    return () => clearInterval(interval);
  }, []);

  // 已登录用户可以直接看到报价面板
  useEffect(() => {
    if (user) setShowQuotePanel(true);
  }, [user]);

  const productCategories = [
    {
      name: '铝型材',
      desc: '工业铝型材、建筑铝型材、装饰铝型材',
      icon: '🏭',
      features: ['CNC加工', '表面处理', '定制截断'],
      href: user ? '/products?category=aluminum' : '/login',
    },
    {
      name: '板材加工',
      desc: '铝板、铝塑板、蜂窝板',
      icon: '📐',
      features: ['激光切割', '折弯成型', '表面氧化'],
      href: user ? '/products?category=plate' : '/login',
    },
    {
      name: '压铸件',
      desc: '铝合金压铸件、锌合金压铸件',
      icon: '⚙️',
      features: ['模具设计', '精密压铸', '后加工'],
      href: user ? '/products?category=casting' : '/login',
    },
    {
      name: '定制加工',
      desc: '来图来样定制、OEM/ODM服务',
      icon: '🔧',
      features: ['图纸报价', '工艺评估', '批量生产'],
      href: user ? '/products?category=custom' : '/login',
    },
  ];

  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'AI 智能报价',
      desc: '基于工艺参数自动计算，秒级生成精准报价单',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: <Package className="w-6 h-6" />,
      title: '多品类支持',
      desc: '铝型材、板材、压铸件等多品类一站式报价管理',
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: '实时铝价',
      desc: '对接市场铝锭价数据，报价随行情自动调整',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: '专业可靠',
      desc: '深耕制造业多年，覆盖CNC、压铸、钣金等全工艺',
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 - 透明浮在Hero上，滚动后变实心 */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 ${
                scrolled ? 'bg-gradient-to-br from-blue-600 to-blue-700' : 'bg-white/15 backdrop-blur-sm'
              }`}>
                <Factory className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className={`text-lg font-bold transition-colors duration-300 ${scrolled ? 'text-slate-800' : 'text-white'}`}>工品报价</span>
                <span className={`hidden sm:inline text-xs ml-1 transition-colors duration-300 ${scrolled ? 'text-slate-400' : 'text-white/60'}`}>gyparts.cn</span>
              </div>
            </Link>

            {/* 桌面导航 */}
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className={`text-sm transition-colors duration-300 ${scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}>核心功能</a>
              <a href="#categories" className={`text-sm transition-colors duration-300 ${scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}>产品品类</a>
              <Link href="/products" className={`text-sm transition-colors duration-300 ${scrolled ? 'text-slate-600 hover:text-slate-900' : 'text-white/80 hover:text-white'}`}>产品库</Link>
              {/* 实时铝价 */}
              {aluminumPrice && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors duration-300 ${
                  scrolled ? 'bg-orange-50' : 'bg-white/10'
                }`}>
                  <TrendingUp className={`w-3.5 h-3.5 transition-colors duration-300 ${scrolled ? 'text-orange-500' : 'text-orange-300'}`} />
                  <span className={`text-xs transition-colors duration-300 ${scrolled ? 'text-slate-500' : 'text-white/60'}`}>铝锭价</span>
                  <span className={`text-xs font-semibold transition-colors duration-300 ${scrolled ? 'text-orange-600' : 'text-orange-300'}`}>¥{aluminumPrice.price.toLocaleString()}</span>
                  <span className={`text-xs ${aluminumPrice.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                  </span>
                </div>
              )}
            </nav>

            {/* 右侧按钮 */}
            <div className="hidden md:flex items-center gap-3">
              {authLoading ? (
                <Loader2 className={`w-5 h-5 animate-spin transition-colors duration-300 ${scrolled ? 'text-slate-400' : 'text-white/60'}`} />
              ) : user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/quote"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    开始报价
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm transition-colors duration-300 ${scrolled ? 'text-slate-600' : 'text-white/70'}`}>{user.phone || user.email || '用户'}</span>
                    <button
                      onClick={() => signOut()}
                      className={`p-1.5 rounded-md transition-colors duration-300 ${scrolled ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
                      title="退出登录"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={`px-4 py-2 text-sm rounded-lg transition-all duration-300 ${
                      scrolled ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50' : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    免费注册
                  </Link>
                </>
              )}
            </div>

            {/* 移动端菜单按钮 */}
            <button
              className={`md:hidden p-2 rounded-md transition-colors duration-300 ${
                scrolled ? 'text-slate-600 hover:bg-slate-100' : 'text-white hover:bg-white/10'
              }`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 移动端菜单 */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 py-4 px-4 space-y-3">
            <a href="#features" className="block text-sm text-slate-600 py-2" onClick={() => setMobileMenuOpen(false)}>核心功能</a>
            <a href="#categories" className="block text-sm text-slate-600 py-2" onClick={() => setMobileMenuOpen(false)}>产品品类</a>
            <Link href="/products" className="block text-sm text-slate-600 py-2" onClick={() => setMobileMenuOpen(false)}>产品库</Link>
            {aluminumPrice && (
              <div className="flex items-center gap-1.5 py-2">
                <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs text-slate-500">铝锭价</span>
                <span className="text-xs font-semibold text-orange-600">¥{aluminumPrice.price.toLocaleString()}</span>
              </div>
            )}
            <div className="pt-3 border-t border-slate-100 flex gap-2">
              {user ? (
                <>
                  <Link href="/quote" className="flex-1 text-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">
                    开始报价
                  </Link>
                  <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">
                    退出
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="flex-1 text-center px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg">
                    登录
                  </Link>
                  <Link href="/register" className="flex-1 text-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">
                    注册
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero 区域 - 紧凑 banner 风格，header 透明叠加 */}
      <section>
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
          {/* 背景装饰 */}
          <div className="absolute inset-0">
            <div className="absolute top-10 left-10 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2Mmgxem0tMiAwaC0ydjJoMnYtMnptLTQgMGgtMnYyaDJ2LTJ6bS00IDBoLTJ2Mmgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 sm:pt-28 sm:pb-16">
            <div className="max-w-3xl">
              {/* 标签 */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-400/20 rounded-full mb-4">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-xs text-blue-300 font-medium">面向制造业的一站式报价服务平台</span>
              </div>

              {/* 主标题 */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">AI 智能报价</span>
                <span className="text-white/70 mx-2">—</span>
                <span className="text-white/90">让制造业报价更快更准</span>
              </h1>

              {/* 副标题 */}
              <p className="text-sm sm:text-base text-slate-400 mb-6 max-w-2xl leading-relaxed">
                基于工艺参数与实时铝价，AI 自动计算加工成本，秒级生成精准报价单。
              </p>

              {/* CTA 按钮 */}
              <div className="flex flex-wrap items-center gap-3">
                {user ? (
                  <>
                    <button
                      onClick={() => setShowQuotePanel(!showQuotePanel)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 text-sm"
                    >
                      <Calculator className="w-4 h-4" />
                      {showQuotePanel ? '收起报价' : '开始报价'}
                    </button>
                    <Link
                      href="/products"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl transition-all border border-white/10 text-sm"
                    >
                      <Package className="w-4 h-4" />
                      浏览产品库
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/register"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      免费注册，立即体验
                    </Link>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-medium rounded-xl transition-all border border-white/10 text-sm"
                    >
                      <LogIn className="w-4 h-4" />
                      已有账号登录
                    </Link>
                  </>
                )}
              </div>

              {/* 数据指标 */}
              <div className="mt-6 flex items-center gap-6 sm:gap-10">
                <div>
                  <div className="text-lg sm:text-xl font-bold text-white">10s</div>
                  <div className="text-xs text-slate-500 mt-0.5">平均报价时间</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-lg sm:text-xl font-bold text-white">4+</div>
                  <div className="text-xs text-slate-500 mt-0.5">产品品类</div>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <div className="text-lg sm:text-xl font-bold text-white">实时</div>
                  <div className="text-xs text-slate-500 mt-0.5">铝价同步</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 已登录用户 - 报价面板区域 */}
      {user && showQuotePanel && (
        <section className="bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ height: '600px' }}>
              <ChatPanel />
            </div>
          </div>
        </section>
      )}

      {/* 功能亮点区 */}
      <section id="features" className="py-20 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">核心能力</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              专为制造业打造的智能报价引擎，从材料成本到加工工艺，全链路自动化报价
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="group relative p-6 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 产品品类展示 */}
      <section id="categories" className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-4">支持品类</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              覆盖主流工业品加工品类，一站式满足多样化报价需求
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {productCategories.map((cat, idx) => (
              <Link
                key={idx}
                href={cat.href}
                className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-4xl mb-4">{cat.icon}</div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-sm text-slate-500 mb-4">{cat.desc}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {cat.features.map((f, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-md">
                      {f}
                    </span>
                  ))}
                </div>
                <div className="flex items-center text-sm text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  进入报价 <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 未登录用户 - 引导注册区域 */}
      {!user && !authLoading && (
        <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              立即注册，体验 AI 智能报价
            </h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
              免费注册即可获得 AI 报价能力，支持铝型材、板材、压铸件等多品类。
              实时对接铝锭价数据，报价更精准、更高效。
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
              >
                <UserPlus className="w-5 h-5" />
                免费注册
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-500/30 text-white font-medium rounded-xl hover:bg-blue-500/40 transition-colors border border-white/20"
              >
                <LogIn className="w-5 h-5" />
                已有账号？登录
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 已登录用户 - 快捷入口 */}
      {user && (
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6">快捷入口</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link href="/quote" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Calculator className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">AI 报价</div>
                  <div className="text-xs text-slate-400">智能生成报价单</div>
                </div>
              </Link>
              <Link href="/products" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <Package className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">产品库</div>
                  <div className="text-xs text-slate-400">管理产品数据</div>
                </div>
              </Link>
              <Link href="/history" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">报价历史</div>
                  <div className="text-xs text-slate-400">查看历史报价</div>
                </div>
              </Link>
              <Link href="/inventory" className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all group">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">库存管理</div>
                  <div className="text-xs text-slate-400">查看库存数据</div>
                </div>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Factory className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold">工品报价</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                面向制造业的一站式报价服务平台，AI 驱动，让报价更高效。
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">产品服务</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/quote" className="hover:text-white transition-colors">AI 报价</Link></li>
                <li><Link href="/products" className="hover:text-white transition-colors">产品库</Link></li>
                <li><Link href="/history" className="hover:text-white transition-colors">报价历史</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">支持品类</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>铝型材 CNC 加工</li>
                <li>板材加工</li>
                <li>压铸件</li>
                <li>定制加工</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-3">联系我们</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>网站：www.gyparts.cn</li>
                <li><Link href="/contact" className="hover:text-white transition-colors">联系表单</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} 工品报价 gyparts.cn — AI 驱动的一站式报价服务平台
          </div>
        </div>
      </footer>
    </div>
  );
}
