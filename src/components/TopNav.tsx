'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// 全站统一的顶部主导航入口（桌面端平铺显示，任何页面都可互相跳转）
export const topNavLinks = [
  { label: '首页', href: '/' },
  { label: 'AI报价', href: '/quote' },
  { label: '供应商库', href: '/suppliers' },
  { label: '铝价行情', href: '/market' },
  { label: '联系我们', href: '/contact' },
];

export default function TopNavLinks({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={`flex items-center gap-1 ${className}`}>
      {topNavLinks.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
