import { NextRequest, NextResponse } from 'next/server';
import {
  Erc8004IdentityService,
  buildErc8004RegistrationDocument,
} from '@moi/identity';
import { CeloChainService } from '@moi/wallet-signer';
import { moiDb } from '@moi/database';

const identityService = new Erc8004IdentityService();
const chainService = new CeloChainService();

export async function GET(req: NextRequest) {
  const agentIdParam =
    req.nextUrl.searchParams.get('agentId') ||
    process.env.ERC8004_AGENT_ID;

  const agentWallet = chainService.getAgentWalletAddress();
  const agentId = agentIdParam ? Number(agentIdParam) : undefined;
  const hasValidAgentId = agentId !== undefined && !Number.isNaN(agentId) && agentId > 0;

  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const isLocal = forwardedHost?.includes('localhost') || forwardedHost?.includes('127.0.0.1');
  const forwardedProto = isLocal ? 'http' : 'https';
  const detectedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : (process.env.APP_URL || req.nextUrl.origin);

  const registrationDoc = buildErc8004RegistrationDocument({
    appUrl: detectedOrigin,
    agentWallet,
    agentId: hasValidAgentId ? agentId : undefined,
  });

  let onchainInspection = null;
  if (hasValidAgentId) {
    onchainInspection = await identityService.inspectOnchainAgentIdentity(agentId);
  }

  const registrationStatus = onchainInspection?.exists
    ? 'VERIFIED_ONCHAIN'
    : hasValidAgentId
      ? 'UNVERIFIED_OR_NOT_FOUND'
      : 'PENDING_REGISTRATION';

  return NextResponse.json({
    ...registrationDoc,
    status: registrationStatus,
    registrationDocument: registrationDoc,
    onchainInspection,
    verification: {
      registryAddress: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      chainId: 42220,
      network: 'Celo Mainnet',
      agentWallet,
      isSignerConfigured: chainService.isSignerConfigured(),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const agentURI =
      body.agentURI || `${req.nextUrl.origin}/api/identity/agent.json`;

    const result = await identityService.registerAgentOnchain({
      agentURI,
      attributionCode: body.attributionCode,
    });

    // Update in database agent record
    const state = moiDb.getState();
    const firstAgentId = state.agents[0]?.id || 'agent_treasury';
    moiDb.updateAgentIdentity(firstAgentId, result.agentId, result.registryAddress);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'ERC-8004 registration failed' },
      { status: 400 }
    );
  }
}
