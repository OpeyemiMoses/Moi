import { NextRequest, NextResponse } from 'next/server';
import { BuyX402ServiceClient } from '@moi/buy-client';
import { treasuryOrchestrator } from '@moi/agent-core';

const buyClient = new BuyX402ServiceClient();

export async function GET() {
  const catalog = await buyClient.fetchLiveCatalog();
  return NextResponse.json({
    ok: true,
    metadata: buyClient.getIntegrationMetadata(),
    catalog,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await treasuryOrchestrator.runServicePurchase({
      mandateId: String(body.mandateId || 'mandate_cngn_usdt'),
      capabilityId: String(body.capabilityId || 'chainstack.celo'),
      paymentTokenSymbol: (body.paymentTokenSymbol || 'USAT') as
        | 'USDC'
        | 'USDT'
        | 'USAT',
      requestPayload: body.requestPayload,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'x402 service call failed' },
      { status: 400 }
    );
  }
}

