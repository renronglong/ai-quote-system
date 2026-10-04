'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Factory, Loader2, LogOut } from 'lucide-react';
import TopNavLinks from '@/components/TopNav';
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Factory className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-800">碧利制造</span>
                <span className="hidden sm:inline text-xs ml-1 text-slate-400">gyparts.cn</span>
              </div>
            </Link>
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
              <TopNavLinks />
            </div>
            <div className="flex items-center gap-3">
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : user ? (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline text-xs text-gray-500 max-w-[120px] truncate">
                    {user.company_name || user.email || '已登录'}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-3 h-3" />退出
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/login?redirect=/history')}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  登录
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

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
    </div>
  );
}
