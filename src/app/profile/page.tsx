'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  User, Phone, Building2, MapPin, FileText, Package,
  BarChart3, KeyRound, LogOut, Clock, Calendar, Shield,
  ChevronRight, Factory, Loader2, Edit3, Check, X, Mail, UserCircle,
} from 'lucide-react';

interface UserProfile {
  phone: string;
  company_name: string | null;
  address: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // 编辑模式
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companySearchResults, setCompanySearchResults] = useState<{name: string; address: string}[]>([]);
  const [companySearching, setCompanySearching] = useState(false);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState({
    company_name: '', contact_name: '', contact_phone: '', contact_email: '', address: '',
  });

  // 未登录跳转
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // 获取用户详细信息
  useEffect(() => {
    if (!user?.id) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/auth/profile?user_id=${user.id}`);
        const data = await res.json();
        if (data.success) {
          const u = data.data.user || {};
          const p = data.data.profile || {};
          const prof: UserProfile = {
            phone: u.phone || '',
            company_name: u.company_name || null,
            address: u.address || null,
            contact_name: p.description?.replace('联系人：', '') || null,
            contact_phone: p.contact_phone || null,
            contact_email: p.contact_email || null,
          };
          setProfile(prof);
          setForm({
            company_name: prof.company_name || '',
            contact_name: prof.contact_name || '',
            contact_phone: prof.contact_phone || '',
            contact_email: prof.contact_email || '',
            address: prof.address || '',
          });
        }
      } catch (err) {
        console.error('获取用户信息失败:', err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone || '未设置';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push('/');
  };

  const handleChangePassword = () => {
    alert('功能开发中，敬请期待！');
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          company_name: form.company_name.trim() || undefined,
          contact_name: form.contact_name.trim() || undefined,
          contact_phone: form.contact_phone.trim() || undefined,
          contact_email: form.contact_email.trim() || undefined,
          address: form.address.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProfile({
          ...profile!,
          company_name: form.company_name.trim() || null,
          contact_name: form.contact_name.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          address: form.address.trim() || null,
        });
        setEditing(false);
        setSaveMsg('保存成功');
        setTimeout(() => setSaveMsg(''), 3000);
      } else {
        setSaveMsg(data.error || '保存失败');
      }
    } catch {
      setSaveMsg('网络错误');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setForm({
        company_name: profile.company_name || '',
        contact_name: profile.contact_name || '',
        contact_phone: profile.contact_phone || '',
        contact_email: profile.contact_email || '',
        address: profile.address || '',
      });
    }
    setEditing(false);
    setSaveMsg('');
  };

  const stats = [
    { label: '报价次数', value: '12', icon: FileText, color: 'from-blue-500 to-blue-600' },
    { label: '产品数量', value: '8', icon: Package, color: 'from-emerald-500 to-emerald-600' },
    { label: '最近登录', value: '今天', icon: Clock, color: 'from-orange-500 to-orange-600' },
  ];

  const menuItems = [
    { label: '我的报价', desc: '查看历史报价记录', icon: FileText, href: '/history', color: 'bg-blue-50 text-blue-600' },
    { label: '我的产品', desc: '管理产品信息', icon: Package, href: '/products', color: 'bg-emerald-50 text-emerald-600' },
    { label: '库存管理', desc: '查看库存数据', icon: BarChart3, href: '/inventory', color: 'bg-purple-50 text-purple-600' },
    { label: '修改密码', desc: '更新登录密码', icon: KeyRound, href: null, color: 'bg-orange-50 text-orange-600', action: handleChangePassword },
    { label: '退出登录', desc: '退出当前账号', icon: LogOut, href: null, color: 'bg-red-50 text-red-600', action: handleSignOut, danger: true },
  ];

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-white';
  const labelCls = 'text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <Factory className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-slate-800">工品报价</span>
            </Link>
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
              返回首页
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 用户信息卡 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <User className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                {profileLoading ? (
                  <div className="h-6 w-32 bg-white/20 rounded animate-pulse" />
                ) : (
                  <>
                    <h1 className="text-lg font-bold text-white">
                      {maskPhone(profile?.phone || user.user_metadata?.phone || '')}
                    </h1>
                    <p className="text-sm text-blue-100 mt-0.5 truncate">
                      {profile?.company_name || '暂未设置公司信息'}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full backdrop-blur-sm">
                <Shield className="w-3.5 h-3.5 text-blue-100" />
                <span className="text-xs text-blue-50 font-medium">已认证</span>
              </div>
            </div>
          </div>

          {/* 详细信息 / 编辑表单 */}
          <div className="px-6 py-4">
            {!editing ? (
              /* 展示模式 */
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">手机号</span>
                  <span className="text-slate-800 font-medium ml-auto">
                    {profileLoading ? '加载中...' : maskPhone(profile?.phone || user.user_metadata?.phone || '')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">公司名称</span>
                  <span className="text-slate-800 font-medium ml-auto">
                    {profileLoading ? '加载中...' : (profile?.company_name || '未设置')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <UserCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">联系人</span>
                  <span className="text-slate-800 font-medium ml-auto">
                    {profileLoading ? '加载中...' : (profile?.contact_name || '未设置')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">联系电话</span>
                  <span className="text-slate-800 font-medium ml-auto">
                    {profileLoading ? '加载中...' : (profile?.contact_phone || '未设置')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">邮箱</span>
                  <span className="text-slate-800 font-medium ml-auto">
                    {profileLoading ? '加载中...' : (profile?.contact_email || '未设置')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-500">地址</span>
                  <span className="text-slate-800 font-medium ml-auto text-right max-w-[200px] truncate">
                    {profileLoading ? '加载中...' : (profile?.address || '未设置')}
                  </span>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="w-full mt-2 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-4 h-4" /> 编辑公司资料
                </button>
              </div>
            ) : (
              /* 编辑模式 */
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>公司名称 <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input className={`${inputCls} pl-9`} placeholder="输入关键词搜索公司..."
                      value={form.company_name}
                      onChange={(e) => {
                        setForm({...form, company_name: e.target.value});
                        searchCompany(e.target.value);
                      }}
                      onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                      onFocus={() => { if (companySearchResults.length > 0) setShowCompanyDropdown(true); }}
                    />
                    {companySearching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-400">搜索中...</span>}
                    {showCompanyDropdown && companySearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {companySearchResults.map((c, i) => (
                          <div key={i} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                            onMouseDown={() => selectCompany(c)}>
                            <div className="text-sm font-medium text-gray-800">{c.name}</div>
                            {c.address && <div className="text-xs text-gray-400 truncate">{c.address}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>联系人</label>
                    <div className="relative">
                      <UserCircle className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input className={`${inputCls} pl-9`} placeholder="姓名"
                        value={form.contact_name} onChange={(e) => setForm({...form, contact_name: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>联系电话</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input className={`${inputCls} pl-9`} placeholder="手机号"
                        value={form.contact_phone} onChange={(e) => setForm({...form, contact_phone: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>联系邮箱</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input className={`${inputCls} pl-9`} placeholder="email@example.com"
                      value={form.contact_email} onChange={(e) => setForm({...form, contact_email: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>公司地址</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-300 absolute left-3 top-2.5" />
                    <input className={`${inputCls} pl-9`} placeholder="详细地址"
                      value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
                  </div>
                </div>
                {saveMsg && (
                  <div className={`text-xs ${saveMsg.includes('成功') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</div>
                )}
                <div className="flex gap-2 pt-1">
                  <button onClick={handleSaveProfile} disabled={saving || !form.company_name.trim()}
                    className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button onClick={handleCancelEdit}
                    className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
                    <X className="w-4 h-4" /> 取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 数据统计区 */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <div className={`w-10 h-10 mx-auto mb-2 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-xl font-bold text-slate-800">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 功能入口列表 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">功能中心</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {menuItems.map((item, idx) => {
              const content = (
                <div className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                  item.danger ? 'hover:bg-red-50' : 'hover:bg-slate-50'
                } ${item.action ? 'cursor-pointer' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${item.danger ? 'text-red-600' : 'text-slate-800'}`}>
                      {item.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                  </div>
                  {signingOut && item.label === '退出登录' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  )}
                </div>
              );
              if (item.href) return <Link key={idx} href={item.href}>{content}</Link>;
              return <div key={idx} onClick={item.action}>{content}</div>;
            })}
          </div>
        </div>

        {/* 底部信息 */}
        <div className="bg-white rounded-2xl border border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>注册时间</span>
            </div>
            <span className="text-slate-700 font-medium">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('zh-CN') : '未知'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-3">
            <div className="flex items-center gap-2 text-slate-500">
              <Shield className="w-4 h-4" />
              <span>会员状态</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
              标准会员
            </span>
          </div>
        </div>

        {/* 底部版权 */}
        <div className="text-center py-4 text-xs text-slate-400">
          <p>工品报价 gyparts.cn</p>
          <p className="mt-1">© {new Date().getFullYear()} 版权所有</p>
        </div>
      </div>
    </div>
  );
}
