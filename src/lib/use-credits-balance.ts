'use client';
import { useEffect, useState } from 'react';

/**
 * 左栏「用户名 + 积分」的余额。
 *
 * 原先三个外壳组件各自只在 [user] 变化时拉一次 /api/credits/balance，
 * 识别扣费后余额变了却不会刷新，业主看到旧数字以为「积分没扣」。
 * 现统一由本 hook 订阅 credits-refresh 事件（auth-context 的 checkQuota 派发），
 * 识别成功后立即重拉，跨页面切换也可通过 refreshKey 触发。
 */
export function useCreditsBalance(userId?: string, refreshKey?: string): number {
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (!userId) { setCredits(0); return; }
    const load = () => {
      fetch(`/api/credits/balance?user_id=${userId}`)
        .then(r => r.json())
        .then(j => setCredits(parseFloat(j?.data?.balance || '0')))
        .catch(() => {});
    };
    load();
    window.addEventListener('credits-refresh', load);
    return () => window.removeEventListener('credits-refresh', load);
  }, [userId, refreshKey]);

  return credits;
}
