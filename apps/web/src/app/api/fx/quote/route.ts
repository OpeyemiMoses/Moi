import { NextRequest, NextResponse } from 'next/server';
import {
  CELO_MAINNET_CHAIN_ID,
  CELO_VERIFIED_ASSETS,
  findAssetByAddress,
} from '@moi/shared-types';
import { TextileFxAdapter } from '@moi/textile-adapter';
import { treasuryOrchestrator } from '@moi/agent-core';

const textile = new TextileFxAdapter();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = body.mode as 'preview' | 'evaluate_cycle';

    if (mode === 'preview') {
      const sellAsset =
        findAssetByAddress(body.sellToken) ??
        CELO_VERIFIED_ASSETS[body.sellSymbol as keyof typeof CELO_VERIFIED_ASSETS] ??
        CELO_VERIFIED_ASSETS.cNGN;
      const buyAsset =
        findAssetByAddress(body.buyToken) ??
        CELO_VERIFIED_ASSETS[body.buySymbol as keyof typeof CELO_VERIFIED_ASSETS] ??
        CELO_VERIFIED_ASSETS.USDT;

      const preview = await textile.preview({
        chainId: CELO_MAINNET_CHAIN_ID,
        sellToken: sellAsset.address,
        buyToken: buyAsset.address,
        sellAmount: String(body.sellAmountAtomic),
      });

      return NextResponse.json({
        ok: true,
        sellAsset,
        buyAsset,
        preview,
      });
    }

    // Run full deterministic agent evaluation cycle (and optional live execution)
    const outcome = await treasuryOrchestrator.runCycle({
      mandateId: String(body.mandateId || 'mandate_cngn_usdt'),
      requestedSellAtomicOverride: body.sellAmountAtomic
        ? String(body.sellAmountAtomic)
        : undefined,
      userApproved: Boolean(body.userApproved),
      executeLiveIfAuthorized: Boolean(body.executeLiveIfAuthorized),
      flippedDirection: Boolean(body.flippedDirection),
    });

    return NextResponse.json({
      ok: true,
      outcome,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'FX quote evaluation failed' },
      { status: 400 }
    );
  }
}

