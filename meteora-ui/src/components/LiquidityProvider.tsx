'use client';

import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { autoFillYByStrategy, StrategyType } from '@meteora-ag/dlmm';
import BN from 'bn.js';

const SOL_USDC_POOL = new PublicKey('5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6');

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
      <div className="text-center p-8">
        <p className="text-gray-600">Please connect your wallet to use the liquidity provider.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">SOL-USDC Liquidity Provider</h2>
      
      {/* Add Liquidity Form */}
      <div className="mb-8 p-6 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Add Liquidity</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SOL Amount
            </label>
            <input
              type="number"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
              placeholder="0.001"
              step="0.001"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="autoCalculate"
              checked={autoCalculateUsdc}
              onChange={(e) => setAutoCalculateUsdc(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoCalculate" className="text-sm text-gray-700">
              Auto-calculate USDC amount
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              USDC Amount
            </label>
            <input
              type="number"
              value={usdcAmount}
              onChange={(e) => setUsdcAmount(e.target.value)}
              placeholder="0.0"
              step="0.000001"
              disabled={autoCalculateUsdc}
              className={`w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                autoCalculateUsdc ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
            {autoCalculateUsdc && (
              <p className="text-sm text-gray-500 mt-1">
                USDC amount is automatically calculated based on SOL amount
              </p>
            )}
          </div>

          <button
            onClick={handleAddLiquidity}
            disabled={isLoading || !solAmount}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Adding Liquidity...' : 'Add Liquidity'}
          </button>
        </div>
      </div>

      {/* Current Positions */}
      <div className="p-6 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Your Positions</h3>
        
        {userPositions.length === 0 ? (
          <p className="text-gray-600 text-center py-4">No positions found</p>
        ) : (
          <div className="space-y-4">
            {userPositions.map((position: any, index: number) => (
              <div key={index} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium">Position #{index + 1}</p>
                    <p className="text-sm text-gray-600">
                      {position.publicKey.toBase58().slice(0, 8)}...
                    </p>
                  </div>
                  <button
                    onClick={() => handleClosePosition(position)}
                    disabled={isLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {isLoading ? 'Closing...' : 'Close Position'}
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Bins:</p>
                    <p>{position.positionData.positionBinData.length}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total SOL:</p>
                    <p>
                      {position.positionData.positionBinData
                        .reduce((sum: number, bin: unknown) => sum + parseInt((bin as any).positionXAmount), 0) / LAMPORTS_PER_SOL}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total USDC:</p>
                    <p>
                      {position.positionData.positionBinData
                        .reduce((sum: number, bin: unknown) => sum + parseInt((bin as any).positionYAmount), 0) / 1000000}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Fees (SOL):</p>
                    <p>
                      {position.positionData.positionBinData
                        .reduce((sum: number, bin: unknown) => sum + parseInt((bin as any).positionFeeXAmount), 0) / LAMPORTS_PER_SOL}
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