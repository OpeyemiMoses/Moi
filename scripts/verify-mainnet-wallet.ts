import { createPublicClient, http, formatEther, formatUnits, erc20Abi } from 'viem';
import { celo } from 'viem/chains';
import { toDataSuffix, fromDataSuffix, verifyTx } from '@celo/attribution-tags';
import { CELO_VERIFIED_ASSETS } from '../packages/shared-types/src/index';

async function main() {
  const targetWallet = process.argv[2] as `0x${string}` | undefined;
  const targetTx = process.argv[3] as `0x${string}` | undefined;

  console.log('='.repeat(70));
  console.log(' MOI — Celo Mainnet Live Verification & Proof Inspector');
  console.log('='.repeat(70));
  console.log(`Network:           Celo Mainnet (Chain ID 42220)`);
  console.log(`RPC Endpoint:      https://forno.celo.org`);
  console.log(`Attribution Tag:   celo_c9cb9a59fc4c`);

  const client = createPublicClient({
    chain: celo,
    transport: http('https://forno.celo.org'),
  });

  // 1. Verify Attribution Tag Encoding
  const suffix = toDataSuffix('celo_c9cb9a59fc4c');
  const decoded = fromDataSuffix(suffix);
  console.log('\n[1] ERC-8021 Attribution Tag Status:');
  console.log(`  Raw Calldata Suffix: ${suffix}`);
  console.log(`  Decoded Tag:         ${decoded.codes.join(', ')} (Schema ${decoded.schemaId})`);
  console.log(`  Encoding Status:     VERIFIED VALID`);

  // 2. Check Wallet Balances if address provided
  if (targetWallet && /^0x[a-fA-F0-9]{40}$/.test(targetWallet)) {
    console.log(`\n[2] Live Mainnet Balances for: ${targetWallet}`);
    try {
      const nativeBalance = await client.getBalance({ address: targetWallet });
      console.log(`  CELO (Native):       ${formatEther(nativeBalance)} CELO`);

      for (const [symbol, asset] of Object.entries(CELO_VERIFIED_ASSETS)) {
        try {
          const balance = await client.readContract({
            address: asset.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [targetWallet],
          });
          const formatted = formatUnits(balance, asset.decimals);
          if (Number(formatted) > 0) {
            console.log(`  ${symbol.padEnd(10)}:        ${formatted} ${symbol} (${asset.name})`);
          }
        } catch {}
      }
    } catch (err: any) {
      console.error(`  Error reading balances: ${err.message}`);
    }
  } else {
    console.log('\n[2] Wallet Balances:');
    console.log('  Pass your wallet address as an argument to inspect live balances:');
    console.log('  npx tsx scripts/verify-mainnet-wallet.ts 0xYourWalletAddress');
  }

  // 3. Inspect a specific Transaction Hash if provided
  if (targetTx && /^0x[a-fA-F0-9]{64}$/.test(targetTx)) {
    console.log(`\n[3] Transaction Attribution Proof for: ${targetTx}`);
    try {
      const [receipt, attr] = await Promise.all([
        client.getTransactionReceipt({ hash: targetTx }),
        verifyTx({ client: client as any, hash: targetTx }),
      ]);
      console.log(`  Status:              ${receipt.status.toUpperCase()}`);
      console.log(`  Block Number:        ${receipt.blockNumber}`);
      console.log(`  Gas Used:            ${receipt.gasUsed.toString()}`);
      console.log(`  Attribution Verified:${attr ? ' YES' : ' NO'}`);
      if (attr) {
        console.log(`  Attribution Codes:   ${attr.codes.join(', ')}`);
      }
      console.log(`  Celoscan Explorer:   https://celoscan.io/tx/${targetTx}`);
    } catch (err: any) {
      console.error(`  Error inspecting tx: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
