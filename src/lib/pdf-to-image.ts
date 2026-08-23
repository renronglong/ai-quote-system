// PDF 第一页转 PNG，用于AI视觉识别
// 使用 pdf-to-img（纯JS，基于pdfjs，serverless兼容）
import { pdf } from 'pdf-to-img';

export async function pdfFirstPageToPng(
  pdfBuffer: Buffer,
  dpi = 200
): Promise<Buffer> {
  const doc = await pdf(pdfBuffer, { scale: dpi / 72 });
  // 取第一页
  for await (const pageImage of doc) {
    return Buffer.from(pageImage) as Buffer;
  }
  throw new Error('PDF为空或无法渲染');
}
