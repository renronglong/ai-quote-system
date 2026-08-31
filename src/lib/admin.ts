import { createHmac } from 'crypto';

/**
 * 管理员体系（手机号白名单 + HMAC token）
 * 系统为内部工具，无完整JWT设施，采用轻量签名token：
 * 登录时若手机号在白名单内，由 /api/auth/login 签发 token 给前端，
 * 管理类 API 用 verifyAdminToken 校验（防止任何人传 is_admin=true 越权）。
 */

// 管理员手机号白名单
export const ADMIN_PHONES = ['13800138000', '18929979760'];

export function isAdminPhone(phone?: string | null): boolean {
  return !!phone && ADMIN_PHONES.includes(phone);
}

// 签名密钥：优先环境变量，无则用内置兜底（内部工具可接受）
const SECRET = process.env.ADMIN_TOKEN_SECRET || 'gyparts-admin-2026-internal-secret';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30天

/** 签发管理员token：base64(phone|exp).hmac */
export function signAdminToken(phone: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(`${phone}|${exp}`).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** 校验管理员token，有效返回手机号，否则null */
export function verifyAdminToken(token?: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  // 定长比较防时序攻击
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  let body: string;
  try {
    body = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const sep = body.lastIndexOf('|');
  if (sep < 0) return null;
  const phone = body.slice(0, sep);
  const exp = Number(body.slice(sep + 1));
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  if (!isAdminPhone(phone)) return null;
  return phone;
}

/** 从请求中提取管理员手机号（Authorization: Bearer 或 x-admin-token） */
export function getAdminFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  const token =
    (auth.startsWith('Bearer ') ? auth.slice(7) : null) ||
    req.headers.get('x-admin-token');
  return verifyAdminToken(token);
}
