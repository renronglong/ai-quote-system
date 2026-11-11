'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Copy, Check, X } from 'lucide-react';

// 统一的分享文案（与 src/app/layout.tsx 的 openGraph 保持一致，不含公司名称）
export const SHARE_TITLE = 'AI 智能报价平台';
export const SHARE_DESC =
  '图纸智能识别 + 即时报价，覆盖铝型材、钣金、压铸、注塑、钢材等加工类型，助您快速核算成本。';
export const SHARE_URL = 'https://www.gyparts.cn/';
export const SHARE_TEXT = `${SHARE_TITLE}\n${SHARE_DESC}\n在线体验：${SHARE_URL}`;

type Variant = 'nav' | 'mobile' | 'header' | 'sheet';

const TRIGGER_CLASS: Record<Variant, string> = {
  // 左侧栏桌面项（与 QuoteSidebar 的 NAV 项同款）
  nav: 'group flex items-center gap-2.5 w-full text-left rounded-lg px-3 py-2 text-sm transition-colors border-l-2 border-transparent text-slate-600 hover:bg-gray-100 hover:text-slate-800',
  // 左侧栏移动端横向条
  mobile:
    'shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 border border-gray-200 hover:bg-gray-50 transition-colors',
  // 顶部导航（与 TopNavLinks 的链接同款）
  header:
    'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors whitespace-nowrap',
  // 移动端汉堡抽屉
  sheet:
    'flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors',
};

const ICON_CLASS: Record<Variant, string> = {
  nav: 'w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-500',
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
  const [copied, setCopied] = useState(false);
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

  const doCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(SHARE_TEXT);
      } else {
        // 微信内置浏览器等可能没有 clipboard API，退回 execCommand
        const ta = document.createElement('textarea');
        ta.value = SHARE_TEXT;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // 最后兜底：让用户手动选中
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
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3
                  id="share-dialog-title"
                  className="text-base font-semibold text-gray-900 flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
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

              <div className="px-5 py-4 space-y-3">
                <div
                  id="share-text-box"
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap select-text break-words"
                >
                  {SHARE_TEXT}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  微信 / QQ 里直接粘贴发送即可；也可以只发链接，分享卡会自动带标题和简介。
                </p>
                <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={doCopy}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        复制文案和链接
                      </>
                    )}
                  </button>
                  {canNative && (
                    <button
                      type="button"
                      onClick={doNative}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      系统分享
                    </button>
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
