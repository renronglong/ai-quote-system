"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

const BENEFITS = [
  { title: '免费获客', desc: '平台采购商主动询价，订单直达你的工作台' },
  { title: '资质认证', desc: '审核通过后获得认证标识，提升买家信任度' },
  { title: '产品管理', desc: '自主上架产品、设置价格，展示产能实力' },
  { title: '零佣金入驻', desc: '入驻免费，无平台抽佣，成交归你' },
];

export default function SupplierLandingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      const checkProfile = async () => {
        try {
          const res = await fetch(`/api/supplier/profile?user_id=${user.id}`);
          const json = await res.json();
          router.replace(json.data ? '/supplier/dashboard' : '/supplier/register');
        } catch { router.replace('/supplier/register'); }
        finally { setChecking(false); }
      };
      checkProfile();
    } else { setChecking(false); }
  }, [user, authLoading, router]);

  if (authLoading || checking) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-6"><Building2 className="w-8 h-8" /></div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">供应商入驻</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-8">免费入驻 gyparts.cn AI报价平台，对接海量采购需求</p>
          <button onClick={() => router.push('/supplier/register')} className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg">立即申请入驻 <ArrowRight className="w-5 h-5" /></button>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">入驻权益</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((b, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4"><CheckCircle2 className="w-5 h-5 text-blue-600" /></div>
              <h3 className="font-semibold text-gray-900 mb-2">{b.title}</h3>
              <p className="text-sm text-gray-500">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">准备好入驻了吗？</h2>
          <p className="text-blue-100 mb-8">免费入驻，无平台抽佣，审核通过后即可开始接单</p>
          <button onClick={() => router.push('/supplier/register')} className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg">填写入驻申请 <ArrowRight className="w-5 h-5" /></button>
        </div>
      </div>
    </AppLayout>
  );
}
