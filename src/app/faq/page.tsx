import Link from 'next/link';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { Factory } from 'lucide-react';
import TopNavLinks from '@/components/TopNav';

const FAQS = [
  {
    q: 'AI报价怎么用？',
    a: '进入「AI智能报价」页面，选择产品品类（铝型材/板材/压铸/注塑/钢材），填写尺寸、材质、数量和表面处理，系统会实时按南海铝锭价等行情自动算出成本和报价，全程免费，无需注册。',
  },
  {
    q: '没有CAD图纸也能报价吗？',
    a: '可以。直接在报价表单手动填写长宽高、壁厚等参数即可。如果有 DXF/STEP/PDF 图纸，也可以在「图纸识别」上传，AI 自动提取尺寸和工艺参数，识别结果可确认后再生成报价。',
  },
  {
    q: '支持哪些图纸格式？',
    a: '目前支持 STEP/STP、IGES/IGS、DXF、PDF 图纸。DWG 格式请先导出为 DXF 再上传。3D 装配体（STEP 汇编）会自动拆分成多个零件逐个识别。',
  },
  {
    q: '报价用的材料价格是最新的吗？',
    a: '是。系统每日同步南海铝锭现货价（lvdingjia）、长江有色及主流塑料行情，铝型材报价按当日含票均价实时计算，行情页每 5 分钟自动刷新。',
  },
  {
    q: '报价结果准确吗？能直接给客户吗？',
    a: '报价基于行业通用加工费公式和实时材料价计算，适合快速给客户参考价。实际成交价会受订单量、账期、特殊工艺影响，建议复杂件联系客服获取人工精报。',
  },
  {
    q: '供应商怎么入驻？',
    a: '在「供应商入驻」页面提交公司信息，审核通过后即可在供应商产品库展示你的加工能力和产品，接收采购询盘，目前入驻免费。',
  },
  {
    q: '为什么识别结果中材质显示"无法识别"？',
    a: '部分图纸未标注材质信息，AI 不会猜测。出现提示时在下拉框手动选择实际材质即可，材质决定剪切强度和成本计算，选错会影响报价准确性。',
  },
  {
    q: '报价单可以保存和导出吗？',
    a: '可以。注册登录后可保存每笔报价到「历史报价」，随时查看对比，并导出为正式报价单发给客户。',
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航 */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Factory className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-800">碧利制造</span>
                <span className="hidden sm:inline text-xs ml-1 text-slate-400">gyparts.cn</span>
              </div>
            </Link>
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
              <TopNavLinks />
            </div>
            <Link
              href="/quote"
              className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              开始报价
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 flex-1 w-full">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-4">
            <HelpCircle className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">常见问题</h1>
          <p className="text-sm text-slate-500 mt-2">关于 AI 报价、图纸识别和供应商服务的常见解答</p>
        </div>

        <div className="space-y-4">
          {FAQS.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-sm transition-shadow">
              <h2 className="font-semibold text-slate-800 mb-2 flex items-start gap-2">
                <span className="text-blue-500 shrink-0">Q</span>
                {item.q}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed pl-6">{item.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-blue-50 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-600 mb-4">还有其他问题？</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              联系我们 <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center justify-center gap-1 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              查看使用指南
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 text-gray-300 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} 碧利制造 gyparts.cn
        </div>
      </footer>
    </div>
  );
}
