'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, Building2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

export default function SupplierEntryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.replace('/login?redirect=/supplier');
      return;
    }

    // Check if user already has a supplier profile
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
  }, [user, authLoading, router]);

  if (authLoading || checking) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <p className="text-gray-500">正在检查供应商信息...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Building2 className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500">正在跳转...</p>
      </div>
    </AppLayout>
  );
}
