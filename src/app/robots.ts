import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 仅屏蔽敏感/私密路径：后端 API、登录、历史（含用户数据）
      disallow: ['/api/', '/login', '/history', '/admin'],
    },
    sitemap: 'https://www.gyparts.cn/sitemap.xml',
  };
}

