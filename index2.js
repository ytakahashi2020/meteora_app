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
  const user = new Keypair(privateKeyArray);

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

  const totalYAmount = new BN(1 * 10 ** 6);

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

  // try {
  //   const createBalancePositionTxHash = await sendAndConfirmTransaction(
  //     connection,
  //     createPositionTx,
  //     [user, newBalancePosition]
  //   );
  //   console.log(`createBalancePositionTxHash:${createBalancePositionTxHash}`);
  //   console.log(
  //     `newBalancePosition:${newBalancePosition.publicKey.toBase58()}`
  //   );
  // } catch (error) {
  //   console.error(error);
  // }

  const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
    user.publicKey
  );
  const binData = userPositions[0].positionData.positionBinData;

  console.log(`userPositions:${userPositions}`);
  console.log(`binData:${binData}`);
}

main();
