'use client';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import QuoteForm, { PricingResult } from '@/components/QuoteForm';
import { ResultPanel } from '@/components/ResultPanel';
import { saveQuoteToAPI } from '@/components/SavedQuotesPanel';
import { ArrowRight, Handshake, History } from 'lucide-react';
import { useState } from 'react';

export default function HomePage() {
  const { user } = useAuth();
  const [result, setResult] = useState<PricingResult | null>(null);
  const [params, setParams] = useState<Record<string, any> | null>(null);
  const [productInfo, setProductInfo] = useState<{ productName: string; productCode: string }>({ productName: '', productCode: '' });

  // ResultPanel 所需的展示/折扣状态（首页用默认值；交互回调接 setState）
  const [productDiscount, setProductDiscount] = useState(100);
  const [moldDiscount, setMoldDiscount] = useState(100);
  const [manualUnitPrice, setManualUnitPrice] = useState<number | null>(null);
  const [manualMoldFee, setManualMoldFee] = useState<number | null>(null);
  const [manualMinOrderQty, setManualMinOrderQty] = useState<number | null>(null);
  const [useExistingMold, setUseExistingMold] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    if (!user || !result || !params) return;
    setSaving(true);
    setSaveSuccess(false);
    const saved = await saveQuoteToAPI(
      user.id,
      params,
      result as any,
      (params.productType as string) || 'plate',
      productDiscount,
      moldDiscount,
      undefined,
      productInfo.productName || undefined,
    );
    setSaving(false);
    setSaveSuccess(!!saved);
    if (saved) setTimeout(() => setSaveSuccess(false), 2000);
  };

  // 与 /quote 一致的派生值（从报价结果取模具费/单价/起订量）
  const baseUnitPrice = result?.unit_price || 0;
  const baseMoldFee = result?.mold_cost || 0;
  const moldFee = manualMoldFee ?? baseMoldFee;
  const minOrderQty = result?.min_order_qty || 0;

  return (
    <AppLayout>
      <section className="mb-6">
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 via-white to-slate-50 border border-gray-100 shadow-sm px-6 py-8 md:px-10 md:py-8">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-lg font-semibold text-gray-900">AI 智能报价 · 铝型材 / 五金加工</h1>
            <Link
              href="/quote/recognize"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              上传图纸报价 <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            {/* 左：完整报价表单（与 /quote 同款，免登录即可算价） */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <QuoteForm
                onCalculate={(d) => setParams(d as any)}
                onResult={(r) => setResult(r)}
                onProductInfoChange={(info) => setProductInfo(info)}
              />
            </div>

            {/* 右：结果面板（与 /quote 同款） */}
            <div>
              <ResultPanel
                pricingResult={result}
                aluminumPrice={null}
                productName={productInfo.productName}
                productCode={productInfo.productCode}
                productDiscount={productDiscount}
                moldDiscount={moldDiscount}
                onProductDiscountChange={setProductDiscount}
                onMoldDiscountChange={setMoldDiscount}
                moldFee={moldFee}
                onSave={user ? handleSave : undefined}
                saving={saving}
                saveSuccess={saveSuccess}
                user={user}
                baseUnitPrice={baseUnitPrice}
                baseMoldFee={baseMoldFee}
                useExistingMold={useExistingMold}
                manualUnitPrice={manualUnitPrice}
                manualMoldFee={manualMoldFee}
                onManualUnitPriceChange={setManualUnitPrice}
                onManualMoldFeeChange={setManualMoldFee}
                minOrderQty={minOrderQty}
                manualMinOrderQty={manualMinOrderQty}
                onManualMinOrderQtyChange={setManualMinOrderQty}
                onExportPDF={undefined}
                hideActions={true}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 登录态 / 保存入口 */}
      <section className="mb-6">
        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={saving || !result}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {saving ? '保存中…' : saveSuccess ? '已保存 ✓' : '保存此报价'}
            </Button>
            <Link href="/history">
              <Button variant="outline" className="border-gray-300 font-semibold">
                <History className="w-4 h-4 mr-1" />我的报价
              </Button>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            登录后可保存报价、查看历史记录 ·
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium ml-1">登录</Link>
          </p>
        )}
      </section>

      {/* 供应商入口：一条横幅 */}
      <section>
        <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="font-semibold text-gray-900">我是铝型材 / 五金供应商</p>
            <p className="text-sm text-gray-500">免费入驻，发布产品与产能，接收采购方精准询价</p>
          </div>
          <Link href="/supplier" className="shrink-0">
            <Button className="bg-emerald-600 hover:bg-emerald-700 font-semibold">
              免费入驻 <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
