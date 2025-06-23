'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import DLMM from '@meteora-ag/dlmm';
import { autoFillYByStrategy, StrategyType } from '@meteora-ag/dlmm';
import BN from 'bn.js';

const SOL_USDC_POOL = new PublicKey('5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export default function LiquidityProvider() {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const { connection } = useConnection();
  
  const [solAmount, setSolAmount] = useState<string>('');
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [dlmmPool, setDlmmPool] = useState<DLMM | null>(null);
  const [activeBin, setActiveBin] = useState<any>(null);
  const [userPositions, setUserPositions] = useState<unknown[]>([]);
  const [autoCalculateUsdc, setAutoCalculateUsdc] = useState(true);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Initialize DLMM pool
  useEffect(() => {
    const initPool = async () => {
      try {
        const pool = await DLMM.create(connection, SOL_USDC_POOL) as DLMM;
        setDlmmPool(pool);
        
        const activeBinData = await pool.getActiveBin();
        setActiveBin(activeBinData);
      } catch (error) {
        console.error('Failed to initialize pool:', error);
      }
    };

    initPool();
  }, [connection]);

  // Load user balances
  useEffect(() => {
    const loadBalances = async () => {
      if (!publicKey) return;
      
      setBalanceLoading(true);
      try {
        // Get SOL balance
        const solBalanceResult = await connection.getBalance(publicKey);
        setSolBalance(solBalanceResult / LAMPORTS_PER_SOL);
        
        // Get USDC balance
        try {
          const usdcTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);
          const accountInfo = await getAccount(connection, usdcTokenAccount);
          setUsdcBalance(Number(accountInfo.amount) / 1000000); // USDC has 6 decimals
        } catch (error) {
          // USDC account doesn't exist
          setUsdcBalance(0);
        }
      } catch (error) {
        console.error('Failed to load balances:', error);
      } finally {
        setBalanceLoading(false);
      }
    };

    loadBalances();
  }, [publicKey, connection]);

  // Load user positions
  useEffect(() => {
    const loadPositions = async () => {
      if (!publicKey || !dlmmPool) return;
      
      try {
        const { userPositions: positions } = await dlmmPool.getPositionsByUserAndLbPair(publicKey) as { userPositions: unknown[] };
        setUserPositions(positions);
      } catch (error) {
        console.error('Failed to load positions:', error);
      }
    };

    loadPositions();
  }, [publicKey, dlmmPool]);

  // Auto-calculate USDC amount when SOL amount changes
  useEffect(() => {
    if (autoCalculateUsdc && solAmount && activeBin && dlmmPool) {
      try {
        const solAmountNum = parseFloat(solAmount);
        if (solAmountNum > 0) {
          const totalXAmount = new BN(solAmountNum * LAMPORTS_PER_SOL);
          
          const TOTAL_RANGE_INTERVAL = 5;
          const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
          const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;
          
          const totalYAmount = autoFillYByStrategy(
            activeBin.binId,
            dlmmPool.lbPair.binStep,
            totalXAmount,
            activeBin.xAmount,
            activeBin.yAmount,
            minBinId,
            maxBinId,
            StrategyType.Spot
          );
          
          // Convert to USDC (6 decimals)
          const usdcAmountNum = totalYAmount.toNumber() / 1000000;
          setUsdcAmount(usdcAmountNum.toFixed(6));
        }
      } catch (error) {
        console.error('Failed to calculate USDC amount:', error);
      }
    }
  }, [solAmount, activeBin, dlmmPool, autoCalculateUsdc]);

  const handleAddLiquidity = async () => {
    if (!publicKey || !dlmmPool || !activeBin || !signTransaction || !signAllTransactions) {
      alert('Please connect your wallet first');
      return;
    }

    if (!solAmount || parseFloat(solAmount) <= 0) {
      alert('Please enter a valid SOL amount');
      return;
    }

    // Check SOL balance
    const solAmountNum = parseFloat(solAmount);
    if (solAmountNum > solBalance) {
      alert(`Insufficient SOL balance. You have ${solBalance.toFixed(4)} SOL but need ${solAmountNum} SOL`);
      return;
    }

    // Check USDC balance
    const requiredUsdcAmount = autoCalculateUsdc ? parseFloat(usdcAmount) : parseFloat(usdcAmount);
    if (requiredUsdcAmount > usdcBalance) {
      alert(`Insufficient USDC balance. You have ${usdcBalance.toFixed(6)} USDC but need ${requiredUsdcAmount.toFixed(6)} USDC`);
      return;
    }

    setIsLoading(true);
    try {
      const totalXAmount = new BN(parseFloat(solAmount) * LAMPORTS_PER_SOL);
      
      const TOTAL_RANGE_INTERVAL = 5;
      const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
      const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

      let totalYAmount;
      if (autoCalculateUsdc) {
        totalYAmount = autoFillYByStrategy(
          activeBin.binId,
          dlmmPool.lbPair.binStep,
          totalXAmount,
          activeBin.xAmount,
          activeBin.yAmount,
          minBinId,
          maxBinId,
          StrategyType.Spot
        );
      } else {
        totalYAmount = new BN(parseFloat(usdcAmount) * 1000000); // USDC has 6 decimals
      }

      const newBalancePosition = new Keypair();

      const createPositionTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
        positionPubKey: newBalancePosition.publicKey,
        user: publicKey,
        totalXAmount,
        totalYAmount,
        strategy: {
          maxBinId,
          minBinId,
          strategyType: StrategyType.Spot,
        },
      });

      // Sign the transaction
      const signedTx = await signTransaction(createPositionTx);
      signedTx.partialSign(newBalancePosition);

      // Send the transaction
      const txHash = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(txHash);

      alert(`Position created successfully! TX: ${txHash}`);
      
      // Reload positions
      const { userPositions: newPositions } = await dlmmPool.getPositionsByUserAndLbPair(publicKey) as { userPositions: unknown[] };
      setUserPositions(newPositions);
      
      // Reload balances
      const solBalanceResult = await connection.getBalance(publicKey);
      setSolBalance(solBalanceResult / LAMPORTS_PER_SOL);
      try {
        const usdcTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);
        const accountInfo = await getAccount(connection, usdcTokenAccount);
        setUsdcBalance(Number(accountInfo.amount) / 1000000);
      } catch (error) {
        setUsdcBalance(0);
      }
      
      // Reset form
      setSolAmount('');
      setUsdcAmount('');
    } catch (error) {
      console.error('Failed to add liquidity:', error);
      alert('Failed to add liquidity. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePosition = async (position: { publicKey: PublicKey; positionData: { positionBinData: { binId: number }[] } }) => {
    if (!publicKey || !dlmmPool || !signTransaction) {
      alert('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    try {
      const binIdsToRemove = position.positionData.positionBinData.map((bin: any) => bin.binId);
      
      const removeLiquidityTx = await dlmmPool.removeLiquidity({
        position: position.publicKey,
        user: publicKey,
        fromBinId: binIdsToRemove[0],
        toBinId: binIdsToRemove[binIdsToRemove.length - 1],
        bps: new BN(10000), // 100%
        shouldClaimAndClose: true,
      });

      const transactions = Array.isArray(removeLiquidityTx) ? removeLiquidityTx : [removeLiquidityTx];
      
      for (const tx of transactions) {
        const signedTx = await signTransaction(tx);
        const txHash = await connection.sendRawTransaction(signedTx.serialize());
        await connection.confirmTransaction(txHash);
      }

      alert('Position closed successfully!');
      
      // Reload positions
      const { userPositions: newPositions } = await dlmmPool.getPositionsByUserAndLbPair(publicKey) as { userPositions: unknown[] };
      setUserPositions(newPositions);
    } catch (error) {
      console.error('Failed to close position:', error);
      alert('Failed to close position. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">Wallet Connection Required</h3>
          <p className="text-gray-300 text-lg">Please connect your wallet to access the liquidity provider features.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Balance Display */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-8">
        <div className="flex items-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-600 rounded-xl flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white">Portfolio Balance</h3>
        </div>
        
        {balanceLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
            <span className="ml-3 text-gray-300">Loading balances...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-600/20 rounded-2xl p-6 border border-yellow-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-yellow-300 font-medium">SOL Balance</span>
                <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-black">◎</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{solBalance.toFixed(4)}</p>
              <p className="text-yellow-200 text-sm">SOL</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-2xl p-6 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-300 font-medium">USDC Balance</span>
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-xs font-bold text-white">$</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-white">{usdcBalance.toFixed(6)}</p>
              <p className="text-blue-200 text-sm">USDC</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Add Liquidity Form */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-8">
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-600 rounded-xl flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white">Add Liquidity</h3>
        </div>
        
        <div className="space-y-6">
          {/* SOL Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              SOL Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={solAmount}
                onChange={(e) => setSolAmount(e.target.value)}
                placeholder="0.001"
                step="0.001"
                className={`w-full p-4 bg-gray-700/50 border rounded-2xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                  solAmount && parseFloat(solAmount) > solBalance 
                    ? 'border-red-400 bg-red-900/20' 
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <span className="text-yellow-400 font-medium">SOL</span>
                <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-black">◎</span>
                </div>
              </div>
            </div>
            {solAmount && parseFloat(solAmount) > solBalance && (
              <div className="flex items-center space-x-2 text-red-400 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Insufficient SOL balance. Available: {solBalance.toFixed(4)} SOL</span>
              </div>
            )}
          </div>

          {/* Auto-calculate toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-2xl border border-gray-600/50">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-gray-300 font-medium">Auto-calculate USDC amount</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="autoCalculate"
                checked={autoCalculateUsdc}
                onChange={(e) => setAutoCalculateUsdc(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* USDC Input */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              USDC Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={usdcAmount}
                onChange={(e) => setUsdcAmount(e.target.value)}
                placeholder="0.0"
                step="0.000001"
                disabled={autoCalculateUsdc}
                className={`w-full p-4 bg-gray-700/50 border rounded-2xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${
                  autoCalculateUsdc ? 'bg-gray-800/50 cursor-not-allowed opacity-50' : 
                  (usdcAmount && parseFloat(usdcAmount) > usdcBalance) ? 'border-red-400 bg-red-900/20' : 'border-gray-600 hover:border-gray-500'
                }`}
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <span className="text-blue-400 font-medium">USDC</span>
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">$</span>
                </div>
              </div>
            </div>
            
            {autoCalculateUsdc && (
              <div className="flex items-center space-x-2 text-blue-400 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>USDC amount is automatically calculated based on SOL amount</span>
              </div>
            )}
            
            {!autoCalculateUsdc && usdcAmount && parseFloat(usdcAmount) > usdcBalance && (
              <div className="flex items-center space-x-2 text-red-400 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Insufficient USDC balance. Available: {usdcBalance.toFixed(6)} USDC</span>
              </div>
            )}
            
            {autoCalculateUsdc && usdcAmount && parseFloat(usdcAmount) > usdcBalance && (
              <div className="flex items-center space-x-2 text-red-400 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Insufficient USDC balance for calculated amount. Available: {usdcBalance.toFixed(6)} USDC</span>
              </div>
            )}
          </div>

          {/* Add Liquidity Button */}
          <button
            onClick={handleAddLiquidity}
            disabled={
              isLoading || 
              !solAmount || 
              (!!solAmount && parseFloat(solAmount) > solBalance) ||
              (!!usdcAmount && parseFloat(usdcAmount) > usdcBalance)
            }
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] disabled:scale-100 shadow-xl"
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Adding Liquidity...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Liquidity</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Current Positions */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-8">
        <div className="flex items-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-white">Your Positions</h3>
        </div>
        
        {userPositions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg">No liquidity positions found</p>
            <p className="text-gray-500 text-sm mt-2">Add liquidity to start earning fees</p>
          </div>
        ) : (
          <div className="space-y-6">
            {userPositions.map((position: any, index: number) => (
              <div key={index} className="bg-gradient-to-br from-gray-700/50 to-gray-800/50 rounded-2xl border border-gray-600/50 p-6 hover:border-gray-500/50 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <span className="text-white font-bold text-lg">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg">Position #{index + 1}</p>
                      <p className="text-gray-400 text-sm font-mono">
                        {position.publicKey.toBase58().slice(0, 8)}...{position.publicKey.toBase58().slice(-8)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleClosePosition(position)}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 shadow-lg"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Closing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Close</span>
                      </div>
                    )}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-600/30">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-gray-300 text-sm font-medium">Bins</span>
                    </div>
                    <p className="text-white text-xl font-bold">{position.positionData.positionBinData.length}</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-yellow-500/10 to-orange-600/10 rounded-xl p-4 border border-yellow-500/20">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-black">◎</span>
                      </div>
                      <span className="text-yellow-300 text-sm font-medium">SOL</span>
                    </div>
                    <p className="text-white text-xl font-bold">
                      {(position.positionData.positionBinData
                        .reduce((sum: number, bin: unknown) => sum + parseInt((bin as any).positionXAmount), 0) / LAMPORTS_PER_SOL).toFixed(4)}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-600/10 rounded-xl p-4 border border-blue-500/20">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">$</span>
                      </div>
                      <span className="text-blue-300 text-sm font-medium">USDC</span>
                    </div>
                    <p className="text-white text-xl font-bold">
                      {(position.positionData.positionBinData
                        .reduce((sum: number, bin: unknown) => sum + parseInt((bin as any).positionYAmount), 0) / 1000000).toFixed(6)}
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                      <span className="text-green-300 text-sm font-medium">Fees</span>
                    </div>
                    <p className="text-white text-xl font-bold">
                      {(position.positionData.positionBinData
                        .reduce((sum: number, bin: unknown) => sum + parseInt((bin as any).positionFeeXAmount), 0) / LAMPORTS_PER_SOL).toFixed(6)} SOL
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}