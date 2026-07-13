'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import {
  Phone,
  MapPin,
  Building2,
  Send,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 模拟提交成功
    setSubmitted(true);
  };

  const handleReset = () => {
    setFormData({ name: '', company: '', phone: '', message: '' });
    setSubmitted(false);
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">联系我们</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            如有任何疑问或合作需求，欢迎通过以下方式联系我们
          </p>
        </div>

        {/* 公司信息卡片 */}
        <Card className="border-gray-200">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div className="space-y-3">
                <h2 className="font-semibold text-lg text-gray-900">
                  上栗县碧利五金塑胶制品厂
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="font-medium">18929979760</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span>江西省萍乡市上栗县长平乡佛溪村下横冲21号</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 联系表单 & 服务信息 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* 左侧：联系表单 */}
          <Card className="md:col-span-3 border-gray-200">
            <CardContent className="pt-6 pb-6">
              {submitted ? (
                <div className="py-12 text-center">
                  <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    提交成功！
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">
                    感谢您的留言，我们会尽快与您联系。
                  </p>
                  <Button variant="outline" onClick={handleReset}>
                    继续提交
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="font-medium text-gray-900 mb-4">在线留言</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">姓名</Label>
                      <Input
                        id="name"
                        placeholder="请输入您的姓名"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">公司名称</Label>
                      <Input
                        id="company"
                        placeholder="请输入公司名称"
                        value={formData.company}
                        onChange={(e) =>
                          setFormData({ ...formData, company: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">电话 / 微信</Label>
                    <Input
                      id="phone"
                      placeholder="请输入您的电话或微信号"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">需求描述</Label>
                    <Textarea
                      id="message"
                      placeholder="请描述您的需求，例如产品类型、材质要求、数量、交期等..."
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      rows={5}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <Send className="w-4 h-4 mr-2" />
                    提交留言
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* 右侧：服务信息 */}
          <div className="md:col-span-2 space-y-4">
            <Card className="border-gray-200">
              <CardContent className="pt-6 pb-6 space-y-4">
                <h3 className="font-medium text-gray-900">服务时间</h3>
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p>周一至周五: 8:30 - 18:00</p>
                    <p>周六: 9:00 - 12:00</p>
                    <p className="text-gray-400">周日及法定节假日休息</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-6 pb-6 space-y-4">
                <h3 className="font-medium text-gray-900">主营品类</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    '铝型材',
                    '板材',
                    '铝压铸',
                    '锌合金压铸',
                    '注塑',
                    'CNC加工',
                  ].map((item) => (
                    <span
                      key={item}
                      className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-200">
              <CardContent className="pt-6 pb-6 space-y-4">
                <h3 className="font-medium text-gray-900">快速响应承诺</h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>24小时内回复咨询</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>48小时内提供报价方案</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>免费样品评估</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
