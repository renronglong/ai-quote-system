'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Sparkles, Layers, Square, Box, Component, Hammer,
  History, Building2, Store, TrendingUp, MessageCircle, Coins,
  Package, LogOut,
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
  const { signOut } = useAuth();
  const userName = user?.company_name || user?.phone || '游客';
  const [alumPrice, setAlumPrice] = useState<{ price: number; change: number; changePercent: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/market-price?material=${encodeURIComponent('铝型材')}`);
        const j = await res.json();
        if (alive && j?.success && j?.data) setAlumPrice({ price: j.data.price, change: j.data.change, changePercent: j.data.changePercent });
      } catch {}
    };
    fetchPrice();
    const t = setInterval(fetchPrice, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

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
        {/* 品牌首行 */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm shrink-0">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1 truncate">
              <span className="font-bold text-[15px] text-blue-700">碧利制造</span>
              <span className="text-blue-600 text-[15px]">·</span>
              <span className="font-bold text-[15px] text-gray-900">AI报价系统</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
              <span>gyparts.cn</span><span>·</span><span>v2.1.3</span>
            </div>
          </div>
        </div>
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">报价模块</p>
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.filter(i => !i.dividerBefore).map(i => renderItem(i))}
        </nav>
        <div className="mx-4 my-2 border-t border-gray-100" />
        <nav className="flex flex-col gap-0.5 px-2 pb-3">
          {NAV.filter(i => i.dividerBefore).map(i => (
            <Fragment key={i.key}>
              {renderItem(i)}
              {i.key === 'market' && alumPrice && (
                <div className="mx-0.5 mt-1 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                      <TrendingUp className="w-4 h-4 text-orange-500" />铝锭
                    </span>
                    <span className="text-sm font-bold text-gray-900">¥{alumPrice.price.toLocaleString()}</span>
                  </div>
                  <div className={`mt-0.5 text-right text-xs font-medium ${alumPrice.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {alumPrice.change >= 0 ? '↑' : '↓'}{Math.abs(alumPrice.changePercent).toFixed(2)}%
                  </div>
                </div>
              )}
            </Fragment>
          ))}
        </nav>

        {/* 左下角：用户名 + 积分 + 退出 */}
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
          {user ? (
            <button
              onClick={() => signOut()}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />退出
            </button>
          ) : (
            <Link
              href="/login"
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 transition-colors"
            >
              登录
            </Link>
          )}
        </div>
      </aside>

      {/* 移动端：顶部横向滚动条 */}
      <nav className="lg:hidden flex items-center gap-1.5 overflow-x-auto border-b border-gray-200 bg-white px-3 py-2 shrink-0">
        {NAV.map(i => renderItem(i, true))}
        {user ? (
          <button onClick={() => signOut()} className="shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-600 border border-gray-200">
            <LogOut className="w-4 h-4" />退出
          </button>
        ) : (
          <Link href="/login" className="shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white bg-blue-600">
            登录
          </Link>
        )}
      </nav>
    </>
  );
}
