'use client';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Calculator,
  Building2,
  TrendingUp,
  Handshake,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Phone,
  LayoutDashboard,
  ChevronRight,
  Users,
  FileCheck,
  Clock,
} from 'lucide-react';

const supplierLinks = [
  { href: '/suppliers', label: '供应商产品库', desc: '浏览现货型材与模具', icon: Building2 },
  { href: '/supplier', label: '供应商工作台', desc: '登录管理产品与询价', icon: LayoutDashboard },
  { href: '/market', label: '铝价行情', desc: '南海现货铝锭价', icon: TrendingUp },
  { href: '/contact', label: '联系我们', desc: '合作咨询与支持', icon: Phone },
];

const quoteHighlights = [
  { icon: Sparkles, title: '图纸AI识别', desc: '上传截面图自动识别尺寸并填入报价表' },
  { icon: TrendingUp, title: '实时铝锭价', desc: '南海现货价每日同步，成本透明' },
  { icon: ShieldCheck, title: '六大品类', desc: '挤压型材、板材、压铸、锌合金、注塑、钢材' },
];

const stats = [
  { value: '2,500+', label: '在库产品', icon: Building2 },
  { value: '秒级', label: '报价速度', icon: Clock },
  { value: '6', label: '加工品类', icon: FileCheck },
  { value: '100+', label: '合作企业', icon: Users },
];

export default function HomePage() {
  return (
    <AppLayout>
      <section className="mb-8">
        <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 overflow-hidden shadow-xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
          </div>
          
          <div className="relative px-6 py-12 md:px-12 md:py-16 lg:px-16 lg:py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/90 mb-6">
                <Sparkles className="w-4 h-4" />
                <span>制造业一站式 AI 报价平台</span>
              </div>
              
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
                铝型材 · 五金加工
                <br />
                <span className="text-blue-400">智能报价，秒级出结果</span>
              </h1>
              
              <p className="text-lg text-slate-300 mb-8 max-w-2xl leading-relaxed">
                实时同步南海铝锭价，上传图纸AI自动识别尺寸。
                <br className="hidden md:block" />
                免注册试算，注册后保存并导出专业报价单。
              </p>
              
              <div className="flex flex-wrap gap-4">
                <Link href="/quote">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/30 px-6">
                    <Calculator className="w-5 h-5 mr-2" />
                    开始报价
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/suppliers">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-medium px-6">
                    浏览供应商
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm hover:shadow-md transition-shadow">
              <stat.icon className="w-5 h-5 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              核心能力
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {quoteHighlights.map((h) => (
                <div key={h.title} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                    <h.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{h.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{h.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 px-4 bg-white rounded-xl border border-gray-100">
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <Zap className="w-4 h-4 text-green-500" />免注册即可试算
            </span>
            <span className="w-px h-4 bg-gray-200 hidden sm:block" />
            <Link href="/register" className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Sparkles className="w-4 h-4" />注册送 100 积分
            </Link>
            <span className="w-px h-4 bg-gray-200 hidden sm:block" />
            <span className="flex items-center gap-1.5 text-sm text-gray-500">
              <ShieldCheck className="w-4 h-4 text-green-500" />数据仅用于报价计算
            </span>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Handshake className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">供应商专区</h2>
                <p className="text-xs text-gray-500">免费入驻平台</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              发布产品与产能，接收采购方精准询价
            </p>
            
            <Link href="/supplier" className="block mb-5">
              <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 font-semibold shadow-sm">
                供应商入驻
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <div className="h-px bg-gray-100 mb-3" />
            
            <div className="space-y-1">
              {supplierLinks.map((l) => (
                <Link
                  key={l.href + l.label}
                  href={l.href}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <l.icon className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 group-hover:text-emerald-700 transition-colors">{l.label}</p>
                    <p className="text-xs text-gray-400">{l.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
