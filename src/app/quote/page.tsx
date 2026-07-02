'use client';

import { useState, useRef } from 'react';
import { 
  Upload, Send, CheckCircle, FileText, User, Phone, Building2,
  MessageSquare, Image as ImageIcon, X, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
}

export default function QuotePage() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    company: '',
    email: '',
    material: '',
    process: '',
    surfaceTreatment: '',
    quantity: '',
    length: '',
    description: '',
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [inquiryId, setInquiryId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check usage count on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const count = parseInt(localStorage.getItem('quote_usage_count') || '0', 10);
      setUsageCount(count);
    }
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    for (const file of Array.from(selectedFiles)) {
      if (file.size > 20 * 1024 * 1024) {
        setError('单个文件不能超过20MB');
        return;
      }
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (data.success && data.url) {
          setFiles(prev => [...prev, {
            name: file.name,
            size: file.size,
            type: file.type,
            url: data.url,
          }]);
        }
      } catch (err) {
        console.error('Upload error:', err);
        setError('文件上传失败，请重试');
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('请输入您的姓名');
      return;
    }
    if (!formData.phone.trim()) {
      setError('请输入联系电话');
      return;
    }
    if (!formData.description.trim() && files.length === 0) {
      setError('请填写需求描述或上传图纸');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          files: files.map(f => ({ name: f.name, url: f.url, type: f.type })),
        }),
      });
      const data = await res.json();

      if (data.success) {
        const newCount = usageCount + 1;
        localStorage.setItem('quote_usage_count', String(newCount));
        setUsageCount(newCount);
        setInquiryId(data.inquiry?.id || '');
        setSubmitted(true);
      } else {
        setError(data.error || '提交失败，请稍后重试');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">询价已提交！</h2>
            <p className="text-slate-500 mb-6">
              我们已收到您的询价需求，将在24小时内通过电话或邮件与您联系。
            </p>
            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-slate-600">
                <span className="font-medium">询价编号：</span>
                <span className="text-blue-600 font-mono">{inquiryId}</span>
              </p>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium">联系姓名：</span>{formData.name}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium">联系电话：</span>{formData.phone}
              </p>
            </div>
            <Button 
              onClick={() => {
                setSubmitted(false);
                setFormData({
                  name: '', phone: '', company: '', email: '',
                  material: '', process: '', surfaceTreatment: '',
                  quantity: '', length: '', description: '',
                });
                setFiles([]);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              继续询价
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const freeQuotesLeft = Math.max(0, 3 - usageCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">AI智能报价</h1>
              <p className="text-xs text-slate-500">上传图纸，1秒出报价</p>
            </div>
          </div>
          {freeQuotesLeft > 0 && (
            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              免费询价剩余 <span className="font-bold text-blue-600">{freeQuotesLeft}</span> 次
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-3">
            专业铝型材报价，<span className="text-blue-600">AI秒算</span>
          </h2>
          <p className="text-slate-500 text-lg">
            上传图纸或描述需求，获取精准报价
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: '⚡', title: 'AI识别', desc: '自动识别图纸参数' },
            { icon: '📐', title: '精准计算', desc: '实时铝价+专业公式' },
            { icon: '📄', title: '报价单', desc: '一键生成PDF报价单' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-4 text-center shadow-sm border border-slate-100">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold text-slate-700 text-sm">{f.title}</div>
              <div className="text-xs text-slate-400 mt-1">{f.desc}</div>
            </div>
          ))}
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">提交询价</CardTitle>
            <CardDescription>填写以下信息，我们将在24小时内给您回复</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" /> 联系信息
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">姓名 *</label>
                    <Input placeholder="您的姓名" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">电话 *</label>
                    <Input placeholder="联系电话" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">公司</label>
                    <Input placeholder="公司名称" value={formData.company} onChange={(e) => handleInputChange('company', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">邮箱</label>
                    <Input type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> 产品信息
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">材料</label>
                    <select className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white" value={formData.material} onChange={(e) => handleInputChange('material', e.target.value)}>
                      <option value="">请选择</option>
                      <option value="挤压铝型材">挤压铝型材</option>
                      <option value="板材">板材</option>
                      <option value="压铸铝材">压铸铝材</option>
                      <option value="锌合金压铸">锌合金压铸</option>
                      <option value="注塑">注塑</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">数量</label>
                    <Input placeholder="如：1000件" value={formData.quantity} onChange={(e) => handleInputChange('quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">长度(mm)</label>
                    <Input placeholder="型材切割长度" value={formData.length} onChange={(e) => handleInputChange('length', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">表面处理</label>
                    <select className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white" value={formData.surfaceTreatment} onChange={(e) => handleInputChange('surfaceTreatment', e.target.value)}>
                      <option value="">请选择</option>
                      <option value="氧化本色">氧化本色</option>
                      <option value="氧化黑色">氧化黑色</option>
                      <option value="电泳">电泳</option>
                      <option value="喷涂">喷涂</option>
                      <option value="无">无表面处理</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 mb-1 block">加工工艺</label>
                    <select className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white" value={formData.process} onChange={(e) => handleInputChange('process', e.target.value)}>
                      <option value="">请选择</option>
                      <option value="铝挤压">铝挤压</option>
                      <option value="CNC加工">CNC加工</option>
                      <option value="冲压">冲压</option>
                      <option value="压铸">压铸</option>
                      <option value="注塑">注塑</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> 上传图纸
                </h3>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">点击或拖拽上传图纸文件</p>
                  <p className="text-xs text-slate-400 mt-1">支持 PDF、JPG、PNG、DXF 格式，单文件不超过20MB</p>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.dxf" onChange={handleFileSelect} className="hidden" />
                </div>
                {files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                        <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                        <span className="text-sm text-slate-700 flex-1 truncate">{file.name}</span>
                        <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)}KB</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> 需求描述
                </h3>
                <textarea className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm min-h-[100px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="请描述您的需求，如规格要求、交期、特殊工艺等..." value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} />
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />提交中...</>
                ) : (
                  <><Send className="w-5 h-5 mr-2" />提交询价</>
                )}
              </Button>

              <p className="text-center text-xs text-slate-400">
                提交即表示同意我们的服务条款 · 询价信息仅用于报价沟通
              </p>
            </form>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-slate-200 bg-white/60 mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-400">
          © 2026 AI智能报价助手 · 专业铝型材报价服务
        </div>
      </footer>
    </div>
  );
}
