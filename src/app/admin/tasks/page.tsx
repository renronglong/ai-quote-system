'use client';

import { useState, useEffect } from 'react';
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
  ListTodo,
  Loader2,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Settings,
  Upload,
  Calculator,
  ExternalLink,
  Download,
} from 'lucide-react';

interface TaskData {
  id: number;
  task_code: string;
  title?: string;
  status: string;
  type?: string;
  created_at: string;
  user_id?: number;
  product_count?: number;
  model_cost?: string;
  price_multiplier?: string;
  total_credits?: string;
  admin_notes?: string;
  result_summary?: string;
  files?: TaskFile[] | string;
  conversation_log?: Array<{role: string; content: string}> | string;
  quote_result?: string;
}

interface TaskWithProfile extends TaskData {
  user_profile?: {
    id: number;
    username: string;
    company_name: string;
    contact_phone?: string;
    contact_email?: string;
  };
}

interface TaskFile {
  name: string;
  url: string;
  type: string;
  size?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3" /> },
  processing: { label: '处理中', color: 'bg-blue-100 text-blue-800', icon: <Settings className="w-3 h-3" /> },
  completed: { label: '已完成', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" /> },
  delivered: { label: '已交付', color: 'bg-purple-100 text-purple-800', icon: <FileText className="w-3 h-3" /> },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-800', icon: <XCircle className="w-3 h-3" /> },
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<TaskWithProfile | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [processingDialogOpen, setProcessingDialogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // 处理表单
  const [processForm, setProcessForm] = useState({
    status: '',
    admin_notes: '',
    product_count: 0,
    model_cost: 0,
    price_multiplier: 1,
    total_credits: 0,
    result_summary: '',
    quote_result: '',
  });
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      params.append('is_admin', 'true');

      const response = await fetch(`/api/tasks?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setTasks(data.data);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [statusFilter, typeFilter]);

  const handleViewDetail = async (task: TaskWithProfile) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}`);
      const data = await response.json();
      if (data.success) {
        setSelectedTask(data.data);
        setDetailDialogOpen(true);
      }
    } catch (error) {
      console.error('获取任务详情失败:', error);
    }
  };

  const handleProcessTask = (task: TaskWithProfile) => {
    setSelectedTask(task);
    setProcessForm({
      status: task.status === 'pending' ? 'processing' : task.status,
      admin_notes: task.admin_notes || '',
      product_count: task.product_count || 0,
      model_cost: parseFloat(task.model_cost || '0'),
      price_multiplier: parseFloat(task.price_multiplier || '1'),
      total_credits: parseFloat(task.total_credits || '0'),
      result_summary: task.result_summary || '',
      quote_result: (task as any).quote_result || '',
    });
    setProcessingDialogOpen(true);
  };

  const calculateCredits = () => {
    const baseCredits = processForm.model_cost;
    const productCredits = processForm.product_count * 2;
    const total = (baseCredits + productCredits) * processForm.price_multiplier;
    return total.toFixed(2);
  };

  const handleSaveProcess = async () => {
    if (!selectedTask) return;

    setSaving(true);
    try {
      const totalCredits = parseFloat(calculateCredits());
      
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          status: processForm.status,
          admin_notes: processForm.admin_notes,
          product_count: processForm.product_count,
          model_cost: processForm.model_cost.toString(),
          price_multiplier: processForm.price_multiplier.toString(),
          total_credits: totalCredits.toString(),
          result_summary: processForm.result_summary,
          quote_result: processForm.quote_result,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setProcessingDialogOpen(false);
        loadTasks();
        alert('任务更新成功！');
      } else {
        alert('更新失败: ' + data.error);
      }
    } catch (error) {
      console.error('更新任务失败:', error);
      alert('更新失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const isManualQuote = (task: TaskWithProfile) => task.type === 'manual_quote';
  
  const getTaskFiles = (task: TaskWithProfile): TaskFile[] => {
    if (!task.files) return [];
    if (Array.isArray(task.files)) return task.files;
    try { return JSON.parse(task.files as string); } catch { return []; }
  };

  const isImageFile = (file: TaskFile) => {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/.test(name);
  };

  const isPdfFile = (file: TaskFile) => {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return type === 'application/pdf' || name.endsWith('.pdf');
  };

  const filteredTasks = tasks;
  
  const drawingTaskCount = tasks.filter(t => t.type === 'manual_quote').length;
  const pendingDrawingCount = tasks.filter(t => t.type === 'manual_quote' && t.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">任务管理</h1>
        <div className="flex gap-3">
          {drawingTaskCount > 0 && (
            <Badge variant="outline" className="px-3 py-1 text-sm">
              <FileText className="w-3 h-3 mr-1" />
              图纸工单 {drawingTaskCount}
            </Badge>
          )}
          {pendingDrawingCount > 0 && (
            <Badge variant="destructive" className="px-3 py-1 text-sm">
              <Clock className="w-3 h-3 mr-1" />
              待报价 {pendingDrawingCount}
            </Badge>
          )}
        </div>
      </div>

      {/* 状态筛选 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="pending">待处理</TabsTrigger>
              <TabsTrigger value="processing">处理中</TabsTrigger>
              <TabsTrigger value="completed">已完成</TabsTrigger>
              <TabsTrigger value="delivered">已交付</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* 工单类型筛选 */}
          <div className="mt-4 flex gap-2">
            <Button
              variant={typeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('all')}
            >
              全部工单
            </Button>
            <Button
              variant={typeFilter === 'manual_quote' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter('manual_quote')}
            >
              <FileText className="w-3 h-3 mr-1" />
              图纸工单
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              暂无任务数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务编号</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>附件</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const files = getTaskFiles(task);
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">{task.task_code}</TableCell>
                      <TableCell>
                        {isManualQuote(task) ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <FileText className="w-3 h-3 mr-1" />
                            图纸报价
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{task.user_profile?.company_name || task.user_profile?.username || '-'}</div>
                          <div className="text-gray-500 text-xs">
                            {task.user_profile?.contact_phone || task.user_profile?.contact_email || ''}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{task.title}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[task.status]?.color || 'bg-gray-100'}>
                          <span className="flex items-center gap-1">
                            {STATUS_CONFIG[task.status]?.icon}
                            {STATUS_CONFIG[task.status]?.label || task.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {files.length > 0 && (
                          <span className="text-sm text-gray-600">
                            {files.length} 个文件
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(task.created_at).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(task)}
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isManualQuote(task) && task.status !== 'delivered' && task.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleProcessTask(task)}
                              title="快速报价"
                              className="text-orange-600 hover:text-orange-700"
                            >
                              <Calculator className="w-4 h-4" />
                            </Button>
                          )}
                          {task.status !== 'delivered' && task.status !== 'cancelled' && !isManualQuote(task) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleProcessTask(task)}
                              title="处理任务"
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 任务详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              任务详情 - {selectedTask?.task_code}
              {selectedTask && isManualQuote(selectedTask) && (
                <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                  图纸工单
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedTask && (
                <Badge className={STATUS_CONFIG[selectedTask.status]?.color}>
                  {STATUS_CONFIG[selectedTask.status]?.label}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">用户</Label>
                  <p className="font-medium">
                    {selectedTask.user_profile?.company_name || selectedTask.user_profile?.username || '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500">联系方式</Label>
                  <p>{selectedTask.user_profile?.contact_phone || selectedTask.user_profile?.contact_email || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">标题</Label>
                  <p>{selectedTask.title || '-'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">创建时间</Label>
                  <p>{new Date(selectedTask.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>

              {/* 用户需求描述（图纸工单专用） */}
              {isManualQuote(selectedTask) && selectedTask.admin_notes && (
                <div>
                  <Label className="text-gray-500 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    用户需求描述
                  </Label>
                  <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedTask.admin_notes}</p>
                  </div>
                </div>
              )}

              {/* 上传文件 - 图纸预览 */}
              {selectedTask.files && getTaskFiles(selectedTask).length > 0 && (
                <div>
                  <Label className="text-gray-500 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    上传图纸/文件
                  </Label>
                  <div className="mt-2 space-y-3">
                    {getTaskFiles(selectedTask).map((file, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden">
                        {/* 图片文件直接显示预览 */}
                        {isImageFile(file) && file.url ? (
                          <div className="relative">
                            <img 
                              src={file.url} 
                              alt={file.name}
                              className="w-full max-h-96 object-contain bg-gray-50 cursor-pointer"
                              onClick={() => setPreviewImage(file.url)}
                            />
                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t">
                              <div className="flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600">{file.name}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setPreviewImage(file.url)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  放大查看
                                </Button>
                                <a href={file.url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm">
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    新窗口
                                  </Button>
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : isPdfFile(file) && file.url ? (
                          /* PDF文件显示链接 */
                          <div className="flex items-center gap-3 p-3 bg-gray-50">
                            <FileText className="w-8 h-8 text-red-400" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-gray-500">
                                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF文件'}
                              </p>
                            </div>
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              <Button variant="outline" size="sm">
                                <ExternalLink className="w-3 h-3 mr-1" />
                                查看PDF
                              </Button>
                            </a>
                            <a href={file.url} download={file.name}>
                              <Button variant="ghost" size="sm">
                                <Download className="w-3 h-3" />
                              </Button>
                            </a>
                          </div>
                        ) : (
                          /* 其他文件类型 */
                          <div className="flex items-center gap-3 p-3 bg-gray-50">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <span className="flex-1 truncate text-sm">{file.name}</span>
                            {file.url && (
                              <a href={file.url} target="_blank" rel="noopener noreferrer"
                                className="text-blue-600 text-sm hover:underline">
                                查看
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 对话记录 */}
              {selectedTask.conversation_log && 
               (Array.isArray(selectedTask.conversation_log) 
                 ? selectedTask.conversation_log 
                 : (() => { try { return JSON.parse(selectedTask.conversation_log as string); } catch { return []; } })()
               ).length > 0 && (
                <div>
                  <Label className="text-gray-500 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    对话记录
                  </Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {(Array.isArray(selectedTask.conversation_log) 
                      ? selectedTask.conversation_log 
                      : (() => { try { return JSON.parse(selectedTask.conversation_log as string); } catch { return []; } })()
                    ).slice(-5).map((msg: {role: string; content: string}, index: number) => (
                      <div 
                        key={index} 
                        className={`p-2 rounded text-sm ${
                          msg.role === 'user' ? 'bg-blue-50 ml-4' : 'bg-gray-50 mr-4'
                        }`}
                      >
                        <span className="text-gray-500 text-xs">
                          {msg.role === 'user' ? '用户' : 'AI'}:
                        </span>
                        <p className="mt-1 line-clamp-3">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 处理结果 */}
              {selectedTask.result_summary && (
                <div>
                  <Label className="text-gray-500">处理结果</Label>
                  <p className="mt-1 p-2 bg-green-50 rounded text-sm">
                    {selectedTask.result_summary}
                  </p>
                </div>
              )}

              {/* 报价结果 */}
              {(selectedTask as any).quote_result && (
                <div>
                  <Label className="text-gray-500">报价详情</Label>
                  <pre className="mt-1 p-3 bg-blue-50 rounded text-sm whitespace-pre-wrap font-mono">
                    {(selectedTask as any).quote_result}
                  </pre>
                </div>
              )}

              {/* 费用信息 */}
              {(selectedTask.product_count || selectedTask.total_credits) && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded">
                  <div>
                    <Label className="text-gray-500 text-xs">产品数量</Label>
                    <p className="font-medium">{selectedTask.product_count || 0}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">模型成本</Label>
                    <p className="font-medium">¥{parseFloat(selectedTask.model_cost || '0').toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500 text-xs">倍数</Label>
                    <p className="font-medium">{parseFloat(selectedTask.price_multiplier || '1').toFixed(2)}x</p>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-gray-500 text-xs">总积分</Label>
                    <p className="font-bold text-lg text-green-600">
                      ¥{parseFloat(selectedTask.total_credits || '0').toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
            {selectedTask && selectedTask.status !== 'delivered' && selectedTask.status !== 'cancelled' && (
              <Button 
                onClick={() => {
                  setDetailDialogOpen(false);
                  handleProcessTask(selectedTask);
                }}
                className={isManualQuote(selectedTask) ? 'bg-orange-600 hover:bg-orange-700' : ''}
              >
                {isManualQuote(selectedTask) ? (
                  <>
                    <Calculator className="w-4 h-4 mr-1" />
                    快速报价
                  </>
                ) : '处理任务'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 图片预览全屏对话框 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-4">
            <DialogTitle>图纸预览</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="px-6 pb-6">
              <img 
                src={previewImage} 
                alt="图纸预览"
                className="w-full max-h-[70vh] object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 处理/报价任务对话框 */}
      <Dialog open={processingDialogOpen} onOpenChange={setProcessingDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTask && isManualQuote(selectedTask) ? '📐 图纸报价' : '处理任务'} - {selectedTask?.task_code}
            </DialogTitle>
            <DialogDescription>
              {selectedTask && isManualQuote(selectedTask) 
                ? '查看图纸后填写报价结果'
                : '设置任务处理参数和结果'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 图纸工单：显示用户需求和文件摘要 */}
            {selectedTask && isManualQuote(selectedTask) && (
              <div className="space-y-3">
                {selectedTask.admin_notes && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                    <p className="text-xs text-orange-600 mb-1">用户需求：</p>
                    <p className="text-sm">{selectedTask.admin_notes}</p>
                  </div>
                )}
                {getTaskFiles(selectedTask).length > 0 && (
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-500 mb-2">
                      附件 ({getTaskFiles(selectedTask).length}个)：
                    </p>
                    {getTaskFiles(selectedTask).map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {isImageFile(f) ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        <span className="truncate">{f.name}</span>
                        {f.url && (
                          <a href={f.url} target="_blank" rel="noopener noreferrer" 
                            className="text-blue-600 text-xs hover:underline ml-auto">
                            查看
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>任务状态</Label>
              <Select
                value={processForm.status}
                onValueChange={(value) => setProcessForm({ ...processForm, status: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="processing">处理中</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="delivered">已交付</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 报价信息区域 */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                报价信息
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product_count" className="text-xs">产品数量</Label>
                  <Input
                    id="product_count"
                    type="number"
                    min="0"
                    value={processForm.product_count}
                    onChange={(e) => setProcessForm({ 
                      ...processForm, 
                      product_count: parseInt(e.target.value) || 0 
                    })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="model_cost" className="text-xs">模型成本 (元)</Label>
                  <Input
                    id="model_cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={processForm.model_cost}
                    onChange={(e) => setProcessForm({ 
                      ...processForm, 
                      model_cost: parseFloat(e.target.value) || 0 
                    })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="price_multiplier" className="text-xs">价格倍数</Label>
                <Input
                  id="price_multiplier"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={processForm.price_multiplier}
                  onChange={(e) => setProcessForm({ 
                    ...processForm, 
                    price_multiplier: parseFloat(e.target.value) || 1 
                  })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  积分 = (模型成本 + 2元/产品) × 倍数
                </p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <Label className="text-blue-800 text-xs">计算积分</Label>
                <p className="text-xl font-bold text-blue-600">¥{calculateCredits()}</p>
              </div>
            </div>

            {/* 报价详情（图纸工单专用） */}
            {selectedTask && isManualQuote(selectedTask) && (
              <div>
                <Label htmlFor="quote_result" className="text-sm font-medium">
                  📋 报价明细
                </Label>
                <Textarea
                  id="quote_result"
                  value={processForm.quote_result}
                  onChange={(e) => setProcessForm({ ...processForm, quote_result: e.target.value })}
                  placeholder={"填写报价明细，例如：
材料费：XXX 元
加工费：XXX 元
表面处理：XXX 元
合计单价：XXX 元/件"}
                  rows={6}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            )}

            <div>
              <Label htmlFor="admin_notes">处理备注</Label>
              <Textarea
                id="admin_notes"
                value={processForm.admin_notes}
                onChange={(e) => setProcessForm({ ...processForm, admin_notes: e.target.value })}
                placeholder="记录处理过程中的重要信息..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="result_summary">处理结果摘要</Label>
              <Textarea
                id="result_summary"
                value={processForm.result_summary}
                onChange={(e) => setProcessForm({ ...processForm, result_summary: e.target.value })}
                placeholder="简要描述处理结果，如报价金额、注意事项等..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessingDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSaveProcess} 
              disabled={saving}
              className={selectedTask && isManualQuote(selectedTask) ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {selectedTask && isManualQuote(selectedTask) ? '提交报价' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
