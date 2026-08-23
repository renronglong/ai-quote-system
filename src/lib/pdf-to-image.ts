// PDF 第一页转 PNG —— 动态import避免在非PDF请求时加载pdf.js
export async function pdfFirstPageToPng(
  pdfBuffer: Buffer,
  dpi = 200
): Promise<Buffer> {
  const { pdf } = await import('pdf-to-img');
  const doc = await pdf(pdfBuffer, { scale: dpi / 72 });
  for await (const pageImage of doc) {
    return Buffer.from(pageImage) as Buffer;
  }
  throw new Error('PDF为空或无法渲染');
}
