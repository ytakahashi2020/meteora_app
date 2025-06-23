import WalletConnectClient from '@/components/WalletConnectClient';
import LiquidityProviderClient from '@/components/LiquidityProviderClient';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}></div>
      
      <div className="relative z-10 container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          {/* Logo/Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-400 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-4">
            Meteora DLMM
          </h1>
          <h2 className="text-2xl font-semibold text-purple-300 mb-6">
            Liquidity Provider
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Provide liquidity to the SOL-USDC pool with advanced Dynamic Liquidity Market Making on Meteora Protocol
          </p>
          <WalletConnectClient />
        </header>

        <main className="mb-12">
          <LiquidityProviderClient />
        </main>

        <footer className="text-center pt-8 border-t border-gray-700/50">
          <div className="flex items-center justify-center space-x-2 text-gray-400">
            <span>Powered by</span>
            <span className="font-semibold text-purple-400">Meteora DLMM Protocol</span>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
          </div>
        </footer>
      </div>
    </div>
  );
}
