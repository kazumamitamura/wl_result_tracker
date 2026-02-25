import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // pdf-parse とその依存関係を Next.js のバンドルから除外し、Node.js ネイティブとして扱う
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;