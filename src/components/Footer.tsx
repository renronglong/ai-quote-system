import Link from 'next/link';
import { Package, Phone, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">碧利制造</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              制造业一站式AI报价平台，实时同步南海铝锭价，秒级出结果。
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">产品服务</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/quote" className="hover:text-white transition-colors">AI智能报价</Link></li>
              <li><Link href="/suppliers" className="hover:text-white transition-colors">供应商产品库</Link></li>
              <li><Link href="/market" className="hover:text-white transition-colors">铝价行情</Link></li>
              <li><Link href="/supplier" className="hover:text-white transition-colors">供应商入驻</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">帮助支持</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="hover:text-white transition-colors">联系我们</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">使用指南</a></li>
              <li><a href="#" className="hover:text-white transition-colors">常见问题</a></li>
              <li><a href="#" className="hover:text-white transition-colors">隐私政策</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">联系方式</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <span>18942401709</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>service@gyparts.cn</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>广东省佛山市南海区</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} 碧利制造 gyparts.cn. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">粤ICP备XXXXXXXX号</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
