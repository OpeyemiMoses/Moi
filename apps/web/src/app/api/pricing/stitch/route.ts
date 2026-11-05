import { NextRequest, NextResponse } from 'next/server';
import {
  CELO_MAINNET_CHAIN_ID,
  CELO_VERIFIED_ASSETS,
  formatAtomicUnits,
  parseAtomicUnits,
} from '@moi/shared-types';
import { TextileFxAdapter, computeStitchTreasuryFeed } from '@moi/textile-adapter';
import { CeloChainService } from '@moi/wallet-signer';
import { moiDb } from '@moi/database';

const textile = new TextileFxAdapter();
const chainService = new CeloChainService();

/**
 * GET /api/pricing/stitch
 * Official Textile Stitch (`textile-stitch`) compatible HTTP Price Feed endpoint.
 * Returns `{ "price", "timestamp", "degraded", ... }` for adaptive inventory-skewed
 * quoting across Celo Mainnet corridors (`cNGN/USDT`, `wARS/USDT`, `wBRL/USDT`, `wCOP/USDT`).
 */
export async function GET(req: NextRequest) {
  const symbolParam = (req.nextUrl.searchParams.get('symbol') || 'cNGN') as
    | 'cNGN'
    | 'wARS'
    | 'wBRL'
    | 'wCOP';
  const balanceOverride = req.nextUrl.searchParams.get('balanceAtomic');

  const asset =
    CELO_VERIFIED_ASSETS[symbolParam] ?? CELO_VERIFIED_ASSETS.cNGN;
  const usdt = CELO_VERIFIED_ASSETS.USDT;
  const state = moiDb.getState();
  const mandate =
    state.mandates.find(
      (m) => m.sellToken.toLowerCase() === asset.address.toLowerCase()
    ) ?? state.mandates[0];

  const sampleInputAtomic = parseAtomicUnits('10000', asset.decimals);
  const livePreview = await textile.preview({
    chainId: CELO_MAINNET_CHAIN_ID,
    sellToken: asset.address,
    buyToken: usdt.address,
    sellAmount: sampleInputAtomic,
  });

  if (
    livePreview.status !== 'preview' ||
    !livePreview.buyAmount ||
    BigInt(livePreview.buyAmount) <= 0n
  ) {
    return NextResponse.json(
      {
        corridor: `${asset.symbol}/USDT`,
        degraded: true,
        reason: 'NO_LIVE_MARKET_PREVIEW',
        error:
          livePreview.reason ||
          'Live Textile FX liquidity unavailable for mid-rate determination',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  const sellHuman = Number(formatAtomicUnits(sampleInputAtomic, asset.decimals));
  const buyHuman = Number(formatAtomicUnits(livePreview.buyAmount, usdt.decimals));
  const midRate = sellHuman / buyHuman;

  // Query live agent wallet balance from onchain Celo RPC if not provided
  let currentBalanceAtomic = balanceOverride;
  if (!currentBalanceAtomic) {
    const balances = await chainService.readWalletBalances(chainService.getAgentWalletAddress());
    const matched = balances.find((b) => b.address.toLowerCase() === asset.address.toLowerCase());
    currentBalanceAtomic = matched?.balanceAtomic || '0';
  }

  const feed = computeStitchTreasuryFeed({
    corridor: `${asset.symbol}/USDT`,
    midReferencePrice: midRate,
    currentLocalBalanceAtomic: currentBalanceAtomic,
    minimumReserveAtomic: mandate.minimumReserveAtomic,
    targetMaxBalanceAtomic: (
      BigInt(mandate.minimumReserveAtomic) + BigInt(mandate.dailySellCapAtomic)
    ).toString(),
    baseSpreadBps: mandate.stitchBaseSpreadBps,
    maxInventorySkewBps: mandate.stitchInventorySkewBps,
  });

  return NextResponse.json(feed);
}

