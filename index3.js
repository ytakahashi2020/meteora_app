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

  // 複数のRPCエンドポイントを試す
  const rpcEndpoints = [
    "https://api.mainnet-beta.solana.com",
    "https://solana-api.projectserum.com",
    "https://rpc.ankr.com/solana",
    "https://solana.public-rpc.com",
  ];

  let connection;
  for (const endpoint of rpcEndpoints) {
    try {
      connection = new Connection(endpoint, "confirmed");
      // 接続テスト
      await connection.getLatestBlockhash();
      console.log(`Using RPC endpoint: ${endpoint}`);
      break;
    } catch (error) {
      console.log(`Failed to connect to ${endpoint}: ${error.message}`);
      continue;
    }
  }

  if (!connection) {
    throw new Error("Failed to connect to any RPC endpoint");
  }

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

  // ユーザーのポジションを取得
  const userPositions = await dlmmPool.getPositionsByUserAndLbPair(
    user.publicKey
  );
  console.log(`Found ${userPositions.length} positions for user`);

  // ポジションの基本情報を表示
  userPositions.forEach((pos, index) => {
    console.log(`Position ${index}:`, {
      publicKey: pos.publicKey.toBase58(),
      owner: pos.positionData.owner.toBase58(),
      lowerBinId: pos.positionData.lowerBinId,
      upperBinId: pos.positionData.upperBinId,
      liquidityShares: pos.positionData.liquidityShares.toString(),
      binCount: pos.positionData.positionBinData.length,
    });
  });

  if (userPositions.length > 0) {
    // 最初のポジションを使用（または特定のポジションを指定）
    const userPosition = userPositions[0];
    console.log(`Using position: ${userPosition.publicKey.toBase58()}`);

    // ポジションのbinデータを取得
    const binIdsToRemove = userPosition.positionData.positionBinData.map(
      (bin) => bin.binId
    );

    console.log(`Bin IDs to remove: ${binIdsToRemove.join(", ")}`);

    // binデータの詳細を表示
    console.log("Bin data details:");
    userPosition.positionData.positionBinData.forEach((bin, index) => {
      console.log(`  Bin ${index}:`, {
        binId: bin.binId,
        liquiditySupply: bin.liquiditySupply.toString(),
        rewardInfos: bin.rewardInfos?.length || 0,
        feeInfos: bin.feeInfos?.length || 0,
      });
    });

    // 流動性を削除
    const removeLiquidityTx = await dlmmPool.removeLiquidity({
      position: userPosition.publicKey,
      user: user.publicKey,
      fromBinId: binIdsToRemove[0],
      toBinId: binIdsToRemove[binIdsToRemove.length - 1],
      liquiditiesBpsToRemove: new Array(binIdsToRemove.length).fill(
        new BN(100 * 100)
      ), // 100% (range from 0 to 100)
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
          { skipPreflight: false, preflightCommitment: "singleGossip" }
        );
        console.log(
          `removeBalanceLiquidityTxHash: ${removeBalanceLiquidityTxHash}`
        );
      }
    } catch (error) {
      console.error("Error removing liquidity:", error);
    }
  } else {
    console.log("No positions found for user");
  }
}

main();
