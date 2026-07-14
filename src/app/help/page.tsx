"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  KeyRound,
  Package,
  TrendingUp,
  History,
  Box,
  HelpCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  Shield,
  FileText,
  Upload,
  MessageSquare,
  Download,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Home,
  Search,
  Phone,
  MapPin,
  Image,
  MousePointerClick,
  LogIn,
  FileOutput,
  Eye,
  Plus,
  Edit,
  Trash2,
  BarChart3,
  Calendar,
  Settings2,
} from "lucide-react";

/* ─────────────────────────────────────────────
   截图占位组件 — 后续替换为真实截图
   ───────────────────────────────────────────── */
function ScreenshotPlaceholder({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="my-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 flex flex-col items-center justify-center py-8 px-4 text-center">
      <Image className="w-8 h-8 text-gray-300 mb-2" />
      <span className="text-xs font-medium text-gray-400">{label}</span>
      {hint && <span className="text-xs text-gray-300 mt-1">{hint}</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   手风琴区块组件
   ───────────────────────────────────────────── */
function AccordionSection({
  icon,
  title,
  subtitle,
  accent,
  defaultOpen,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  accent: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const accentMap: Record<string, { bg: string; border: string; iconBg: string; iconText: string }> = {
    blue:    { bg: "bg-blue-50",    border: "border-blue-100",   iconBg: "bg-blue-100",    iconText: "text-blue-600" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100", iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
    violet:  { bg: "bg-violet-50",  border: "border-violet-100",  iconBg: "bg-violet-100",  iconText: "text-violet-600" },
    orange:  { bg: "bg-orange-50",  border: "border-orange-100",  iconBg: "bg-orange-100",  iconText: "text-orange-600" },
    amber:   { bg: "bg-amber-50",   border: "border-amber-100",   iconBg: "bg-amber-100",   iconText: "text-amber-600" },
    slate:   { bg: "bg-slate-50",   border: "border-slate-200",   iconBg: "bg-slate-100",   iconText: "text-slate-600" },
    teal:    { bg: "bg-teal-50",    border: "border-teal-100",    iconBg: "bg-teal-100",    iconText: "text-teal-600" },
  };
  const c = accentMap[accent] ?? accentMap.blue;

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden transition-shadow ${open ? "shadow-md" : "shadow-sm hover:shadow-md"}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${open ? c.bg : "bg-white hover:bg-gray-50"}`}
      >
        <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
          <span className={c.iconText}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-2 bg-white border-t border-gray-100">{children}</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   教程步骤组件
   ───────────────────────────────────────────── */
function TutorialStep({
  step,
  title,
  children,
  color = "blue",
}: {
  step: number;
  title: string;
  children: React.ReactNode;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-600",
    violet: "bg-violet-600",
    emerald: "bg-emerald-600",
    orange: "bg-orange-600",
    amber: "bg-amber-600",
    teal: "bg-teal-600",
  };
  const bg = colorMap[color] ?? "bg-blue-600";

  return (
    <div className="relative pl-10 pb-4">
      {/* 竖线 */}
      <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-gray-200" />
      {/* 步骤圆圈 */}
      <div className={`absolute left-0 top-0 w-8 h-8 ${bg} rounded-full text-white text-xs font-bold flex items-center justify-center z-10`}>
        {step}
      </div>
      <div>
        <h5 className="text-sm font-semibold text-gray-800 mb-1">{title}</h5>
        <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   提示框组件
   ───────────────────────────────────────────── */
function TipBox({ type = "tip", children }: { type?: "tip" | "warn" | "info"; children: React.ReactNode }) {
  const styles = {
    tip:  { bg: "bg-green-50 border-green-200", icon: "💡", label: "小贴士" },
    warn: { bg: "bg-amber-50 border-amber-200", icon: "⚠️", label: "注意" },
    info: { bg: "bg-blue-50 border-blue-200",   icon: "ℹ️", label: "说明" },
  };
  const s = styles[type];
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border ${s.bg} my-3`}>
      <span className="text-base flex-shrink-0 mt-0.5">{s.icon}</span>
      <div className="text-xs text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAQ 条目
   ───────────────────────────────────────────── */
function FAQItem({ question, answer }: { question: string; answer: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <HelpCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          {question}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <div className="text-sm text-gray-600 leading-relaxed">{answer}</div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   文件格式标签
   ───────────────────────────────────────────── */
function FileTag({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
      <div>
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="text-xs text-gray-500 ml-1.5">{desc}</span>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════
   主页面
   ═════════════════════════════════════════════ */
export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── 顶部 Hero ── */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <HelpCircle className="w-6 h-6" />
            </div>
            <span className="text-blue-200 text-sm font-medium tracking-wide">HELP CENTER</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">使用帮助 / 常见问题</h1>
          <p className="text-blue-100 text-base sm:text-lg max-w-2xl">
            欢迎使用工品报价平台！下面有详细的使用教程，手把手教你怎么用。遇到问题直接看 FAQ 或联系我们。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/">
              <Button variant="secondary" size="sm" className="bg-white/15 hover:bg-white/25 text-white border-white/20">
                <Home className="w-4 h-4 mr-1.5" /> 返回首页
              </Button>
            </Link>
            <a href="#contact">
              <Button variant="secondary" size="sm" className="bg-white/15 hover:bg-white/25 text-white border-white/20">
                <Mail className="w-4 h-4 mr-1.5" /> 联系我们
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* ── 目录导航 ── */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        <Card className="border-gray-200 shadow-md">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {[
                { href: "#quick-start", label: "快速开始", icon: <Rocket className="w-3.5 h-3.5" /> },
                { href: "#ai-quote", label: "AI 智能报价", icon: <Sparkles className="w-3.5 h-3.5" /> },
                { href: "#products", label: "产品库", icon: <Package className="w-3.5 h-3.5" /> },
                { href: "#market", label: "铝价行情", icon: <TrendingUp className="w-3.5 h-3.5" /> },
                { href: "#history", label: "报价历史", icon: <History className="w-3.5 h-3.5" /> },
                { href: "#inventory", label: "库存管理", icon: <Box className="w-3.5 h-3.5" /> },
                { href: "#faq", label: "常见问题", icon: <HelpCircle className="w-3.5 h-3.5" /> },
                { href: "#contact", label: "联系我们", icon: <Mail className="w-3.5 h-3.5" /> },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════ 内容区域 ══════ */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">

        {/* ════════════════════════════════════════
            1. 快速开始（注册 / 登录 / 忘记密码）
            ════════════════════════════════════════ */}
        <div id="quick-start">
          <AccordionSection
            icon={<Rocket className="w-5 h-5" />}
            title="快速开始 — 注册、登录与密码找回"
            subtitle="第一次用？从这里开始"
            accent="blue"
            defaultOpen={true}
          >
            {/* ── 1.1 注册账号 ── */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <LogIn className="w-4 h-4 text-blue-500" /> 一、注册账号
              </h4>

              <TutorialStep step={1} title="打开注册页面" color="blue">
                在浏览器输入 <strong>gyparts.cn</strong>，在首页右上角点击 <strong>"注册"</strong> 按钮，进入注册页面。
              </TutorialStep>

              <ScreenshotPlaceholder label="截图：首页右上角「注册」按钮位置" hint="建议截取注册按钮区域" />

              <TutorialStep step={2} title="输入手机号" color="blue">
                在手机号输入框中，填写您正在使用的手机号码。系统会向该号码发送短信验证码。
              </TutorialStep>

              <TutorialStep step={3} title="获取并输入验证码" color="blue">
                点击 <strong>"获取验证码"</strong> 按钮，等待几秒后会收到一条短信。将短信中的数字验证码填入输入框。
              </TutorialStep>

              <TipBox type="tip">
                如果 60 秒内没收到验证码，可以点击"重新发送"。也请检查手机是否拦截了短信。
              </TipBox>

              <TutorialStep step={4} title="设置登录密码" color="blue">
                输入你想设置的密码。建议包含字母和数字，长度不少于 8 位，这样更安全。
              </TutorialStep>

              <TutorialStep step={5} title="点击「注册」完成" color="blue">
                确认信息无误后，点击 <strong>"注册"</strong> 按钮。看到"注册成功"提示后，就可以去登录了！
              </TutorialStep>

              <ScreenshotPlaceholder label="截图：注册页面完整界面" hint="展示手机号、验证码、密码三个输入框" />
            </div>

            {/* ── 1.2 登录 ── */}
            <div className="border-t border-gray-100 pt-4 mb-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-500" /> 二、登录
              </h4>

              <TutorialStep step={1} title="打开登录页面" color="emerald">
                在首页右上角点击 <strong>"登录"</strong> 按钮。
              </TutorialStep>

              <TutorialStep step={2} title="输入手机号和密码" color="emerald">
                填入注册时使用的手机号，以及你设置的密码。
              </TutorialStep>

              <TutorialStep step={3} title="勾选「记住密码」（可选）" color="emerald">
                如果是自己的电脑，可以勾选 <strong>"记住密码"</strong>，下次打开就不用再输密码了。
              </TutorialStep>

              <TutorialStep step={4} title="点击「登录」" color="emerald">
                点击 <strong>"登录"</strong> 按钮，验证成功后自动跳转到首页。
              </TutorialStep>

              <ScreenshotPlaceholder label="截图：登录页面完整界面" hint="展示手机号、密码输入框和「记住密码」勾选项" />
            </div>

            {/* ── 1.3 忘记密码 ── */}
            <div className="border-t border-gray-100 pt-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-500" /> 三、忘记密码怎么办？
              </h4>

              <TutorialStep step={1} title="点击「忘记密码」" color="orange">
                在登录页面，点击密码输入框下方的 <strong>"忘记密码"</strong> 链接。
              </TutorialStep>

              <TutorialStep step={2} title="输入手机号获取验证码" color="orange">
                填入注册时的手机号，点击获取验证码。输入收到的验证码。
              </TutorialStep>

              <TutorialStep step={3} title="设置新密码" color="orange">
                验证码正确后，输入你的新密码，再次确认后点击 <strong>"确认重置"</strong> 即可完成。
              </TutorialStep>

              <TipBox type="info">
                重置密码后，之前的登录状态会失效，需要重新登录。
              </TipBox>
            </div>
          </AccordionSection>
        </div>

        {/* ════════════════════════════════════════
            2. AI 智能报价（重点）
            ════════════════════════════════════════ */}
        <div id="ai-quote">
          <AccordionSection
            icon={<Sparkles className="w-5 h-5" />}
            title="AI 智能报价 — 核心功能教程"
            subtitle="上传图纸 → AI 识别 → 秒级报价 → 导出报价单"
            accent="violet"
            defaultOpen={true}
          >
            <div className="mb-2 p-3 bg-violet-50 border border-violet-200 rounded-lg">
              <p className="text-sm text-violet-800 font-medium">
                🚀 AI 报价是平台最核心的功能——只需上传图纸或用文字描述需求，AI 几秒钟就能算出价格！
              </p>
            </div>

            {/* ── 完整报价流程 ── */}
            <h4 className="text-sm font-semibold text-gray-800 mb-3 mt-4 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-violet-500" /> 完整报价流程（共 7 步）
            </h4>

            <TutorialStep step={1} title="打开网站并登录" color="violet">
              在浏览器打开 <strong>gyparts.cn</strong>，如果还没有账号，先按上面的步骤注册一个。登录后才能使用报价功能。
            </TutorialStep>

            <TutorialStep step={2} title="进入报价页面" color="violet">
              登录后，在首页找到并点击 <strong>"开始报价"</strong> 按钮，或者在左侧导航栏点击相关入口，进入 AI 报价界面。
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：首页「开始报价」按钮位置" hint="展示首页报价入口" />

            <TutorialStep step={3} title="上传图纸 或 文字描述需求" color="violet">
              <p>你有两种方式开始报价：</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">A</span>
                  <span><strong>上传图纸：</strong>直接把图纸文件拖拽到报价面板，或点击上传区域选择文件。</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">B</span>
                  <span><strong>文字描述：</strong>如果暂时没有图纸，也可以直接在对话框里打字，告诉 AI 你要做什么产品、什么材质、大概尺寸等。</span>
                </div>
              </div>
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：报价界面上传区域" hint="展示拖拽上传区域和对话输入框" />

            <TutorialStep step={4} title="AI 自动识别工艺参数" color="violet">
              文件上传后，AI 会自动分析图纸，识别出以下信息：
              <div className="mt-2 ml-1 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> 材质（如 6063 铝合金、ADC12 等）
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> 尺寸规格（长、宽、高、壁厚等）
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> 表面处理（阳极氧化、喷涂、电泳等）
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span> 加工方式和数量
                </div>
              </div>
            </TutorialStep>

            <TutorialStep step={5} title="确认或修改参数" color="violet">
              AI 识别完后，会把它"看懂"的参数展示给你。请仔细核对：
              <div className="mt-2 ml-1 space-y-1">
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <ArrowRight className="w-3 h-3 mt-0.5 text-green-500 flex-shrink-0" />
                  如果参数正确，直接告诉 AI <strong>"确认"</strong> 或 <strong>"没问题"</strong>，继续下一步
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <ArrowRight className="w-3 h-3 mt-0.5 text-orange-500 flex-shrink-0" />
                  如果有错误，直接在对话框里说，比如：<strong>"材质改成 6061"</strong>、<strong>"表面处理要阳极氧化"</strong>、<strong>"数量改为 500 件"</strong>
                </div>
              </div>
              <p className="mt-2">AI 支持<strong>多轮对话修改</strong>，你可以反复调整，直到所有参数都满意为止。</p>
            </TutorialStep>

            <TipBox type="tip">
              修改参数时不需要重新上传图纸，直接在对话框里打字修改就行。比如："壁厚改成 2mm"、"帮我加上电镀"。
            </TipBox>

            <ScreenshotPlaceholder label="截图：AI 对话界面，展示参数确认和修改的对话示例" hint="展示 AI 识别出的参数列表，以及用户修改参数的对话" />

            <TutorialStep step={6} title="生成报价单" color="violet">
              参数确认无误后，AI 会根据当前铝价行情和你的工艺要求，自动计算出价格，生成一份详细的报价单。报价单包含：
              <div className="mt-2 ml-1 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 产品规格和材质
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 各工序加工费用明细
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 材料费用（参考当日铝价）
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 总价和单价
                </div>
              </div>
            </TutorialStep>

            <TutorialStep step={7} title="导出报价单 PDF" color="violet">
              报价单生成后，点击 <strong>"导出 PDF"</strong> 或 <strong>"下载报价单"</strong> 按钮，即可保存到本地。你可以打印出来、发给客户、或存档备查。
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：报价单结果页面和导出按钮" hint="展示报价单明细和 PDF 下载按钮" />

            {/* ── 支持的文件格式 ── */}
            <div className="border-t border-gray-100 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Upload className="w-4 h-4 text-violet-500" /> 支持上传的文件格式
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <FileTag label="PDF" desc="工程图纸" />
                <FileTag label="PNG / JPG" desc="图片格式的图纸" />
                <FileTag label="STEP / STP" desc="3D 模型文件" />
                <FileTag label="DXF / DWG" desc="CAD 图纸文件" />
              </div>

              <TipBox type="tip">
                <strong>上传建议：</strong>图纸越清晰，AI 识别越准确。建议从 CAD 软件直接导出的原始文件，比拍照或截图效果更好。STEP/STP 格式的 3D 模型识别准确率最高。
              </TipBox>
            </div>

            {/* ── 常见问题 ── */}
            <div className="border-t border-gray-100 pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">💬 报价时常见问题</h4>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Q: AI 报价不准怎么办？</p>
                  <p className="text-xs text-gray-600">AI 报价基于图纸和参数计算，如果结果偏差大，通常是参数识别有误。你可以在对话中手动修改参数，比如纠正材质、尺寸、数量等，修改后报价会自动更新。</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Q: 没有图纸也能报价吗？</p>
                  <p className="text-xs text-gray-600">可以！直接在对话框里描述你的需求，比如："我要做一批 6063 铝合金方管，40x40mm，壁厚 1.5mm，长度 3 米，表面阳极氧化，500 根"。AI 会根据你的描述给出报价。</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-1">Q: 报价包含铝价吗？</p>
                  <p className="text-xs text-gray-600">包含。AI 报价会参考最新的南海铝锭价（实时同步），所以报价里的材料费用是根据当天铝价计算的。如果铝价波动较大，建议重新报价获取最新价格。</p>
                </div>
              </div>
            </div>
          </AccordionSection>
        </div>

        {/* ════════════════════════════════════════
            3. 产品库
            ════════════════════════════════════════ */}
        <div id="products">
          <AccordionSection
            icon={<Package className="w-5 h-5" />}
            title="产品库 — 管理你的产品数据"
            subtitle="查看截面图、规格参数，建立产品目录"
            accent="emerald"
          >
            <p className="text-sm text-gray-600 mb-4">
              产品库帮你集中管理所有产品的截面图和规格数据。建立好产品目录后，报价时可以直接调用，省去重复输入的麻烦。
            </p>

            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-500" /> 操作步骤
            </h4>

            <TutorialStep step={1} title="进入产品管理页面" color="emerald">
              在左侧导航栏找到 <strong>"产品管理"</strong>（或直接访问 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">gyparts.cn/products</code>）。
            </TutorialStep>

            <TutorialStep step={2} title="查看已有产品" color="emerald">
              进入后可以看到产品列表，每个产品会显示<strong>截面图</strong>和<strong>规格参数</strong>（如材质、尺寸、重量等）。点击产品卡片可以查看详情。
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：产品列表页面" hint="展示产品卡片、截面图、规格参数" />

            <TutorialStep step={3} title="添加新产品" color="emerald">
              点击 <strong>"新增产品"</strong> 按钮，填写产品名称、上传截面图、填写规格参数（材质、尺寸、表面处理等），填好后保存即可。
            </TutorialStep>

            <TutorialStep step={4} title="编辑或删除产品" color="emerald">
              在产品列表中，每个产品右侧有操作按钮：
              <div className="mt-1 ml-1 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Edit className="w-3 h-3 text-blue-500" /> 点击 <strong>"编辑"</strong> 修改产品信息
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Trash2 className="w-3 h-3 text-red-500" /> 点击 <strong>"删除"</strong> 移除不需要的产品
                </div>
              </div>
            </TutorialStep>

            <TipBox type="tip">
              建议把常用的产品都添加到产品库，这样报价时可以直接选用，不用每次都重新填参数。
            </TipBox>
          </AccordionSection>
        </div>

        {/* ════════════════════════════════════════
            4. 铝价行情
            ════════════════════════════════════════ */}
        <div id="market">
          <AccordionSection
            icon={<TrendingUp className="w-5 h-5" />}
            title="铝价行情 — 实时查看铝锭价格"
            subtitle="南海铝锭价 · 长江铝锭 · 铝型材 · ADC12"
            accent="orange"
          >
            <p className="text-sm text-gray-600 mb-4">
              做铝型材生意，铝价每天都在变。平台帮你实时同步最新铝价，报价时自动参考，不用自己去查了。
            </p>

            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" /> 操作步骤
            </h4>

            <TutorialStep step={1} title="在首页查看铝价" color="orange">
              登录后，首页顶部导航栏会实时显示 <strong>南海铝锭价</strong>，打开网站就能看到，不用点进任何页面。
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：首页导航栏铝价显示位置" hint="展示顶部导航栏实时铝价" />

            <TutorialStep step={2} title="进入铝价行情页面" color="orange">
              点击导航栏中的 <strong>"铝价行情"</strong>，或在地址栏输入 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">gyparts.cn/market</code>。
            </TutorialStep>

            <TutorialStep step={3} title="查看详细铝价数据" color="orange">
              铝价行情页面展示以下数据：
              <div className="mt-2 ml-1 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> <strong>南海铝锭价</strong> — 含票价、无票价
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> <strong>长江铝锭价</strong> — 全国参考价
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span> <strong>铝型材价格</strong> — 电泳铝、喷涂铝、磨砂铝等
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> <strong>ADC12</strong> — 压铸铝合金价格
                </div>
              </div>
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：铝价行情页面完整界面" hint="展示各类铝价数据表格和涨跌趋势" />

            <TipBox type="info">
              铝价数据每日更新，与市场行情同步。报价时系统会自动使用最新铝价，无需手动修改。
            </TipBox>
          </AccordionSection>
        </div>

        {/* ════════════════════════════════════════
            5. 报价历史
            ════════════════════════════════════════ */}
        <div id="history">
          <AccordionSection
            icon={<History className="w-5 h-5" />}
            title="报价历史 — 找回之前的报价单"
            subtitle="搜索、筛选、重新下载报价单"
            accent="amber"
          >
            <p className="text-sm text-gray-600 mb-4">
              每次 AI 生成的报价单都会自动保存，不会丢失。随时可以在这里找到、查看、重新下载。
            </p>

            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-500" /> 操作步骤
            </h4>

            <TutorialStep step={1} title="进入报价历史页面" color="amber">
              在左侧导航栏点击 <strong>"报价历史"</strong>，或访问 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">gyparts.cn/history</code>。
            </TutorialStep>

            <TutorialStep step={2} title="查看报价列表" color="amber">
              页面会列出你所有的历史报价记录，按时间从新到旧排列。每条记录显示报价时间、产品名称、报价金额等信息。
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：报价历史列表页面" hint="展示报价记录列表，含时间、产品、金额" />

            <TutorialStep step={3} title="搜索报价记录" color="amber">
              在页面顶部的搜索框中，输入产品名称、材质等关键词，按回车即可筛选出匹配的报价。
            </TutorialStep>

            <TutorialStep step={4} title="查看和下载报价单" color="amber">
              点击某条报价记录进入详情页，可以查看完整的报价明细。点击 <strong>"导出 PDF"</strong> 可以重新下载报价单。
            </TutorialStep>

            <TutorialStep step={5} title="按时间筛选" color="amber">
              如果报价记录比较多，可以使用时间筛选功能，选择某个时间段内的报价记录来查看。
            </TutorialStep>

            <TipBox type="tip">
              建议定期把重要报价单导出 PDF 保存到本地，作为业务记录留存。
            </TipBox>
          </AccordionSection>
        </div>

        {/* ════════════════════════════════════════
            6. 库存管理
            ════════════════════════════════════════ */}
        <div id="inventory">
          <AccordionSection
            icon={<Box className="w-5 h-5" />}
            title="库存管理 — 管理产品库存数据"
            subtitle="入库、出库、查询库存"
            accent="teal"
          >
            <p className="text-sm text-gray-600 mb-4">
              库存管理帮你记录每个产品的库存数量，方便随时掌握存货情况。
            </p>

            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-teal-500" /> 操作步骤
            </h4>

            <TutorialStep step={1} title="进入库存管理页面" color="teal">
              在左侧导航栏点击 <strong>"库存管理"</strong>，或访问 <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">gyparts.cn/inventory</code>。
            </TutorialStep>

            <TutorialStep step={2} title="查看当前库存" color="teal">
              进入后可以看到所有产品的库存列表，包括产品名称、当前库存数量、单位等信息。
            </TutorialStep>

            <ScreenshotPlaceholder label="截图：库存列表页面" hint="展示产品库存数据表格" />

            <TutorialStep step={3} title="入库操作" color="teal">
              找到需要入库的产品，点击 <strong>"入库"</strong> 按钮，输入入库数量，确认后库存数量会自动增加。
            </TutorialStep>

            <TutorialStep step={4} title="出库操作" color="teal">
              找到需要出库的产品，点击 <strong>"出库"</strong> 按钮，输入出库数量，确认后库存数量会自动减少。
            </TutorialStep>

            <TutorialStep step={5} title="搜索和筛选" color="teal">
              在产品较多时，可以使用搜索框输入产品名称快速找到对应库存记录。
            </TutorialStep>

            <TipBox type="info">
              库存数据只对你自己的账号可见，其他用户看不到你的库存信息。
            </TipBox>
          </AccordionSection>
        </div>

        {/* ════════════════════════════════════════
            7. 常见问题 FAQ
            ════════════════════════════════════════ */}
        <div id="faq" className="pt-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">常见问题 FAQ</h2>
              <p className="text-xs text-gray-500">点击问题展开查看详细解答</p>
            </div>
          </div>
          <div className="space-y-2">
            <FAQItem
              question="AI 报价准不准？能不能直接用？"
              answer={
                <div>
                  <p>AI 报价会根据你上传的图纸和参数，结合当前铝价行情来计算。在参数正确的前提下，报价准确度较高。</p>
                  <p className="mt-2 text-orange-600 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <strong>建议：</strong>AI 报价可以作为快速参考，正式报价和签约前，建议再跟我们的业务人员确认一下。
                  </p>
                </div>
              }
            />
            <FAQItem
              question="支持哪些文件格式上传？"
              answer={
                <div>
                  <p>目前支持以下 4 类文件格式：</p>
                  <ul className="mt-2 space-y-1 ml-4 list-disc text-gray-600">
                    <li><strong>PDF</strong> — 工程图纸（从 CAD 导出的 PDF 效果最好）</li>
                    <li><strong>PNG / JPG</strong> — 图片格式的图纸照片或截图</li>
                    <li><strong>STEP / STP</strong> — 3D 模型文件（识别准确率最高）</li>
                    <li><strong>DXF / DWG</strong> — CAD 图纸文件</li>
                  </ul>
                </div>
              }
            />
            <FAQItem
              question="怎么联系人工报价？"
              answer={
                <div>
                  <p>如果你觉得 AI 报价不满足需求，或者产品比较复杂，可以联系我们安排人工报价：</p>
                  <ul className="mt-2 space-y-1 ml-4 list-disc text-gray-600">
                    <li>拨打服务热线：<strong>18929979760</strong></li>
                    <li>添加微信：<strong>18929979760</strong></li>
                    <li>在「联系我们」页面提交在线留言</li>
                  </ul>
                  <p className="mt-2">我们承诺 24 小时内回复，48 小时内提供人工报价方案。</p>
                </div>
              }
            />
            <FAQItem
              question="我的图纸和数据安全吗？"
              answer={
                <div>
                  <p>数据安全是我们的底线，请放心使用：</p>
                  <ul className="mt-2 space-y-1 ml-4 list-disc text-gray-600">
                    <li><Shield className="w-3.5 h-3.5 inline text-green-500 mr-1" /> 所有数据传输都经过 HTTPS 加密，不会被中间截取</li>
                    <li><Shield className="w-3.5 h-3.5 inline text-green-500 mr-1" /> 你上传的图纸文件仅用于报价分析，不会泄露给第三方</li>
                    <li><Shield className="w-3.5 h-3.5 inline text-green-500 mr-1" /> 不同用户的数据完全隔离，别人看不到你的东西</li>
                    <li><Shield className="w-3.5 h-3.5 inline text-green-500 mr-1" /> 系统定期备份，不用担心数据丢失</li>
                  </ul>
                </div>
              }
            />
            <FAQItem
              question="报价单能重新下载吗？"
              answer={
                <p>可以！进入 <strong>"报价历史"</strong> 页面（gyparts.cn/history），找到你要的报价记录，点进去就能看到详情并重新导出 PDF 报价单。</p>
              }
            />
            <FAQItem
              question="铝价多久更新一次？"
              answer={
                <p>铝价数据<strong>每天更新</strong>，跟随市场行情。首页导航栏显示的是最新的南海铝锭价。详细铝价数据请进入"铝价行情"页面查看。AI 报价时会自动使用当天最新的铝价。</p>
              }
            />
            <FAQItem
              question="可以在手机上使用吗？"
              answer={
                <p>可以！网站做了<strong>移动端适配</strong>，手机浏览器打开 gyparts.cn 就能正常使用。上传图纸、查看报价、管理库存都可以在手机上操作。建议把网站添加到手机书签，方便下次快速打开。</p>
              }
            />
          </div>
        </div>

        {/* ════════════════════════════════════════
            8. 联系我们
            ════════════════════════════════════════ */}
        <div id="contact" className="pt-2">
          <Card className="border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">联系我们</h2>
                  <p className="text-xs text-blue-200">有问题随时找我们，我们在线等你</p>
                </div>
              </div>
            </div>
            <CardContent className="pt-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Phone className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 mb-1">服务热线</p>
                  <p className="text-sm font-semibold text-gray-800">18929979760</p>
                  <p className="text-xs text-gray-400 mt-1">周一至周五 8:30-18:00</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 mb-1">微信咨询</p>
                  <p className="text-sm font-semibold text-gray-800">18929979760</p>
                  <p className="text-xs text-gray-400 mt-1">扫码或搜索添加</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <MapPin className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 mb-1">公司地址</p>
                  <p className="text-xs font-medium text-gray-800">江西省萍乡市上栗县</p>
                  <p className="text-xs text-gray-400 mt-1">长平乡佛溪村</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <Link href="/contact">
                  <Button className="mt-2">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    在线留言
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 底部 ── */}
        <div className="text-center pt-6 pb-8">
          <p className="text-xs text-gray-400">
            工品报价 · AI 智能报价平台 &nbsp;|&nbsp; <Link href="/" className="hover:text-blue-500">gyparts.cn</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
