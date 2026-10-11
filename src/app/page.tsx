'use client';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import QuickQuote from '@/components/QuickQuote';
import {
  Upload,
  Calculator,
  ArrowRight,
  ChevronRight,
  Handshake,
  History,
} from 'lucide-react';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      {/* 首屏：左入口 + 右快速报价估算器 */}
      <section className="mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-slate-50 border border-gray-100 shadow-sm px-6 py-8 md:px-10 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* 左：入口按钮。业主判定原大标题+营销文案无用，已删除 */}
            <div>
              <h1 className="text-lg font-semibold text-gray-900 mb-5">AI 智能报价 · 铝型材 / 五金加工</h1>

              <div className="flex flex-wrap items-center gap-3">
                <Link href="/quote/recognize">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm px-6">
                    <Upload className="w-5 h-5 mr-2" />
                    上传图纸报价
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/quote">
                  <Button size="lg" variant="outline" className="border-gray-300 font-semibold px-6">
                    <Calculator className="w-5 h-5 mr-2" />
                    完整报价器
                  </Button>
                </Link>
                {user && (
                  <Link href="/history">
                    <Button size="lg" variant="outline" className="border-gray-300 font-semibold px-6">
                      <History className="w-5 h-5 mr-2" />
                      我的报价
                    </Button>
                  </Link>
                )}
              </div>

              <Link
                href="/suppliers"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium mt-4 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                浏览供应商产品库
                <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            {/* 右：快速报价估算器（访客免登录即可填数出价） */}
            <div className="lg:justify-self-end w-full max-w-sm mx-auto lg:mx-0">
              <QuickQuote />
            </div>
          </div>
        </div>
      </section>

      {/* 供应商入口：一条横幅 */}
      <section>
        <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold text-gray-900">我是铝型材 / 五金供应商</p>
            <p className="text-sm text-gray-500">免费入驻，发布产品与产能，接收采购方精准询价</p>
          </div>
          <Link href="/supplier" className="shrink-0">
            <Button className="bg-emerald-600 hover:bg-emerald-700 font-semibold">
              免费入驻
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
