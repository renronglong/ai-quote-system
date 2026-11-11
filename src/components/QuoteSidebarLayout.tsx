'use client';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCreditsBalance } from '@/lib/use-credits-balance';
import QuoteSidebar from '@/components/QuoteSidebar';
import { useSidebarAccount } from '@/components/sidebarAccountContext';

// 与 /quote 一致的「顶部页头 + 左栏 + 内容区」外壳：
// 在页面自有 header 之下，放左侧栏（桌面）+ 内容区（内部滚动）。
// 自身拉取 user / 积分，供左侧栏底部「用户名 + 积分」使用。
export default function QuoteSidebarLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const credits = useCreditsBalance(user?.id);
  const { setHasSidebar } = useSidebarAccount();

  // 通知 AppLayout：本页有左侧栏，账户菜单由左侧栏底部接管，顶栏账户下拉/移动端汉堡隐藏，避免重复。
  useEffect(() => {
    setHasSidebar(true);
    return () => setHasSidebar(false);
  }, [setHasSidebar]);

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col lg:flex-row">
      <QuoteSidebar user={user} credits={credits} />
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
