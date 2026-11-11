'use client';
import QuoteSidebarLayout from '@/components/QuoteSidebarLayout';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Loader2, FileSpreadsheet } from 'lucide-react';
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

      {/* 业主 2026-11-11：界面太窄 → 去掉 max-w-7xl 与多层套盒，内容区铺满左栏右侧 */}
      <main className="w-full max-w-none px-3 sm:px-5 py-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">我的报价</h1>
            <p className="text-slate-500 mt-0.5 text-xs sm:text-sm">
              完整显示已保存报价，勾选多条可批量导出、保存或删除
            </p>
          </div>
          <Link href="/history/sheets"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-50">
            <FileSpreadsheet className="w-4 h-4" />已保存报价单
          </Link>
        </div>

        {authLoading || !user ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <SavedQuotesPanel
            userId={user.id}
            user={user}
            variant="inline"
            onEditQuote={handleEditQuote}
          />
        )}
      </main>
        </QuoteSidebarLayout>
</div>
  );
}
