/**
 * PDF 首页转 PNG 用的 pdf.js 加载器。
 *
 * 之前从 cdnjs.cloudflare.com 拉 pdf.js，CDN 拉不到时 PDF 上传整个功能就挂掉。
 * 现在从站点自己的 /pdfjs/pdf.min.js 加载（文件已放进 public/）：
 * 既不依赖国外 CDN，也不参与打包 —— 用 script 标签按需注入，
 * 只有真的传了 PDF 才会去下载这 377KB。
 */

const PDFJS_SRC = '/pdfjs/pdf.min.js';
// 必须显式指到同目录的 worker，否则 legacy 版会去猜一个路径再报
// "Setting up fake worker failed"，PDF 照样转不出来
const PDFJS_WORKER_SRC = '/pdfjs/pdf.worker.min.js';

let loading: Promise<any> | null = null;

export function loadPdfJs(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const done = () => {
      const lib = w.pdfjsLib || w.pdfjs;
      if (!lib) {
        loading = null;
        reject(new Error('pdf.js 加载后不可用'));
        return;
      }
      if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
      w.pdfjsLib = lib;
      resolve(lib);
    };

    const existing = document.querySelector('script[data-pdfjs="true"]');
    if (existing) {
      if (w.pdfjsLib || w.pdfjs) { done(); return; }
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => { loading = null; reject(new Error('pdf.js 加载失败')); });
      return;
    }

    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.async = true;
    s.setAttribute('data-pdfjs', 'true');
    s.onload = () => setTimeout(done, 50);
    s.onerror = () => { loading = null; reject(new Error('pdf.js 加载失败')); };
    document.head.appendChild(s);
  });

  return loading;
}
