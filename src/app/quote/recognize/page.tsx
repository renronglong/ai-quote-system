"use client";
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Share2 } from 'lucide-react';
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

  // 手机上传入口：复制当前页链接（发微信文件传输助手 / 手机浏览器打开）
  const [linkCopied, setLinkCopied] = useState(false);
  const copyPageLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://www.gyparts.cn/quote/recognize';
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

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
          {/* 手机上传入口：桌面端展示二维码引导微信上传；手机端自身就是目标页，不显示 */}
          <div className="mt-4 hidden sm:block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <img
                src="/qr-recognize.png"
                alt="扫码打开图纸识别页"
                width={88}
                height={88}
                className="h-[88px] w-[88px] shrink-0 rounded-lg border border-slate-100"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-700">手机微信上传图纸</div>
                <ol className="mt-1 space-y-0.5 text-xs leading-relaxed text-slate-500 list-decimal list-inside">
                  <li>微信「扫一扫」二维码，在微信里打开本页</li>
                  <li>点上方「上传图纸」→ 选「从聊天记录中选择文件」</li>
                  <li>好友发来的 STP / DXF / PDF 可直接选，识别结果同账号同步</li>
                </ol>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyPageLink}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    <Share2 size={13} />
                    {linkCopied ? '链接已复制' : '复制链接'}
                  </button>
                  <span className="text-[11px] text-slate-400">也可发到微信「文件传输助手」，手机点开即传</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400 text-center">
            支持格式：STP/STEP · DXF · DWG（导出DXF后解析）· PDF · JPG/PNG图片
          </div>
        </div>
      </main>
    </div>
  );
}
