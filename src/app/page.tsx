import { redirect } from 'next/navigation';

// 主网址不再单独做首页/登录门禁，直接进入 AI 报价页。
// 登录入口保留在 /quote 顶栏「登录」按钮与 /login 路由（手机+密码 / 邮箱）。
export default function HomePage() {
  redirect('/quote');
}
