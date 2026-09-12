"use client";
import { useState } from "react";
import {
  Upload, FileImage, Bot, Edit3, Save, Send,
  ChevronDown, ChevronUp, X, HelpCircle, Sparkles,
  MousePointerClick, CheckCircle2, Info, AlertCircle,
  Keyboard,
} from "lucide-react";

interface GuideStep {
  icon: React.ReactNode;
  title: string;
  desc: string;
  detail?: string;
  color: string;
  tag?: string;
}

const STEPS: GuideStep[] = [
  {
    icon: <Upload className="w-5 h-5" />,
    title: "上传图纸（可选）",
    desc: "支持 PDF、PNG、JPG、STEP、DXF 等格式，也可上传 ZIP 压缩包批量识别",
    detail: "上传后系统自动判断文件类型并调用对应的解析服务，ZIP 文件会逐个解压识别。也可跳过此步直接手动填写参数。",
    color: "blue",
    tag: "AI 流程",
  },
  {
    icon: <FileImage className="w-5 h-5" />,
    title: "AI 智能识别（可选）",
    desc: "自动识别材质、尺寸、公差、表面处理等关键参数",
    detail: "仅上传图纸时触发。识别结果以产品卡片形式展示，置信度≥75% 的参数自动填入表单，低于 75% 的标记为待确认。",
    color: "violet",
    tag: "AI 流程",
  },
  {
    icon: <Keyboard className="w-5 h-5" />,
    title: "手动填写参数",
    desc: "没有图纸也可以直接填写，所有字段均可手动输入",
    detail: "选择产品类别（铝型材/冷轧板/不锈钢/压铸铝/塑胶/注塑等），填写材质、截面尺寸、长度、数量、表面处理、二次加工工序等。所有参数均可自由编辑，系统会实时校验合法性。",
    color: "amber",
    tag: "通用",
  },
  {
    icon: <Edit3 className="w-5 h-5" />,
    title: "核对与调整参数",
    desc: "检查识别结果或手动填写内容，确认无误后进入报价",
    detail: "AI 识别的参数可以手动修改，手动填写的参数也可以随时调整。如有多个产品（ZIP 批量识别），点击产品按钮切换编辑每个产品。",
    color: "teal",
    tag: "通用",
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "AI 辅助报价",
    desc: "系统根据参数自动计算材料成本、加工费用、模具费用",
    detail: "铝锭价格实时对接市场行情，加工费按工艺类型自动匹配，模具费根据截面周长和厚度智能选配。右侧实时显示费用明细。",
    color: "emerald",
    tag: "自动",
  },
  {
    icon: <Save className="w-5 h-5" />,
    title: "保存报价单",
    desc: "确认无误后保存，支持导出 PDF 分享给客户",
    detail: "报价单自动编号存档，可在「报价历史」中随时查看、修改和重新导出。报价单保存后不会自动发送给任何人，您可以随时修改。",
    color: "orange",
    tag: "完成",
  },
];

const TIPS = [
  {
    icon: <Keyboard className="w-4 h-4" />,
    text: "无需图纸也能报价：直接在表单中选择产品类别、填写尺寸和工艺参数，系统同样可以计算报价",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    icon: <Info className="w-4 h-4" />,
    text: "上传的图纸越清晰，AI 识别准确率越高。建议分辨率 ≥ 300 DPI",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    icon: <AlertCircle className="w-4 h-4" />,
    text: "DWG 文件无法直接解析，请先导出为 DXF 或 PDF 格式再上传",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    icon: <MousePointerClick className="w-4 h-4" />,
    text: "一个 ZIP 包可包含多个产品图纸，系统会自动逐个识别并分别生成报价卡片",
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  {
    icon: <CheckCircle2 className="w-4 h-4" />,
    text: "报价单保存后不会自动发送给任何人，您可以随时修改和重新导出",
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
];

const colorMap: Record<string, { bg: string; border: string; iconBg: string; iconText: string; stepBg: string; tagBg: string; tagText: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    iconBg: "bg-blue-100",    iconText: "text-blue-600",    stepBg: "bg-blue-600",    tagBg: "bg-blue-100",    tagText: "text-blue-600" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  iconBg: "bg-violet-100",  iconText: "text-violet-600",  stepBg: "bg-violet-600",  tagBg: "bg-violet-100",  tagText: "text-violet-600" },
  amber:   { bg: "bg-amber-50",   border: "border-amber-200",   iconBg: "bg-amber-100",   iconText: "text-amber-600",   stepBg: "bg-amber-600",   tagBg: "bg-amber-100",   tagText: "text-amber-600" },
  teal:    { bg: "bg-teal-50",    border: "border-teal-200",    iconBg: "bg-teal-100",    iconText: "text-teal-600",    stepBg: "bg-teal-600",    tagBg: "bg-teal-100",    tagText: "text-teal-600" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", iconBg: "bg-emerald-100", iconText: "text-emerald-600", stepBg: "bg-emerald-600", tagBg: "bg-emerald-100", tagText: "text-emerald-600" },
  orange:  { bg: "bg-orange-50",  border: "border-orange-200",  iconBg: "bg-orange-100",  iconText: "text-orange-600",  stepBg: "bg-orange-600",  tagBg: "bg-orange-100",  tagText: "text-orange-600" },
};

export default function OperationGuide() {
  const [open, setOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  return (
    <div className="w-full">
      {/* 折叠按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200
          hover:from-blue-100 hover:to-indigo-100 transition-all shadow-sm"
      >
        <HelpCircle className="w-4 h-4" />
        <span>操作指南</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* 展开内容 */}
      {open && (
        <div className="mt-3 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 顶部横幅 */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-base">AI 智能报价 — 操作指南</h3>
                <p className="text-blue-200 text-xs mt-0.5">支持 AI 图纸识别和手动填写两种报价方式</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* 两种模式说明 */}
          <div className="px-4 pt-3 pb-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-center">
                <Bot className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-blue-700">AI 图纸识别</p>
                <p className="text-[10px] text-blue-500 mt-0.5">上传图纸，AI 自动填参</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-center">
                <Keyboard className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-amber-700">手动填写参数</p>
                <p className="text-[10px] text-amber-500 mt-0.5">无图纸也能快速报价</p>
              </div>
            </div>
          </div>

          {/* 步骤列表 */}
          <div className="p-4 space-y-2.5">
            {STEPS.map((step, idx) => {
              const c = colorMap[step.color] ?? colorMap.blue;
              const isExpanded = expandedStep === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border ${c.border} overflow-hidden transition-all ${
                    isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"
                  }`}
                >
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : idx)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isExpanded ? c.bg : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full ${c.stepBg} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                      {idx + 1}
                    </span>
                    <div className={`w-8 h-8 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <span className={c.iconText}>{step.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 text-sm">{step.title}</h4>
                        {step.tag && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.tagBg} ${c.tagText}`}>
                            {step.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{step.desc}</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {isExpanded && step.detail && (
                    <div className="px-4 pb-3 pt-1 bg-white border-t border-gray-100">
                      <p className="text-xs text-gray-600 leading-relaxed">{step.detail}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 使用提示 */}
          <div className="px-4 pb-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> 使用提示
            </h4>
            <div className="space-y-1.5">
              {TIPS.map((tip, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 px-3 py-2 rounded-md border text-xs ${tip.color}`}
                >
                  <span className="flex-shrink-0 mt-0.5">{tip.icon}</span>
                  <span>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
