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
};

export default nextConfig;