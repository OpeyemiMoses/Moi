import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, siweService } from '@moi/identity';
import { moiDb } from '@moi/database';

export async function GET(req: NextRequest) {
  try {
    // 1. Authoritative check: verify HttpOnly session cookie
    const cookieAuth = await authenticateRequest(req);
    if (cookieAuth.authenticated && cookieAuth.user && cookieAuth.session) {
      const tenantState = moiDb.getTenantState(cookieAuth.user.id);
      return NextResponse.json({
        authenticated: true,
        userId: cookieAuth.user.id,
        walletAddress: cookieAuth.session.walletAddress,
        authenticatedAt: cookieAuth.session.createdAt,
        expiresAt: cookieAuth.session.expiresAt,
        userProfile: cookieAuth.user,
        treasury: tenantState.treasury,
      });
    }

    // 2. Secondary check for wallet query parameter
    const walletParam = req.nextUrl.searchParams.get('wallet');
    if (walletParam) {
      const session = siweService.getSession(walletParam);
      const isVerified = Boolean(
        session && siweService.isSessionActive(walletParam)
      );

      if (isVerified) {
        const user = moiDb.getUserByWallet(walletParam) || moiDb.getState().userProfile;
        const tenantState = moiDb.getTenantState(user.id);
        return NextResponse.json({
          authenticated: true,
          userId: user.id,
          walletAddress: session!.walletAddress,
          authenticatedAt: session!.authenticatedAt,
          expiresAt: session!.expiresAt,
          userProfile: user,
          treasury: tenantState.treasury,
        });
      }
    }

    return NextResponse.json({
      authenticated: false,
      walletAddress: null,
      message: 'No active authenticated session found. Please sign in.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error checking authentication session.' },
      { status: 500 }
    );
  }
}

