'use client';

import { useEffect, useState } from 'react';
import { Loader2, FileText, Search, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Quotation {
  id: string;
  created_at: string;
  status: string;
  total_price?: number;
  customer_name?: string;
  description?: string;
}

export default function HistoryPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/quotation');
        const data = await res.json();
        setQuotations(data.quotations || []);
      } catch {
        console.error('获取报价历史失败');
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const filtered = quotations.filter(
    (q) =>
      (q.customer_name || '').includes(searchTerm) ||
      (q.description || '').includes(searchTerm) ||
      q.id.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">报价历史</h1>
        <p className="text-gray-500 mt-1">查看和管理所有历史报价记录</p>
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
          <Calendar className="w-4 h-4 mr-2" />
          筛选日期
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mb-4" />
            <p>暂无报价记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <Card key={q.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {q.customer_name || `报价 #${q.id.slice(0, 8)}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(q.created_at).toLocaleDateString('zh-CN')} ·{' '}
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          q.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : q.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {q.status === 'completed'
                          ? '已完成'
                          : q.status === 'pending'
                          ? '待处理'
                          : q.status}
                      </span>
                    </p>
                  </div>
                </div>
                {q.total_price != null && (
                  <p className="text-lg font-semibold text-blue-600">
                    ¥{q.total_price.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
