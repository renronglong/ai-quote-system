'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  User,
  Phone,
  Building2,
  MapPin,
  FileText,
  Package,
  BarChart3,
  KeyRound,
  LogOut,
  Clock,
  Calendar,
  Shield,
  ChevronRight,
  Factory,
  Loader2,
} from 'lucide-react';

interface UserProfile {
  phone: string;
  company_name: string | null;
  address: string | null;
}

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // 未登录跳转
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // 获取用户详细信息
  useEffect(() => {
    if (!user?.id) return;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/auth/profile?user_id=${user.id}`);
        const data = await res.json();
        if (data.success) {
          setProfile(data.data.user);
        }
      } catch (err) {
        console.error('获取用户信息失败:', err);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  // 手机号脱敏
  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone || '未设置';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  };

  // 退出登录
  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push('/');
  };

  // 修改密码（预留）
  const handleChangePassword = () => {
    alert('功能开发中，敬请期待！');
  };

  // 统计数据（占位）
  const stats = [
    { label: '报价次数', value: '12', icon: FileText, color: 'from-blue-500 to-blue-600' },
    { label: '产品数量', value: '8', icon: Package, color: 'from-emerald-500 to-emerald-600' },
    { label: '最近登录', value: '今天', icon: Clock, color: 'from-orange-500 to-orange-600' },
  ];

  // 功能入口
  const menuItems = [
    { label: '我的报价', desc: '查看历史报价记录', icon: FileText, href: '/history', color: 'bg-blue-50 text-blue-600' },
    { label: '我的产品', desc: '管理产品信息', icon: Package, href: '/products', color: 'bg-emerald-50 text-emerald-600' },
    { label: '库存管理', desc: '查看库存数据', icon: BarChart3, href: '/inventory', color: 'bg-purple-50 text-purple-600' },
    { label: '修改密码', desc: '更新登录密码', icon: KeyRound, href: null, color: 'bg-orange-50 text-orange-600', action: handleChangePassword },
    { label: '退出登录', desc: '退出当前账号', icon: LogOut, href: null, color: 'bg-red-50 text-red-600', action: handleSignOut, danger: true },
  ];

  // 加载中
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

          {/* 详细信息 */}
          <div className="px-6 py-4 space-y-3">
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
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">地址</span>
              <span className="text-slate-800 font-medium ml-auto text-right max-w-[200px] truncate">
                {profileLoading ? '加载中...' : (profile?.address || '未设置')}
              </span>
            </div>
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

              if (item.href) {
                return <Link key={idx} href={item.href}>{content}</Link>;
              }
              return (
                <div key={idx} onClick={item.action}>
                  {content}
                </div>
              );
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
