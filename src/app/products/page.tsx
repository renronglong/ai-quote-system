'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react';

interface Product {
  id: number;
  product_code: string;
  name: string;
  material: string;
  process: string;
  surface_treatment: string;
  oxidation_color?: string;
  cost_price: string;
  min_price?: string;
  specs?: string;
  description?: string;
  created_at: string;
}

const MATERIALS = ['铝型材', '冷轧板', '不锈钢', '压铸铝', '塑胶'];
const PROCESSES = ['铝挤压', '冲压', '铝压铸', '注塑', '塑料挤出', 'CNC加工', '车加工'];
const SURFACE_TREATMENTS = ['氧化', '喷涂', '电泳', '电镀'];
const OXIDATION_COLORS = ['银白', '黑色', '金色', '古铜色', '香槟色'];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMaterial, setFilterMaterial] = useState<string>('');
  const [filterProcess, setFilterProcess] = useState<string>('');
  const [filterSurfaceTreatment, setFilterSurfaceTreatment] = useState<string>('');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    product_code: '',
    name: '',
    material: '',
    process: '',
    surface_treatment: '',
    oxidation_color: '',
    cost_price: '',
    min_price: '',
    specs: '',
    description: '',
  });

  // 加载产品列表
  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterMaterial) params.append('material', filterMaterial);
      if (filterProcess) params.append('process', filterProcess);
      if (filterSurfaceTreatment) params.append('surface_treatment', filterSurfaceTreatment);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (error) {
      console.error('加载产品失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [filterMaterial, filterProcess, filterSurfaceTreatment]);

  // 打开新建/编辑对话框
  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        product_code: product.product_code,
        name: product.name,
        material: product.material,
        process: product.process,
        surface_treatment: product.surface_treatment,
        oxidation_color: product.oxidation_color || '',
        cost_price: product.cost_price,
        min_price: product.min_price || '',
        specs: product.specs || '',
        description: product.description || '',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        product_code: '',
        name: '',
        material: '',
        process: '',
        surface_treatment: '',
        oxidation_color: '',
        cost_price: '',
        min_price: '',
        specs: '',
        description: '',
      });
    }
    setDialogOpen(true);
  };

  // 保存产品
  const handleSave = async () => {
    try {
      const url = '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const body = editingProduct
        ? { id: editingProduct.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        setDialogOpen(false);
        loadProducts();
      } else {
        alert('保存失败: ' + data.error);
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  // 删除产品
  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个产品吗？')) return;

    try {
      const response = await fetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        loadProducts();
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">产品管理</h1>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          新增产品
        </Button>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索产品名称或编码..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => e.key === 'Enter' && loadProducts()}
                />
              </div>
            </div>
            <Select value={filterMaterial || "all"} onValueChange={(v) => setFilterMaterial(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="材质" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部材质</SelectItem>
                {MATERIALS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterProcess || "all"} onValueChange={(v) => setFilterProcess(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="工艺" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部工艺</SelectItem>
                {PROCESSES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSurfaceTreatment || "all"} onValueChange={(v) => setFilterSurfaceTreatment(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="表面处理" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部处理</SelectItem>
                {SURFACE_TREATMENTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 产品列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无产品数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品编码</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>材质</TableHead>
                  <TableHead>工艺</TableHead>
                  <TableHead>表面处理</TableHead>
                  <TableHead>成本单价</TableHead>
                  <TableHead>最低限价</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.product_code}</TableCell>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.material}</Badge>
                    </TableCell>
                    <TableCell>{product.process}</TableCell>
                    <TableCell>
                      {product.surface_treatment}
                      {product.oxidation_color && ` - ${product.oxidation_color}`}
                    </TableCell>
                    <TableCell>¥{product.cost_price}</TableCell>
                    <TableCell>
                      {product.min_price ? `¥${product.min_price}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? '编辑产品' : '新增产品'}</DialogTitle>
            <DialogDescription>
              填写产品信息，带 * 的为必填项
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label htmlFor="product_code">产品编码 *</Label>
              <Input
                id="product_code"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="name">产品名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>材质 *</Label>
              <Select
                value={formData.material}
                onValueChange={(value) => setFormData({ ...formData, material: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择材质" />
                </SelectTrigger>
                <SelectContent>
                  {MATERIALS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>加工工艺 *</Label>
              <Select
                value={formData.process}
                onValueChange={(value) => setFormData({ ...formData, process: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择工艺" />
                </SelectTrigger>
                <SelectContent>
                  {PROCESSES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>表面处理 *</Label>
              <Select
                value={formData.surface_treatment}
                onValueChange={(value) => setFormData({ ...formData, surface_treatment: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="选择表面处理" />
                </SelectTrigger>
                <SelectContent>
                  {SURFACE_TREATMENTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.surface_treatment === '氧化' && (
              <div>
                <Label>氧化颜色</Label>
                <Select
                  value={formData.oxidation_color}
                  onValueChange={(value) => setFormData({ ...formData, oxidation_color: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="选择颜色" />
                  </SelectTrigger>
                  <SelectContent>
                    {OXIDATION_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="cost_price">成本单价 (元) *</Label>
              <Input
                id="cost_price"
                type="number"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="min_price">最低限价 (元)</Label>
              <Input
                id="min_price"
                type="number"
                value={formData.min_price}
                onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="specs">规格参数</Label>
              <Textarea
                id="specs"
                value={formData.specs}
                onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">产品描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
