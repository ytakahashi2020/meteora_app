'use client';

import dynamic from 'next/dynamic';

const WalletConnect = dynamic(
  () => import('./WalletConnect'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center space-y-6">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 px-8 rounded-2xl animate-pulse">
          Loading wallet...
        </div>
      </div>
    )
  }
);

export default WalletConnect;