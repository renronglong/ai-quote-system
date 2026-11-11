'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Share2,
  Copy,
  Check,
  X,
  MessageCircle,
  MessageSquare,
  Link2,
  Sparkles,
  Zap,
} from 'lucide-react';

// 统一的分享文案（与 src/app/layout.tsx 的 openGraph 保持一致，不含公司名称）
export const SHARE_TITLE = 'AI 智能报价平台';
export const SHARE_DESC =
  '图纸智能识别 + 即时报价，覆盖铝型材、钣金、压铸、注塑、钢材等加工类型，助您快速核算成本。';
export const SHARE_URL = 'https://www.gyparts.cn/';
export const SHARE_TEXT = `${SHARE_TITLE}\n${SHARE_DESC}\n在线体验：${SHARE_URL}`;

type Variant = 'nav' | 'mobile' | 'header' | 'sheet';

const TRIGGER_CLASS: Record<Variant, string> = {
  // 左侧栏桌面项（与 QuoteSidebar 的 NAV 项同款）
  nav: 'group flex items-center gap-2.5 w-full text-left rounded-lg px-3 py-2 text-sm transition-colors border-l-2 border-transparent text-slate-700 hover:bg-white/60 hover:text-slate-900',
  // 左侧栏移动端横向条
  mobile:
    'shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-700 border border-white/60 hover:bg-white/60 transition-colors',
  // 顶部导航（与 TopNavLinks 的链接同款）
  header:
    'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors whitespace-nowrap',
  // 移动端汉堡抽屉
  sheet:
    'flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors',
};

const ICON_CLASS: Record<Variant, string> = {
  nav: 'w-4 h-4 shrink-0 text-slate-500 group-hover:text-slate-700',
  mobile: 'w-4 h-4 shrink-0',
  header: 'w-4 h-4 shrink-0',
  sheet: 'w-5 h-5 shrink-0',
};

export default function ShareButton({
  variant = 'nav',
  label = '分享',
  className = '',
}: {
  variant?: Variant;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'' | 'text' | 'url'>('');
  const [canNative, setCanNative] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setCanNative(
      typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function'
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // 打开时锁定滚动、支持 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const copy = async (text: string, kind: 'text' | 'url') => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // 微信内置浏览器等可能没有 clipboard API，退回 execCommand
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(kind);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(''), 2200);
    } catch {
      // 最后兜底：让用户手动选中预览区
      const box = document.getElementById('share-text-box') as HTMLElement | null;
      if (box) {
        const range = document.createRange();
        range.selectNodeContents(box);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  const doNative = async () => {
    try {
      await (navigator as any).share({
        title: SHARE_TITLE,
        text: SHARE_DESC,
        url: SHARE_URL,
      });
      setOpen(false);
    } catch {
      // 用户取消或环境不支持，忽略
    }
  };

  const tileClass =
    'flex flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-1 py-3 transition-colors hover:bg-gray-50 active:scale-[0.98]';

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-dialog-title"
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 头部 */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3
                  id="share-dialog-title"
                  className="text-base font-semibold text-gray-900 flex items-center gap-2.5"
                >
                  <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm shrink-0">
                    <Share2 className="w-4 h-4 text-white" />
                  </span>
                  分享 AI 智能报价平台
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="关闭"
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* 文案预览：每行带图标 */}
                <div
                  id="share-text-box"
                  className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-3 space-y-2 select-text"
                >
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    </span>
                    <span className="text-sm font-semibold text-gray-900">{SHARE_TITLE}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-3.5 h-3.5 text-blue-500" />
                    </span>
                    <span className="text-sm text-slate-600 leading-relaxed">{SHARE_DESC}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center shrink-0 mt-0.5">
                      <Link2 className="w-3.5 h-3.5 text-slate-500" />
                    </span>
                    <span className="text-sm text-slate-600 break-all">{SHARE_URL}</span>
                  </div>
                </div>

                {/* 图标瓷砖 */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => copy(SHARE_TEXT, 'text')}
                    className={tileClass}
                    aria-label="复制文案，到微信粘贴发送"
                  >
                    <span className="w-10 h-10 rounded-xl bg-[#07C160] flex items-center justify-center shadow-sm">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </span>
                    <span className="text-xs text-gray-600">微信</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copy(SHARE_TEXT, 'text')}
                    className={tileClass}
                    aria-label="复制文案，到 QQ 粘贴发送"
                  >
                    <span className="w-10 h-10 rounded-xl bg-[#12B7F5] flex items-center justify-center shadow-sm">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </span>
                    <span className="text-xs text-gray-600">QQ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copy(SHARE_URL, 'url')}
                    className={tileClass}
                    aria-label="复制链接"
                  >
                    <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shadow-sm">
                      <Link2 className="w-5 h-5 text-slate-600" />
                    </span>
                    <span className="text-xs text-gray-600">复制链接</span>
                  </button>

                  {canNative ? (
                    <button
                      type="button"
                      onClick={doNative}
                      className={tileClass}
                      aria-label="系统分享"
                    >
                      <span className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-sm">
                        <Share2 className="w-5 h-5 text-white" />
                      </span>
                      <span className="text-xs text-gray-600">系统分享</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => copy(SHARE_TEXT, 'text')}
                      className={tileClass}
                      aria-label="复制文案和链接"
                    >
                      <span className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                        <Copy className="w-5 h-5 text-white" />
                      </span>
                      <span className="text-xs text-gray-600">复制文案</span>
                    </button>
                  )}
                </div>

                {/* 反馈 / 提示 */}
                <div className="min-h-[18px] text-center">
                  {copied ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <Check className="w-3.5 h-3.5" />
                      {copied === 'url' ? '链接已复制' : '文案已复制，去微信 / QQ 粘贴发送'}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      点微信 / QQ 会复制文案，到对应 App 粘贴即可；只发链接也会自动带标题和简介。
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${TRIGGER_CLASS[variant]} ${className}`}
        title="分享给同行 / 复制链接和简介"
      >
        <Share2 className={ICON_CLASS[variant]} />
        <span className="truncate">{label}</span>
      </button>
      {modal}
    </>
  );
}
