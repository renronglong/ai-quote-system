'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import QuoteSidebar from '@/components/QuoteSidebar';

// 与 /quote 一致的「顶部页头 + 左栏 + 内容区」外壳：
// 在页面自有 header 之下，放左侧栏（桌面）+ 内容区（内部滚动）。
// 自身拉取 user / 积分，供左侧栏底部「用户名 + 积分」使用。
export default function QuoteSidebarLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (!user) { setCredits(0); return; }
    fetch(`/api/credits/balance?user_id=${user.id}`)
      .then(r => r.json())
      .then(j => setCredits(parseFloat(j?.data?.balance || '0')))
      .catch(() => {});
  }, [user]);

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col lg:flex-row">
      <QuoteSidebar user={user} credits={credits} />
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
