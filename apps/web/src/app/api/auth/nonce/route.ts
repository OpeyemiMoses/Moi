import { NextRequest, NextResponse } from 'next/server';
import { siweService } from '@moi/identity';

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get('wallet');
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    if (!wallet) {
      return NextResponse.json(
        { error: 'Query parameter "wallet" (EVM address) is required.' },
        { status: 400 }
      );
    }

    const outcome = siweService.generateChallenge({
      walletAddress: wallet,
      clientIp,
    });

    if (!outcome.ok || !outcome.challenge) {
      const isRateLimited = outcome.error?.includes('Too many authentication requests');
      return NextResponse.json(
        { error: outcome.error || 'Failed to generate SIWE challenge.' },
        { status: isRateLimited ? 429 : 400 }
      );
    }

    return NextResponse.json({
      nonce: outcome.challenge.nonce,
      message: outcome.challenge.message,
      domain: outcome.challenge.domain,
      uri: outcome.challenge.uri,
      chainId: outcome.challenge.chainId,
      issuedAt: outcome.challenge.issuedAt,
      expirationTime: outcome.challenge.expirationTime,
      walletAddress: outcome.challenge.address,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error generating authentication challenge.' },
      { status: 500 }
    );
  }
}

