'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import AppLayout from '@/components/AppLayout';
import {
  Building2,
  Loader2,
  Plus,
  Package,
  Edit2,
  Trash2,
  MapPin,
  Phone,
  User,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface SupplierProfile {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  address: string | null;
  business_license: string | null;
  created_at: string;
}

interface SupplierProduct {
  id: string;
  alloy_grade: string;
  profile_type: string;
  min_width_mm: number | null;
  max_width_mm: number | null;
  min_height_mm: number | null;
  max_height_mm: number | null;
  max_circle_mm: number | null;
  min_wall_mm: number | null;
  min_order_kg: number;
  unit_price: number;
  price_unit: string;
  lead_days: number;
  surface_treatments: string[];
  remarks: string | null;
  is_active: boolean;
  created_at: string;
}

export default function SupplierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/supplier/dashboard');
      return;
    }
    fetchData();
  }, [user, authLoading, router]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get profile
      const profRes = await fetch(`/api/supplier/profile?user_id=${user.id}`);
      const profJson = await profRes.json();
      if (!profJson.data) {
        router.replace('/supplier/register');
        return;
      }
      setProfile(profJson.data);

      // Get products
      const prodRes = await fetch(`/api/supplier/products?supplier_id=${profJson.data.id}`);
      const prodJson = await prodRes.json();
      setProducts(prodJson.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此产品吗？')) return;
    try {
      const res = await fetch(`/api/supplier/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">供应商后台</h1>
            <p className="text-gray-500 mt-1">管理您的供应商资料和产品</p>
          </div>
          <Button onClick={() => router.push('/supplier/products')}>
            <Plus className="w-4 h-4 mr-2" />
            管理产品
          </Button>
        </div>

        {/* 企业信息 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  {profile.company_name}
                </CardTitle>
                <CardDescription>
                  入驻时间：{new Date(profile.created_at).toLocaleDateString('zh-CN')}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/supplier/register')}
              >
                <Edit2 className="w-4 h-4 mr-1" />
                编辑
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{profile.contact_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{profile.phone}</span>
              </div>
              {profile.address && (
                <div className="flex items-center gap-2 text-sm col-span-1 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{profile.address}</span>
                </div>
              )}
              {profile.business_license && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{profile.business_license}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 产品列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  产品列表
                </CardTitle>
                <CardDescription>
                  共 {products.length} 个产品
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/supplier/products')}
              >
                <Plus className="w-4 h-4 mr-1" />
                新增产品
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">暂无产品，开始添加您的铝型材产品吧</p>
                <Button onClick={() => router.push('/supplier/products')}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加产品
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>合金牌号</TableHead>
                      <TableHead>型材类型</TableHead>
                      <TableHead>尺寸范围(mm)</TableHead>
                      <TableHead>最小壁厚</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>交期</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.alloy_grade}</TableCell>
                        <TableCell>{product.profile_type}</TableCell>
                        <TableCell>
                          {product.max_circle_mm
                            ? `≤∅${product.max_circle_mm}`
                            : [
                                product.min_width_mm && product.max_width_mm
                                  ? `W${product.min_width_mm}-${product.max_width_mm}`
                                  : null,
                                product.min_height_mm && product.max_height_mm
                                  ? `H${product.min_height_mm}-${product.max_height_mm}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' × ') || '-'}
                        </TableCell>
                        <TableCell>
                          {product.min_wall_mm ? `${product.min_wall_mm}mm` : '-'}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-orange-600">
                            ¥{product.unit_price}
                          </span>
                          <span className="text-xs text-gray-500">/{product.price_unit.replace('元/', '')}</span>
                        </TableCell>
                        <TableCell>{product.lead_days}天</TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? 'default' : 'secondary'}>
                            {product.is_active ? '上架' : '下架'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/supplier/products?edit=${product.id}`)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
