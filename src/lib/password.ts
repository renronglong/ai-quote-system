/**
 * 密码哈希工具（Node scrypt，零依赖）
 * 存储格式：scrypt$<saltHex>$<hashHex>
 * 兼容历史明文：stored 不以 "scrypt$" 开头时按明文比对，
 * 登录成功后由调用方顺手升级为哈希。
 */
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  // 历史明文
  if (!stored.startsWith('scrypt$')) {
    return stored === password;
  }
  const parts = stored.split('$');
  if (parts.length !== 3) return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** 是否为旧式明文（需要登录后升级哈希） */
export function isLegacyPlaintext(stored: string): boolean {
  return !!stored && !stored.startsWith('scrypt$');
}
