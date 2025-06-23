import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
    };

    // Handle Solana packages
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        '@solana/web3.js': 'commonjs @solana/web3.js',
        '@solana/wallet-adapter-base': 'commonjs @solana/wallet-adapter-base',
        '@solana/wallet-adapter-react': 'commonjs @solana/wallet-adapter-react',
        '@solana/wallet-adapter-react-ui': 'commonjs @solana/wallet-adapter-react-ui',
        '@solana/wallet-adapter-wallets': 'commonjs @solana/wallet-adapter-wallets',
        '@meteora-ag/dlmm': 'commonjs @meteora-ag/dlmm',
        'bn.js': 'commonjs bn.js',
      });
    }

    // Ignore binary files for Solana
    config.module.rules.push({
      test: /\.node$/,
      use: 'ignore-loader',
    });

    return config;
  },
  transpilePackages: [
    '@solana/web3.js',
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-wallets',
    '@meteora-ag/dlmm',
  ],
};

export default nextConfig;
