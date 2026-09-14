'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/components/AppLayout';
import { Loader2, Building2, ChevronDown, ChevronUp, Search, Handshake, ArrowRight } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

interface Supplier {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
}

interface Product {
  id: string;
  supplier_id: string;
  product_name: string | null;
  mold_number: string | null;
  cross_section_mm: string | null;
  weight_per_meter: number | null;
  perimeter: number | null;
  mold_type?: string;
  num_dies?: number;
  surface_treatments: string[];
  cross_section_image_url: string | null;
  remarks: string | null;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, Product[]>>({});
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const PAGE_SIZE = 50;
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from('supplier_profiles')
        .select('*')
        .order('company_name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (supplierId: string) => {
    if (productsMap[supplierId]) return;
    try {
      const res = await fetch(`/api/supplier/products?supplier_id=${supplierId}`);
      const json = await res.json();
      setProductsMap((prev) => ({ ...prev, [supplierId]: json.data || [] }));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setVisibleCount((prev) => ({ ...prev, [id]: PAGE_SIZE }));
      loadProducts(id);
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    !searchTerm || s.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">挤压铝型材供应商</h1>
          <p className="text-gray-500 mt-1">点击公司名查看可生产的铝型材产品</p>
        </div>

        {/* 搜索框 */}
        <div className="relative max-w-xs mx-auto mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索供应商..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-16 text-gray-400">暂无供应商数据</div>
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map((supplier) => (
              <Card key={supplier.id} className="overflow-hidden">
                <CardHeader
                  className="cursor-pointer hover:bg-gray-50 transition-colors py-4"
                  onClick={() => toggleExpand(supplier.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{supplier.company_name}</CardTitle>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {supplier.contact_name && <span>联系人: {supplier.contact_name}</span>}
                          {supplier.phone && <span>电话: {supplier.phone}</span>}
                          {supplier.address && <span>{supplier.address}</span>}
                        </div>
                      </div>
                    </div>
                    {expandedId === supplier.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </CardHeader>

                {expandedId === supplier.id && (
                  <CardContent className="p-0 pb-4">
                    {!productsMap[supplier.id] ? (
                      <div className="text-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                      </div>
                    ) : productsMap[supplier.id].length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">暂无产品</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>模具编号</TableHead>
                            <TableHead>产品名称</TableHead>
                            <TableHead>截面尺寸(mm)</TableHead>
                            <TableHead>米重</TableHead>
                            <TableHead>周长</TableHead>
                            <TableHead>模具类型</TableHead>
                            <TableHead>表面处理</TableHead>
                            <TableHead>截面图</TableHead>
                            <TableHead>备注</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productsMap[supplier.id].slice(0, visibleCount[supplier.id] || PAGE_SIZE).map((product) => (
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
                                <div className="flex flex-wrap gap-1 max-w-[140px]">
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
                                  <img
                                    src={product.cross_section_image_url}
                                    alt="截面图"
                                    className="w-10 h-10 object-cover rounded border"
                                  />
                                ) : '-'}
                              </TableCell>
                              <TableCell className="text-gray-500 text-xs max-w-[100px] truncate">
                                {product.remarks || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                    {(productsMap[supplier.id]?.length || 0) > (visibleCount[supplier.id] || PAGE_SIZE) && (
                      <div className="text-center py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setVisibleCount((prev) => ({
                              ...prev,
                              [supplier.id]: (prev[supplier.id] || PAGE_SIZE) + 200,
                            }))
                          }
                        >
                          加载更多（已显示 {visibleCount[supplier.id] || PAGE_SIZE} / {productsMap[supplier.id].length}）
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* 供应商入驻引导 */}
        <div className="mt-6 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-11 h-11 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">您也是供应商？</p>
              <p className="text-sm text-gray-500">免费入驻平台，发布产品与产能，接收采购方精准询价</p>
            </div>
          </div>
          <Link href="/supplier" className="shrink-0">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 font-semibold">
              立即入驻
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
