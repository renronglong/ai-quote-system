import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.gyparts.cn';

// 仅收录公开、可被搜索引擎索引的页面；登录/注册/个人中心等私密页不收录
const PUBLIC_PATHS = [
  '',
  'quote',
  'market',
  'products',
  'suppliers',
  'supplier',
  'inquiries',
  'inventory',
  'contact',
  'help',
  'terms',
  'privacy',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.map((p) => ({
    url: `${SITE_URL}/${p}`.replace(/\/$/, ''),
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.7,
  }));
}
