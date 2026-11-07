import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  parseEther,
  parseAbi,
  erc20Abi,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { toDataSuffix, verifyTx } from '@celo/attribution-tags';
import { appendAttributionToCalldata } from '../packages/wallet-signer/src/index';
import * as fs from 'fs';
import * as path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';
const ATTRIBUTION_TAG = process.env.CELO_ATTRIBUTION_TAG || 'celo_c9cb9a59fc4c';

// Verified Celo Mainnet Addresses
const SWAP_ROUTER_02 = '0x5615CDAb10dc425a742d643d949a7F474C01abc4' as const;
const CELO_TOKEN = '0x471EcE3750Da237f93B8E339c536989b8978a438' as const;
const USDT_TOKEN = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as const;

const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

async function main() {
  console.log('='.repeat(72));
  console.log(' MOI — Live Celo Mainnet Swap: CELO -> USDT with ERC-8021 Attribution');
  console.log('='.repeat(72));

  let rawKey = (process.env.CELO_OPERATOR_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (rawKey && !rawKey.startsWith('0x') && rawKey.length === 64) {
    rawKey = `0x${rawKey}`;
  }

  if (!rawKey) {
    console.error('CELO_OPERATOR_PRIVATE_KEY not set.');
    return;
  }

  const account = privateKeyToAccount(rawKey as Hex);
  const operator = account.address;

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(RPC_URL),
  });

  const [celoBalance, usdtBalanceBefore] = await Promise.all([
    publicClient.getBalance({ address: operator }),
    publicClient.readContract({
      address: USDT_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [operator],
    }),
  ]);

  console.log(`Operator Wallet:   ${operator}`);
  console.log(`CELO Balance:      ${formatEther(celoBalance)} CELO`);
  console.log(`USDT Balance:      ${formatUnits(usdtBalanceBefore, 6)} USDT`);

  const swapAmountCelo = parseEther('3'); // 3 CELO (~$1.95)
  console.log(`\nSwapping 3 CELO -> USDT on Celo Mainnet Uniswap v3 (0.01% pool)...`);

  // Step 1: Check and set allowance on CELO ERC-20
  const currentAllowance = await publicClient.readContract({
    address: CELO_TOKEN,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [operator, SWAP_ROUTER_02],
  });

  if (currentAllowance < swapAmountCelo) {
    console.log(`\n[1/2] Approving Uniswap SwapRouter02 for CELO (with tag ${ATTRIBUTION_TAG})...`);
    const { encodeFunctionData, maxUint256 } = await import('viem');
    const rawApprove = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [SWAP_ROUTER_02, maxUint256],
    });
    const approveData = appendAttributionToCalldata(rawApprove, ATTRIBUTION_TAG);

    const approveTx = await walletClient.sendTransaction({
      to: CELO_TOKEN,
      data: approveData,
    });
    console.log(`  Approve Tx: ${approveTx}`);
    console.log(`  Waiting for confirmation...`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(`  Approved in block #${approveReceipt.blockNumber} (Status: ${approveReceipt.status.toUpperCase()})`);
  } else {
    console.log(`[1/2] Allowance already sufficient: ${formatEther(currentAllowance)} CELO`);
  }

  // Step 2: Execute exactInputSingle swap
  console.log(`\n[2/2] Executing swap via SwapRouter02...`);
  // Encode exactInputSingle call
  const calldataParams = {
    tokenIn: CELO_TOKEN,
    tokenOut: USDT_TOKEN,
    fee: 100, // 0.01% pool
    recipient: operator,
    amountIn: swapAmountCelo,
    amountOutMinimum: 0n, // Accept market output for test
    sqrtPriceLimitX96: 0n,
  };

  const { encodeFunctionData } = await import('viem');
  const rawData = encodeFunctionData({
    abi: routerAbi,
    functionName: 'exactInputSingle',
    args: [calldataParams],
  });

  const taggedSwapData = appendAttributionToCalldata(rawData, ATTRIBUTION_TAG);

  const swapTx = await walletClient.sendTransaction({
    to: SWAP_ROUTER_02,
    data: taggedSwapData,
  });

  console.log(`  Swap Tx Submitted: ${swapTx}`);
  console.log(`  Waiting for block confirmation...`);
  const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
  console.log(`  Confirmed in block #${swapReceipt.blockNumber} (Status: ${swapReceipt.status.toUpperCase()})`);
  console.log(`  Celoscan Link: https://celoscan.io/tx/${swapTx}`);

  // Verify attribution tag onchain
  const attrVerified = await verifyTx({ client: publicClient as any, hash: swapTx });
  console.log(`  Attribution Tag Verified Onchain: ${attrVerified ? 'YES (VERIFIED)' : 'PENDING'}`);

  // Step 3: Check new balances
  const [celoBalanceAfter, usdtBalanceAfter] = await Promise.all([
    publicClient.getBalance({ address: operator }),
    publicClient.readContract({
      address: USDT_TOKEN,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [operator],
    }),
  ]);

  const usdtReceived = usdtBalanceAfter - usdtBalanceBefore;
  console.log('\n' + '='.repeat(72));
  console.log(' SWAP COMPLETED SUCCESSFULLY');
  console.log('='.repeat(72));
  console.log(`CELO Balance:      ${formatEther(celoBalanceAfter)} CELO`);
  console.log(`USDT Balance:      ${formatUnits(usdtBalanceAfter, 6)} USDT (+${formatUnits(usdtReceived, 6)} USDT received)`);
  console.log(`Swap Tx:           https://celoscan.io/tx/${swapTx}`);
  console.log('='.repeat(72));
}

main().catch(console.error);
