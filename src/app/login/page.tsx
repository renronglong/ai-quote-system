import LoginPanel from '@/components/LoginPanel';

/**
 * /login 页面：登录界面已抽到共享组件 LoginPanel，
 * 首页未登录时会以 embedded 模式复用同一个界面。
 */
export default function LoginPage() {
  return <LoginPanel />;
}
