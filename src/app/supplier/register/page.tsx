"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import { Building2, Loader2, AlertCircle, Lock } from 'lucide-react';

const STORAGE_KEY = 'supplier_register_form';

function saveFormData(form: any) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(form)); } catch {}
}
function loadFormData(): any {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}
function clearFormData() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}

export default function SupplierRegisterPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    address: '',
    business_license: '',
  });

  // Load saved form data from session (for post-login restore)
  useEffect(() => {
    const saved = loadFormData();
    if (saved) {
      setForm(prev => ({ ...prev, ...saved }));
    }
  }, []);

  // Auto-fill phone from logged-in user, but don't redirect if not logged in
  useEffect(() => {
    if (user && !form.phone) {
      setForm(prev => ({ ...prev, phone: user.phone || prev.phone }));
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.company_name.trim()) { setError('请输入公司名称'); return; }
    if (!form.contact_name.trim()) { setError('请输入联系人姓名'); return; }
    if (!form.phone.trim()) { setError('请输入联系电话'); return; }

    // If not logged in, save form and redirect to login
    if (!user) {
      saveFormData(form);
      setPendingSubmit(true);
      router.push('/login?redirect=/supplier/register');
      return;
    }

    // Submit the form
    setLoading(true);
    try {
      const res = await fetch('/api/supplier/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...form }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || '提交失败'); return; }
      clearFormData();
      router.push('/supplier/dashboard');
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* 页头 */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">供应商入驻</h1>
          <p className="text-gray-500 mt-2">填写企业信息，免费入驻 gyparts.cn 供应商平台</p>
        </div>

        {/* 未登录提示 */}
        {!authLoading && !user && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <Lock className="w-4 h-4 shrink-0" />
            <span>提交入驻需要登录账号，填完表单后点击提交会自动跳转登录</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>企业信息</CardTitle>
            <CardDescription>请填写贵公司的基本信息</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="company_name">公司名称 *</Label>
                <Input
                  id="company_name"
                  placeholder="如：佛山市南海区鑫铝铝业有限公司"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact_name">联系人 *</Label>
                  <Input
                    id="contact_name"
                    placeholder="您的姓名"
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">联系电话 *</Label>
                  <Input
                    id="phone"
                    placeholder="手机号码"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">公司地址</Label>
                <Textarea
                  id="address"
                  placeholder="详细地址（选填）"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_license">营业执照号</Label>
                <Input
                  id="business_license"
                  placeholder="统一社会信用代码（选填）"
                  value={form.business_license}
                  onChange={(e) => setForm({ ...form, business_license: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? '提交中...' : !user ? '填写后提交入驻' : '提交入驻'}
              </Button>
              {!user && (
                <p className="text-center text-xs text-gray-400">
                  已有账号？<button type="button" onClick={() => { saveFormData(form); router.push('/login?redirect=/supplier/register'); }} className="text-blue-500 hover:underline">立即登录</button>
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
