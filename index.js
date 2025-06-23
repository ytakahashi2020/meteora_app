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

  const connection = new Connection(clusterApiUrl("mainnet-beta"));

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
}

main();
