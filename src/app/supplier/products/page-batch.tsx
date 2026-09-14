'use client';

import { Suspense, useCallback, useRef, useState } from 'react';
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
  Loader2,
  Download,
  Upload,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ParsedRow {
  mold_number: string;
  product_name: string;
  cross_section_mm: string;
  weight_per_meter: string;
  perimeter: string;
  surface_treatments: string;
  remarks: string;
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  '模具编号': 'mold_number',
  '产品名称': 'product_name',
  '截面尺寸': 'cross_section_mm',
  '米重kg/m': 'weight_per_meter',
  '周长mm': 'perimeter',
  '表面处理': 'surface_treatments',
  '备注': 'remarks',
};

function BatchUploadContent() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ success: number; fail: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Redirect if not logged in
  if (!authLoading && !user) {
    router.replace('/login?redirect=/supplier/products/page-batch');
    return null;
  }

  const parseExcelFile = useCallback((file: File) => {
    setError('');
    setResult(null);
    setFileName(file.name);
    setUploading(true);

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

        // Parse header row to find column indices
        const headerRow = jsonData[0].map((h: any) => String(h).trim());
        const colIndices: Record<string, number> = {};
        for (const [cnName, key] of Object.entries(COLUMN_MAP)) {
          const idx = headerRow.findIndex((h: string) => h === cnName);
          if (idx >= 0) colIndices[key] = idx;
        }

        if (colIndices['mold_number'] === undefined) {
          setError('未找到"模具编号"列，请使用下载的模板文件');
          setUploading(false);
          return;
        }

        // Parse data rows
        const parsed: ParsedRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every((cell: any) => cell === undefined || cell === null || String(cell).trim() === '')) {
            continue; // skip empty rows
          }
          const parsedRow: ParsedRow = {
            mold_number: colIndices['mold_number'] !== undefined ? String(row[colIndices['mold_number']] ?? '').trim() : '',
            product_name: colIndices['product_name'] !== undefined ? String(row[colIndices['product_name']] ?? '').trim() : '',
            cross_section_mm: colIndices['cross_section_mm'] !== undefined ? String(row[colIndices['cross_section_mm']] ?? '').trim() : '',
            weight_per_meter: colIndices['weight_per_meter'] !== undefined ? String(row[colIndices['weight_per_meter']] ?? '').trim() : '',
            perimeter: colIndices['perimeter'] !== undefined ? String(row[colIndices['perimeter']] ?? '').trim() : '',
            surface_treatments: colIndices['surface_treatments'] !== undefined ? String(row[colIndices['surface_treatments']] ?? '').trim() : '',
            remarks: colIndices['remarks'] !== undefined ? String(row[colIndices['remarks']] ?? '').trim() : '',
          };
          if (parsedRow.mold_number) {
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleSubmit = async () => {
    if (rows.length === 0 || !session) return;
    setSubmitting(true);
    setError('');
    setResult(null);

    try {
      const BATCH_SIZE = 20;
      let totalSuccess = 0;
      let totalFail = 0;
      let allErrors: string[] = [];

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const items = batch.map((r) => ({
          mold_number: r.mold_number,
          product_name: r.product_name || null,
          cross_section_mm: r.cross_section_mm || null,
          weight_per_meter: r.weight_per_meter ? Number(r.weight_per_meter) : null,
          perimeter: r.perimeter ? Number(r.perimeter) : null,
          surface_treatments: r.surface_treatments || null,
          remarks: r.remarks || null,
          num_dies: 1,
        }));

        const res = await fetch('/api/supplier-products/batch-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ items }),
        });

        const json = await res.json();
        if (!res.ok) {
          setError(json.error || '提交失败');
          setSubmitting(false);
          return;
        }

        totalSuccess += json.data?.success_count || 0;
        totalFail += json.data?.fail_count || 0;
        if (json.data?.errors) {
          allErrors = [...allErrors, ...json.data.errors];
        }
      }

      setResult({ success: totalSuccess, fail: totalFail, errors: allErrors });
    } catch (err: any) {
      setError(err.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setRows([]);
    setFileName('');
    setError('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/supplier/products')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">批量上传产品</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                下载模板 → 填写数据 → 上传 Excel → 一键导入
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push('/supplier/products')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            产品列表
          </Button>
        </div>

        {/* Step 1: Download template */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              下载模板
            </CardTitle>
            <CardDescription>
              下载标准 Excel 模板，按格式填写产品信息
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/excel_template_supplier_products.xlsx" download>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                下载 Excel 模板
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Step 2: Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              上传 Excel 文件
            </CardTitle>
            <CardDescription>
              支持 .xlsx / .xls 格式，拖拽或点击上传
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : rows.length > 0
                  ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/10'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
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
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                  <p className="text-sm text-gray-500">解析中...</p>
                </div>
              ) : rows.length > 0 ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    已解析 {rows.length} 条数据 · 点击重新选择
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-10 h-10 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    拖拽 Excel 文件到此处，或 <span className="text-blue-600 underline">点击选择</span>
                  </p>
                  <p className="text-xs text-gray-400">.xlsx / .xls</p>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Preview & Submit */}
        {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                确认并提交
                <Badge variant="secondary" className="ml-2">{rows.length} 条</Badge>
              </CardTitle>
              <CardDescription>
                以下是解析结果（展示前 {Math.min(5, rows.length)} 行），确认无误后点击提交
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preview table */}
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>模具编号</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>截面尺寸</TableHead>
                      <TableHead>米重</TableHead>
                      <TableHead>周长</TableHead>
                      <TableHead>表面处理</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-gray-400">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.mold_number}</TableCell>
                        <TableCell>{row.product_name || '-'}</TableCell>
                        <TableCell>{row.cross_section_mm || '-'}</TableCell>
                        <TableCell>{row.weight_per_meter || '-'}</TableCell>
                        <TableCell>{row.perimeter || '-'}</TableCell>
                        <TableCell>{row.surface_treatments || '-'}</TableCell>
                        <TableCell>{row.remarks || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length > 5 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-sm text-gray-400 py-3">
                          ... 还有 {rows.length - 5} 条数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Result message */}
              {result && (
                <div className={`flex items-start gap-3 p-4 rounded-lg border ${
                  result.fail === 0
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                }`}>
                  {result.fail === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">
                      上传完成：成功 <span className="text-green-700">{result.success}</span> 条
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

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !!result}
                  className="gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      确认上传 {rows.length} 条数据
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={submitting}>
                  <X className="w-4 h-4 mr-1" />
                  重新选择
                </Button>
                {result && (
                  <Button variant="ghost" onClick={() => router.push('/supplier/products')}>
                    返回产品列表
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

export default function BatchUploadPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>}>
      <BatchUploadContent />
    </Suspense>
  );
}
