import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ChromaDBなどのネイティブモジュールや特殊な依存関係を持つパッケージを
  // Next.jsのバンドル処理から除外する設定
  serverExternalPackages: ['chromadb', '@chroma-core/default-embed'],
};

export default nextConfig;
