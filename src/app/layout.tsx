import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'AI智能报价系统_铝型材五金加工自动算成本软件 | 工品报价',
  description: '面向制造业的一站式AI报价服务平台，覆盖铝型材CNC加工、板材、压铸件等多品类，实时铝价同步，秒级生成精准报价单。',
  keywords: '铝型材报价,照明铝材成本核算,CAD图纸自动报价,灵通铝锭价实时查询,五金加工报价软件',
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
