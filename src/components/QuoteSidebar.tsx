'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles, Layers, Square, Box, Component, Hammer,
  History, Building2, Store, TrendingUp, MessageCircle, Coins,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  href: string;        // 跳转地址（含产品模块独立子页）
  icon: LucideIcon;
  dividerBefore?: boolean;
}

// 左侧栏模块清单（来自 gyparts.cn 新修改任务.xlsx）
// 5 个产品模块为各自独立子页（/quote/extrusion 等），其余为既有页面
const NAV: NavItem[] = [
  { key: 'recognize', label: '图纸AI识别', href: '/quote/recognize', icon: Sparkles },
  { key: 'extrusion', label: '挤出铝型材', href: '/quote/extrusion', icon: Layers },
  { key: 'sheet', label: '板材', href: '/quote/sheet', icon: Square },
  { key: 'casting', label: '铸造', href: '/quote/casting', icon: Box },
  { key: 'injection', label: '注塑', href: '/quote/injection', icon: Component },
  { key: 'steel', label: '钢材', href: '/quote/steel', icon: Hammer },
  { key: 'history', label: '我的报价', href: '/history', icon: History, dividerBefore: true },
  { key: 'profile', label: '公司资料', href: '/profile', icon: Building2 },
  { key: 'products', label: '我的产品展示', href: '/supplier/register', icon: Store },
  { key: 'market', label: '铝价行情', href: '/market', icon: TrendingUp },
  { key: 'contact', label: '联系我们', href: '/contact', icon: MessageCircle },
];

function isActive(item: NavItem, pathname: string): boolean {
  // /quote 默认页（无子路径）时，挤出铝型材作为默认高亮
  if (item.href === '/quote/extrusion' && pathname === '/quote') return true;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export default function QuoteSidebar({
  user,
  credits,
}: {
  user: any;
  credits: number;
}) {
  const pathname = usePathname() || '';
  const userName = user?.company_name || user?.phone || '游客';

  const renderItem = (item: NavItem, compact = false) => {
    const Icon = item.icon;
    const active = isActive(item, pathname);
    const base = 'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors border-l-2';
    const state = active
      ? 'bg-blue-50 text-blue-700 font-medium border-blue-600'
      : 'text-slate-600 border-transparent hover:bg-gray-100 hover:text-slate-800';
    const cls = `${base} ${state} ${compact ? 'shrink-0 whitespace-nowrap' : ''}`;
    return (
      <Link key={item.key} href={item.href} className={cls} title={item.label}>
        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* 桌面端：左侧竖向栏 */}
      <aside className="hidden lg:flex lg:flex-col w-56 shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">报价模块</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.filter(i => !i.dividerBefore).map(i => renderItem(i))}
        </nav>
        <div className="mx-4 my-2 border-t border-gray-100" />
        <nav className="flex flex-col gap-0.5 px-2 pb-3">
          {NAV.filter(i => i.dividerBefore).map(i => renderItem(i))}
        </nav>

        {/* 左下角：用户名 + 积分 */}
        <div className="mt-auto border-t border-gray-200 p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {(userName === '游客' ? '游' : (userName || 'U').slice(0, 1))}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{userName}</p>
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Coins className="w-3 h-3" />
                {credits.toFixed(0)} 积分
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* 移动端：顶部横向滚动条 */}
      <nav className="lg:hidden flex items-center gap-1.5 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 shrink-0">
        {NAV.map(i => renderItem(i, true))}
      </nav>
    </>
  );
}
