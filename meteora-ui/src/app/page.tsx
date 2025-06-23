import WalletConnect from '@/components/WalletConnect';
import LiquidityProvider from '@/components/LiquidityProvider';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Meteora DLMM Liquidity Provider
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Provide liquidity to the SOL-USDC pool on Meteora
          </p>
          <WalletConnect />
        </header>

        <main>
          <LiquidityProvider />
        </main>

        <footer className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-500">
            Powered by Meteora DLMM Protocol
          </p>
        </footer>
      </div>
    </div>
  );
}
