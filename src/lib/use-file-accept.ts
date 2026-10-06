'use client';
import { useEffect, useState } from 'react';

/**
 * 手机端 / 微信内置浏览器的 accept 适配。
 *
 * 背景（2026-10-06 实测）：在微信里点上传图纸，选择器只弹出
 * 「拍摄 / 从手机相册选择 / 取消」，**没有「从聊天记录选择文件」** ——
 * 因为 accept 里带了一长串扩展名白名单（.stp/.dxf/.igs…），
 * 微信 X5 内核解析不了就退化成"只当图片输入"。
 *
 * 处理：移动端一律给「任意文件」通配 accept，微信即恢复「从聊天记录选择文件」；
 * 桌面端仍用扩展名白名单（系统文件框能过滤）。扩展名合法性由各页面自行校验
 * （如 DrawingRecognition 的 isValidFile）。
 */
const MOBILE_UA = /Android|iPhone|iPad|iPod|MicroMessenger|Windows Phone|Mobile/i;

export function useFileAccept(desktopAccept: string): string {
  const [accept, setAccept] = useState(desktopAccept);
  useEffect(() => {
    if (typeof navigator !== 'undefined' && MOBILE_UA.test(navigator.userAgent || '')) {
      setAccept('*/*');
    }
  }, []);
  return accept;
}

/** 是否手机端 / 微信内置浏览器（用于切换提示文案等） */
export function useIsMobileUa(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile(MOBILE_UA.test(navigator.userAgent || ''));
  }, []);
  return mobile;
}
