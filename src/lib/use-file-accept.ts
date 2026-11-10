'use client';
import { useEffect, useState } from 'react';

/**
 * 手机端 / 微信内置浏览器的 accept 适配。
 *
 * 背景（2026-10-06 实测）：在微信里点上传图纸，选择器只弹出
 * 「拍摄 / 从手机相册选择 / 取消」——因为 accept 里带一长串扩展名白名单
 * （.stp/.dxf/.igs…），微信 X5 内核解析不了就退化成"只当图片输入"。
 *
 * 处理：移动端一律给「任意文件」通配 accept；桌面端仍用扩展名白名单
 * （系统文件框能过滤）。扩展名合法性由各页面自行校验（isValidFile）。
 *
 * ⚠️ 2026-11-10 业主实机更正：微信里并不会出现「从聊天记录选择文件」
 * （那是小程序 wx.chooseMessageFile 的能力，普通 H5 拿不到）。安卓微信会把
 * <input type="file"> 交给系统「安全访问」选择器，且带 multiple 时容易退化成
 * 图片多选（显示「预览 0/100」），非图片文件直接不可选。因此 DrawingRecognition
 * 在手机端改为：不输出 accept、不输出 multiple，并用 key 强制重建 input 节点。
 * 这条限制属于微信/系统层，H5 未必能完全绕开；根治方案是小程序选文件入口。
 */
const MOBILE_UA = /Android|iPhone|iPad|iPod|MicroMessenger|Windows Phone|Mobile/i;

// SSR 与客户端首帧保持一致（避免 hydration mismatch）：初始取 desktopAccept，
// useEffect 后再切到移动端值；消费方用 key 重建 input 让 WebView 原生层重新读取属性。

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
