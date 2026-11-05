import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  extractSessionToken,
  hashSessionToken,
  siweService,
  validateCsrfOrigin,
} from '@moi/identity';
import { moiDb } from '@moi/database';

export async function POST(req: NextRequest) {
  try {
    const csrfCheck = validateCsrfOrigin(req);
    if (!csrfCheck.valid) {
      return NextResponse.json(
        { error: csrfCheck.reason || 'Forbidden: CSRF validation failed.' },
        { status: 403 }
      );
    }

    const rawToken = extractSessionToken(req);
    if (rawToken) {
      const tokenHash = hashSessionToken(rawToken);
      moiDb.revokeSession(tokenHash);
    }

    const body = await req.json().catch(() => ({}));
    const targetWallet =
      body?.walletAddress || moiDb.getState().userProfile?.walletAddress;

    if (targetWallet) {
      siweService.revokeSession(targetWallet);
    }
    const userProfile = moiDb.deauthenticateWallet();

    const response = NextResponse.json({
      ok: true,
      authenticated: false,
      message: 'Authentication session successfully invalidated.',
      userProfile,
    });

    clearSessionCookie(response);
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error processing logout.' },
      { status: 500 }
    );
  }
}

