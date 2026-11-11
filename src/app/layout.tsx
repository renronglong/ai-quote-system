import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'AI智能报价系统_铝型材五金加工自动算成本软件 | 碧利制造',
  description: '图纸智能识别 + 即时报价，覆盖铝型材、钣金、压铸、注塑、钢材等加工类型，助您快速核算成本。',
  keywords: '铝型材报价,照明铝材成本核算,CAD图纸自动报价,灵通铝锭价实时查询,五金加工报价软件',
  // 业主 2026-11-11：分享链接时（微信等）自动带文字说明，不含公司名称
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://www.gyparts.cn/',
    siteName: 'AI 智能报价平台',
    title: 'AI 智能报价平台',
    description: '图纸智能识别 + 即时报价，覆盖铝型材、钣金、压铸、注塑、钢材等加工类型，助您快速核算成本。',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
