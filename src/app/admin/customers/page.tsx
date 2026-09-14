'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getAdminToken } from '@/lib/auth-context';
import AppLayout from '@/components/AppLayout';
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
import {
  Building2,
  Search,
  Loader2,
  Plus,
  Edit3,
  Trash2,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Customer {
  id: string;
  customer_code: string | null;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

interface ParsedRow {
  customer_code: string;
  company_name: string;
  contact_name: string;
  phone: string;
  address: string;
  email: string;
  remarks: string;
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  '客户编号': 'customer_code',
  '公司名称': 'company_name',
  '联系人': 'contact_name',
  '电话': 'phone',
  '地址': 'address',
  '邮箱': 'email',
  '备注': 'remarks',
};

function CustomersContent() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();

  // Customer list state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [formCode, setFormCode] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formContact, setFormContact] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  // Batch upload state
  const [batchOpen, setBatchOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: number; fail: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/admin/customers');
    } else if (!authLoading && user && !isAdmin) {
      router.replace('/');
    }
  }, [authLoading, user, isAdmin, router]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : '';
      const resp = await fetch(`/api/customers${qs}`, {
        headers: { 'x-admin-token': getAdminToken() || '' },
      });
      const data = await resp.json();
      if (resp.status === 403) {
        setError('无管理员权限');
        setCustomers([]);
      } else if (data.success) {
        setCustomers(data.data || []);
        setTotal(data.total || 0);
      } else {
        setError(data.error || '加载失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    if (isAdmin) loadCustomers();
  }, [isAdmin, refreshKey, loadCustomers]);

  // Open add dialog
  const openAddDialog = () => {
    setEditingCustomer(null);
    setFormCode('');
    setFormCompany('');
    setFormContact('');
    setFormPhone('');
    setFormAddress('');
    setFormEmail('');
    setFormRemarks('');
    setError('');
    setFormDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (c: Customer) => {
    setEditingCustomer(c);
    setFormCode(c.customer_code || '');
    setFormCompany(c.company_name);
    setFormContact(c.contact_name || '');
    setFormPhone(c.phone || '');
    setFormAddress(c.address || '');
    setFormEmail(c.email || '');
    setFormRemarks(c.remarks || '');
    setError('');
    setFormDialogOpen(true);
  };

  // Submit add/edit
  const submitForm = async () => {
    if (!formCompany.trim()) {
      setError('公司名称不能为空');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const body = {
        customer_code: formCode || undefined,
        company_name: formCompany,
        contact_name: formContact || undefined,
        phone: formPhone || undefined,
        address: formAddress || undefined,
        email: formEmail || undefined,
        remarks: formRemarks || undefined,
      };

      const isEdit = !!editingCustomer;
      const url = isEdit ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = isEdit ? 'PUT' : 'POST';

      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': getAdminToken() || '',
        },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      if (data.success) {
        setFormDialogOpen(false);
        setRefreshKey(k => k + 1);
      } else {
        setError(data.error || '操作失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete customer
  const deleteCustomer = async () => {
    if (!deleteConfirm) return;
    setSubmitting(true);
    setError('');

    try {
      const resp = await fetch(`/api/customers/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': getAdminToken() || '' },
      });
      const data = await resp.json();
      if (data.success) {
        setDeleteConfirm(null);
        setRefreshKey(k => k + 1);
      } else {
        setError(data.error || '删除失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  // Batch upload handlers
  const parseExcelFile = useCallback((file: File) => {
    setError('');
    setResult(null);
    setFileName(file.name);
    setUploading(true);
    setRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        if (jsonData.length < 2) {
          setError('Excel 文件为空或只有表头');
          setUploading(false);
          return;
        }

        const headerRow = jsonData[0].map((h: any) => String(h).trim());
        const colIndices: Record<string, number> = {};
        for (const [cnName, key] of Object.entries(COLUMN_MAP)) {
          const idx = headerRow.findIndex((h: string) => h === cnName);
          if (idx >= 0) colIndices[key] = idx;
        }

        if (colIndices['company_name'] === undefined) {
          setError('未找到"公司名称"列，请使用下载的模板文件');
          setUploading(false);
          return;
        }

        const parsed: ParsedRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '')) {
            continue;
          }
          const parsedRow: ParsedRow = {
            customer_code: colIndices['customer_code'] !== undefined ? String(row[colIndices['customer_code']] ?? '').trim() : '',
            company_name: colIndices['company_name'] !== undefined ? String(row[colIndices['company_name']] ?? '').trim() : '',
            contact_name: colIndices['contact_name'] !== undefined ? String(row[colIndices['contact_name']] ?? '').trim() : '',
            phone: colIndices['phone'] !== undefined ? String(row[colIndices['phone']] ?? '').trim() : '',
            address: colIndices['address'] !== undefined ? String(row[colIndices['address']] ?? '').trim() : '',
            email: colIndices['email'] !== undefined ? String(row[colIndices['email']] ?? '').trim() : '',
            remarks: colIndices['remarks'] !== undefined ? String(row[colIndices['remarks']] ?? '').trim() : '',
          };
          if (parsedRow.company_name) {
            parsed.push(parsedRow);
          }
        }

        if (parsed.length === 0) {
          setError('Excel 中没有有效的数据行');
          setUploading(false);
          return;
        }

        setRows(parsed);
        setUploading(false);
      } catch (err: any) {
        setError('解析 Excel 文件失败: ' + (err.message || '未知错误'));
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setError('读取文件失败');
      setUploading(false);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcelFile(file);
  }, [parseExcelFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
        setError('只支持 .xlsx 或 .xls 格式');
        return;
      }
      parseExcelFile(file);
    }
  }, [parseExcelFile]);

  const handleBatchSubmit = async () => {
    if (rows.length === 0) return;
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/customers/batch-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': getAdminToken() || '',
        },
        body: JSON.stringify({ items: rows }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '提交失败');
        setSubmitting(false);
        return;
      }

      setResult({
        success: json.data?.success_count || 0,
        fail: json.data?.fail_count || 0,
        errors: json.data?.errors || [],
      });
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchReset = () => {
    setRows([]);
    setFileName('');
    setError('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">请先登录...</div>;
  }
  if (!isAdmin) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">无管理员权限，正在跳转...</div>;
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">客户管理</h1>
              <p className="text-sm text-gray-500">共 {total} 个客户</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBatchOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />
              批量导入
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="w-4 h-4 mr-1" />
              新增客户
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setRefreshKey(k => k + 1)}
              placeholder="搜索公司名、联系人、编号、电话…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            搜索
          </button>
        </div>

        {error && !formDialogOpen && !deleteConfirm && !batchOpen && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
        )}

        {/* Customer Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中…
            </div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">暂无客户数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">客户编号</th>
                  <th className="px-4 py-3 text-left">公司名称</th>
                  <th className="px-4 py-3 text-left">联系人</th>
                  <th className="px-4 py-3 text-left">电话</th>
                  <th className="px-4 py-3 text-left">地址</th>
                  <th className="px-4 py-3 text-left">备注</th>
                  <th className="px-4 py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{c.customer_code || '—'}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{c.company_name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contact_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{c.address || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{c.remarks || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditDialog(c)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteConfirm(c); setError(''); }}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add/Edit Dialog */}
        {formDialogOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !submitting && setFormDialogOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-bold text-gray-900">{editingCustomer ? '编辑客户' : '新增客户'}</h2>
              </div>

              {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">客户编号 <span className="text-gray-400 text-xs">（留空自动生成）</span></label>
                  <input
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="如：KH000001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">公司名称 <span className="text-red-500">*</span></label>
                  <input
                    value={formCompany}
                    onChange={e => setFormCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">联系人</label>
                  <input
                    value={formContact}
                    onChange={e => setFormContact(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">电话</label>
                  <input
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">地址</label>
                  <input
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">邮箱</label>
                  <input
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">备注</label>
                  <textarea
                    value={formRemarks}
                    onChange={e => setFormRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setFormDialogOpen(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={submitForm}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? '提交中…' : editingCustomer ? '保存修改' : '添加客户'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !submitting && setDeleteConfirm(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="w-5 h-5 text-red-600" />
                <h2 className="text-base font-bold text-gray-900">确认删除</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                确定要删除客户 <span className="font-semibold text-gray-900">{deleteConfirm.company_name}</span> 吗？此操作不可撤销。
              </p>

              {error && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={deleteCustomer}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? '删除中…' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Upload Dialog */}
        {batchOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !submitting && setBatchOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-bold text-gray-900">批量导入客户</h2>
                </div>
                <button onClick={() => { setBatchOpen(false); handleBatchReset(); }} className="p-1 rounded hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Step 1: Download template */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">1. 下载模板</p>
                <a href="/excel_template_customers.xlsx" download>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    下载 Excel 模板
                  </Button>
                </a>
              </div>

              {/* Step 2: Upload */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">2. 上传 Excel 文件</p>
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-blue-500 bg-blue-50'
                      : rows.length > 0
                      ? 'border-green-300 bg-green-50/50'
                      : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-sm text-gray-500">解析中...</p>
                    </div>
                  ) : rows.length > 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                      <p className="text-sm font-medium text-green-700">{fileName}</p>
                      <p className="text-xs text-gray-500">已解析 {rows.length} 条数据 · 点击重新选择</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 text-gray-400" />
                      <p className="text-sm text-gray-500">拖拽 Excel 文件到此处，或 <span className="text-blue-600 underline">点击选择</span></p>
                    </div>
                  )}
                </div>
              </div>

              {error && batchOpen && (
                <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Step 3: Preview */}
              {rows.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    3. 确认数据
                    <Badge variant="secondary">{rows.length} 条</Badge>
                  </p>
                  <div className="border rounded-lg overflow-x-auto max-h-60 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>编号</TableHead>
                          <TableHead>公司名称</TableHead>
                          <TableHead>联系人</TableHead>
                          <TableHead>电话</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-gray-400">{i + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{row.customer_code || '(自动生成)'}</TableCell>
                            <TableCell className="font-medium">{row.company_name}</TableCell>
                            <TableCell>{row.contact_name || '-'}</TableCell>
                            <TableCell>{row.phone || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {rows.length > 5 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-sm text-gray-400 py-3">
                              ... 还有 {rows.length - 5} 条数据
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className={`flex items-start gap-3 p-4 rounded-lg border mb-4 ${
                  result.fail === 0
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  {result.fail === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">
                      导入完成：成功 <span className="text-green-700">{result.success}</span> 条
                      {result.fail > 0 && <>，失败 <span className="text-red-600">{result.fail}</span> 条</>}
                    </p>
                    {result.errors.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-500 list-disc pl-4 space-y-0.5">
                        {result.errors.slice(0, 10).map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                        {result.errors.length > 10 && (
                          <li>... 还有 {result.errors.length - 10} 条错误</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleBatchSubmit}
                  disabled={submitting || rows.length === 0 || !!result}
                  className="gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      导入中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      确认导入 {rows.length} 条数据
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleBatchReset} disabled={submitting}>
                  <X className="w-4 h-4 mr-1" />
                  重新选择
                </Button>
                {result && (
                  <Button variant="ghost" onClick={() => { setBatchOpen(false); handleBatchReset(); setRefreshKey(k => k + 1); }}>
                    关闭并刷新列表
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <CustomersContent />
    </Suspense>
  );
}
