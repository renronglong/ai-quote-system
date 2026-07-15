import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  // 增大 API 请求体大小限制（支持 STEP 文件上传）
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  // 忽略 Python 脚本（不需要被 webpack 打包）
  serverExternalPackages: [],
};

export default nextConfig;
