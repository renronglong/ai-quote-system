'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Loader2,
  Eye,
  CheckCircle,
  Clock,
  FileText,
  Download,
  Search,
  Sparkles,
  Settings,
  XCircle,
  Phone,
  Mail,
  Building2,
  MessageSquare,
} from 'lucide-react';

interface CadRequest {
  id: string;
  user_id: string | null;
  file_name: string;
  file_size: number | null;
  coze_file_id: string;
  status: 'pending' | 'auto_recognized' | 'processed';
  user_email: string | null;
  user_phone: string | null;
  company_name: string | null;
  remark: string | null;
  recognition_result: string | null;
  admin_notes: string | null;
  created_at: string;
}

interface RecognitionResult {
  product_type?: string;
  material_grade?: string;
  material_category?: string;
  width?: number;
  height?: number;
  wall_thickness?: number;
  length?: number | null;
  perimeter?: number | null;
  meter_weight?: number;
  num_cavities?: number;
  die_type?: string;
  surface_treatment?: string;
  processes?: string[];
  quantity?: number | null;
  product_name?: string | null;
  product_code?: string | null;
  confidence?: number;
  notes?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
  auto_recognized: { label: 'AI已识别', color: 'bg-blue-100 text-blue-800', icon: <Sparkles className="w-3 h-3" /> },
  processed: { label: '已处理', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
};

const STATUS_OPTIONS = ['pending', 'auto_recognized', 'processed'];

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function parseRecognitionResult(raw: string | null): RecognitionResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecognitionResult;
  } catch {
    return null;
  }
}

export default function AdminInquiriesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // 登录检查
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const [requests, setRequests] = useState<CadRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<CadRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [processForm, setProcessForm] = useState({
    status: '',
    admin_notes: '',
  });

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('pageSize', '100');

      const response = await fetch(`/api/admin/cad-requests?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setRequests(data.data || []);
      } else {
        console.error('加载工单失败:', data.error);
      }
    } catch (error) {
      console.error('加载工单失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadRequests();
    }
  }, [authLoading, user, statusFilter]);

  const handleViewDetail = (req: CadRequest) => {
    setSelectedRequest(req);
    setDetailDialogOpen(true);
  };

  const handleProcess = (req: CadRequest) => {
    setSelectedRequest(req);
    setProcessForm({
      status: req.status === 'pending' ? 'processed' : req.status,
      admin_notes: req.admin_notes || '',
    });
    setProcessDialogOpen(true);
  };

  const handleSaveProcess = async () => {
    if (!selectedRequest) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/cad-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          status: processForm.status,
          admin_notes: processForm.admin_notes,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setProcessDialogOpen(false);
        setDetailDialogOpen(false);
        loadRequests();
      } else {
        alert('更新失败: ' + data.error);
      }
    } catch (error) {
      console.error('更新工单失败:', error);
      alert('更新失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (req: CadRequest) => {
    setDownloadingId(req.id);
    try {
      const response = await fetch(`/api/admin/cad-requests/${req.id}/download`);
      const data = await response.json();
      if (data.success && data.download_url) {
        // Open download in new tab
        window.open(data.download_url, '_blank');
      } else {
        alert('获取下载链接失败: ' + (data.error || '未知错误'));
      }
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请稍后重试');
    } finally {
      setDownloadingId(null);
    }
  };

  // 过滤数据
  const filteredRequests = requests.filter((req) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      req.file_name.toLowerCase().includes(term) ||
      (req.user_email || '').toLowerCase().includes(term) ||
      (req.user_phone || '').includes(term) ||
      (req.company_name || '').toLowerCase().includes(term) ||
      req.id.toLowerCase().includes(term)
    );
  });

  const recognition = parseRecognitionResult(selectedRequest?.recognition_result || null);

  if (authLoading || !user) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const autoRecognizedCount = requests.filter((r) => r.status === 'auto_recognized').length;
  const processedCount = requests.filter((r) => r.status === 'processed').length;

  return (
    <div className="space-y-6 p-6">
      {/* 标题和统计 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">深度报价工单</h1>
          <p className="text-sm text-gray-500 mt-1">管理CAD图纸识别与深度报价工单</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1 text-sm">
            <FileText className="w-3 h-3 mr-1" />
            总计 {requests.length}
          </Badge>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="px-3 py-1 text-sm">
              <Clock className="w-3 h-3 mr-1" />
              待处理 {pendingCount}
            </Badge>
          )}
          {autoRecognizedCount > 0 && (
            <Badge className="px-3 py-1 text-sm bg-blue-100 text-blue-800 hover:bg-blue-100">
              <Sparkles className="w-3 h-3 mr-1" />
              AI已识别 {autoRecognizedCount}
            </Badge>
          )}
        </div>
      </div>

      {/* 筛选和搜索 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索文件名、邮箱、电话、公司..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-500 whitespace-nowrap">状态筛选:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s]?.label || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 工单列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="w-12 h-12 mb-4" />
              <p>暂无工单数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件名</TableHead>
                    <TableHead>用户信息</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>文件大小</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 max-w-[200px] truncate" title={req.file_name}>
                            {req.file_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {req.user_phone && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Phone className="w-3 h-3" />
                              {req.user_phone}
                            </div>
                          )}
                          {req.user_email && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{req.user_email}</span>
                            </div>
                          )}
                          {!req.user_phone && !req.user_email && (
                            <span className="text-gray-400">未提供</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          {req.company_name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[req.status]?.color || ''}>
                          <span className="flex items-center gap-1">
                            {STATUS_CONFIG[req.status]?.icon}
                            {STATUS_CONFIG[req.status]?.label || req.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatFileSize(req.file_size)}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm whitespace-nowrap">
                        {new Date(req.created_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetail(req)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            详情
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(req)}
                            disabled={downloadingId === req.id}
                          >
                            {downloadingId === req.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5 mr-1" />
                            )}
                            {downloadingId === req.id ? '' : '下载'}
                          </Button>
                          {req.status !== 'processed' && (
                            <Button
                              size="sm"
                              onClick={() => handleProcess(req)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              处理
                            </Button>
                          )}
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

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>工单详情</DialogTitle>
            <DialogDescription>
              CAD深度报价工单详细信息
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6 py-2">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 text-xs">工单ID</Label>
                  <p className="font-mono text-sm mt-1">{selectedRequest.id.slice(0, 20)}...</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">状态</Label>
                  <div className="mt-1">
                    <Badge className={STATUS_CONFIG[selectedRequest.status]?.color || ''}>
                      <span className="flex items-center gap-1">
                        {STATUS_CONFIG[selectedRequest.status]?.icon}
                        {STATUS_CONFIG[selectedRequest.status]?.label || selectedRequest.status}
                      </span>
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">文件名</Label>
                  <p className="font-medium text-sm mt-1">{selectedRequest.file_name}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">文件大小</Label>
                  <p className="text-sm mt-1">{formatFileSize(selectedRequest.file_size)}</p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">提交时间</Label>
                  <p className="text-sm mt-1">
                    {new Date(selectedRequest.created_at).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500 text-xs">Coze文件ID</Label>
                  <p className="font-mono text-xs mt-1 truncate">{selectedRequest.coze_file_id}</p>
                </div>
              </div>

              {/* 用户信息 */}
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  用户信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedRequest.user_phone || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 truncate">{selectedRequest.user_email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedRequest.company_name || '-'}</span>
                  </div>
                </div>
                {selectedRequest.remark && (
                  <div className="pt-2 border-t">
                    <Label className="text-gray-500 text-xs">用户备注</Label>
                    <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2 rounded">
                      {selectedRequest.remark}
                    </p>
                  </div>
                )}
              </div>

              {/* 识别结果 */}
              {recognition && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      AI识别结果
                    </h3>
                    {recognition.confidence !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        置信度: {(recognition.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {recognition.product_type && (
                      <div>
                        <Label className="text-gray-500 text-xs">产品类型</Label>
                        <p className="font-medium mt-1">{recognition.product_type}</p>
                      </div>
                    )}
                    {recognition.material_category && (
                      <div>
                        <Label className="text-gray-500 text-xs">材质类别</Label>
                        <p className="font-medium mt-1">{recognition.material_category}</p>
                      </div>
                    )}
                    {recognition.material_grade && (
                      <div>
                        <Label className="text-gray-500 text-xs">材质牌号</Label>
                        <p className="font-medium mt-1">{recognition.material_grade}</p>
                      </div>
                    )}
                    {recognition.die_type && (
                      <div>
                        <Label className="text-gray-500 text-xs">模具类型</Label>
                        <p className="font-medium mt-1">
                          {recognition.die_type === 'flat' ? '平模' : recognition.die_type === 'split' ? '分流模' : recognition.die_type}
                        </p>
                      </div>
                    )}
                    {recognition.width !== undefined && (
                      <div>
                        <Label className="text-gray-500 text-xs">截面宽度</Label>
                        <p className="font-medium mt-1">{recognition.width} mm</p>
                      </div>
                    )}
                    {recognition.height !== undefined && (
                      <div>
                        <Label className="text-gray-500 text-xs">截面高度</Label>
                        <p className="font-medium mt-1">{recognition.height} mm</p>
                      </div>
                    )}
                    {recognition.wall_thickness !== undefined && (
                      <div>
                        <Label className="text-gray-500 text-xs">壁厚</Label>
                        <p className="font-medium mt-1">{recognition.wall_thickness} mm</p>
                      </div>
                    )}
                    {recognition.meter_weight !== undefined && (
                      <div>
                        <Label className="text-gray-500 text-xs">米重</Label>
                        <p className="font-medium mt-1">{recognition.meter_weight} kg/m</p>
                      </div>
                    )}
                    {recognition.length !== undefined && recognition.length !== null && (
                      <div>
                        <Label className="text-gray-500 text-xs">长度</Label>
                        <p className="font-medium mt-1">{recognition.length} mm</p>
                      </div>
                    )}
                    {recognition.num_cavities !== undefined && (
                      <div>
                        <Label className="text-gray-500 text-xs">面域数</Label>
                        <p className="font-medium mt-1">{recognition.num_cavities}</p>
                      </div>
                    )}
                    {recognition.perimeter !== undefined && recognition.perimeter !== null && (
                      <div>
                        <Label className="text-gray-500 text-xs">周长</Label>
                        <p className="font-medium mt-1">{recognition.perimeter} mm</p>
                      </div>
                    )}
                    {recognition.surface_treatment && (
                      <div>
                        <Label className="text-gray-500 text-xs">表面处理</Label>
                        <p className="font-medium mt-1">{recognition.surface_treatment}</p>
                      </div>
                    )}
                    {recognition.quantity !== undefined && recognition.quantity !== null && (
                      <div>
                        <Label className="text-gray-500 text-xs">数量</Label>
                        <p className="font-medium mt-1">{recognition.quantity}</p>
                      </div>
                    )}
                    {recognition.product_code && (
                      <div>
                        <Label className="text-gray-500 text-xs">图号</Label>
                        <p className="font-medium mt-1">{recognition.product_code}</p>
                      </div>
                    )}
                    {recognition.product_name && (
                      <div className="col-span-2">
                        <Label className="text-gray-500 text-xs">产品名称</Label>
                        <p className="font-medium mt-1">{recognition.product_name}</p>
                      </div>
                    )}
                    {recognition.processes && recognition.processes.length > 0 && (
                      <div className="col-span-2">
                        <Label className="text-gray-500 text-xs">加工工序</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {recognition.processes.map((p, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {recognition.notes && (
                      <div className="col-span-2">
                        <Label className="text-gray-500 text-xs">备注</Label>
                        <p className="text-sm text-gray-600 mt-1">{recognition.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 无识别结果提示 */}
              {!recognition && selectedRequest.status === 'pending' && (
                <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">待AI识别或人工处理</span>
                  </div>
                  <p className="text-sm text-yellow-600 mt-1">
                    该工单尚未完成AI识别，请下载文件后进行人工评估
                  </p>
                </div>
              )}

              {/* 管理员备注 */}
              {selectedRequest.admin_notes && (
                <div>
                  <Label className="text-gray-500 text-xs">管理员备注</Label>
                  <p className="mt-1 p-2 bg-blue-50 rounded text-sm">
                    {selectedRequest.admin_notes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            {selectedRequest && (
              <Button
                variant="outline"
                onClick={() => handleDownload(selectedRequest)}
                disabled={downloadingId === selectedRequest.id}
              >
                {downloadingId === selectedRequest.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                下载文件
              </Button>
            )}
            {selectedRequest && selectedRequest.status !== 'processed' && (
              <Button
                onClick={() => {
                  setDetailDialogOpen(false);
                  handleProcess(selectedRequest);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                标记已处理
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 处理对话框 */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>处理工单</DialogTitle>
            <DialogDescription>
              更新工单状态和处理备注
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedRequest && (
              <div className="p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium text-gray-900">{selectedRequest.file_name}</p>
                <p className="text-gray-500 text-xs mt-1">
                  提交时间: {new Date(selectedRequest.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="status">工单状态</Label>
              <Select
                value={processForm.status}
                onValueChange={(value) => setProcessForm({ ...processForm, status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s]?.label || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="admin_notes">处理备注</Label>
              <Textarea
                id="admin_notes"
                value={processForm.admin_notes}
                onChange={(e) => setProcessForm({ ...processForm, admin_notes: e.target.value })}
                placeholder="记录处理过程、报价结果、注意事项等..."
                rows={5}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveProcess}
              disabled={saving || !processForm.status}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
