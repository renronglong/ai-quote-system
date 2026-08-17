'use client';

import { useEffect, useState } from 'react';
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
  ArrowLeft,
  Loader2,
  Plus,
  Package,
  Edit2,
  Trash2,
  AlertCircle,
  Save,
  X,
} from 'lucide-react';

interface SupplierProfile {
  id: string;
  company_name: string;
}

interface ProductForm {
  alloy_grade: string;
  profile_type: string;
  min_width_mm: string;
  max_width_mm: string;
  min_height_mm: string;
  max_height_mm: string;
  max_circle_mm: string;
  min_wall_mm: string;
  min_order_kg: string;
  unit_price: string;
  price_unit: string;
  lead_days: string;
  surface_treatments: string[];
  remarks: string;
  is_active: boolean;
}

interface SupplierProduct {
  id: string;
  supplier_id: string;
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

const ALLOY_GRADES = [
  '6063-T5', '6063-T6', '6061-T6', '6060-T5', '6060-T6',
  '6N01-T5', '6N01-T6', '6005-T5', '6082-T6', '7075-T6',
  '5052-H32', '5083-H111', '2A12-T4', '3A21-H14',
];

const PROFILE_TYPES = ['平模实心', '平模空心', '分流模'];

const SURFACE_TREATMENTS = [
  '阳极氧化', '电泳涂装', '粉末喷涂', '氟碳喷涂',
  '木纹转印', '抛光', '拉丝', '喷砂',
];

const PRICE_UNITS = ['元/吨', '元/kg'];

const emptyForm: ProductForm = {
  alloy_grade: '',
  profile_type: '',
  min_width_mm: '',
  max_width_mm: '',
  min_height_mm: '',
  max_height_mm: '',
  max_circle_mm: '',
  min_wall_mm: '',
  min_order_kg: '300',
  unit_price: '',
  price_unit: '元/吨',
  lead_days: '15',
  surface_treatments: [],
  remarks: '',
  is_active: true,
};

export default function SupplierProductsPage() {
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
    setError('');
    setDialogOpen(true);
  };

  const openEditDialog = (product: any) => {
    setEditingId(product.id);
    setForm({
      alloy_grade: product.alloy_grade,
      profile_type: product.profile_type,
      min_width_mm: product.min_width_mm?.toString() || '',
      max_width_mm: product.max_width_mm?.toString() || '',
      min_height_mm: product.min_height_mm?.toString() || '',
      max_height_mm: product.max_height_mm?.toString() || '',
      max_circle_mm: product.max_circle_mm?.toString() || '',
      min_wall_mm: product.min_wall_mm?.toString() || '',
      min_order_kg: (product.min_order_kg || 300).toString(),
      unit_price: product.unit_price?.toString() || '',
      price_unit: product.price_unit || '元/吨',
      lead_days: (product.lead_days || 15).toString(),
      surface_treatments: product.surface_treatments || [],
      remarks: product.remarks || '',
      is_active: product.is_active !== false,
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!form.alloy_grade) { setError('请选择合金牌号'); return; }
    if (!form.profile_type) { setError('请选择型材类型'); return; }
    if (!form.unit_price) { setError('请输入加工单价'); return; }

    setSaving(true);
    setError('');

    const payload = {
      alloy_grade: form.alloy_grade,
      profile_type: form.profile_type,
      min_width_mm: form.min_width_mm ? Number(form.min_width_mm) : null,
      max_width_mm: form.max_width_mm ? Number(form.max_width_mm) : null,
      min_height_mm: form.min_height_mm ? Number(form.min_height_mm) : null,
      max_height_mm: form.max_height_mm ? Number(form.max_height_mm) : null,
      max_circle_mm: form.max_circle_mm ? Number(form.max_circle_mm) : null,
      min_wall_mm: form.min_wall_mm ? Number(form.min_wall_mm) : null,
      min_order_kg: Number(form.min_order_kg) || 300,
      unit_price: Number(form.unit_price),
      price_unit: form.price_unit,
      lead_days: Number(form.lead_days) || 15,
      surface_treatments: form.surface_treatments,
      remarks: form.remarks || null,
      is_active: form.is_active,
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
      // Clear edit URL param
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

  const toggleSurfaceTreatment = (treatment: string) => {
    setForm((prev) => ({
      ...prev,
      surface_treatments: prev.surface_treatments.includes(treatment)
        ? prev.surface_treatments.filter((t) => t !== treatment)
        : [...prev.surface_treatments, treatment],
    }));
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/supplier/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">产品管理</h1>
              <p className="text-gray-500 mt-1">
                {profile?.company_name} - 共 {products.length} 个产品
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            新增产品
          </Button>
        </div>

        {/* 产品列表 */}
        <Card>
          <CardContent className="pt-6">
            {products.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">暂无产品</h3>
                <p className="text-gray-400 mb-6">添加您的第一款挤压铝型材产品</p>
                <Button onClick={openAddDialog}>
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
                      <TableHead>尺寸范围</TableHead>
                      <TableHead>壁厚</TableHead>
                      <TableHead>起订量</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>交期</TableHead>
                      <TableHead>表面处理</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.alloy_grade}</TableCell>
                        <TableCell>{product.profile_type}</TableCell>
                        <TableCell className="text-xs">
                          {product.max_circle_mm
                            ? `≤∅${product.max_circle_mm}mm`
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
                        <TableCell>{product.min_wall_mm ? `${product.min_wall_mm}mm` : '-'}</TableCell>
                        <TableCell>{product.min_order_kg}kg</TableCell>
                        <TableCell>
                          <span className="font-semibold text-orange-600">¥{product.unit_price}</span>
                          <span className="text-xs text-gray-500 ml-0.5">
                            /{product.price_unit === '元/吨' ? '吨' : 'kg'}
                          </span>
                        </TableCell>
                        <TableCell>{product.lead_days}天</TableCell>
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
                          <Badge variant={product.is_active ? 'default' : 'secondary'}>
                            {product.is_active ? '上架' : '下架'}
                          </Badge>
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

            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>合金牌号 *</Label>
                <Select
                  value={form.alloy_grade}
                  onValueChange={(v) => setForm({ ...form, alloy_grade: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择牌号" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOY_GRADES.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>型材类型 *</Label>
                <Select
                  value={form.profile_type}
                  onValueChange={(v) => setForm({ ...form, profile_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFILE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 尺寸范围 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">尺寸范围 (mm)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="最小宽度"
                    type="number"
                    value={form.min_width_mm}
                    onChange={(e) => setForm({ ...form, min_width_mm: e.target.value })}
                  />
                  <span className="text-gray-400 text-sm shrink-0">~</span>
                  <Input
                    placeholder="最大宽度"
                    type="number"
                    value={form.max_width_mm}
                    onChange={(e) => setForm({ ...form, max_width_mm: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="最小高度"
                    type="number"
                    value={form.min_height_mm}
                    onChange={(e) => setForm({ ...form, min_height_mm: e.target.value })}
                  />
                  <span className="text-gray-400 text-sm shrink-0">~</span>
                  <Input
                    placeholder="最大高度"
                    type="number"
                    value={form.max_height_mm}
                    onChange={(e) => setForm({ ...form, max_height_mm: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">最大外接圆直径(mm)</Label>
                  <Input
                    placeholder="如：200"
                    type="number"
                    value={form.max_circle_mm}
                    onChange={(e) => setForm({ ...form, max_circle_mm: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">最小壁厚(mm)</Label>
                  <Input
                    placeholder="如：1.0"
                    type="number"
                    step="0.1"
                    value={form.min_wall_mm}
                    onChange={(e) => setForm({ ...form, min_wall_mm: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* 价格与起订量 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>加工单价 *</Label>
                <Input
                  type="number"
                  placeholder="如：18000"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>价格单位</Label>
                <Select
                  value={form.price_unit}
                  onValueChange={(v) => setForm({ ...form, price_unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_UNITS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>最小起订量(kg)</Label>
                <Input
                  type="number"
                  placeholder="300"
                  value={form.min_order_kg}
                  onChange={(e) => setForm({ ...form, min_order_kg: e.target.value })}
                />
              </div>
            </div>

            {/* 交期 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>交期（天）</Label>
                <Input
                  type="number"
                  placeholder="15"
                  value={form.lead_days}
                  onChange={(e) => setForm({ ...form, lead_days: e.target.value })}
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: !!checked })}
                  />
                  <span className="text-sm">立即上架</span>
                </label>
              </div>
            </div>

            {/* 表面处理 */}
            <div className="space-y-2">
              <Label>可做的表面处理</Label>
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

            {/* 备注 */}
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                placeholder="其他补充说明（选填）"
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
    </AppLayout>
  );
}
