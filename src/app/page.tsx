'use client';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import {
  Upload,
  ScanLine,
  FileText,
  Calculator,
  ArrowRight,
  ChevronRight,
  Handshake,
  History,
} from 'lucide-react';

// 三步流程：比罗列「核心能力」更能回答"我要做什么、多久出结果"
const steps = [
  { icon: Upload, title: '上传图纸', desc: 'STP / STEP / DXF / DWG / PDF / 图片' },
  { icon: ScanLine, title: 'AI 识别尺寸', desc: '自动读取长宽厚、孔数、折弯与工艺' },
  { icon: FileText, title: '出报价单', desc: '材料 + 加工 + 表面处理，可保存导出' },
];

// 报价单示例（让首屏右边那片空白说清"产出什么"，数值为示例）
const demoRows = [
  { label: '材料费', value: '¥1.23' },
  { label: '加工费', value: '¥1.57' },
  { label: '表面处理费', value: '—' },
  { label: '包装 + 运输', value: '¥0.04' },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      {/* 首屏：左文案 + 右报价单示例（原右侧是一大片空白） */}
      <section className="mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-slate-50 border border-gray-100 shadow-sm px-6 py-8 md:px-10 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* 左：只留入口按钮。原有的大标题 + 一句营销文案（"铝型材·五金加工 /
                上传图纸秒级出报价 / 免注册试算…"）业主判定无用，已删除。 */}
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
                    手动填单
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

            {/* 右：报价单示例 */}
            <div className="lg:justify-self-end w-full max-w-sm mx-auto lg:mx-0">
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">报价单</p>
                    <p className="text-xs text-gray-400 mt-0.5">YL-175-3 · 1.5mm 铝板 · 1 件</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">示例</span>
                </div>

                <div className="space-y-2 text-sm">
                  {demoRows.map((r) => (
                    <div key={r.label} className="flex items-center justify-between text-gray-600">
                      <span>{r.label}</span>
                      <span className="tabular-nums">{r.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-dashed border-gray-200 flex items-baseline justify-between">
                  <span className="text-sm text-gray-500">含税单价</span>
                  <span className="text-xl font-bold text-blue-600 tabular-nums">¥4.03</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 三步流程 */}
      <section className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              {/* 步骤之间的连接箭头（手机端隐藏） */}
              {i < steps.length - 1 && (
                <ChevronRight className="hidden sm:block absolute -right-[13px] top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 z-10" />
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-400">STEP {i + 1}</span>
              </div>
              <h2 className="font-semibold text-gray-900 mb-1">{s.title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
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
