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
} from 'lucide-react';

interface SupplierProfile {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  address: string | null;
  created_at: string;
}

interface SupplierProduct {
  id: string;
  mold_number: string | null;
  product_name: string | null;
  cross_section_mm: string | null;
  weight_per_meter: number | null;
  perimeter: number | null;
  surface_treatments: string[];
  cross_section_image_url: string | null;
  remarks: string | null;
  created_at: string;
}

export default function SupplierDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
      const profRes = await fetch(`/api/supplier/profile?user_id=${user.id}`);
      const profJson = await profRes.json();
      if (!profJson.data) {
        router.replace('/supplier/register');
        return;
      }
      setProfile(profJson.data);

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
                <CardDescription>共 {products.length} 个产品</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/supplier/products')}>
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
                      <TableHead className="w-[100px]">模具编号</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead className="w-[130px]">截面尺寸(mm)</TableHead>
                      <TableHead className="w-[80px]">米重</TableHead>
                      <TableHead className="w-[80px]">周长</TableHead>
                      <TableHead className="w-[80px]">模具类型</TableHead>
                      <TableHead className="w-[140px]">表面处理</TableHead>
                      <TableHead className="w-[60px]">截面图</TableHead>
                      <TableHead className="w-[100px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-xs">
                          {product.mold_number || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {product.product_name || '-'}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {product.cross_section_mm || '-'}
                        </TableCell>
                        <TableCell>
                          {product.weight_per_meter != null ? `${product.weight_per_meter} kg/m` : '-'}
                        </TableCell>
                        <TableCell>
                          {product.perimeter != null ? `${product.perimeter} mm` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.mold_type === '分流模' ? 'destructive' : 'secondary'} className="text-xs">
                            {product.mold_type || (product.num_dies >= 1 ? '分流模' : '平模')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[130px]">
                            {(product.surface_treatments || []).slice(0, 2).map((t) => (
                              <Badge key={t} variant="secondary" className="text-xs">
                                {t}
                              </Badge>
                            ))}
                            {(product.surface_treatments || []).length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(product.surface_treatments || []).length - 2}
                              </Badge>
                            )}
                            {(!product.surface_treatments || product.surface_treatments.length === 0) && '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.cross_section_image_url ? (
                            <div
                              className="w-10 h-10 rounded border overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 hover:shadow-md transition-all bg-gray-50 flex items-center justify-center group"
                              onClick={() => setLightboxImage(product.cross_section_image_url)}
                            >
                              <img
                                src={product.cross_section_image_url}
                                alt="截面图"
                                className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                              />
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
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
      {/* 图片预览弹窗 */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-[80vw] max-h-[80vh]">
            <img
              src={lightboxImage}
              alt="截面图预览"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-gray-100 text-lg font-bold transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
