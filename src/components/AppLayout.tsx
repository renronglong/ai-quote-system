'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth-context';
import TopNavLinks from '@/components/TopNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Home,
  Package,
  FileText,
  History,
  Box,
  MessageSquare,
  Users,
  Settings,
  List,
  ChevronDown,
  LogOut,
  Coins,
  Building2,
  Phone,
  TrendingUp,
  Handshake,
} from   UserCircle,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}



// 移动端汉堡菜单 / 头像下拉 使用
const navGroups: NavGroup[] = [
  {
    label: '功能',
    items: [
      { label: '首页', href: '/', icon: <Home className="w-5 h-5" /> },
      { label: 'AI报价', href: '/quote', icon: <FileText className="w-5 h-5" /> },
      { label: '产品管理', href: '/products', icon: <Package className="w-5 h-5" /> },
      { label: '库存管理', href: '/inventory', icon: <Box className="w-5 h-5" /> },
      { label: '询价管理', href: '/inquiries', icon: <MessageSquare className="w-5 h-5" /> },
      { label: '报价历史', href: '/history', icon: <History className="w-5 h-5" /> },
      { label: '供应商', href: '/suppliers', icon: <Building2 className="w-5 h-5" /> },
      { label: '供应商入驻', href: '/supplier', icon: <Handshake className="w-5 h-5" /> },
      { label: '公司资料', href: '/profile', icon: <UserCircle className="w-5 h-5" /> },
      { label: '联系我们', href: '/contact', icon: <Phone className="w-5 h-5" /> },
      { label: '铝价行情', href: '/market', icon: <TrendingUp className="w-5 h-5" /> },
    ],
  },
  {
    label: '管理',
    items: [
      { label: '用户管理', href: '/admin/users', icon: <Users className="w-5 h-5" />, adminOnly: true },
      { label: '任务管理', href: '/admin/tasks', icon: <FileText className="w-5 h-5" />, adminOnly: true },
      { label: '系统设置', href: '/admin/settings', icon: <Settings className="w-5 h-5" />, adminOnly: true },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [credits, setCredits] = useState<number>(0);
  const { user, signOut } = useAuth();

  // 拉取积分余额（仅登录用户）
  useEffect(() => {
    if (!user) { setCredits(0); return; }
    fetch(`/api/credits/balance?user_id=${user.id}`)
      .then(r => r.json())
      .then(json => setCredits(parseFloat(json?.data?.balance || '0')))
      .catch(() => {});
  }, [user, pathname]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-16">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900 hidden sm:inline">
                AI报价系统
              </span>
            </Link>
          </div>

          {/* 桌面端导航：全站统一平铺入口 */}
          <div className="hidden lg:block">
            <TopNavLinks />
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-3">
            {/* 积分显示（登录用户） */}
            {user && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200">
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {credits.toFixed(0)} 积分
              </span>
            </div>
            )}

            {/* 桌面端：未登录显示 登录/注册 按钮；已登录显示头像+下拉菜单 */}
            {!user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login"><Button variant="outline" size="sm">登录</Button></Link>
                <Link href="/register"><Button size="sm" className="bg-blue-600 hover:bg-blue-700">注册</Button></Link>
              </div>
            ) : (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className="flex items-center gap-1.5 rounded-full hover:bg-gray-100 py-1 pl-1 pr-2 transition-colors"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {(user.phone || 'U').slice(-1)}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {userMenuOpen && (
                  <>
                    {/* 点击外部关闭 */}
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute top-full right-0 pt-2 z-50 w-56">
                      <div className="bg-white rounded-lg shadow-lg border py-1">
                        <div className="px-4 py-2 border-b">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.company_name || '已登录用户'}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Coins className="w-3.5 h-3.5 text-amber-600" />{credits.toFixed(0)} 积分
                          </p>
                        </div>
                        <Link href="/history" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><History className="w-4 h-4" />报价历史</Link>
                        <Link href="/products" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><Package className="w-4 h-4" />产品管理</Link>
                        <Link href="/inquiries" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><MessageSquare className="w-4 h-4" />询价管理</Link>
                        <Link href="/supplier" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><Handshake className="w-4 h-4" />供应商工作台</Link>
                        <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><UserCircle className="w-4 h-4" />公司资料</Link>
                        <div className="h-px bg-gray-100 my-1" />
                        <Link href="/admin/tasks" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><FileText className="w-4 h-4" />任务管理</Link>
                        <Link href="/admin/users" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"><Users className="w-4 h-4" />用户管理</Link>
                        <div className="h-px bg-gray-100 my-1" />
                        <button onClick={() => { setUserMenuOpen(false); signOut(); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                          <LogOut className="w-4 h-4" />退出登录
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 移动端菜单 */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <List className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex flex-col gap-4 pt-4">
                  <div className="flex items-center gap-3 px-2">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        U
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{user ? (user.phone || '已登录') : '未登录'}</p>
                      {user && <p className="text-xs text-gray-500">{user.company_name || user.phone}</p>}
                    </div>
                  </div>

                  <div className="h-px bg-gray-200" />

                  {navGroups.filter(g => !(g.items[0]?.adminOnly) || user).map((group) => (
                    <div key={group.label}>
                      <p className="px-2 text-xs font-medium text-gray-500 uppercase mb-2">
                        {group.label}
                      </p>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                              pathname === item.href
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {item.icon}
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="h-px bg-gray-200 mt-auto" />

                  {user ? (
                    <Button variant="ghost" className="justify-start text-red-600" onClick={() => signOut()}>
                      <LogOut className="w-4 h-4 mr-2" />
                      退出登录
                    </Button>
                  ) : (
                    <div className="flex gap-2 px-3">
                      <Link href="/login"><Button variant="outline" size="sm">登录</Button></Link>
                      <Link href="/register"><Button size="sm" className="bg-blue-600 hover:bg-blue-700">注册</Button></Link>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
