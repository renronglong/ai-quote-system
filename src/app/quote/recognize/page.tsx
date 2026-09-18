"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, AlertCircle, Loader2, CheckCircle2, X } from 'lucide-react';
import DrawingRecognition from '@/components/DrawingRecognition';
import TopNavLinks from '@/components/TopNav';
import { useAuth } from '@/lib/auth-context';

/**
 * /quote/recognize - 图纸识别上传页
 * 用户在首页点"图纸AI识别"跳转到这里，上传图纸后识别
 * 识别完成后：sessionStorage存结果，自动跳转到/quote/parts零件列表页
 */
export default function QuoteRecognizePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [recogData, setRecogData] = useState<any>(null);
  const [drawingKey, setDrawingKey] = useState(0);
  const navigatedRef = useRef(false);

  const handleDrawingData = useCallback((data: any) => {
    if (!data) return;
    setRecogData(data);
    // 构建零件列表：优先用recogProducts，否则用recogData单件
    const products: any[] = data.recogProducts && data.recogProducts.length > 0
      ? data.recogProducts
      : (data.recogData ? [data.recogData] : []);
    const isAssembly = data.isAssembly ?? products.length > 1;
    try {
      const payload = {
        products,
        isAssembly,
        fileName: data.fileName || (data.recogData?._fileName) || '',
        recognitionId: data.recognitionId,
        createdAt: Date.now(),
      };
      sessionStorage.setItem('ai_quote_parts', JSON.stringify(payload));
      sessionStorage.setItem('ai_quote_recog_result', JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save recognition data:', e);
    }
    if (!navigatedRef.current && products.length > 0) {
      navigatedRef.current = true;
      setTimeout(() => router.push('/quote/parts'), 400);
    }
  }, [router]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <TopNavLinks user={user} />
      <main className="flex-1 min-h-0 flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <div className="mb-6">
            <Link href="/quote" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
              <ArrowLeft size={16} /> 返回手动报价
            </Link>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Upload size={24} className="text-blue-600" />
              图纸AI识别
            </h1>
            <p className="text-slate-500 mt-1 text-sm">上传图纸（STP/STEP/DXF/DWG/PDF/图片），AI自动识别零件尺寸参数</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <DrawingRecognition
              key={drawingKey}
              onDrawingData={handleDrawingData}
              user={user}
              aiData={recogData}
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
