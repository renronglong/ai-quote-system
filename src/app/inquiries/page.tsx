'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageSquare, Search, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Inquiry {
  id: string;
  created_at: string;
  status: string;
  customer_name?: string;
  description?: string;
  reply_count?: number;
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchInquiries() {
      try {
        const res = await fetch('/api/inquiries');
        const data = await res.json();
        setInquiries(data.inquiries || []);
      } catch {
        console.error('获取询价列表失败');
      } finally {
        setLoading(false);
      }
    }
    fetchInquiries();
  }, []);

  const filtered = inquiries.filter(
    (q) =>
      (q.customer_name || '').includes(searchTerm) ||
      (q.description || '').includes(searchTerm) ||
      q.id.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">询价管理</h1>
        <p className="text-gray-500 mt-1">管理客户询价和沟通记录</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜索客户名、描述或ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          筛选
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
            <MessageSquare className="w-12 h-12 mb-4" />
            <p>暂无询价记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((inq) => (
            <Card key={inq.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {inq.customer_name || `询价 #${inq.id.slice(0, 8)}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(inq.created_at).toLocaleDateString('zh-CN')} ·{' '}
                      {inq.reply_count != null && `${inq.reply_count} 条回复`}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    inq.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : inq.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {inq.status === 'active' ? '进行中' : inq.status === 'pending' ? '待回复' : '已关闭'}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
