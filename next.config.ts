import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*', pathname: '/**' }],
  },
  experimental: {
    serverActions: { bodySizeLimit: '50mb' },
  },
  serverExternalPackages: ["pdfkit", "fontkit", "fontkit/src/TTFFont", "@swc/helpers"],
};

export default nextConfig;
