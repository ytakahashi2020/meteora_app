'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function WalletConnect() {
  const { publicKey, connected } = useWallet();

  return (
    <div className="flex flex-col items-center space-y-6">
      <style jsx global>{`
        .wallet-adapter-button {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
          border: none !important;
          border-radius: 1rem !important;
          padding: 1rem 2rem !important;
          font-weight: 600 !important;
          font-size: 1.1rem !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3) !important;
        }
        
        .wallet-adapter-button:hover {
          background: linear-gradient(135deg, #5046e4 0%, #7c3aed 100%) !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 15px 35px rgba(99, 102, 241, 0.4) !important;
        }
        
        .wallet-adapter-button:not([disabled]):hover {
          background: linear-gradient(135deg, #5046e4 0%, #7c3aed 100%) !important;
        }
        
        .wallet-adapter-button[disabled] {
          background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%) !important;
          cursor: not-allowed !important;
          transform: none !important;
        }
        
        .wallet-adapter-button-start-icon {
          width: 1.5rem !important;
          height: 1.5rem !important;
        }
      `}</style>
      
      <WalletMultiButton />
      
      {connected && publicKey && (
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-2xl px-6 py-3 border border-gray-600/50">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-gray-300 text-sm font-medium">Connected:</span>
            <span className="text-white font-mono text-sm">
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}