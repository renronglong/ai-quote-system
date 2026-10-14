import Link from 'next/link';
import { Home, Search } from 'lucide-react';

const QUICK_LINKS = [
  { href: '/quote', label: 'AI智能报价' },
  { href: '/market', label: '铝价行情' },
  { href: '/suppliers', label: '供应商库' },
  { href: '/faq', label: '常见问题' },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
          <Search className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold text-slate-800">碧利制造</span>
      </div>
      <h1 className="text-7xl font-bold text-gray-200 mb-2">404</h1>
      <p className="text-lg text-gray-500 mb-8">抱歉，页面不存在或已被移动</p>
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {QUICK_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Home className="w-4 h-4" />
        返回首页
      </Link>
    </div>
  );
}
