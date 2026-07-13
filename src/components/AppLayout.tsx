'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from '@/components/ui/sheet';
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

const navGroups: NavGroup[] = [
  {
    label: '主功能',
    items: [
      { label: '首页', href: '/', icon: <Home className="w-5 h-5" /> },
      { label: '产品管理', href: '/products', icon: <Package className="w-5 h-5" /> },
      { label: '库存管理', href: '/inventory', icon: <Box className="w-5 h-5" /> },
      { label: '询价管理', href: '/inquiries', icon: <MessageSquare className="w-5 h-5" /> },
      { label: '报价历史', href: '/history', icon: <History className="w-5 h-5" /> },
      { label: '供应商', href: '/suppliers', icon: <Building2 className="w-5 h-5" /> },
      { label: '联系我们', href: '/contact', icon: <Phone className="w-5 h-5" /> },
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
  const [credits, setCredits] = useState<number>(0);

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

          {/* 桌面端导航 */}
          <nav className="hidden md:flex items-center gap-1">
            {navGroups.map((group) => (
              <div key={group.label} className="relative group">
                <Button
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-900"
                >
                  {group.label}
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
                <div className="absolute top-full left-0 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <div className="bg-white rounded-lg shadow-lg border py-1 min-w-[160px]">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 ${
                          pathname === item.href
                            ? 'text-blue-600 bg-blue-50'
                            : 'text-gray-600'
                        }`}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-3">
            {/* 积分显示 */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200">
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {credits.toFixed(2)} 积分
              </span>
            </div>

            {/* 用户头像 */}
            <Avatar className="w-8 h-8 cursor-pointer">
              <AvatarImage src="" />
              <AvatarFallback className="bg-blue-100 text-blue-600">
                U
              </AvatarFallback>
            </Avatar>

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
                      <p className="font-medium text-sm">用户</p>
                      <p className="text-xs text-gray-500">user@example.com</p>
                    </div>
                  </div>

                  <div className="h-px bg-gray-200" />

                  {navGroups.map((group) => (
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

                  <Button variant="ghost" className="justify-start text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    退出登录
                  </Button>
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
