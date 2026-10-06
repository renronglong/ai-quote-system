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
} from 'lucide-react';

// 三步流程：比罗列「核心能力」更能回答"我要做什么、多久出结果"
const steps = [
  { icon: Upload, title: '上传图纸', desc: 'STP / STEP / DXF / DWG / PDF / 图片' },
  { icon: ScanLine, title: 'AI 识别尺寸', desc: '自动读取长宽厚、孔数、折弯与工艺' },
  { icon: FileText, title: '出报价单', desc: '材料 + 加工 + 表面处理，可保存导出' },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <AppLayout>
      {/* 首屏：直接给两个报价入口（主推上传图纸），不再堆能力清单 */}
      <section className="mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-slate-50 border border-gray-100 shadow-sm px-6 py-10 md:px-12 md:py-14">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-4">
            铝型材 · 五金加工
            <br />
            <span className="text-blue-600">上传图纸，秒级出报价</span>
          </h1>

          <p className="text-lg text-gray-600 mb-8 max-w-2xl leading-relaxed">
            {user
              ? '报价可保存、可导出，同一副模具的多个长度只算一次模具费。'
              : '免注册即可试算；注册后可保存、导出专业报价单。'}
          </p>

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
            <Link
              href="/suppliers"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            >
              浏览供应商产品库
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* 三步流程 */}
      <section className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
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

      {/* 供应商入口：压成一条横幅，不再占整列 */}
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
