import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 跳过类型检查，减少内存消耗（服务器只有 2GB）
  typescript: {
    ignoreBuildErrors: true,
  },
  // 跳过 ESLint 检查，减少内存消耗
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Next.js 16 的内置代理默认只转发前 10MB 请求体，超过会被截断导致后端解析失败。
  // 技改立项 PDF 动辄一两 MB，一次上传数十份会直接超限。
  // 这里放宽到 200MB。前端 importPdfBatch 也做了分批，两头兜底。
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
