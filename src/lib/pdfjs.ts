/**
 * PDF 首页转 PNG 用的 pdf.js 加载器。
 *
 * 这里统一从项目内打包的 pdfjs-dist 按需加载（legacy 构建，兼容微信 X5 等老内核），
 * 不再从国外 CDN 拉脚本 —— 之前 CDN 拉不到时 PDF 上传会直接报「pdf.js加载失败」。
 * 用动态 import，只有真的传了 PDF 才会下载这块代码。
 */

let cached: any = null;

export async function loadPdfJs(): Promise<any> {
  if (cached) return cached;
  const w = window as any;
  if (w.pdfjsLib) {
    cached = w.pdfjsLib;
    return cached;
  }
  const mod: any = await import('pdfjs-dist/legacy/build/pdf.js');
  const lib = (mod && (mod.default || mod.pdfjsLib || mod.pdfjs)) || mod;
  if (lib?.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = '';
  cached = lib;
  w.pdfjsLib = lib;
  return lib;
}
