'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import {
  Package,
  TrendingUp,
  LogOut,
  Menu,
  X,
  Loader2,
  Calculator,
  Factory,
  BarChart3,
  FileText,
  ChevronDown,
  Lightbulb,
  Settings,
  HardDrive,
  Upload,
  History,
  User,
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
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const chatPanelRef = useRef<HTMLDivElement>(null);

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

  // 快捷提问按钮点击 - 滚动到ChatPanel
  const scrollToChat = () => {
    if (chatPanelRef.current) {
      chatPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // 报价模板库点击提示
  const handleTemplateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    alert('功能即将上线');
  };

  // FAQ 数据
  const faqItems = [
    {
      question: '支持哪些图纸、文件格式上传？',
      answer: 'DWG、DXF、PDF、图片、Excel BOM、压缩包批量上传',
    },
    {
      question: '报价数据、图纸文件会泄露吗？',
      answer: '所有图纸与报价数据加密存储，仅本账号可见',
    },
    {
      question: '新用户免费额度有多少？',
      answer: '注册即可免费解析2套图纸完整报价',
    },
    {
      question: '适配哪些加工行业？',
      answer: '铝型材、照明配件、CNC五金、冲压、机箱外壳制造工厂',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ==================== 区域1：顶部悬浮导航栏 ==================== */}
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
              <a href="#ai-quote" className="text-sm font-bold text-white">
                AI 智能报价
              </a>
              <Link href="/products" className="text-sm text-white/80 hover:text-white transition-colors">
                产品库
              </Link>
              <Link href="/market" className="text-sm text-white/80 hover:text-white transition-colors">
                实时金属行情
              </Link>
              <a href="#" onClick={handleTemplateClick} className="text-sm text-white/80 hover:text-white transition-colors">
                报价模板库
              </a>
              <Link href="/help" className="text-sm text-white/80 hover:text-white transition-colors">
                工艺知识库
              </Link>
              <Link href="/help" className="text-sm text-white/80 hover:text-white transition-colors">
                帮助中心
              </Link>

              {/* 行情小标签 */}
              {aluminumPrice && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10">
                  <TrendingUp className="w-3.5 h-3.5 text-orange-300" />
                  <span className="text-xs text-white/60">灵通铝锭价</span>
                  <span className="text-xs font-semibold text-orange-300">¥{aluminumPrice.price.toLocaleString()}</span>
                  <span className={`text-xs ${aluminumPrice.change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {aluminumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(aluminumPrice.changePercent).toFixed(2)}%
                  </span>
                </div>
              )}
            </nav>

            {/* 右侧操作区 */}
            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/quote"
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                免费上传图纸报价
              </Link>
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

        {/* 移动端下拉菜单 */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0F2040] border-t border-white/10 px-4 py-4 space-y-3">
            <a href="#ai-quote" className="block text-sm font-bold text-white" onClick={() => setMobileMenuOpen(false)}>AI 智能报价</a>
            <Link href="/products" className="block text-sm text-white/80" onClick={() => setMobileMenuOpen(false)}>产品库</Link>
            <Link href="/market" className="block text-sm text-white/80" onClick={() => setMobileMenuOpen(false)}>实时金属行情</Link>
            <Link href="/help" className="block text-sm text-white/80" onClick={() => setMobileMenuOpen(false)}>帮助中心</Link>
            {aluminumPrice && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 w-fit">
                <TrendingUp className="w-3.5 h-3.5 text-orange-300" />
                <span className="text-xs text-orange-300 font-semibold">灵通铝锭价 ¥{aluminumPrice.price.toLocaleString()}</span>
              </div>
            )}
            <div className="pt-3 border-t border-white/10 space-y-2">
              <Link href="/quote" className="block w-full text-center px-4 py-2.5 bg-[#2563EB] text-white text-sm font-medium rounded-lg">
                免费上传图纸报价
              </Link>
              {!user && (
                <div className="flex gap-2 justify-center">
                  <Link href="/login" className="text-sm text-white/70">登录</Link>
                  <span className="text-white/30">/</span>
                  <Link href="/register" className="text-sm text-white/70">注册</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ==================== 区域2：首屏Banner价值区 ==================== */}
      <section className="pt-16 bg-gradient-to-b from-[#0F2040] to-[#1a3260] min-h-[520px] flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            10秒AI自动核算加工成本
            <br />
            <span className="text-blue-300">告别人工算料耗、算工时</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            基于CAD图纸/BOM工艺参数联动灵通实时金属行情，自动核算材料费、CNC加工、氧化、喷涂全工序费用，一键导出工厂专用报价单，杜绝漏算成本、报价亏损。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/quote"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/30 text-base"
            >
              <Upload className="w-5 h-5" />
              免费上传图纸报价
            </Link>
            <a
              href="#cases"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors border border-white/20 text-base"
            >
              <FileText className="w-5 h-5" />
              查看加工报价案例
            </a>
          </div>
        </div>
      </section>

      {/* ==================== 区域3：四大信任数据卡片 ==================== */}
      <section className="bg-white py-12 sm:py-16 -mt-8 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">⏱️</div>
              <div className="text-2xl sm:text-3xl font-bold text-[#2563EB] mb-1">10秒</div>
              <div className="text-sm text-slate-600 font-medium">极速报价</div>
              <div className="text-xs text-slate-400 mt-1">平均10秒生成完整报价单</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">📦</div>
              <div className="text-2xl sm:text-3xl font-bold text-[#2563EB] mb-1">40+</div>
              <div className="text-sm text-slate-600 font-medium">覆盖品类</div>
              <div className="text-xs text-slate-400 mt-1">铝型材/五金加工品类</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">📈</div>
              <div className="text-2xl sm:text-3xl font-bold text-[#2563EB] mb-1">每日更新</div>
              <div className="text-sm text-slate-600 font-medium">行情同步</div>
              <div className="text-xs text-slate-400 mt-1">自动更新灵通铝、铜、不锈钢价格</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">🏭</div>
              <div className="text-2xl sm:text-3xl font-bold text-[#2563EB] mb-1">2000+</div>
              <div className="text-sm text-slate-600 font-medium">企业在用</div>
              <div className="text-xs text-slate-400 mt-1">照明、五金制造工厂</div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 区域4：三大核心优势板块 ==================== */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">为什么选择工品报价？</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">三大核心能力，让工厂报价不再困难</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* 卡片1 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg hover:border-blue-200 transition-all">
              <div className="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mb-5">
                <TrendingUp className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">原材料行情自动联动</h3>
              <p className="text-sm text-slate-500 mb-3">无需手动查价，原材料成本实时同步。</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                系统每日同步灵通现货金属价，报价单自动跟随铝/铜/不锈钢价格浮动。
              </p>
            </div>
            {/* 卡片2 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg hover:border-blue-200 transition-all">
              <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-5">
                <Settings className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">内置完整加工工艺库</h3>
              <p className="text-sm text-slate-500 mb-3">上百套标准工序工时，减少人为误差。</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                内置挤压、冲压、CNC、拉丝、氧化、喷粉等工艺标准损耗、工时模板。
              </p>
            </div>
            {/* 卡片3 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg hover:border-blue-200 transition-all">
              <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mb-5">
                <HardDrive className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">私有报价模板存储</h3>
              <p className="text-sm text-slate-500 mb-3">保存本厂加价、损耗参数，一键复用。</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                自定义工厂毛利率、废料损耗、包装运费规则。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 区域5：AI智能报价助手交互区 ==================== */}
      <section id="ai-quote" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 模块标题 */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">
              AI智能报价助手｜支持图纸/压缩包/BOM文件拖拽上传
            </h2>
          </div>

          {/* 助手功能清单 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-800">图纸解析</div>
                <div className="text-xs text-slate-500 mt-1">识别DWG/DXF/PDF/图片，自动提取尺寸、材质、加工工序</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl">
              <Calculator className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-800">智能核价</div>
                <div className="text-xs text-slate-500 mt-1">联动实时金属价，自动计算料重、加工费、表面处理成本</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl">
              <Package className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-800">文件处理</div>
                <div className="text-xs text-slate-500 mt-1">批量解析Excel BOM，批量生成多款产品报价</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl">
              <BarChart3 className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-slate-800">单据导出</div>
                <div className="text-xs text-slate-500 mt-1">生成带工厂抬头、无水印PDF正式报价单</div>
              </div>
            </div>
          </div>

          {/* 快捷提问按钮 */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            <button onClick={scrollToChat} className="px-4 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-sm text-slate-600 rounded-full transition-colors border border-slate-200 hover:border-blue-200">
              上传铝型材图纸算报价
            </button>
            <button onClick={scrollToChat} className="px-4 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-sm text-slate-600 rounded-full transition-colors border border-slate-200 hover:border-blue-200">
              批量导入BOM核算成本
            </button>
            <button onClick={scrollToChat} className="px-4 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-sm text-slate-600 rounded-full transition-colors border border-slate-200 hover:border-blue-200">
              查询今日灵通铝锭价格
            </button>
            <button onClick={scrollToChat} className="px-4 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-sm text-slate-600 rounded-full transition-colors border border-slate-200 hover:border-blue-200">
              导出标准工厂报价单
            </button>
          </div>

          {/* ChatPanel + 右侧工具栏 */}
          <div ref={chatPanelRef} className="flex gap-4" style={{ height: '600px' }}>
            {/* 左侧工具按钮 */}
            <div className="hidden sm:flex flex-col gap-2 w-16 bg-slate-50 rounded-l-2xl border border-r-0 border-slate-200 p-3 items-center justify-start pt-6">
              <Link href="/quote" className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 transition-colors group">
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                <span className="text-[10px] text-slate-400 group-hover:text-blue-600">上传</span>
              </Link>
              <Link href="/history" className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 transition-colors group">
                <History className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                <span className="text-[10px] text-slate-400 group-hover:text-blue-600">历史</span>
              </Link>
              <Link href="/profile" className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50 transition-colors group">
                <User className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                <span className="text-[10px] text-slate-400 group-hover:text-blue-600">我的</span>
              </Link>
            </div>

            {/* 主对话区 - ChatPanel */}
            <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <ChatPanel />
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 区域6：客户落地案例板块 ==================== */}
      <section id="cases" className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">上千家加工工厂真实使用效果</h2>
            <p className="text-slate-500">看看同行们如何通过AI报价提升效率</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* 案例1 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center">
                  <Lightbulb className="w-6 h-6 text-yellow-500" />
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block">照明铝型材厂</div>
                </div>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                原有1小时核算1套图纸，现10秒批量生成10款报价
              </p>
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <span className="text-2xl font-bold text-[#2563EB]">90%</span>
                <span className="text-sm text-slate-500">报价亏损减少</span>
              </div>
            </div>
            {/* 案例2 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Settings className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block">五金冲压配件厂</div>
                </div>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                新人无需熟记工艺工时，3分钟独立完成客户完整报价
              </p>
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <span className="text-2xl font-bold text-[#2563EB]">3分钟</span>
                <span className="text-sm text-slate-500">新人独立完成报价</span>
              </div>
            </div>
            {/* 案例3 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Factory className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block">机箱CNC加工厂</div>
                </div>
              </div>
              <p className="text-slate-700 leading-relaxed mb-4">
                自动同步铝锭浮动价，每月减少原材料成本核算误差
              </p>
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <span className="text-2xl font-bold text-[#2563EB]">实时同步</span>
                <span className="text-sm text-slate-500">铝锭浮动价</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 区域7：高频FAQ问答板块 ==================== */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">常见使用问题</h2>
            <p className="text-slate-500">快速了解工品报价的核心能力</p>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                >
                  <span className="text-base font-medium text-slate-800">{item.question}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 ml-4 transition-transform ${faqOpen === idx ? 'rotate-180' : ''}`} />
                </button>
                {faqOpen === idx && (
                  <div className="px-5 pb-5">
                    <p className="text-sm text-slate-600 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== 区域8：页脚 ==================== */}
      <footer className="bg-[#0F2040] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">产品</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/quote" className="hover:text-white transition-colors">AI智能报价</Link></li>
                <li><Link href="/products" className="hover:text-white transition-colors">产品库</Link></li>
                <li><Link href="/market" className="hover:text-white transition-colors">实时金属行情</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">帮助</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/help" className="hover:text-white transition-colors">操作教程</Link></li>
                <li><Link href="/help" className="hover:text-white transition-colors">工艺知识库</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">在线客服</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">商务</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>工厂合作</li>
                <li>功能定制</li>
                <li><Link href="/contact" className="hover:text-white transition-colors">联系我们</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">版权</h4>
              <p className="text-sm text-slate-400">
                ©{new Date().getFullYear()} 工品报价 gyparts.cn
                <br />
                工业品AI报价平台
              </p>
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
