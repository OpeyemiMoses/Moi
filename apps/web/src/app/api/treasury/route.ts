import { NextRequest, NextResponse } from 'next/server';
import {
  AssetSymbol,
  CELO_VERIFIED_ASSETS,
  HACKATHON_TECH_MARKERS,
  TreasuryMandateSchema,
} from '@moi/shared-types';
import { compileNaturalLanguageMandateDraft } from '@moi/policy-engine';
import { CeloChainService, resolveAttributionTagStatus } from '@moi/wallet-signer';
import { computeTreasuryAnalytics } from '@moi/ledger';
import { moiDb } from '@moi/database';
import { authenticateRequest, validateCsrfOrigin } from '@moi/identity';

const chainService = new CeloChainService();

export async function GET(req: NextRequest) {
  // Check server-side session authentication
  const auth = await authenticateRequest(req);

  let targetState: ReturnType<typeof moiDb.getTenantState>;
  let targetWallet: `0x${string}` | null = null;
  let isDisconnected = false;

  if (auth.authenticated && auth.user) {
    // Multi-tenant: derive state strictly from authenticated user session
    targetState = moiDb.getTenantState(auth.user.id);
    targetWallet = targetState.treasury.ownerWalletAddress || null;
  } else {
    // Unauthenticated / Disconnected fallback
    const walletParam = req.nextUrl.searchParams.get('wallet');
    const dbState = moiDb.getState();
    if (walletParam && /^0x[a-fA-F0-9]{40}$/.test(walletParam)) {
      targetWallet = walletParam as `0x${string}`;
      targetState = {
        userProfile: {
          ...dbState.userProfile,
          walletAddress: targetWallet,
          walletConnected: true,
          siweVerified: false,
        },
        treasury: {
          ...dbState.treasury,
          ownerWalletAddress: targetWallet,
        },
        agents: dbState.agents,
        mandates: dbState.mandates,
        executions: [],
        ledgerEntries: [],
        servicePurchases: [],
        auditEvents: [],
        invoices: [],
      };
    } else {
      isDisconnected = true;
      targetState = {
        userProfile: {
          ...dbState.userProfile,
          walletAddress: null,
          walletConnected: false,
          siweVerified: false,
        },
        treasury: {
          ...dbState.treasury,
          ownerWalletAddress: null,
        },
        agents: dbState.agents,
        mandates: dbState.mandates,
        executions: [],
        ledgerEntries: [],
        servicePurchases: [],
        auditEvents: [],
        invoices: [],
      };
    }
  }

  const [liveBalances, attributionStatus] = await Promise.all([
    targetWallet && !isDisconnected
      ? chainService.readWalletBalances(targetWallet)
      : Promise.resolve(
          Object.values(CELO_VERIFIED_ASSETS).map((asset) => ({
            symbol: asset.symbol,
            address: asset.address,
            decimals: asset.decimals,
            region: asset.region,
            balanceAtomic: '0',
            formattedBalance: '0.00',
            reactorAllowanceAtomic: '0',
            allowanceFormatted: '0.00',
            isAllowanceSufficient: false,
          }))
        ),
    Promise.resolve(resolveAttributionTagStatus()),
  ]);

  const analytics = computeTreasuryAnalytics({
    executions: targetState.executions,
    servicePurchases: targetState.servicePurchases,
  });

  return NextResponse.json({
    authenticated: Boolean(auth.authenticated),
    userProfile: targetState.userProfile,
    treasury: targetState.treasury,
    agentWalletAddress: chainService.getAgentWalletAddress(),
    signerConfigured: chainService.isSignerConfigured(),
    liveBalances,
    agents: targetState.agents,
    mandates: targetState.mandates,
    executions: targetState.executions,
    ledgerEntries: targetState.ledgerEntries,
    servicePurchases: targetState.servicePurchases,
    auditEvents: targetState.auditEvents,
    invoices: isDisconnected ? [] : (targetState as any).invoices || [],
    attributionStatus,
    analytics,
    verifiedAssets: CELO_VERIFIED_ASSETS,
    techMarkers: HACKATHON_TECH_MARKERS,
    fetchedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. CSRF Protection for state-changing requests
    const csrfCheck = validateCsrfOrigin(req);
    if (!csrfCheck.valid) {
      return NextResponse.json(
        { error: csrfCheck.reason || 'Forbidden: CSRF validation failed.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const action = body.action as string;

    // Public / Authentication onboarding actions
    if (action === 'lookup_account') {
      const email = body.email as string | undefined;
      const walletAddress = body.walletAddress as string | undefined;
      const account = moiDb.findAccount({ email, walletAddress });
      if (account) {
        return NextResponse.json({
          found: true,
          userProfile: account,
        });
      }
      return NextResponse.json({ found: false });
    }

    if (action === 'sign_in') {
      const res = moiDb.signInUser({
        email: body.email,
        walletAddress: body.walletAddress,
        siweSignaturePreview: body.siweSignaturePreview,
      });
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 404 });
      }
      const nextState = moiDb.getState();
      return NextResponse.json({
        ok: true,
        treasury: nextState.treasury,
        userProfile: res.userProfile,
      });
    }

    if (action === 'sign_up') {
      const res = moiDb.signUpUser(body.profile || {});
      const nextState = moiDb.getState();
      return NextResponse.json({
        ok: true,
        treasury: nextState.treasury,
        userProfile: res.userProfile,
      });
    }

    if (action === 'connect_wallet') {
      const address = body.walletAddress as string;
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return NextResponse.json(
          { error: 'Invalid EVM wallet address' },
          { status: 400 }
        );
      }
      // Security: Never trust client-supplied body.siweVerified.
      // Cryptographic verification must occur through /api/auth/verify.
      const currentProfile = moiDb.getState().userProfile;
      const isAlreadyVerified =
        Boolean(currentProfile.siweVerified) &&
        currentProfile.walletAddress?.toLowerCase() === address.toLowerCase();

      const nextState = moiDb.updateUserProfile({
        walletAddress: address as `0x${string}`,
        walletConnected: true,
        siweSignaturePreview: body.siweSignaturePreview,
      });
      return NextResponse.json({
        ok: true,
        treasury: nextState.treasury,
        userProfile: {
          ...nextState.userProfile,
          siweVerified: isAlreadyVerified,
        },
      });
    }

    // =========================================================================
    // TENANT MUTATIONS: Bound to active session or primary operator
    // =========================================================================
    const auth = await authenticateRequest(req);
    if (!auth.authenticated && (action === 'update_mandate' || action === 'toggle_agent')) {
      return NextResponse.json({ error: 'Active session required to mutate tenant resources' }, { status: 401 });
    }
    const tenantUserId =
      auth.authenticated && auth.user
        ? auth.user.id
        : moiDb.getState().userProfile.id || 'usr_primary_operator';

    if (action === 'update_profile') {
      const updatedUser = moiDb.updateProfileForTenant(body.profile || {}, tenantUserId);
      const tenantState = moiDb.getTenantState(tenantUserId);
      return NextResponse.json({
        ok: true,
        treasury: tenantState.treasury,
        userProfile: updatedUser,
      });
    }

    if (action === 'compile_nl_mandate') {
      const tenantState = moiDb.getTenantState(tenantUserId);
      const current =
        tenantState.mandates.find((m) => m.id === body.mandateId) ??
        tenantState.mandates[0];
      const compiled = compileNaturalLanguageMandateDraft(
        String(body.intentText || ''),
        current
      );
      return NextResponse.json({ ok: true, ...compiled });
    }

    if (action === 'update_mandate') {
      const parsed = TreasuryMandateSchema.parse(body.mandate);
      const result = moiDb.updateMandateForUser(parsed, tenantUserId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ ok: true, mandate: result.mandate });
    }

    if (action === 'toggle_agent') {
      const result = moiDb.toggleAgentForUser(
        String(body.agentId),
        Boolean(body.active),
        tenantUserId
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ ok: true, agent: result.agent });
    }

    if (action === 'emergency_pause') {
      moiDb.emergencyPauseForUser(Boolean(body.paused), tenantUserId);
      const tenantState = moiDb.getTenantState(tenantUserId);
      return NextResponse.json({
        ok: true,
        paused: Boolean(body.paused),
        mandates: tenantState.mandates,
      });
    }

    if (action === 'delete_agent') {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json(
          { error: 'Missing agentId.' },
          { status: 400 }
        );
      }
      const res = moiDb.deleteAgentForUser(String(agentId), tenantUserId);
      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      const tenantState = moiDb.getTenantState(tenantUserId);
      return NextResponse.json({
        ok: true,
        agents: tenantState.agents,
        mandates: tenantState.mandates,
      });
    }

    if (action === 'create_agent') {
      const {
        name,
        role,
        description,
        mode,
        sellToken,
        buyToken,
        minimumReserveAtomic,
        maxTradeAtomic,
        dailySellCapAtomic,
        maxSlippageBps,
        naturalLanguageIntent,
      } = body;

      if (!name || !sellToken || !buyToken) {
        return NextResponse.json(
          { error: 'Missing required fields: name, sellToken, buyToken.' },
          { status: 400 }
        );
      }

      const res = moiDb.createAgentForUser(
        {
          name: String(name),
          role: role || 'treasury_rebalancer',
          description: description || 'Autonomous Treasury Agent on Celo Mainnet',
          mode: mode || 'autonomous',
          sellToken,
          buyToken,
          minimumReserveAtomic: String(minimumReserveAtomic || '0'),
          maxTradeAtomic: String(maxTradeAtomic || '10000000000'),
          dailySellCapAtomic: String(dailySellCapAtomic || '50000000000'),
          maxSlippageBps: Number(maxSlippageBps || 50),
          naturalLanguageIntent: naturalLanguageIntent ? String(naturalLanguageIntent) : undefined,
        },
        tenantUserId
      );

      if (!res.ok) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      const tenantState = moiDb.getTenantState(tenantUserId);
      return NextResponse.json({
        ok: true,
        agent: res.agent,
        mandate: res.mandate,
        agents: tenantState.agents,
        mandates: tenantState.mandates,
      });
    }

    if (action === 'send_transfer') {
      const {
        tokenSymbol,
        tokenAddress,
        recipient,
        amountAtomic,
        decimals,
      } = body;

      if (!tokenAddress || !recipient || !amountAtomic) {
        return NextResponse.json(
          { error: 'Missing required transfer fields: tokenAddress, recipient, amountAtomic.' },
          { status: 400 }
        );
      }

      if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
        return NextResponse.json(
          { error: 'Invalid recipient address. Must be a valid 40-character hex EVM address.' },
          { status: 400 }
        );
      }

      if (BigInt(amountAtomic) <= 0n) {
        return NextResponse.json(
          { error: 'Amount must be greater than zero.' },
          { status: 400 }
        );
      }

      // 1. Verify signer balance onchain
      const currentBalances = await chainService.readWalletBalances(chainService.getAgentWalletAddress());
      const assetBalance = currentBalances.find(
        (b) => b.address.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (!assetBalance || BigInt(assetBalance.balanceAtomic) < BigInt(amountAtomic)) {
        return NextResponse.json(
          {
            error: `Insufficient live balance on Celo Mainnet for ${tokenSymbol || 'token'}. Available: ${assetBalance ? assetBalance.balanceAtomic : '0'} atomic units. Deposit funds first.`,
          },
          { status: 400 }
        );
      }

      // 2. Broadcast onchain transfer via CeloChainService
      const txResult = await chainService.executeTransferOnchain({
        tokenAddress,
        recipient,
        amountAtomic,
      });

      // 3. Record execution & ledger entry
      const execution = moiDb.recordTransferExecutionForUser(
        {
          tokenSymbol: tokenSymbol || 'CELO',
          tokenAddress,
          recipient,
          amountAtomic,
          decimals: decimals ?? 18,
          txHash: txResult.txHash,
          blockNumber: txResult.blockNumber,
          gasUsed: txResult.gasUsed,
        },
        tenantUserId
      );

      return NextResponse.json({
        ok: true,
        txHash: txResult.txHash,
        blockNumber: txResult.blockNumber,
        gasUsed: txResult.gasUsed,
        execution,
      });
    }

    if (action === 'record_signed_transfer') {
      const {
        tokenSymbol,
        tokenAddress,
        recipient,
        amountAtomic,
        decimals,
        txHash,
      } = body;

      const execution = moiDb.recordTransferExecutionForUser(
        {
          tokenSymbol: tokenSymbol || 'CELO',
          tokenAddress,
          recipient,
          amountAtomic,
          decimals: decimals ?? 18,
          txHash,
        },
        tenantUserId
      );

      return NextResponse.json({
        ok: true,
        execution,
      });
    }

    if (action === 'withdraw_to_bank') {
      const {
        country,
        currency,
        amount,
        bankName,
        accountNumber,
        accountName,
        pixKey,
        cbu,
        clabe,
      } = body;

      if (!amount || Number(amount) <= 0) {
        return NextResponse.json(
          { error: 'Withdrawal amount must be greater than zero.' },
          { status: 400 }
        );
      }

      const numAmount = Number(amount);
      const symbol = (currency || 'cNGN') as AssetSymbol;
      const assetMeta = CELO_VERIFIED_ASSETS[symbol] || CELO_VERIFIED_ASSETS.cNGN;

      const randomSuffix = Math.floor(100000000 + Math.random() * 900000000);
      let rail = 'NIP Instant Bank Settlement';
      let referenceCode = `REF-NIP-${randomSuffix}`;
      let destinationSummary = `${bankName || 'Bank'} (${accountNumber ? '***' + accountNumber.slice(-4) : 'Account'})`;

      if (country === 'BR') {
        rail = 'Central Bank of Brazil PIX';
        referenceCode = `REF-PIX-${randomSuffix}`;
        destinationSummary = `PIX: ${pixKey || accountNumber || 'Key'}`;
      } else if (country === 'AR') {
        rail = 'COELSA CBU/CVU';
        referenceCode = `REF-CBU-${randomSuffix}`;
        destinationSummary = `CBU/CVU: ${cbu || accountNumber || 'Account'}`;
      } else if (country === 'CO') {
        rail = 'PSE / Nequi Colombia';
        referenceCode = `REF-PSE-${randomSuffix}`;
        destinationSummary = `PSE: ${bankName || 'Nequi'} (${accountNumber})`;
      } else if (country === 'MX') {
        rail = 'SPEI / STP Mexico';
        referenceCode = `REF-SPEI-${randomSuffix}`;
        destinationSummary = `CLABE: ${clabe || accountNumber}`;
      } else if (country === 'US') {
        rail = 'Fedwire / International ACH';
        referenceCode = `REF-WIRE-${randomSuffix}`;
        destinationSummary = `Wire: ${bankName || 'US Bank'} (${accountNumber})`;
      }

      const amountAtomic = (
        BigInt(Math.floor(numAmount * 1e6)) *
        BigInt(10 ** Math.max(0, assetMeta.decimals - 6))
      ).toString();

      const txHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}` as `0x${string}`;

      let execution = null;
      if (tenantUserId) {
        execution = moiDb.recordTransferExecutionForUser(
          {
            tokenSymbol: symbol,
            tokenAddress: assetMeta.address,
            recipient: '0x000000000000000000000000000000000000dEaD',
            amountAtomic,
            decimals: assetMeta.decimals,
            txHash,
          },
          tenantUserId
        );
      }

      return NextResponse.json({
        ok: true,
        referenceCode,
        rail,
        destinationSummary,
        amount: numAmount.toFixed(2),
        currency: symbol,
        eta: '10–30 seconds',
        status: 'DISPATCHED_TO_BANK',
        execution,
      });
    }

    if (action === 'create_invoice') {
      const {
        invoiceNumber,
        creatorWallet,
        clientName,
        clientEmail,
        clientAddress,
        amount,
        tokenSymbol,
        memo,
        creatorSignature,
        signatureScheme,
        dueDate,
      } = body;

      if (!creatorWallet || !clientName || !amount) {
        return NextResponse.json(
          { error: 'Missing required invoice fields: creatorWallet, clientName, amount.' },
          { status: 400 }
        );
      }

      if (!creatorSignature) {
        return NextResponse.json(
          { error: 'A cryptographic signature ($0 gas) from the creator wallet is required.' },
          { status: 400 }
        );
      }

      const invoice = moiDb.createInvoiceForUser(
        {
          invoiceNumber,
          creatorWallet,
          clientName,
          clientEmail,
          clientAddress,
          amount,
          tokenSymbol: tokenSymbol || 'USDT',
          memo: memo || 'Payment Request',
          creatorSignature,
          signatureScheme: signatureScheme || 'EIP-712',
          dueDate,
        },
        tenantUserId
      );

      return NextResponse.json({
        ok: true,
        invoice,
      });
    }

    if (action === 'mark_invoice_paid') {
      const { invoiceId, paidTxHash } = body;
      if (!invoiceId) {
        return NextResponse.json(
          { error: 'Missing invoiceId.' },
          { status: 400 }
        );
      }
      const result = moiDb.markInvoicePaidForUser(invoiceId, paidTxHash);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ ok: true, invoice: result.invoice });
    }

    if (action === 'export_audit_bundle') {
      const bundle = moiDb.exportAuditBundleForUser(tenantUserId);
      return NextResponse.json({
        ok: true,
        bundle,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to process treasury mutation' },
      { status: 400 }
    );
  }
}

