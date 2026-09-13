"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, FileText, Shield, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

const BENEFITS = [
  { icon: TrendingUp, title: '免费获客', desc: '平台采购商主动询价，订单直达你的工作台' },
  { icon: Shield, title: '资质认证', desc: '审核通过后获得认证标识，提升买家信任度' },
  { icon: FileText, title: '产品管理', desc: '自主上架产品、设置价格，展示产能实力' },
  { icon: CheckCircle2, title: '零佣金入驻', desc: '入驻免费，无平台抽佣，成交归你' },
];

const STEPS = [
  { num: '01', title: '填写企业信息', desc: '公司名称、联系人、营业执照等基础资料' },
  { num: '02', title: '提交审核', desc: '平台1-3个工作日内完成资质审核' },
  { num: '03', title: '开通工作台', desc: '审核通过后即可发布产品、接收询价' },
];

export default function SupplierLandingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      // Already logged in, check profile status
      const checkProfile = async () => {
        try {
          const res = await fetch(`/api/supplier/profile?user_id=${user.id}`);
          const json = await res.json();
          if (json.data) {
            router.replace('/supplier/dashboard');
          } else {
            router.replace('/supplier/register');
          }
        } catch {
          router.replace('/supplier/register');
        } finally {
          setChecking(false);
        }
      };
      checkProfile();
    } else {
      setChecking(false);
    }
  }, [user, authLoading, router]);

  if (authLoading || checking) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    );
  }

  // Logged in users get redirected above, so this is the visitor landing page
  return (
    <AppLayout>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-6">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">供应商入驻</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto mb-8">
            免费入驻 gyparts.cn AI报价平台，对接海量采购需求，让你的产品被更多买家看到
          </p>
          <button
            onClick={() => router.push('/login?redirect=/supplier/register')}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/20"
          >
            立即申请入驻
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-sm text-blue-200 mt-4">已有账号？登录即可提交入驻申请</p>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">入驻权益</h2>
        <p className="text-gray-500 text-center mb-10">四大核心权益，助力供应商高效获客</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {BENEFITS.map((b, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                <b.icon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{b.title}</h3>
              <p className="text-sm text-gray-500">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Steps Section */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">入驻流程</h2>
          <p className="text-gray-500 text-center mb-10">三步完成入驻，最快1个工作日开通</p>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={i} className="relative">
                <div className="text-5xl font-bold text-blue-100 mb-4">{s.num}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-blue-200" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Required Materials */}
      <div className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">所需资料</h2>
        <p className="text-gray-500 text-center mb-10">准备以下资料，入驻更高效</p>
        <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {['公司名称', '联系人姓名', '联系电话', '公司地址（选填）', '营业执照号（选填）'].map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-6 py-4">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-700">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">准备好入驻了吗？</h2>
          <p className="text-blue-100 mb-8">免费入驻，无平台抽佣，审核通过后即可开始接单</p>
          <button
            onClick={() => router.push('/login?redirect=/supplier/register')}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg"
          >
            立即申请入驻
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
