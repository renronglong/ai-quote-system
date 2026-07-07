'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/lib/auth-context';
import {
  Search,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Package,
  Ruler,
  Weight,
  DollarSign,
  Layers,
  LayoutGrid,
  List,
  Building2,
  Menu,
  X,
} from 'lucide-react';

interface ProductSpecs {
  width?: number;
  height?: number;
  wall_thickness?: number;
  weight_per_meter?: number;
  svg_path?: string;
  length?: number;
  supplier?: string;
  [key: string]: number | string | undefined;
}

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
  specs?: ProductSpecs | string | null;
  description?: string;
  status?: string;
  supplier?: string;
  user_id?: string;
  created_at: string;
}

const MATERIALS = ['铝型材', '冷轧板', '不锈钢', '压铸铝', '塑胶'];
const PROCESSES = ['铝挤压', '冲压', '铝压铸', '注塑', '塑料挤出', 'CNC加工', '车加工'];
const SURFACE_TREATMENTS = ['氧化', '喷涂', '电泳', '电镀'];
const OXIDATION_COLORS = ['银白', '黑色', '金色', '古铜色', '香槟色'];

// 解析 specs 字段
function parseSpecs(specs: ProductSpecs | string | null | undefined): ProductSpecs {
  if (!specs) return {};
  if (typeof specs === 'string') {
    try {
      return JSON.parse(specs);
    } catch {
      return {};
    }
  }
  return specs;
}

// SVG 占位图组件
function SvgPlaceholder({ productCode }: { productCode: string }) {
  return (
    <div className="w-full h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
      <div className="text-center">
        <Package className="w-10 h-10 text-gray-300 mx-auto mb-1" />
        <span className="text-xs text-gray-400 font-mono">{productCode}</span>
      </div>
    </div>
  );
}

// 产品卡片组件
function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
}) {
  const specs = parseSpecs(product.specs);

  const formatDimension = (val: number | string | undefined) => {
    if (val === undefined || val === null || val === '') return null;
    return typeof val === 'number' ? `${val}` : val;
  };

  const dimensionParts = [
    formatDimension(specs.width),
    formatDimension(specs.height),
    formatDimension(specs.wall_thickness),
  ].filter(Boolean);

  const dimensionText = dimensionParts.length > 0
    ? `${dimensionParts.join(' × ')} mm`
    : null;

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden border-gray-200 hover:border-blue-300">
      {/* SVG 预览区域 */}
      <div className="relative p-3 pb-0">
        {specs.svg_path ? (
          <div className="w-full h-32 bg-white rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={specs.svg_path}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = `
                  <div class="w-full h-full flex items-center justify-center">
                    <div class="text-center">
                      <svg class="w-10 h-10 text-gray-300 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                      </svg>
                      <span class="text-xs text-gray-400 font-mono">${product.product_code}</span>
                    </div>
                  </div>
                `;
              }}
            />
          </div>
        ) : (
          <SvgPlaceholder productCode={product.product_code} />
        )}

        {/* 操作按钮 */}
        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 w-7 p-0 shadow-sm"
            onClick={() => onEdit(product)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 w-7 p-0 shadow-sm text-red-500 hover:text-red-600"
            onClick={() => onDelete(product.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* 产品信息 */}
      <CardContent className="pt-3 pb-3 space-y-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
              {product.product_code}
            </span>
            <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal">
              {product.material}
            </Badge>
          </div>
          <h3 className="font-medium text-sm text-gray-900 leading-tight line-clamp-1">
            {product.name}
          </h3>
        </div>

        <div className="space-y-1">
          {dimensionText && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Ruler className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{dimensionText}</span>
            </div>
          )}
          {specs.weight_per_meter && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Weight className="w-3 h-3 flex-shrink-0" />
              <span>{specs.weight_per_meter} kg/m</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Layers className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{product.process} · {product.surface_treatment}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-600">
              ¥{product.cost_price}
            </span>
            <span className="text-xs text-gray-400">/kg</span>
          </div>
          {product.min_price && (
            <span className="text-xs text-gray-400">
              限价 ¥{product.min_price}
            </span>
          )}
        </div>

        {/* 供应商标签 */}
        {product.supplier && (
          <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
            <Building2 className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-400 truncate">
              {product.supplier.replace('佛山市', '').replace('有限公司', '')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 供应商栏组件
function SupplierSidebar({
  suppliers,
  selectedSupplier,
  onSelectSupplier,
  mobileOpen,
  onCloseMobile,
}: {
  suppliers: string[];
  selectedSupplier: string;
  onSelectSupplier: (supplier: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSuppliers = suppliers.filter((s) =>
    s.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="p-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            供应商
          </h2>
          {/* 移动端关闭按钮 */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1 rounded hover:bg-gray-100"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <Input
            placeholder="搜索供应商..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* 供应商列表 */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* 全部 */}
        <button
          onClick={() => {
            onSelectSupplier('');
            onCloseMobile();
          }}
          className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
            selectedSupplier === ''
              ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Package className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">全部产品</div>
          </div>
        </button>

        {/* 供应商列表 */}
        {filteredSuppliers.map((supplier) => {
          // 获取简称
          const shortName = supplier
            .replace('佛山市', '')
            .replace('有限公司', '');
          const isSelected = selectedSupplier === supplier;

          return (
            <button
              key={supplier}
              onClick={() => {
                onSelectSupplier(supplier);
                onCloseMobile();
              }}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{shortName}</div>
                <div className="text-xs text-gray-400 truncate">{supplier}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* 桌面端侧边栏 */}
      <aside className="hidden lg:block w-60 flex-shrink-0">
        <Card className="sticky top-4 shadow-sm border-gray-200">
          {sidebarContent}
        </Card>
      </aside>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <>
          {/* 遮罩 */}
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={onCloseMobile}
          />
          {/* 侧边栏 */}
          <aside className="fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-xl lg:hidden">
            <Card className="h-full border-0 rounded-none">
              {sidebarContent}
            </Card>
          </aside>
        </>
      )}
    </>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </AppLayout>
    }>
      <ProductsPageContent />
    </Suspense>
  );
}

function ProductsPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMaterial, setFilterMaterial] = useState<string>('');
  const [filterProcess, setFilterProcess] = useState<string>('');
  const [filterSurfaceTreatment, setFilterSurfaceTreatment] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  // 初始化搜索词
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearchQuery(q);
  }, [searchParams]);

  // 加载供应商列表
  const loadSuppliers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (user?.id) params.append('user_id', user.id);
      params.append('suppliers', 'true');

      const response = await fetch(`/api/products?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data);
      }
    } catch (error) {
      console.error('加载供应商列表失败:', error);
    }
  }, [user]);

  // 加载产品列表
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (user?.id) params.append('user_id', user.id);
      if (selectedSupplier) params.append('supplier', selectedSupplier);
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
  }, [user, selectedSupplier, filterMaterial, filterProcess, filterSurfaceTreatment, searchQuery]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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
        specs: typeof product.specs === 'string' ? product.specs : JSON.stringify(product.specs || {}, null, 2),
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

      let parsedSpecs: Record<string, unknown> = {};
      if (formData.specs) {
        try {
          parsedSpecs = JSON.parse(formData.specs);
        } catch {
          parsedSpecs = {};
        }
      }

      // 确保 supplier 字段保留
      if (suppliers.length > 0) {
        parsedSpecs.supplier = suppliers[0];
      }

      const body = editingProduct
        ? { id: editingProduct.id, ...formData, specs: parsedSpecs }
        : { ...formData, specs: parsedSpecs, user_id: user?.id };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (data.success) {
        setDialogOpen(false);
        loadProducts();
        loadSuppliers();
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
        loadSuppliers();
      } else {
        alert('删除失败: ' + data.error);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 搜索处理
  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    router.replace(`/products?${params.toString()}`);
  };

  // 处理供应商选择
  const handleSelectSupplier = (supplier: string) => {
    setSelectedSupplier(supplier);
  };

  // 当前显示的供应商名称
  const currentSupplierName = selectedSupplier
    ? selectedSupplier.replace('佛山市', '').replace('有限公司', '')
    : '全部产品';

  return (
    <AppLayout>
      <div className="flex gap-4">
        {/* 左侧供应商栏 */}
        <SupplierSidebar
          suppliers={suppliers}
          selectedSupplier={selectedSupplier}
          onSelectSupplier={handleSelectSupplier}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* 右侧内容区 */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* 页面标题栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md border border-gray-200 hover:bg-gray-50"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{currentSupplierName}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  共 {products.length} 个产品
                </p>
              </div>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              新增产品
            </Button>
          </div>

          {/* 搜索和筛选 */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* 搜索框 */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="搜索产品编号或名称..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>

                {/* 筛选下拉 */}
                <Select value={filterMaterial || "all"} onValueChange={(v) => setFilterMaterial(v === "all" ? "" : v)}>
                  <SelectTrigger className="w-full sm:w-36">
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
                  <SelectTrigger className="w-full sm:w-36">
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
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="表面处理" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部处理</SelectItem>
                    {SURFACE_TREATMENTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 视图切换 */}
                <div className="flex border rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 产品列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="py-20 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">暂无产品数据</p>
                <Button onClick={() => handleOpenDialog()} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  添加第一个产品
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={handleOpenDialog}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">产品编号</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">名称</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">材质</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">工艺</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">尺寸 (mm)</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">米重</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">单价</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {products.map((product) => {
                        const specs = parseSpecs(product.specs);
                        const dims = [specs.width, specs.height].filter(Boolean).join(' × ');
                        return (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-blue-600 text-xs">{product.product_code}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                            <td className="px-4 py-3">
                              <Badge variant="outline">{product.material}</Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{product.process}</td>
                            <td className="px-4 py-3 text-gray-600">
                              {dims ? `${dims}${specs.wall_thickness ? ` × ${specs.wall_thickness}` : ''} mm` : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {specs.weight_per_meter ? `${specs.weight_per_meter} kg/m` : '-'}
                            </td>
                            <td className="px-4 py-3 font-semibold text-emerald-600">¥{product.cost_price}</td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenDialog(product)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(product.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 新建/编辑对话框 */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                  <Label htmlFor="cost_price">成本单价 (元/kg) *</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="min_price">最低限价 (元/kg)</Label>
                  <Input
                    id="min_price"
                    type="number"
                    value={formData.min_price}
                    onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="specs">规格参数 (JSON)</Label>
                  <Textarea
                    id="specs"
                    value={formData.specs}
                    onChange={(e) => setFormData({ ...formData, specs: e.target.value })}
                    className="mt-1 font-mono text-sm"
                    rows={4}
                    placeholder='{"width": 50, "height": 30, "wall_thickness": 2, "weight_per_meter": 1.5}'
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
      </div>
    </AppLayout>
  );
}
