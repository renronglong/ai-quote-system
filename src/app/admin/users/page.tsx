'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getAdminToken } from '@/lib/auth-context';
import { Users, Search, Coins, Loader2, Gift, Building2, Phone as PhoneIcon } from 'lucide-react';

interface AdminUser {
  id: string;
  phone: string;
  company_name: string;
  address: string;
  created_at: string;
  balance: number;
  total_recharged: number;
  total_consumed: number;
}

export default function AdminUsersPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [grantOpen, setGrantOpen] = useState<AdminUser | null>(null);
  const [grantAmount, setGrantAmount] = useState('100');
  const [grantRemark, setGrantRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/admin/users');
    } else if (!authLoading && user && !isAdmin) {
      router.replace('/');
    }
  }, [authLoading, user, isAdmin, router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : '';
      const resp = await fetch(`/api/admin/users${qs}`, {
        headers: { 'x-admin-token': getAdminToken() || '' },
      });
      const data = await resp.json();
      if (resp.status === 403) {
        setError('无管理员权限（登录可能已过期，请退出后重新登录管理员账号）');
        setUsers([]);
      } else if (data.success) {
        setUsers(data.data || []);
      } else {
        setError(data.error || '加载失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, refreshKey, loadUsers]);

  const submitGrant = async (deduct: boolean) => {
    if (!grantOpen) return;
    const amount = Math.abs(Number(grantAmount) || 0);
    if (amount <= 0) { setError('积分数量必须大于0'); return; }
    setSubmitting(true);
    setError('');
    try {
      const resp = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() || '' },
        body: JSON.stringify({
          user_id: grantOpen.id,
          amount: deduct ? -amount : amount,
          remark: grantRemark || '',
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setGrantOpen(null);
        setGrantRemark('');
        setRefreshKey(k => k + 1);
      } else {
        setError(data.error || '操作失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">请先登录...</div>;
  }
  if (!isAdmin) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">无管理员权限，正在跳转...</div>;
  }

  const totalBalance = users.reduce((s, u) => s + Number(u.balance || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">用户管理</h1>
          <p className="text-sm text-gray-500">共 {users.length} 个用户 · 积分总余额 {totalBalance.toFixed(0)}</p>
        </div>
      </div>

      {/* 搜索 */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setRefreshKey(k => k + 1)}
            placeholder="搜索手机号或公司名…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          搜索
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>}

      {/* 用户表格 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">暂无用户</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">手机号</th>
                <th className="px-4 py-3 text-left">公司名</th>
                <th className="px-4 py-3 text-right">积分余额</th>
                <th className="px-4 py-3 text-right">累计赠送</th>
                <th className="px-4 py-3 text-right">累计消耗</th>
                <th className="px-4 py-3 text-left">注册时间</th>
                <th className="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">{u.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{u.company_name || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${Number(u.balance) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {Number(u.balance).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{Number(u.total_recharged).toFixed(0)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{Number(u.total_consumed).toFixed(0)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => { setGrantOpen(u); setGrantAmount('100'); setGrantRemark(''); setError(''); }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                    >
                      <Gift className="w-3.5 h-3.5" /> 赠积分
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 赠送积分弹窗 */}
      {grantOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !submitting && setGrantOpen(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-bold text-gray-900">调整积分</h2>
            </div>
            <div className="mb-4 text-sm text-gray-600 space-y-1">
              <p className="flex items-center gap-2"><PhoneIcon className="w-4 h-4 text-gray-400" />{grantOpen.phone}</p>
              {grantOpen.company_name && <p className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" />{grantOpen.company_name}</p>}
              <p className="text-amber-600">当前余额：{Number(grantOpen.balance).toFixed(0)} 分</p>
            </div>
            <label className="block text-sm text-gray-600 mb-1">积分数量</label>
            <input
              type="number"
              value={grantAmount}
              onChange={e => setGrantAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="block text-sm text-gray-600 mb-1">备注（可选）</label>
            <input
              value={grantRemark}
              onChange={e => setGrantRemark(e.target.value)}
              placeholder="如：活动补偿"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => !submitting && setGrantOpen(null)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => submitGrant(true)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {submitting ? '…' : '扣除'}
              </button>
              <button
                onClick={() => submitGrant(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? '处理中…' : '赠送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
