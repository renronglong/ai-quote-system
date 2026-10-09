"use client";
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';
import DrawingRecognition from '@/components/DrawingRecognition';
import TopNavLinks from '@/components/TopNav';
import { useAuth } from '@/lib/auth-context';

/**
 * /quote/recognize - 图纸识别上传页（连续上传模式）
 * 用户在首页点"图纸AI识别"跳转到这里，可连续上传多个文件，
 * 系统边识别边排队，用户无需等待单个文件完成即可继续上传。
 * 全部文件识别完成后点击"去零件列表报价"进入 /quote/parts。
 */
export default function QuoteRecognizePage() {
  const { user } = useAuth();
  const router = useRouter();

  const handleDrawingData = useCallback((data: any) => {
    if (!data) return;
    const products: any[] = data.recogProducts && data.recogProducts.length > 0
      ? data.recogProducts
      : (data.recogData ? [data.recogData] : []);
    const isAssembly = data.isAssembly ?? products.length > 1;
    const fileName = data.fileName || '';
    const recognitionId = data.recognitionId;

    const payload = {
      products,
      isAssembly,
      fileName,
      recognitionId,
      createdAt: Date.now(),
    };

    try {
      sessionStorage.setItem('ai_quote_parts', JSON.stringify(payload));
      sessionStorage.setItem('ai_quote_recog_result', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save recognition data:', e);
    }

    // 直接跳转；组件已在连续上传模式下聚合完成
    router.push('/quote/parts');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden">
      <TopNavLinks />
      <div className="bg-white border-b border-slate-100 px-6 py-2">
        <div className="max-w-4xl mx-auto flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/" className="px-1.5 py-1 rounded hover:bg-gray-100 hover:text-slate-700">首页</Link>
          <span className="text-slate-300">/</span>
          <Link href="/quote" className="px-1.5 py-1 rounded hover:bg-gray-100 hover:text-slate-700">AI报价</Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 font-medium">图纸识别</span>
        </div>
      </div>
      <main className="flex-1 min-h-0 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <div className="mb-6">
            <Link href="/quote" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3 py-2 -ml-2 px-2 rounded-lg hover:bg-gray-100">
              <ArrowLeft size={16} /> 返回手动报价
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Upload size={24} className="text-blue-600" />
              图纸AI识别
            </h1>
            <p className="text-slate-500 mt-1 text-sm">上传图纸（STP/STEP/DXF/DWG/PDF/图片），可连续添加文件，AI自动识别零件尺寸参数</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <DrawingRecognition
              mode="continuous"
              onDrawingData={handleDrawingData}
              user={user}
            />
          </div>
          <div className="mt-4 text-xs text-slate-400 text-center">
            支持格式：STP/STEP · DXF · DWG（导出DXF后解析）· PDF · JPG/PNG图片
          </div>
        </div>
      </main>
    </div>
  );
}
