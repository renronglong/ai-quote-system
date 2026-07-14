import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: '工品报价 - AI智能报价平台 | 铝型材CNC/板材/压铸件',
  description: '面向制造业的一站式AI报价服务平台，覆盖铝型材CNC加工、板材、压铸件等多品类，实时铝价同步，秒级生成精准报价单。',
  keywords: 'AI报价,铝型材,CNC加工,压铸件,板材加工,工业品报价,制造业报价',
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
