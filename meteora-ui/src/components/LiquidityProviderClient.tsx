'use client';

import dynamic from 'next/dynamic';

const LiquidityProvider = dynamic(
  () => import('./LiquidityProvider'),
  { 
    ssr: false,
    loading: () => (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-6"></div>
          <p className="text-gray-300 text-lg">Loading liquidity provider...</p>
        </div>
      </div>
    )
  }
);

export default LiquidityProvider;