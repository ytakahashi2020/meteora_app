'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function WalletConnect() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="flex flex-col items-center space-y-4">
      <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
      {connected && publicKey && (
        <div className="text-sm text-gray-600">
          Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </div>
      )}
    </div>
  );
}