import { NextRequest, NextResponse } from 'next/server';
import {
  siweService,
  setSessionCookie,
  validateCsrfOrigin,
} from '@moi/identity';
import { moiDb } from '@moi/database';

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF Protection
    const csrfCheck = validateCsrfOrigin(req);
    if (!csrfCheck.valid) {
      return NextResponse.json(
        { error: csrfCheck.reason || 'Forbidden: CSRF validation failed.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON request payload.' },
        { status: 400 }
      );
    }

    const { message, signature, profile } = body;
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'SIWE "message" string is required.' },
        { status: 400 }
      );
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json(
        { error: 'Cryptographic "signature" string is required.' },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Cryptographic server-side verification + session generation
    const outcome = await siweService.verifyAuthentication({
      message,
      signature,
      clientIp,
    });

    if (!outcome.valid || !outcome.walletAddress) {
      const isRateLimited = outcome.error?.includes('Rate limit');
      return NextResponse.json(
        {
          ok: false,
          error: outcome.error || 'Cryptographic SIWE verification failed.',
        },
        { status: isRateLimited ? 429 : 401 }
      );
    }

    // Authenticate and record verified wallet in database
    const userProfile = moiDb.authenticateVerifiedWallet(
      outcome.walletAddress,
      profile
    );
    const tenantState = moiDb.getTenantState(userProfile.id);

    const response = NextResponse.json({
      ok: true,
      verified: true,
      walletAddress: outcome.walletAddress,
      nonceUsed: outcome.nonceUsed,
      userProfile,
      treasury: tenantState.treasury,
    });

    // Issue secure HttpOnly session cookie
    if (outcome.rawSessionToken) {
      setSessionCookie(response, outcome.rawSessionToken);
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error during signature verification.' },
      { status: 500 }
    );
  }
}

