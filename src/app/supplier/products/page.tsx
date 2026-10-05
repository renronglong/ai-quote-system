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
  Sparkles,
  CheckCircle2,
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

/** AI 图纸解析返回的产品对象（归一化后用于编辑/展示） */
interface AiProduct {
  product_id: string;
  width: number | null;
  height: number | null;
  weight_per_meter: number | null;
  outer_perimeter?: number | null;
  inner_perimeter?: number | null;
  cross_section_area?: number | null;
  cross_section_image_base64?: string | null;
  data_confidence?: string; // high / medium / low
  raw?: Record<string, any>; // 解析接口返回的原始对象，发布时原样带回
}

// 供应商图纸上传服务：经 Vercel rewrite 代理到 http://129.204.40.114:8001/api/*
// （vercel.json 中的 source 前缀，避免与现有 /api/supplier/* 路由冲突）
const SUPPLIER_UPLOAD_API = '/api/supplier-upload';

// 归一化数字（空串/null/undefined → null）
const numOrNull = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// 把解析接口返回的产品对象归一化成界面用的结构。
// ⚠️ 实际接口字段名与对接文档不一致（实测 2026-10-05）：
//    实际 width_mm/height_mm、weight_kg_per_m、perimeter_mm、area_mm2、无截面图字段；
//    文档写的是 width/height、weight_per_meter、outer_perimeter、cross_section_area、cross_section_image_base64。
//    两套都兼容，优先文档名，其次实际名。
const normalizeAiProduct = (p: any): AiProduct => {
  let w = numOrNull(p?.width ?? p?.width_mm);
  let h = numOrNull(p?.height ?? p?.height_mm);
  if ((w == null || h == null) && typeof p?.cross_section_mm === 'string' && p.cross_section_mm.includes('*')) {
    const parts = p.cross_section_mm.split('*').map((x: string) => Number(String(x).trim()));
    if (w == null && Number.isFinite(parts[0])) w = parts[0];
    if (h == null && Number.isFinite(parts[1])) h = parts[1];
  }
  return {
    product_id: String(p?.product_id ?? p?.mold_number ?? p?.name ?? '').trim(),
    width: w,
    height: h,
    weight_per_meter: numOrNull(p?.weight_per_meter ?? p?.weight_kg_per_m ?? p?.final_weight_kg_per_m),
    outer_perimeter: numOrNull(p?.outer_perimeter ?? p?.perimeter_mm),
    inner_perimeter: numOrNull(p?.inner_perimeter),
    cross_section_area: numOrNull(p?.cross_section_area ?? p?.area_mm2),
    cross_section_image_base64: p?.cross_section_image_base64 ?? p?.cross_section_image ?? p?.image ?? null,
    data_confidence: p?.data_confidence,
    raw: p && typeof p === 'object' ? p : undefined,
  };
};

// base64 → 可渲染的图片地址（兼容已带 data: 前缀的情况）
const toImageSrc = (b64?: string | null) => {
  if (!b64) return '';
  return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
};
// 去掉 data URL 前缀，发布接口需要纯 base64
const stripImagePrefix = (b64?: string | null) => {
  if (!b64) return '';
  return b64.includes(',') ? b64.split(',')[1] : b64;
};

// 带超时的 fetch：后端无响应时快速失败，避免界面无限等待
const fetchWithTimeout = async (input: string, init: RequestInit = {}, ms = 90000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

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
  const [searchQuery, setSearchQuery] = useState('');

  // ===== AI 上传图纸 =====
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiPublishing, setAiPublishing] = useState(false);
  const [aiProducts, setAiProducts] = useState<AiProduct[]>([]);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');
  const [aiMeta, setAiMeta] = useState<{ original_file?: string; dxf_file?: string } | null>(null);

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

  // ===== AI 上传图纸 =====
  const openAiDialog = () => {
    setAiFile(null);
    setAiProducts([]);
    setAiError('');
    setAiSuccess('');
    setAiMeta(null);
    setAiDialogOpen(true);
  };

  const handleAiParse = async () => {
    if (!aiFile) {
      setAiError('请先选择 DWG 或 DXF 文件');
      return;
    }
    setAiParsing(true);
    setAiError('');
    setAiSuccess('');
    setAiProducts([]);
    try {
      const isDxf = /\.dxf$/i.test(aiFile.name);
      const endpoint = isDxf
        ? `${SUPPLIER_UPLOAD_API}/upload/parse-dxf`
        : `${SUPPLIER_UPLOAD_API}/upload/dwg`;
      const fd = new FormData();
      fd.append('file', aiFile);
      const res = await fetchWithTimeout(endpoint, { method: 'POST', body: fd }, 120000);
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* 代理 502 等非 JSON 响应 */ }
      if (!res.ok || !json) {
        setAiError(
          json?.error || json?.msg ||
          `解析失败（HTTP ${res.status}${text && !json ? '：' + text.slice(0, 120) : ''}）`
        );
        return;
      }
      const list: any[] = Array.isArray(json.products) ? json.products : [];
      if (list.length === 0) {
        setAiError('未从图纸中识别到产品');
        return;
      }
      setAiProducts(list.map(normalizeAiProduct));
      setAiMeta({ original_file: json.original_file, dxf_file: json.dxf_file });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setAiError('解析请求超时（后端无响应）。请确认图纸上传服务是否在线，或稍后重试。');
      } else {
        setAiError(err?.message || '网络错误，无法连接解析服务');
      }
    } finally {
      setAiParsing(false);
    }
  };

  const updateAiProduct = (index: number, key: keyof AiProduct, value: any) => {
    setAiProducts((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)));
  };

  const removeAiProduct = (index: number) => {
    setAiProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAiPublish = async () => {
    if (aiProducts.length === 0) {
      setAiError('没有可上传的产品');
      return;
    }
    setAiPublishing(true);
    setAiError('');
    setAiSuccess('');
    try {
      const images: Record<string, string> = {};
      aiProducts.forEach((p) => {
        const b64 = stripImagePrefix(p.cross_section_image_base64);
        if (p.product_id && b64) images[p.product_id] = b64;
      });
      // 发布时原样带回解析接口的原始对象，并同时给出两套字段名（文档名 + 实测实际名），
      // 免得后端只认其中一种写法。
      const payloadProducts = aiProducts.map(({ raw, ...p }) => ({
        ...(raw || {}),
        product_id: p.product_id,
        width: p.width, height: p.height, weight_per_meter: p.weight_per_meter,
        cross_section_area: p.cross_section_area ?? undefined,
        outer_perimeter: p.outer_perimeter ?? undefined,
        width_mm: p.width, height_mm: p.height,
        weight_kg_per_m: p.weight_per_meter,
        area_mm2: p.cross_section_area ?? undefined,
        perimeter_mm: p.outer_perimeter ?? undefined,
      }));
      const res = await fetchWithTimeout(`${SUPPLIER_UPLOAD_API}/upload/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: payloadProducts,
          supplier_id: profile?.id,
          supplier_name: profile?.company_name,
          images,
        }),
      }, 60000);
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* 代理 502 等非 JSON 响应 */ }
      if (!res.ok || !json) {
        setAiError(
          json?.error || json?.msg ||
          `上传失败（HTTP ${res.status}${text && !json ? '：' + text.slice(0, 120) : ''}）`
        );
        return;
      }
      const n = json.success_count ?? json.count ?? json.uploaded ?? aiProducts.length;
      setAiSuccess(`已成功上传 ${n} 个产品到供应商库`);
      setAiProducts([]);
      setAiFile(null);
      if (profile) fetchProducts(profile.id);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setAiError('上传请求超时（后端无响应）。请确认图纸上传服务是否在线，或稍后重试。');
      } else {
        setAiError(err?.message || '网络错误，无法连接上传服务');
      }
    } finally {
      setAiPublishing(false);
    }
  };

  const confidenceBadge = (level?: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      high: { text: '● 高', cls: 'text-green-600' },
      medium: { text: '● 中', cls: 'text-amber-500' },
      low: { text: '● 低', cls: 'text-red-500' },
    };
    const m = level ? map[level] : undefined;
    if (!m) return <span className="text-gray-300 text-xs">-</span>;
    return <span className={`${m.cls} text-xs font-medium whitespace-nowrap`}>{m.text}</span>;
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
            <Button variant="outline" onClick={openAiDialog}>
              <Sparkles className="w-4 h-4 mr-1" />
              AI 上传图纸
            </Button>
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
          <div className="px-4 pt-4 pb-2">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索模具编号 / 截面尺寸 / 产品名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-1.5 text-xs text-gray-400">
                {(() => { const q = searchQuery.trim().toLowerCase(); if(!q) return products.length; const kws = q.split(/\s+/).filter(Boolean); return products.filter(p => { const s = ((p.mold_number||'')+' '+(p.cross_section_mm||'')+' '+(p.product_name||'')).toLowerCase(); return kws.every(k=>s.includes(k)); }).length; })()} 条匹配结果
              </div>
            )}
          </div>
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
                    {products.filter(p => {
                      const q = searchQuery.trim().toLowerCase();
                      if (!q) return true;
                      // 多关键词空格分隔，全部匹配才显示
                      const keywords = q.split(/\s+/).filter(Boolean);
                      const searchIn = ((p.mold_number || '') + ' ' + (p.cross_section_mm || '') + ' ' + (p.product_name || '')).toLowerCase();
                      return keywords.every(kw => searchIn.includes(kw));
                    }).map((product) => (
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

      {/* AI 上传图纸弹窗 */}
      <Dialog open={aiDialogOpen} onOpenChange={(o) => { if (!aiParsing && !aiPublishing) setAiDialogOpen(o); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              AI 上传图纸
            </DialogTitle>
            <DialogDescription>
              上传 DWG/DXF 图纸，自动识别截面参数 → 预览确认 → 推送到供应商库
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {aiError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-all">{aiError}</span>
              </div>
            )}
            {aiSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {aiSuccess}
              </div>
            )}

            {/* 选择文件 + 解析 */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".dwg,.dxf"
                onChange={(e) => {
                  setAiFile(e.target.files?.[0] || null);
                  setAiProducts([]);
                  setAiError('');
                  setAiSuccess('');
                }}
                className="block text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Button onClick={handleAiParse} disabled={aiParsing || !aiFile}>
                {aiParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    AI 解析中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1" />
                    上传并解析
                  </>
                )}
              </Button>
              {aiMeta?.original_file && (
                <span className="text-xs text-gray-400">
                  {aiMeta.original_file}{aiMeta.dxf_file ? ` → ${aiMeta.dxf_file}` : ''}
                </span>
              )}
            </div>

            {/* 解析结果预览 */}
            {aiProducts.length > 0 && (
              <>
                <div className="text-sm text-gray-500">
                  识别到 <b className="text-gray-800">{aiProducts.length}</b> 个产品，可编辑或移除后确认上传：
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">编号</TableHead>
                        <TableHead className="w-[80px]">宽(mm)</TableHead>
                        <TableHead className="w-[80px]">高(mm)</TableHead>
                        <TableHead className="w-[110px]">米重(kg/m)</TableHead>
                        <TableHead className="w-[90px]">截面图</TableHead>
                        <TableHead className="w-[70px]">置信度</TableHead>
                        <TableHead className="w-[60px] text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiProducts.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input
                              className="h-8 text-xs"
                              value={p.product_id || ''}
                              onChange={(e) => updateAiProduct(i, 'product_id', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              value={p.width ?? ''}
                              onChange={(e) => updateAiProduct(i, 'width', e.target.value === '' ? null : Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              value={p.height ?? ''}
                              onChange={(e) => updateAiProduct(i, 'height', e.target.value === '' ? null : Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-xs"
                              type="number"
                              value={p.weight_per_meter ?? ''}
                              onChange={(e) => updateAiProduct(i, 'weight_per_meter', e.target.value === '' ? null : Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            {p.cross_section_image_base64 ? (
                              <img
                                src={toImageSrc(p.cross_section_image_base64)}
                                alt="截面图"
                                className="w-10 h-10 object-contain border rounded bg-white cursor-pointer hover:ring-2 hover:ring-blue-400"
                                onClick={() => setLightboxImage(toImageSrc(p.cross_section_image_base64))}
                              />
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>{confidenceBadge(p.data_confidence)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => removeAiProduct(i)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAiDialogOpen(false)}
              disabled={aiParsing || aiPublishing}
            >
              <X className="w-4 h-4 mr-1" />
              取消
            </Button>
            <Button onClick={handleAiPublish} disabled={aiPublishing || aiProducts.length === 0}>
              {aiPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  确认上传到供应商库
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
