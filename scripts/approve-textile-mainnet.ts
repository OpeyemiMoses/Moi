import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
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
const USDT_TOKEN = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as const;
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;
const LIMIT_ORDER_REACTOR = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3' as const;

async function main() {
  let rawKey = (process.env.CELO_OPERATOR_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (rawKey && !rawKey.startsWith('0x') && rawKey.length === 64) {
    rawKey = `0x${rawKey}`;
  }

  const account = privateKeyToAccount(rawKey as Hex);
  const publicClient = createPublicClient({ chain: celo, transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC_URL) });

  console.log(`Approving Permit2 for USDT on Celo Mainnet...`);
  const rawP2 = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [PERMIT2, maxUint256] });
  const dataP2 = appendAttributionToCalldata(rawP2, ATTRIBUTION_TAG);
  const txP2 = await walletClient.sendTransaction({ to: USDT_TOKEN, data: dataP2 });
  console.log(`Permit2 Approve Tx: ${txP2}`);
  const rP2 = await publicClient.waitForTransactionReceipt({ hash: txP2 });
  console.log(`Permit2 Confirmed in block #${rP2.blockNumber}!`);

  console.log(`\nApproving Textile LimitOrderReactor for USDT on Celo Mainnet...`);
  const rawR = encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [LIMIT_ORDER_REACTOR, maxUint256] });
  const dataR = appendAttributionToCalldata(rawR, ATTRIBUTION_TAG);
  const txR = await walletClient.sendTransaction({ to: USDT_TOKEN, data: dataR });
  console.log(`Textile Reactor Approve Tx: ${txR}`);
  const rR = await publicClient.waitForTransactionReceipt({ hash: txR });
  console.log(`Textile Reactor Confirmed in block #${rR.blockNumber}!`);
}

main().catch(console.error);

