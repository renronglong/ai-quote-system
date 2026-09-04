'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/components/AppLayout';
import {
  Loader2,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Save,
  X,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

interface SupplierProfile {
  id: string;
  company_name: string;
}

interface ProductForm {
  mold_number: string;
  product_name: string;
  cross_section_mm: string;
  weight_per_meter: string;
  perimeter: string;
  mold_type?: string;
  surface_treatments: string[];
  cross_section_image_url: string;
  remarks: string;
}

interface SupplierProduct {
  id: string;
  supplier_id: string;
  mold_number: string | null;
  product_name: string | null;
  cross_section_mm: string | null;
  weight_per_meter: number | null;
  perimeter: number | null;
  surface_treatments: string[];
  cross_section_image_url: string | null;
  remarks: string | null;
  mold_type?: string;
  num_dies?: number;
  created_at: string;
  updated_at: string;
}

const SURFACE_TREATMENTS = [
  '阳极氧化', '电泳涂装', '粉末喷涂', '氟碳喷涂',
  '木纹转印', '抛光', '拉丝', '喷砂',
];

const emptyForm: ProductForm = {
  mold_number: '',
  product_name: '',
  cross_section_mm: '',
  weight_per_meter: '',
  perimeter: '',
  mold_type: '',
  surface_treatments: [],
  cross_section_image_url: '',
  remarks: '',
};

function SupplierProductsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Handle image file (from upload or paste)
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('图片大小不能超过2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({ ...prev, cross_section_image_url: dataUrl }));
      setPreviewImage(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  // Paste event listener — global when dialog is open
  useEffect(() => {
    if (!dialogOpen) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) handleImageFile(file);
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [dialogOpen, handleImageFile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/supplier/products');
      return;
    }
    fetchProfile();
  }, [user, authLoading, router]);

  useEffect(() => {
    if (editId && products.length > 0) {
      const product = products.find((p) => p.id === editId);
      if (product) {
        openEditDialog(product);
      }
    }
  }, [editId, products]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/supplier/profile?user_id=${user.id}`);
      const json = await res.json();
      if (!json.data) {
        router.replace('/supplier/register');
        return;
      }
      setProfile(json.data);
      await fetchProducts(json.data.id);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchProducts = async (supplierId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier/products?supplier_id=${supplierId}`);
      const json = await res.json();
      setProducts(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setPreviewImage(null);
    setError('');
    setDialogOpen(true);
  };

  const openEditDialog = (product: SupplierProduct) => {
    setEditingId(product.id);
    setForm({
      mold_number: product.mold_number || '',
      product_name: product.product_name || '',
      cross_section_mm: product.cross_section_mm || '',
      weight_per_meter: product.weight_per_meter?.toString() || '',
      perimeter: product.perimeter?.toString() || '',
      mold_type: product.mold_type || '',
      surface_treatments: product.surface_treatments || [],
      cross_section_image_url: product.cross_section_image_url || '',
      remarks: product.remarks || '',
    });
    setPreviewImage(product.cross_section_image_url || null);
    setError('');
    setDialogOpen(true);
  };

  const toggleSurfaceTreatment = (t: string) => {
    setForm((prev) => ({
      ...prev,
      surface_treatments: prev.surface_treatments.includes(t)
        ? prev.surface_treatments.filter((s) => s !== t)
        : [...prev.surface_treatments, t],
    }));
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!form.mold_number?.trim()) { setError('请输入模具编号'); return; }

    setSaving(true);
    setError('');

    const payload = {
      mold_number: form.mold_number || null,
      product_name: form.product_name,
      cross_section_mm: form.cross_section_mm || null,
      weight_per_meter: form.weight_per_meter ? Number(form.weight_per_meter) : null,
      perimeter: form.perimeter ? Number(form.perimeter) : null,
      mold_type: form.mold_type || null,
      surface_treatments: form.surface_treatments,
      cross_section_image_url: form.cross_section_image_url || null,
      remarks: form.remarks || null,
    };

    try {
      const url = '/api/supplier/products';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...payload } : { supplier_id: profile.id, ...payload };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '保存失败');
        return;
      }

      setDialogOpen(false);
      fetchProducts(profile.id);
      if (editId) {
        router.replace('/supplier/products');
      }
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此产品吗？')) return;
    if (!profile) return;
    try {
      const res = await fetch(`/api/supplier/products?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">产品管理</h1>
            <p className="text-gray-500 text-sm mt-1">{profile?.company_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/supplier/products/page-batch')}>
              <Upload className="w-4 h-4 mr-1" />
              批量上传 Excel
            </Button>
            <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-1" />
            新增产品
          </Button>
        </div>
          </div>

        {/* 产品表格 */}
        <Card>
          <CardContent className="p-0">
            {products.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg mb-2">暂无产品</p>
                <p className="text-sm">点击右上角「新增产品」开始添加</p>
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
                      <TableHead className="w-[160px]">表面处理</TableHead>
                      <TableHead className="w-[80px]">截面图</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="w-[80px] text-right">操作</TableHead>
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
                            {product.mold_type || ((product.num_dies ?? 0) >= 1 ? '分流模' : '平模')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
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
                              className="w-12 h-12 rounded border overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 hover:shadow-md transition-all bg-gray-50 flex items-center justify-center group"
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
                        <TableCell className="text-gray-500 text-xs max-w-[120px] truncate">
                          {product.remarks || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(product)}>
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

      {/* 新增/编辑产品弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑产品' : '新增产品'}</DialogTitle>
            <DialogDescription>
              {editingId ? '修改产品信息' : '添加一款挤压铝型材产品'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* 模具编号 + 产品名称 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>模具编号</Label>
                <Input
                  placeholder="如：MJ-20260801 *"
                  value={form.mold_number}
                  onChange={(e) => setForm({ ...form, mold_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>产品名称</Label>
                <Input
                  placeholder="如：散热器铝型材（选填）"
                  value={form.product_name}
                  onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                />
              </div>
            </div>

            {/* 截面尺寸 + 米重 + 周长 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>截面尺寸(mm)</Label>
                <Input
                  placeholder="如：50×30×2.0"
                  value={form.cross_section_mm}
                  onChange={(e) => setForm({ ...form, cross_section_mm: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>米重(kg/m)</Label>
                <Input
                  type="number"
                  placeholder="如：850"
                  value={form.weight_per_meter}
                  onChange={(e) => setForm({ ...form, weight_per_meter: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>周长(mm)</Label>
                <Input
                  type="number"
                  placeholder="如：320"
                  value={form.perimeter}
                  onChange={(e) => setForm({ ...form, perimeter: e.target.value })}
                />
              </div>
            </div>


            {/* 模具类型 */}
            <div className="space-y-2">
              <Label>模具类型</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={form.mold_type}
                onChange={(e) => setForm({ ...form, mold_type: e.target.value })}
              >
                <option value="">未指定</option>
                <option value="平模">平模</option>
                <option value="分流模">分流模</option>
              </select>
            </div>

            {/* 表面处理 */}
            <div className="space-y-2">
              <Label>表面处理</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SURFACE_TREATMENTS.map((t) => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.surface_treatments.includes(t)}
                      onCheckedChange={() => toggleSurfaceTreatment(t)}
                    />
                    <span className="text-sm">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 截面图 */}
            <div className="space-y-2">
              <Label>截面图</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="粘贴图片URL"
                  value={form.cross_section_image_url}
                  onChange={(e) => {
                    setForm({ ...form, cross_section_image_url: e.target.value });
                    setPreviewImage(e.target.value || null);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFile(file);
                    };
                    input.click();
                  }}
                >
                  <ImageIcon className="w-4 h-4 mr-1" />
                  上传
                </Button>
              </div>
              <p className="text-xs text-gray-400">支持上传文件或 Ctrl+V 粘贴截图</p>
              {previewImage && (
                <div className="mt-2 relative inline-block">
                  <img
                    src={previewImage}
                    alt="截面图预览"
                    className="w-32 h-32 object-contain border-2 border-blue-200 rounded-lg shadow-sm bg-white p-1"
                    onError={() => setPreviewImage(null)}
                  />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow"
                    onClick={() => {
                      setPreviewImage(null);
                      setForm({ ...form, cross_section_image_url: '' });
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* 备注 */}
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="其他说明（选填）"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  {editingId ? '更新' : '保存'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

export default function SupplierProductsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <SupplierProductsContent />
    </Suspense>
  );
}
