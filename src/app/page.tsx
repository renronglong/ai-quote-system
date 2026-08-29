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
  { icon: ShieldCheck, title: '五大品类', desc: '挤压型材、板材、压铸、锌合金、注塑' },
];

export default function HomePage() {
  return (
    <AppLayout>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 左侧：供应商专区 */}
        <div className="md:col-span-1 order-2 md:order-1">
          <div className="rounded-xl border border-gray-200 bg-white p-5 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Handshake className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-gray-900 text-lg">供应商专区</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              免费入驻平台，发布产品与产能，接收采购方精准询价
            </p>
            <Link href="/supplier" className="block">
              <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 font-semibold">
                供应商入驻
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>

            <div className="h-px bg-gray-100 my-4" />

            <div className="space-y-1">
              {supplierLinks.map((l) => (
                <Link
                  key={l.href + l.label}
                  href={l.href}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <l.icon className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-emerald-700">{l.label}</p>
                    <p className="text-xs text-gray-400">{l.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：报价主入口 */}
        <div className="md:col-span-2 order-1 md:order-2 space-y-4">
          {/* Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700 text-white px-6 py-10 md:px-10 md:py-12 shadow-lg">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-xs md:text-sm mb-4">
                <Sparkles className="w-4 h-4" />
                制造业一站式 AI 报价平台
              </div>
              <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-3">
                铝型材 · 五金加工报价
                <br className="hidden md:block" />
                不用等，秒级出结果
              </h1>
              <p className="text-blue-100 text-sm md:text-base mb-7 leading-relaxed">
                实时同步南海铝锭价，上传图纸AI自动识别尺寸，
                报价免注册，打开就能用。
              </p>
              <Link href="/quote">
                <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold">
                  <Calculator className="w-5 h-5 mr-2" />
                  开始报价
                </Button>
              </Link>
            </div>
          </div>

          {/* 报价特性 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quoteHighlights.map((h) => (
              <div key={h.title} className="rounded-xl border border-gray-200 bg-white p-4">
                <h.icon className="w-5 h-5 text-blue-600 mb-2" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{h.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>

          {/* 底部说明 */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" />报价无需注册</span>
            <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />注册送每日10次图纸AI识别</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />数据仅用于报价计算</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
