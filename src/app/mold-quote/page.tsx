'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import TopNavLinks from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { saveQuoteToAPI } from '@/components/SavedQuotesPanel';
import {
  calcMoldQuote,
  MATERIAL_PARAMS,
  MATERIAL_NAMES,
  MOLD_FRAMES,
  recommendMoldFrame,
  DEFAULT_STEEL_PRICE,
  type MoldQuoteInput,
  type MoldMaterial,
} from '@/lib/mold-quote/engine';

export default function MoldQuotePage() {
  const { user, signOut } = useAuth();

  // ---- 表单状态（A端输入）----
  const [form, setForm] = useState({
    L: 32, W: 14, H: 16,
    netWeightG: 9.14, removalVolume: 3784.48, cncCycleMin: 3.59,
    sideCount: 2,
  });
  const [material, setMaterial] = useState<MoldMaterial>('铝压铸');
  const [moldFrame, setMoldFrame] = useState<string>('2535');
  const [steelPrice, setSteelPrice] = useState<number>(DEFAULT_STEEL_PRICE);
  const [steelPriceLoading, setSteelPriceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 模架默认 2535（与 08-27 基准一致）；尺寸变化不自动覆盖用户选择，
  // 「按尺寸推荐」按钮为显式推荐动作
  const recSpec = useMemo(() => recommendMoldFrame(form.L, form.W).spec, [form.L, form.W]);

  // ---- 实时计算 ----
  const result = useMemo(() => {
    return calcMoldQuote({
      ...form,
      material,
      moldFrame,
      steelPrice,
    } as MoldQuoteInput);
  }, [form, material, moldFrame, steelPrice]);

  const ok = result.success === true;

  // ---- 查市场钢板价 ----
  async function fetchSteelPrice() {
    setSteelPriceLoading(true);
    try {
      const res = await fetch('/api/market-price?material=模具钢');
      const json = await res.json();
      if (json.success && json.prices?.length > 0) {
        const ton = parseInt(json.prices[0].price);
        if (!isNaN(ton) && ton > 0) {
          setSteelPrice(Math.round((ton / 1000) * 100) / 100); // 元/吨 -> 元/kg
          toast.success(`已更新市场钢板价 ¥${(ton / 1000).toFixed(2)}/kg（${json.prices[0].name}）`);
          return;
        }
      }
      toast.error('未查到模具钢实时价，保持当前价格');
    } catch {
      toast.error('行情查询失败，保持当前价格');
    } finally {
      setSteelPriceLoading(false);
    }
  }

  // ---- 保存报价 ----
  async function handleSave() {
    if (!user) { toast.error('请先登录后再保存'); return; }
    if (!ok) { toast.error('当前输入无法计算报价'); return; }
    setSaving(true);
    try {
      const savedQuote = await saveQuoteToAPI(
        user.id,
        { ...form, material, moldFrame, steelPrice },
        result,
        'mold_quote',
        100, 100, undefined,
        `模具报价-${material}-${form.L}x${form.W}x${form.H}mm`,
      );
      if (savedQuote) { setSaved(true); toast.success('模具报价已保存到「我的报价」'); }
      else { toast.error('保存失败，请重试'); }
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部导航栏 */}
      <header className="shrink-0 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
          <div className="relative flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">模</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-bold text-gray-800">模具报价</span>
                <span className="hidden sm:inline text-[11px] text-gray-400">gyparts.cn</span>
              </div>
            </Link>

            {/* 全站统一导航 */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
              <TopNavLinks />
            </div>

            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <Link href="/profile" className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors" title="公司资料">
                    <span className="max-w-[100px] truncate">{user.company_name || '公司资料'}</span>
                  </Link>
                  <button onClick={() => signOut()} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors">
                    <LogOut className="w-3 h-3" />退出
                  </button>
                </div>
              ) : (
                <Link href="/login?redirect=/mold-quote">
                  <Button className="px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700">登录</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="space-y-6">
      {/* 页头 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">压铸 / 注塑模具报价</h1>
          <p className="text-sm text-gray-500 mt-1">
            布局链自动推导（滑块→穴数→穴排→机台吨位）· 五块成本（模架/滑块/模芯钢/型腔/浇道）· 三材质对比 · 市场钢板价联动
          </p>
        </div>
        <div className="text-xs text-gray-400 bg-white border rounded-lg px-3 py-2">
          模架费 = 钢板重量 × 市场价 + 2800 · 合计 = 小计 ÷ 0.7
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============ 左侧：输入区 ============ */}
        <div className="space-y-6">
          {/* A端产品参数 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-600 rounded" />
                产品参数（A端输入）
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>外廓L(滑块向·mm)</Label>
                <Input type="number" value={form.L || ''} onChange={set('L')} />
              </div>
              <div>
                <Label>产品宽W(mm)</Label>
                <Input type="number" value={form.W || ''} onChange={set('W')} />
              </div>
              <div>
                <Label>产品高H(mm)</Label>
                <Input type="number" value={form.H || ''} onChange={set('H')} />
              </div>
              <div>
                <Label>净重(g)</Label>
                <Input type="number" value={form.netWeightG || ''} onChange={set('netWeightG')} />
              </div>
              <div>
                <Label>去除量(mm³)</Label>
                <Input type="number" value={form.removalVolume || ''} onChange={set('removalVolume')} />
              </div>
              <div>
                <Label>CNC节拍(min)</Label>
                <Input type="number" value={form.cncCycleMin || ''} onChange={set('cncCycleMin')} />
              </div>
              <div>
                <Label>侧面数N（决定滑块数）</Label>
                <Input type="number" value={form.sideCount || ''} onChange={set('sideCount')} />
                <p className="text-[11px] text-gray-400 mt-1">N≤2→1个滑块 · N≤4→2个 · N&gt;4→4个</p>
              </div>
            </CardContent>
          </Card>

          {/* 工艺/模架/市场价 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-1.5 h-4 bg-amber-500 rounded" />
                工艺 · 模架 · 市场价
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label>材质（三材质切换）</Label>
                <Select value={material} onValueChange={(v) => { setMaterial(v as MoldMaterial); setSaved(false); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MATERIAL_NAMES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}（{MATERIAL_PARAMS[m].steel}钢 · {MATERIAL_PARAMS[m].tonnage}T）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>模架规格（12规格查表）</Label>
                <div className="flex gap-2">
                  <Select value={moldFrame} onValueChange={(v) => { setMoldFrame(v); setSaved(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MOLD_FRAMES.map((f) => (
                        <SelectItem key={f.spec} value={f.spec}>
                          {f.spec}（{f.size} · {f.weightKg}kg）
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" type="button" onClick={() => { setMoldFrame(recSpec); setSaved(false); }}>
                    按尺寸推荐
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">默认 2535（与 08-27 基准一致）；推荐规格 {recSpec}，可手改</p>
              </div>
              <div className="col-span-2">
                <Label>市场钢板价（元/kg · 模架费联动）</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={steelPrice || ''}
                    onChange={(e) => { setSaved(false); setSteelPrice(parseFloat(e.target.value) || 0); }}
                    placeholder="默认 7 元/kg"
                  />
                  <Button variant="outline" onClick={fetchSteelPrice} disabled={steelPriceLoading} className="shrink-0">
                    {steelPriceLoading ? '查询中…' : '查市场价'}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">模架费 = 模架钢板重量 × 此价格 + 2800 加工底费</p>
              </div>
            </CardContent>
          </Card>

          {/* 材质参数参考 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-1.5 h-4 bg-gray-500 rounded" />
                材质参数表
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs text-gray-600">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-1.5 text-left">材质</th>
                    <th className="py-1.5 text-right">模具钢</th>
                    <th className="py-1.5 text-right">钢价¥/kg</th>
                    <th className="py-1.5 text-right">倍率</th>
                    <th className="py-1.5 text-right">机时¥/h</th>
                    <th className="py-1.5 text-right">机台T</th>
                    <th className="py-1.5 text-right">单穴型腔费</th>
                  </tr>
                </thead>
                <tbody>
                  {MATERIAL_NAMES.map((m) => {
                    const p = MATERIAL_PARAMS[m];
                    const active = m === material;
                    return (
                      <tr key={m} className={`border-b last:border-0 ${active ? 'bg-blue-50 text-blue-700 font-medium' : ''}`}>
                        <td className="py-1.5">{m}</td>
                        <td className="py-1.5 text-right">{p.steel}</td>
                        <td className="py-1.5 text-right">{p.steelPrice}</td>
                        <td className="py-1.5 text-right">{p.multiplier}</td>
                        <td className="py-1.5 text-right">{p.hourlyRate}</td>
                        <td className="py-1.5 text-right">{p.tonnage}</td>
                        <td className="py-1.5 text-right">{p.cavityFee}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* ============ 右侧：结果区 ============ */}
        <div className="space-y-6">
          {!ok ? (
            <Card>
              <CardContent className="py-10 text-center text-gray-500">
                <p className="text-2xl mb-2">⚠️</p>
                <p className="font-medium">输入不完整</p>
                <p className="text-sm mt-1">请提供产品外廓 L / W / H（mm）</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 布局链 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded" />
                    布局链（自动推导）
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-gray-500">滑块数</p>
                    <p className="text-xl font-bold text-blue-700">{result.layout.sliderCount}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-gray-500">穴数</p>
                    <p className="text-xl font-bold text-blue-700">{result.layout.cavityCount}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-gray-500">穴排</p>
                    <p className="text-xl font-bold text-blue-700">{result.layout.cavityRows}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-gray-500">机台吨位</p>
                    <p className="text-xl font-bold text-amber-700">{result.layout.tonnage}T</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-gray-500">机台类型</p>
                    <p className="text-sm font-bold text-amber-700 leading-tight mt-1">{result.layout.machineType}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 成本五块 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-600 rounded" />
                    成本明细（五块）
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.costs.map((c) => (
                    <div key={c.item} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{c.item}</p>
                        <p className="text-[11px] text-gray-400 truncate" title={c.calculation}>{c.calculation}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 whitespace-nowrap">¥{c.amount.toLocaleString()}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm font-semibold text-gray-800">前5项小计</p>
                    <p className="text-base font-bold text-gray-900">¥{result.subtotal.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 合计 + 保存 */}
              <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-500">模具费合计（= 小计 ÷ 0.7）</p>
                    <p className="text-3xl font-extrabold text-blue-700">¥{result.total.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      模架 {result.moldFrame.spec}（{result.moldFrame.size}）· {result.materialParams.steel}钢 ¥{result.materialParams.steelPrice}/kg · 市场钢板 ¥{steelPrice}/kg
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {user ? (
                      <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? '保存中…' : saved ? '✓ 已保存' : '保存到我的报价'}
                      </Button>
                    ) : (
                      <Link href="/login">
                        <Button className="bg-blue-600 hover:bg-blue-700">登录后保存</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ============ 三材质对比 ============ */}
      {ok && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-1.5 h-4 bg-emerald-500 rounded" />
              三材质对比（同一产品参数）
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs text-gray-600">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2 text-left">项目</th>
                  {result.comparisons.map((c) => (
                    <th key={c.material} className="py-2 text-right">{c.material}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b"><td className="py-1.5">模具钢</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">{c.steel}（¥{c.steelPrice}/kg）</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">机台吨位</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">{c.tonnage}T</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">机时费率</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">¥{c.hourlyRate}/h</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">滑块/穴数</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">{c.sliderCount} / {c.cavityCount}</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">模架费</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">¥{c.frameFee.toLocaleString()}</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">滑块费</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">¥{c.sliderFee.toLocaleString()}</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">模芯钢</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">¥{c.coreSteel.toLocaleString()}</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">型腔加工</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">¥{c.cavityProcess.toLocaleString()}</td>)}</tr>
                <tr className="border-b"><td className="py-1.5">浇道费</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right">¥{c.runnerFee.toLocaleString()}</td>)}</tr>
                <tr className="border-b"><td className="py-1.5 font-medium">小计</td>{result.comparisons.map(c => <td key={c.material} className="py-1.5 text-right font-medium">¥{c.subtotal.toLocaleString()}</td>)}</tr>
                <tr>
                  <td className="py-2 font-bold text-gray-900">合计（÷0.7）</td>
                  {result.comparisons.map(c => (
                    <td key={c.material} className={`py-2 text-right font-bold ${c.material === material ? 'text-blue-700' : 'text-gray-900'}`}>
                      ¥{c.total.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      </div>
      </main>
    </div>
  );
}
