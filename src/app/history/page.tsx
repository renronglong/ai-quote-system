'use client';
import QuoteSidebarLayout from '@/components/QuoteSidebarLayout';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';
import SavedQuotesPanel, { type SavedQuote } from '@/components/SavedQuotesPanel';

/**
 * 「我的报价」页（/history）
 *
 * - 数据源统一为 saved_quotes 表 —— 与报价页「保存报价」写入的是同一张表。
 *   原先读 quotation_history 的旧实现已废弃（该表线上不存在）。
 * - 列表 / 多选 / 删除 / 编辑 / 批量导出，复用 SavedQuotesPanel 的 inline 形态，
 *   与报价页抽屉共用同一份实现，避免两处逻辑分叉。
 * - 本页只做数据展示与交互，不参与任何报价计算。
 */
export default function MyQuotesPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/history');
    }
  }, [authLoading, user, router]);

  // 编辑：把该条报价暂存，跳回报价页由 QuoteForm 回填
  const handleEditQuote = (quote: SavedQuote) => {
    try {
      sessionStorage.setItem('ai_quote_edit_quote', JSON.stringify(quote));
    } catch (e) {
      console.error('暂存待编辑报价失败:', e);
    }
    router.push('/quote');
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <QuoteSidebarLayout>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">我的报价</h1>
          <p className="text-slate-500 mt-1 text-sm">
            查看、编辑已保存的报价，勾选多条可批量导出报价单
          </p>
        </div>

        {authLoading || !user ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <SavedQuotesPanel
              userId={user.id}
              user={user}
              variant="inline"
              onEditQuote={handleEditQuote}
            />
          </div>
        )}
      </main>
        </QuoteSidebarLayout>
</div>
  );
}
