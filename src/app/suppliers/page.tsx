'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/components/AppLayout';
import {
  Search,
  Building2,
  Phone,
  MapPin,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  categories: string[];
  contact: string;
  wechat: string;
  location: string;
  description: string;
}

const CATEGORIES = [
  '全部',
  '铝型材',
  '板材',
  '铝压铸',
  '锌合金压铸',
  '注塑',
  'CNC加工',
];

const SUPPLIERS: Supplier[] = [
  // 铝型材
  {
    id: 1,
    name: '佛山市南海区鑫铝铝业有限公司',
    categories: ['铝型材'],
    contact: '13800138001',
    wechat: 'xinlv_ly',
    location: '广东省佛山市南海区',
    description: '专注铝型材挤压加工15年，拥有多条挤压生产线，可定制各种截面铝型材，年产能5000吨以上。',
  },
  {
    id: 2,
    name: '广东永利铝业有限公司',
    categories: ['铝型材'],
    contact: '13900139002',
    wechat: 'yongli_alu',
    location: '广东省佛山市顺德区',
    description: '主营工业铝型材、散热器型材、LED灯壳型材等，表面处理包括氧化、电泳、喷涂，品质稳定。',
  },
  {
    id: 3,
    name: '佛山市南海区精锐铝业制品厂',
    categories: ['铝型材', 'CNC加工'],
    contact: '13700137003',
    wechat: 'ruijui_ly',
    location: '广东省佛山市南海区',
    description: '集铝型材挤压与CNC深加工于一体，提供从原材料到成品的一站式服务，交货周期短。',
  },
  // 板材
  {
    id: 4,
    name: '佛山市顺德区宏达金属材料有限公司',
    categories: ['板材'],
    contact: '13600136004',
    wechat: 'hongda_js',
    location: '广东省佛山市顺德区',
    description: '专业经销冷轧板、镀锌板、不锈钢板等，常备库存充足，支持开平、分条等加工服务。',
  },
  {
    id: 5,
    name: '东莞市鑫隆钢铁有限公司',
    categories: ['板材'],
    contact: '13500135005',
    wechat: 'xinlong_gt',
    location: '广东省东莞市长安镇',
    description: '主营SPCC冷轧板、SGCC镀锌板及SUS不锈钢板材，厚度0.3-6.0mm，提供材料质保书。',
  },
  // 铝压铸
  {
    id: 6,
    name: '佛山市南海区裕丰压铸有限公司',
    categories: ['铝压铸'],
    contact: '13400134006',
    wechat: 'yufeng_yz',
    location: '广东省佛山市南海区',
    description: '拥有160T-800T压铸机，专业铝压铸件生产，产品涵盖汽车配件、电机壳体、灯具外壳等。',
  },
  {
    id: 7,
    name: '中山市精固压铸科技有限公司',
    categories: ['铝压铸', 'CNC加工'],
    contact: '13300133007',
    wechat: 'jinggu_yz',
    location: '广东省中山市小榄镇',
    description: '集模具设计、铝压铸、CNC加工于一体，具备完整品质检测体系，通过IATF16949认证。',
  },
  {
    id: 8,
    name: '东莞市恒力精密压铸有限公司',
    categories: ['铝压铸'],
    contact: '13200132008',
    wechat: 'hengli_yz',
    location: '广东省东莞市寮步镇',
    description: '主营高精密铝压铸产品，公差可达±0.05mm，服务于通讯、消费电子、新能源等行业。',
  },
  // 锌合金压铸
  {
    id: 9,
    name: '佛山市南海区金固锌合金制品厂',
    categories: ['锌合金压铸'],
    contact: '13100131009',
    wechat: 'jingu_xj',
    location: '广东省佛山市南海区',
    description: '专业锌合金压铸厂，产品包括拉手、铰链、装饰件、箱包配件等，表面处理工艺齐全。',
  },
  {
    id: 10,
    name: '深圳市鑫辉锌合金压铸有限公司',
    categories: ['锌合金压铸'],
    contact: '13000130010',
    wechat: 'xinhui_xj',
    location: '广东省深圳市龙岗区',
    description: '拥有88T-280T锌合金压铸机，可生产各类精密锌合金零件，电镀、喷涂等后加工配套完善。',
  },
  // 注塑
  {
    id: 11,
    name: '佛山市顺德区精塑模具有限公司',
    categories: ['注塑'],
    contact: '13910139011',
    wechat: 'jingsu_mj',
    location: '广东省佛山市顺德区',
    description: '专业精密注塑厂，拥有CNC加工中心及火花机，可独立完成模具设计与注塑生产。',
  },
  {
    id: 12,
    name: '东莞市华丰塑胶模具有限公司',
    categories: ['注塑'],
    contact: '13810138012',
    wechat: 'huafeng_su',
    location: '广东省东莞市长安镇',
    description: '注塑车间配备50-650T注塑机30余台，可加工ABS、PC、PA、POM等各类工程塑料产品。',
  },
  {
    id: 13,
    name: '广州市明达注塑科技有限公司',
    categories: ['注塑'],
    contact: '13710137013',
    wechat: 'mingda_zs',
    location: '广东省广州市番禺区',
    description: '专注家电外壳、电子配件注塑加工，支持双色注塑、嵌件注塑等复杂工艺。',
  },
  // CNC加工
  {
    id: 14,
    name: '佛山市南海区精创 CNC 加工中心',
    categories: ['CNC加工'],
    contact: '13610136014',
    wechat: 'jingchuang_cnc',
    location: '广东省佛山市南海区',
    description: '拥有三轴、四轴、五轴CNC加工中心20余台，擅长铝合金、不锈钢精密零件加工。',
  },
  {
    id: 15,
    name: '东莞市锐达精密机械有限公司',
    categories: ['CNC加工', '铝型材'],
    contact: '13510135015',
    wechat: 'ruida_cnc',
    location: '广东省东莞市长安镇',
    description: '提供CNC车削、铣削、线切割等加工服务，批量及打样均可，交期准时品质可靠。',
  },
  {
    id: 16,
    name: '苏州市金诚精密机械科技有限公司',
    categories: ['CNC加工'],
    contact: '13410134016',
    wechat: 'jincheng_jx',
    location: '江苏省苏州市吴中区',
    description: '华东地区精密CNC加工服务商，服务客户涵盖半导体设备、医疗器械、工业自动化等领域。',
  },
];

export default function SuppliersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // 登录检查
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredSuppliers = SUPPLIERS.filter((supplier) => {
    const matchCategory =
      selectedCategory === '全部' ||
      supplier.categories.includes(selectedCategory);
    const matchSearch =
      !searchQuery ||
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 页面标题 */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">供应商</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            共 {filteredSuppliers.length} 家供应商
          </p>
        </div>

        {/* 搜索和筛选 */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* 搜索框 */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索供应商名称、地区或简介..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* 品类筛选 */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className={
                      selectedCategory === category
                        ? ''
                        : 'text-gray-600 hover:text-gray-900'
                    }
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 供应商列表 */}
        {filteredSuppliers.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">暂无匹配的供应商</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((supplier) => {
              const isExpanded = expandedId === supplier.id;
              return (
                <Card
                  key={supplier.id}
                  className="group hover:shadow-lg transition-all duration-200 overflow-hidden border-gray-200 hover:border-blue-300"
                >
                  {/* 卡片头部 */}
                  <div className="relative p-4 pb-2">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 leading-tight line-clamp-2">
                          {supplier.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-500 truncate">
                            {supplier.location}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="pt-0 pb-4 space-y-3">
                    {/* 品类标签 */}
                    <div className="flex flex-wrap gap-1.5">
                      {supplier.categories.map((cat) => (
                        <Badge
                          key={cat}
                          variant="outline"
                          className="text-xs px-2 py-0 font-normal bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {cat}
                        </Badge>
                      ))}
                    </div>

                    {/* 联系方式 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span>{supplier.contact}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <MessageCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span>微信: {supplier.wechat}</span>
                      </div>
                    </div>

                    {/* 简介 - 折叠/展开 */}
                    <div className="pt-2 border-t border-gray-100">
                      <div
                        className={`text-xs text-gray-500 leading-relaxed ${
                          isExpanded ? '' : 'line-clamp-2'
                        }`}
                      >
                        {supplier.description}
                      </div>
                      <button
                        onClick={() => toggleExpand(supplier.id)}
                        className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-700"
                      >
                        {isExpanded ? (
                          <>
                            收起 <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            展开详情 <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
