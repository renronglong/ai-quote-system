'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Package,
  Building2,
  Phone,
  Mail,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface Product {
  id: number;
  product_code: string;
  name: string;
  material: string;
  process: string;
  surface_treatment: string;
  oxidation_color?: string;
  specs?: string;
  description?: string;
  images?: string[];
  created_at: string;
}

interface UserProfile {
  username: string;
  company_name: string;
  contact_phone?: string;
  contact_email?: string;
  description?: string;
  avatar_url?: string;
}

interface SiteData {
  profile: UserProfile;
  products: Product[];
}

export default function UserSitePage() {
  const params = useParams();
  const username = params.username as string;

  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inquiryDialogOpen, setInquiryDialogOpen] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchSiteData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/user-site/${username}`);
        const data = await response.json();

        if (data.success) {
          setSiteData(data.data);
        } else {
          setError(data.error || '加载失败');
        }
      } catch (err) {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    if (username) {
      fetchSiteData();
    }
  }, [username]);

  const handleInquiry = async () => {
    if (!inquiryForm.name || !inquiryForm.message) {
      alert('请填写姓名和询价内容');
      return;
    }

    setSubmitting(true);
    try {
      // 这里可以调用询价 API
      alert('询价已提交，我们会尽快联系您！');
      setInquiryDialogOpen(false);
      setInquiryForm({ name: '', phone: '', email: '', message: '' });
    } catch (err) {
      alert('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !siteData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">站点不存在</h2>
            <p className="text-gray-500">
              {error || '该用户站点不存在或已被关闭'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, products } = siteData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部信息 */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback className="text-xl">
                {profile.company_name?.charAt(0) || profile.username?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" />
                {profile.company_name || profile.username}
              </h1>
              <p className="text-gray-500 mt-1">@{profile.username}</p>
              {profile.description && (
                <p className="text-gray-600 mt-3 max-w-2xl">{profile.description}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-4">
                {profile.contact_phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    {profile.contact_phone}
                  </div>
                )}
                {profile.contact_email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    {profile.contact_email}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 产品列表 */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Package className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            产品展示 ({products.length})
          </h2>
        </div>

        {products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无产品</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card 
                key={product.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedProduct(product);
                  setInquiryDialogOpen(true);
                }}
              >
                {/* 产品图片 */}
                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base line-clamp-1">
                    {product.name}
                  </CardTitle>
                  <p className="text-xs text-gray-500">{product.product_code}</p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="outline" className="text-xs">
                      {product.material}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {product.process}
                    </Badge>
                    {product.surface_treatment && (
                      <Badge variant="outline" className="text-xs">
                        {product.surface_treatment}
                        {product.oxidation_color && ` - ${product.oxidation_color}`}
                      </Badge>
                    )}
                  </div>
                  {product.specs && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {product.specs}
                    </p>
                  )}
                  <Button className="w-full" size="sm">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    询价
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 底部联系信息 */}
      <div className="bg-white border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">
                {profile.company_name || profile.username}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {profile.contact_phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  {profile.contact_phone}
                </div>
              )}
              {profile.contact_email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {profile.contact_email}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 询价对话框 */}
      <Dialog open={inquiryDialogOpen} onOpenChange={setInquiryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>提交询价</DialogTitle>
            <DialogDescription>
              {selectedProduct && (
                <span>产品：{selectedProduct.name}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedProduct && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center shrink-0">
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedProduct.name}</p>
                    <p className="text-xs text-gray-500">{selectedProduct.product_code}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {selectedProduct.material}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {selectedProduct.process}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={inquiryForm.name}
                onChange={(e) => setInquiryForm({ ...inquiryForm, name: e.target.value })}
                placeholder="请输入您的姓名"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="phone">联系电话</Label>
              <Input
                id="phone"
                value={inquiryForm.phone}
                onChange={(e) => setInquiryForm({ ...inquiryForm, phone: e.target.value })}
                placeholder="请输入您的电话"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={inquiryForm.email}
                onChange={(e) => setInquiryForm({ ...inquiryForm, email: e.target.value })}
                placeholder="请输入您的邮箱"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="message">询价内容 *</Label>
              <Textarea
                id="message"
                value={inquiryForm.message}
                onChange={(e) => setInquiryForm({ ...inquiryForm, message: e.target.value })}
                placeholder="请描述您的需求..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInquiryDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleInquiry} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              提交询价
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
