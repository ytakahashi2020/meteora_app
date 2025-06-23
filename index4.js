const DLMM = require("@meteora-ag/dlmm").default;
const {
  Keypair,
  PublicKey,
  Connection,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const { autoFillYByStrategy, StrategyType } = require("@meteora-ag/dlmm");
const { config } = require("dotenv");
const bs58 = require("bs58").default;
const BN = require("bn.js");
config();

async function main() {
  const privateKeyString = process.env.PRIVATE_KEY;
  const privateKeyArray = bs58.decode(privateKeyString);
  const user = Keypair.fromSecretKey(privateKeyArray);

  console.log(`publickey: ${user.publicKey.toBase58()}`);

  const connection = new Connection(
    "https://mainnet.helius-rpc.com/?api-key=1edb3684-fc9a-47c1-a109-e5e356103df8"
  );

  const SOL_USDC_POOL = new PublicKey(
    "5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6"
  );

  const dlmmPool = await DLMM.create(connection, SOL_USDC_POOL);

  const activeBin = await dlmmPool.getActiveBin();

  console.log(`active Bin ID: ${activeBin.binId}`);

  const TOTAL_RANGE_INTERVAL = 5; // 10 bins on each side of the active bin
  const minBinId = activeBin.binId - TOTAL_RANGE_INTERVAL;
  const maxBinId = activeBin.binId + TOTAL_RANGE_INTERVAL;

  console.log(`minBinId: ${minBinId}`);
  console.log(`maxBinId: ${maxBinId}`);

  const totalXAmount = new BN(0.0001 * LAMPORTS_PER_SOL);

  const totalYAmount = autoFillYByStrategy(
    activeBin.binId,
    dlmmPool.lbPair.binStep,
    totalXAmount,
    activeBin.xAmount,
    activeBin.yAmount,
    minBinId,
    maxBinId,
    StrategyType.Spot // can be StrategyType.Spot, StrategyType.BidAsk, StrategyType.Curve
  );

  const newBalancePosition = new Keypair();

  const createPositionTx =
    await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: newBalancePosition.publicKey,
      user: user.publicKey,
      totalXAmount,
      totalYAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: StrategyType.Spot, // can be StrategyType.Spot, StrategyType.BidAsk, StrategyType.Curve
      },
    });

  try {
    const createBalancePositionTxHash = await sendAndConfirmTransaction(
      connection,
      createPositionTx,
      [user, newBalancePosition]
    );
    console.log(`createBalancePositionTxHash:${createBalancePositionTxHash}`);
    console.log(
      `newBalancePosition:${newBalancePosition.publicKey.toBase58()}`
    );
  } catch (error) {
    console.error(error);
  }

  await new Promise((resolve) => setTimeout(resolve, 60000));

  const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
    user.publicKey
  );
  const binData = userPositions[0].positionData.positionBinData;

  // console.log(userPositions);
  console.log(binData);

  const userPosition = userPositions.find(({ publicKey }) =>
    publicKey.equals(newBalancePosition.publicKey)
  );
  // Remove Liquidity
  const binIdsToRemove = userPosition.positionData.positionBinData.map(
    (bin) => bin.binId
  );
  const removeLiquidityTx = await dlmmPool.removeLiquidity({
    position: userPosition.publicKey,
    user: user.publicKey,
    fromBinId: binIdsToRemove[0],
    toBinId: binIdsToRemove[binIdsToRemove.length - 1],
    bps: new BN(10000), // 100% = 10000 bps
    shouldClaimAndClose: true, // should claim swap fee and close position together
  });

  try {
    for (let tx of Array.isArray(removeLiquidityTx)
      ? removeLiquidityTx
      : [removeLiquidityTx]) {
      const removeBalanceLiquidityTxHash = await sendAndConfirmTransaction(
        connection,
        tx,
        [user],
        { skipPreflight: false, preflightCommitment: "confirmed" }
      );
      console.log(`removeLiquidityTxHash: ${removeBalanceLiquidityTxHash}`);
    }
  } catch (error) {
    console.error("Error removing liquidity:", error);
  }

  // Note: Fees are already claimed because shouldClaimAndClose: true in removeLiquidity
  // If you want to claim fees separately, set shouldClaimAndClose: false above
  
  // Uncomment this section if you need to claim fees separately:
  /*
  console.log("\nClaiming swap fees...");
  const claimFeeTxs = await dlmmPool.claimAllSwapFee({
    owner: user.publicKey,
    positions: userPositions,
  });

  try {
    for (const claimFeeTx of claimFeeTxs) {
      const claimFeeTxHash = await sendAndConfirmTransaction(
        connection,
        claimFeeTx,
        [user]
      );
      console.log(`claimFeeTxHash: ${claimFeeTxHash}`);
    }
  } catch (error) {
    console.error("Error claiming fees:", error);
  }
  */

  // Note: Position is already closed because shouldClaimAndClose: true in removeLiquidity
  // The position and fees are handled in one transaction when shouldClaimAndClose is true
  
  console.log("\nProcess completed! Liquidity removed, fees claimed, and position closed.");
}

main();
