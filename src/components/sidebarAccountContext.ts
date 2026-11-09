'use client';
import { createContext, useContext } from 'react';

// QuoteSidebarLayout 渲染左侧栏时，通过此 context 通知 AppLayout 隐藏其右上角账户下拉，
// 避免「左侧栏账户菜单」与「顶栏账户下拉」重复。无左侧栏的页面（首页/登录/产品管理/供应商后台/管理后台等）仍保留顶栏下拉。
export const SidebarAccountContext = createContext<{ setHasSidebar: (v: boolean) => void }>({
  setHasSidebar: () => {},
});

export const useSidebarAccount = () => useContext(SidebarAccountContext);
