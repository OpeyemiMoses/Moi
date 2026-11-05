import crypto, { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CELO_MAINNET_CHAIN_ID,
  CELO_VERIFIED_ASSETS,
  FirmQuote,
  PolicyCheckDetail,
  PolicyEvaluationResult,
  TEXTILE_CONTRACTS,
  TreasuryMandate,
  FirstTradeAuthorizationRecord,
  findAssetByAddress,
  formatAtomicUnits,
  parseAtomicUnits,
} from '@moi/shared-types';

export const INTERNAL_POLICY_HMAC_SECRET =
  process.env.INTERNAL_POLICY_HMAC_SECRET || 'moi_internal_deterministic_policy_enclave_key_v2';

export interface PolicyAttestationParams {
  userId?: string;
  treasuryId?: string;
  mandateId: string;
  agentId?: string;
  executionId?: string;
  rfqId: string;
  chainId: number;
  sellToken?: string;
  buyToken?: string;
  takerPays: string;
  minimumBuyAmount?: string;
  buyAmount?: string;
  swapTo: string;
  calldataHash?: string;
  quoteExpiry?: string;
  expiresAt?: string;
  attestationExpiry?: string;
  nonce?: string;
}

export function buildCanonicalAttestationPayload(params: {
  userId: string;
  treasuryId: string;
  mandateId: string;
  agentId: string;
  executionId: string;
  rfqId: string;
  chainId: number | string;
  sellToken: string;
  buyToken: string;
  takerPays: string;
  minimumBuyAmount: string;
  swapTo: string;
  calldataHash: string;
  quoteExpiry: string;
  attestationExpiry: string;
  nonce: string;
}): string {
  const qExp = isNaN(Number(params.quoteExpiry))
    ? String(new Date(params.quoteExpiry).getTime())
    : params.quoteExpiry;
  const aExp = isNaN(Number(params.attestationExpiry))
    ? String(new Date(params.attestationExpiry).getTime())
    : params.attestationExpiry;

  return [
    params.userId,
    params.treasuryId,
    params.mandateId,
    params.agentId,
    params.executionId,
    params.rfqId,
    String(params.chainId),
    params.sellToken.toLowerCase(),
    params.buyToken.toLowerCase(),
    params.takerPays,
    params.minimumBuyAmount,
    params.swapTo.toLowerCase(),
    params.calldataHash,
    qExp,
    aExp,
    params.nonce,
  ].join(':');
}

export function generatePolicyAttestation(
  params: PolicyAttestationParams,
  secret: string = INTERNAL_POLICY_HMAC_SECRET
): { payload: string; signature: string; nonce: string } {
  const nonce = params.nonce || crypto.randomUUID();
  const quoteExp =
    params.quoteExpiry ||
    params.expiresAt ||
    new Date(Date.now() + 60000).toISOString();
  const attExp =
    params.attestationExpiry || new Date(Date.now() + 60000).toISOString();
  const minBuy = params.minimumBuyAmount || params.buyAmount || '0';

  let payload: string;
  if (
    params.userId &&
    params.treasuryId &&
    params.agentId &&
    params.executionId &&
    params.sellToken &&
    params.buyToken &&
    params.calldataHash
  ) {
    payload = buildCanonicalAttestationPayload({
      userId: params.userId,
      treasuryId: params.treasuryId,
      mandateId: params.mandateId,
      agentId: params.agentId,
      executionId: params.executionId,
      rfqId: params.rfqId,
      chainId: params.chainId,
      sellToken: params.sellToken,
      buyToken: params.buyToken,
      takerPays: params.takerPays,
      minimumBuyAmount: minBuy,
      swapTo: params.swapTo,
      calldataHash: params.calldataHash,
      quoteExpiry: quoteExp,
      attestationExpiry: attExp,
      nonce,
    });
  } else {
    // Legacy 7-field fallback
    payload = [
      params.mandateId,
      params.rfqId,
      params.takerPays,
      params.buyAmount || minBuy,
      params.swapTo.toLowerCase(),
      String(params.chainId),
      quoteExp,
    ].join(':');
  }

  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { payload, signature, nonce };
}

export function verifyPolicyAttestation(
  payload: string,
  signature: string,
  secret: string = INTERNAL_POLICY_HMAC_SECRET
): boolean {
  if (!payload || !signature) return false;
  try {
    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

export function parseAttestationPayload(payload: string): {
  isCanonical16: boolean;
  userId?: string;
  treasuryId?: string;
  mandateId: string;
  agentId?: string;
  executionId?: string;
  rfqId: string;
  chainId: number;
  sellToken?: string;
  buyToken?: string;
  takerPays: string;
  minimumBuyAmount: string;
  swapTo: string;
  calldataHash?: string;
  quoteExpiry: string;
  attestationExpiry?: string;
  nonce?: string;
} {
  const parts = payload.split(':');
  if (parts.length === 16) {
    return {
      isCanonical16: true,
      userId: parts[0],
      treasuryId: parts[1],
      mandateId: parts[2],
      agentId: parts[3],
      executionId: parts[4],
      rfqId: parts[5],
      chainId: Number(parts[6]),
      sellToken: parts[7],
      buyToken: parts[8],
      takerPays: parts[9],
      minimumBuyAmount: parts[10],
      swapTo: parts[11],
      calldataHash: parts[12],
      quoteExpiry: !isNaN(Number(parts[13]))
        ? new Date(Number(parts[13])).toISOString()
        : parts[13],
      attestationExpiry: !isNaN(Number(parts[14]))
        ? new Date(Number(parts[14])).toISOString()
        : parts[14],
      nonce: parts[15],
    };
  }
  return {
    isCanonical16: false,
    mandateId: parts[0],
    rfqId: parts[1],
    takerPays: parts[2],
    minimumBuyAmount: parts[3],
    swapTo: parts[4],
    chainId: Number(parts[5]),
    quoteExpiry: parts[6],
  };
}

export interface PolicyEvaluationContext {
  mandate: TreasuryMandate;
  quote: FirmQuote;
  expectedTakerWallet: `0x${string}`;
  currentSellBalanceAtomic: string;
  currentDailySoldAtomic: string;
  currentDailyLossAtomic?: string;
  activeExecutionLock: boolean;
  signerHealthy: boolean;
  userApproved?: boolean;
  nowMs?: number;
  // Milestone 2.5 additions
  userId?: string;
  treasuryId?: string;
  agentId?: string;
  executionId?: string;
  settledExecutionsCount?: number;
  firstTradeAuthorization?: FirstTradeAuthorizationRecord;
}

/**
 * Deterministic Policy Engine (Sections 8.7 & 12.4)
 * Strictly isolated from the LLM boundary. Every check uses exact BigInt atomic math.
 */
export function evaluateSwapPolicy(ctx: PolicyEvaluationContext): PolicyEvaluationResult {
  const checks: PolicyCheckDetail[] = [];
  const nowMs = ctx.nowMs ?? Date.now();
  const { mandate, quote } = ctx;

  const pushCheck = (
    ruleId: string,
    ruleName: string,
    passed: boolean,
    reason: string,
    actualValue?: string,
    thresholdValue?: string
  ) => {
    checks.push({ ruleId, ruleName, passed, reason, actualValue, thresholdValue });
  };

  // 1. Mandate active / Not paused
  pushCheck(
    'MANDATE_NOT_PAUSED',
    'Treasury & Mandate Active (Not Paused)',
    !mandate.paused,
    mandate.paused
      ? 'Emergency pause is active on this mandate.'
      : 'Mandate is active and not paused.',
    String(mandate.paused),
    'false'
  );

  // 1b. SEC-M2-02: Mandatory First-Trade Owner Authorization Gate
  const isFirstTrade = ctx.settledExecutionsCount === 0;
  let firstTradeAuthorized = true;
  let firstTradeReason = isFirstTrade
    ? 'First-trade owner authorization verified.'
    : 'Not first trade; prior settled executions exist.';

  if (isFirstTrade) {
    const auth = ctx.firstTradeAuthorization;
    if (!auth) {
      firstTradeAuthorized = false;
      firstTradeReason =
        'Mandatory First-Trade Gate: Treasury has 0 settled executions. An explicit owner authorization is required before the first trade can be executed, even in autonomous mode.';
    } else if (auth.consumed) {
      firstTradeAuthorized = false;
      firstTradeReason = 'First-trade authorization has already been consumed.';
    } else if (new Date(auth.expiresAt).getTime() < nowMs) {
      firstTradeAuthorized = false;
      firstTradeReason = `First-trade authorization expired at ${auth.expiresAt}.`;
    } else if (
      ctx.executionId &&
      auth.executionId &&
      auth.executionId !== ctx.executionId
    ) {
      firstTradeAuthorized = false;
      firstTradeReason = `First-trade authorization executionId mismatch (${auth.executionId} vs ${ctx.executionId}).`;
    } else if (auth.treasuryId !== mandate.treasuryId) {
      firstTradeAuthorized = false;
      firstTradeReason = `First-trade authorization treasury mismatch (${auth.treasuryId} vs ${mandate.treasuryId}).`;
    } else if (
      auth.sellToken.toLowerCase() !== mandate.sellToken.toLowerCase() ||
      auth.buyToken.toLowerCase() !== mandate.buyToken.toLowerCase()
    ) {
      firstTradeAuthorized = false;
      firstTradeReason = `First-trade authorization token corridor mismatch.`;
    } else if (
      quote.quote &&
      BigInt(auth.amountInAtomic) < BigInt(quote.quote.takerPays)
    ) {
      firstTradeAuthorized = false;
      firstTradeReason = `First-trade authorization amount (${auth.amountInAtomic}) is lower than quoted takerPays (${quote.quote.takerPays}).`;
    } else if (
      quote.quote &&
      BigInt(quote.quote.buyAmount) < BigInt(auth.minBuyAmountAtomic)
    ) {
      firstTradeAuthorized = false;
      firstTradeReason = `Quoted buyAmount (${quote.quote.buyAmount}) is lower than authorized minBuyAmountAtomic (${auth.minBuyAmountAtomic}).`;
    } else if (
      quote.transactions?.swap &&
      auth.destinationContract.toLowerCase() !==
        quote.transactions.swap.to.toLowerCase()
    ) {
      firstTradeAuthorized = false;
      firstTradeReason = `First-trade authorization destination contract mismatch (${auth.destinationContract} vs ${quote.transactions.swap.to}).`;
    }
  }

  pushCheck(
    'FIRST_TRADE_OWNER_AUTHORIZATION',
    'First-Trade Mandatory Owner Authorization Gate',
    firstTradeAuthorized,
    firstTradeReason,
    isFirstTrade
      ? firstTradeAuthorized
        ? 'AUTHORIZED'
        : 'MISSING_OR_INVALID'
      : 'NOT_FIRST_TRADE',
    'AUTHORIZED_OR_NOT_FIRST'
  );

  // 2. Operating mode authorization (Autonomous mode cannot bypass first-trade authorization)
  const modeAuthorized =
    (mandate.mode === 'autonomous' && !isFirstTrade) ||
    (mandate.mode === 'autonomous' && isFirstTrade && firstTradeAuthorized) ||
    (mandate.mode === 'approval_required' &&
      (ctx.userApproved === true || (isFirstTrade && firstTradeAuthorized)));

  pushCheck(
    'OPERATING_MODE',
    'Operating Mode Permits Execution',
    modeAuthorized,
    modeAuthorized
      ? `Authorized via "${mandate.mode}" mode${isFirstTrade ? ' with verified first-trade owner authorization' : ''}.`
      : isFirstTrade && mandate.mode === 'autonomous'
        ? 'Autonomous mode cannot bypass mandatory first-trade owner authorization.'
        : mandate.mode === 'monitor'
          ? 'Mandate is in Monitor-Only mode; transaction signing is blocked.'
          : 'Mandate requires explicit user approval before execution.',
    mandate.mode,
    'autonomous | approved'
  );

  // 3. Distributed Execution Lock check
  pushCheck(
    'NO_DUPLICATE_LOCK',
    'No Concurrent Execution In Flight',
    !ctx.activeExecutionLock,
    ctx.activeExecutionLock
      ? 'An execution lock is already active for this treasury mandate.'
      : 'No duplicate execution in progress.',
    String(ctx.activeExecutionLock),
    'false'
  );

  // 4. Signer health check
  pushCheck(
    'SIGNER_HEALTHY',
    'Restricted Signer Boundary Healthy',
    ctx.signerHealthy,
    ctx.signerHealthy
      ? 'Restricted signer boundary is reachable and configured.'
      : 'Restricted signer is unavailable or unconfigured.',
    String(ctx.signerHealthy),
    'true'
  );

  // 5. Chain ID verification (Celo Mainnet 42220)
  const swapChainId = quote.transactions?.swap.chainId ?? mandate.chainId;
  const chainValid =
    mandate.chainId === CELO_MAINNET_CHAIN_ID && swapChainId === CELO_MAINNET_CHAIN_ID;
  pushCheck(
    'CHAIN_ID_CELO_MAINNET',
    'Celo Mainnet Chain ID (42220)',
    chainValid,
    chainValid
      ? 'Confirmed Celo Mainnet (chainId: 42220).'
      : `Invalid chainId (${swapChainId}); only Celo Mainnet (42220) is permitted.`,
    String(swapChainId),
    String(CELO_MAINNET_CHAIN_ID)
  );

  // 6. Quote status & presence
  const hasFirmQuote = quote.status === 'quoted' && !!quote.quote && !!quote.transactions?.swap;
  pushCheck(
    'FIRM_QUOTE_PRESENT',
    'Executable Firm Quote Present',
    hasFirmQuote,
    hasFirmQuote
      ? `Firm quote ${quote.rfqId} received.`
      : `Quote is not executable (status: ${quote.status}, reason: ${quote.reason ?? 'unknown'}).`,
    quote.status,
    'quoted'
  );

  if (!hasFirmQuote || !quote.quote || !quote.transactions?.swap) {
    const failedReasons = checks.filter((c) => !c.passed).map((c) => c.reason);
    return {
      authorized: false,
      mandateId: mandate.id,
      evaluatedAt: new Date(nowMs).toISOString(),
      checks,
      failedReasons,
    };
  }

  const q = quote.quote;
  const swapTx = quote.transactions.swap;

  // 7. Taker wallet matches restricted agent wallet
  const takerMatches =
    q.taker.toLowerCase() === ctx.expectedTakerWallet.toLowerCase();
  pushCheck(
    'TAKER_WALLET_MATCH',
    'Taker Matches Restricted Agent Wallet',
    takerMatches,
    takerMatches
      ? `Taker wallet verified (${q.taker}).`
      : `Quote taker (${q.taker}) does not match expected agent wallet (${ctx.expectedTakerWallet}).`,
    q.taker,
    ctx.expectedTakerWallet
  );

  // 8. Quote Expiry & Order Deadline check (with 2-second safety buffer)
  const expiresAtMs = Date.parse(q.expiresAt);
  const orderDeadlineMs = Date.parse(q.orderDeadline);
  const notExpired =
    !Number.isNaN(expiresAtMs) &&
    expiresAtMs > nowMs + 2000 &&
    orderDeadlineMs > nowMs + 2000;
  pushCheck(
    'QUOTE_NOT_EXPIRED',
    'Quote Accept Window & Order Deadline Live',
    notExpired,
    notExpired
      ? `Quote valid until ${q.expiresAt} (${Math.round((expiresAtMs - nowMs) / 1000)}s remaining).`
      : `Quote expired or within 2s safety cutoff (expiresAt: ${q.expiresAt}).`,
    q.expiresAt,
    new Date(nowMs + 2000).toISOString()
  );

  // 9. Allowlisted token corridor check
  const sellAsset = findAssetByAddress(mandate.sellToken);
  const buyAsset = findAssetByAddress(mandate.buyToken);
  const pairVerified = !!sellAsset && !!buyAsset && sellAsset.address !== buyAsset.address;
  pushCheck(
    'ALLOWLISTED_CORRIDOR',
    'Verified Celo Token Corridor',
    pairVerified,
    pairVerified
      ? `Verified corridor: ${sellAsset.symbol} → ${buyAsset.symbol}.`
      : `Unverified token pair (${mandate.sellToken} -> ${mandate.buyToken}).`,
    `${sellAsset?.symbol ?? mandate.sellToken} -> ${buyAsset?.symbol ?? mandate.buyToken}`,
    'Verified Celo Registry'
  );

  // 10. Approved Settlement Reactor Target check
  const allowedLower = mandate.allowedTargets.map((t) => t.toLowerCase());
  const reactorIsOfficial =
    q.reactor.toLowerCase() === TEXTILE_CONTRACTS.LimitOrderReactor.toLowerCase() &&
    swapTx.to.toLowerCase() === TEXTILE_CONTRACTS.LimitOrderReactor.toLowerCase() &&
    allowedLower.includes(swapTx.to.toLowerCase());
  pushCheck(
    'APPROVED_REACTOR_TARGET',
    'Approved Textile LimitOrderReactor Target',
    reactorIsOfficial,
    reactorIsOfficial
      ? `Target verified: Textile LimitOrderReactor (${swapTx.to}).`
      : `Unauthorized transaction target (${swapTx.to}).`,
    swapTx.to,
    TEXTILE_CONTRACTS.LimitOrderReactor
  );

  // 11. Transaction Value === "0" & Non-empty Calldata check
  const zeroNativeValue = BigInt(swapTx.value || '0') === 0n;
  const validCalldata = swapTx.data.startsWith('0x') && swapTx.data.length >= 10;
  pushCheck(
    'CALLDATA_AND_VALUE_GUARD',
    'Zero Native Value & Valid Reactor Calldata',
    zeroNativeValue && validCalldata,
    zeroNativeValue && validCalldata
      ? 'Swap transaction value is 0 (fees in sell token) and calldata is well-formed.'
      : `Invalid tx value (${swapTx.value}) or malformed calldata.`,
    `value=${swapTx.value}, dataLen=${swapTx.data.length}`,
    'value=0, dataLen>=10'
  );

  // 12. Per-Trade Cap check (takerPays <= maxTradeAtomic)
  const takerPays = BigInt(q.takerPays);
  const maxTrade = BigInt(mandate.maxTradeAtomic);
  const withinMaxTrade = takerPays > 0n && takerPays <= maxTrade;
  pushCheck(
    'PER_TRADE_CAP',
    'Within Per-Trade Spend Cap',
    withinMaxTrade,
    withinMaxTrade
      ? `takerPays (${q.takerPays}) is within maxTradeAtomic (${mandate.maxTradeAtomic}).`
      : `takerPays (${q.takerPays}) exceeds per-trade cap (${mandate.maxTradeAtomic}).`,
    q.takerPays,
    mandate.maxTradeAtomic
  );

  // 13. Cumulative Daily Conversion Cap check
  const dailySold = BigInt(ctx.currentDailySoldAtomic);
  const dailyCap = BigInt(mandate.dailySellCapAtomic);
  const projectedDaily = dailySold + takerPays;
  const withinDailyCap = projectedDaily <= dailyCap;
  pushCheck(
    'DAILY_SELL_CAP',
    'Within 24h Cumulative Conversion Cap',
    withinDailyCap,
    withinDailyCap
      ? `Projected daily volume (${projectedDaily.toString()}) is within daily cap (${dailyCap.toString()}).`
      : `Projected daily volume (${projectedDaily.toString()}) exceeds daily cap (${dailyCap.toString()}).`,
    projectedDaily.toString(),
    mandate.dailySellCapAtomic
  );

  // 14. Minimum Operating Reserve Preservation check
  const currentBalance = BigInt(ctx.currentSellBalanceAtomic);
  const minReserve = BigInt(mandate.minimumReserveAtomic);
  const sufficientBalance = currentBalance >= takerPays;
  const postSwapBalance = sufficientBalance ? currentBalance - takerPays : 0n;
  const reservePreserved = sufficientBalance && postSwapBalance >= minReserve;
  pushCheck(
    'MINIMUM_RESERVE_PRESERVED',
    'Preserves Minimum Operating Reserve',
    reservePreserved,
    reservePreserved
      ? `Post-swap reserve (${postSwapBalance.toString()}) preserves minimum reserve (${minReserve.toString()}).`
      : !sufficientBalance
        ? `Insufficient balance (${currentBalance.toString()}) to cover takerPays (${takerPays.toString()}).`
        : `Post-swap balance (${postSwapBalance.toString()}) would breach minimum reserve (${minReserve.toString()}).`,
    postSwapBalance.toString(),
    mandate.minimumReserveAtomic
  );

  // 15. Minimum Acceptable Output Threshold check
  const buyAmount = BigInt(q.buyAmount);
  const minBuy = mandate.minBuyAmountAtomic ? BigInt(mandate.minBuyAmountAtomic) : 1n;
  const meetsMinOutput = buyAmount >= minBuy;
  pushCheck(
    'MIN_BUY_OUTPUT_THRESHOLD',
    'Meets Minimum Acceptable Buy Output',
    meetsMinOutput,
    meetsMinOutput
      ? `Quoted output (${q.buyAmount}) meets minimum threshold (${minBuy.toString()}).`
      : `Quoted output (${q.buyAmount}) is below minimum threshold (${minBuy.toString()}).`,
    q.buyAmount,
    minBuy.toString()
  );

  // 16. Protocol Fee Ceiling Check (Default <= 25 bps; Textile Celo is 1 bps)
  const feeAmount = BigInt(q.feeAmount);
  const feeBps = takerPays > 0n ? Number((feeAmount * 10000n) / takerPays) : 0;
  const maxFeeBps = mandate.maxProtocolFeeBps ?? 25;
  const feeAcceptable = feeBps <= maxFeeBps;
  pushCheck(
    'PROTOCOL_FEE_BOUND',
    'Protocol Fee Within Policy Ceiling',
    feeAcceptable,
    feeAcceptable
      ? `Protocol fee (${feeBps} bps) is within limit (${maxFeeBps} bps).`
      : `Protocol fee (${feeBps} bps) exceeds policy maximum (${maxFeeBps} bps).`,
    `${feeBps} bps`,
    `${maxFeeBps} bps`
  );

  // 17. Daily Loss / Risk Limit Check
  if (mandate.maxDailyLossAtomic) {
    const currentLoss = BigInt(ctx.currentDailyLossAtomic ?? '0');
    const maxLoss = BigInt(mandate.maxDailyLossAtomic);
    const withinLossLimit = currentLoss < maxLoss;
    pushCheck(
      'DAILY_LOSS_CIRCUIT_BREAKER',
      'Daily Risk / Loss Limit Not Breached',
      withinLossLimit,
      withinLossLimit
        ? `Cumulative daily risk impact (${currentLoss.toString()}) is below circuit breaker (${maxLoss.toString()}).`
        : `Daily loss limit (${maxLoss.toString()}) reached; halting autonomous execution.`,
      currentLoss.toString(),
      mandate.maxDailyLossAtomic
    );
  }

  const authorized = checks.every((c) => c.passed);
  const failedReasons = checks.filter((c) => !c.passed).map((c) => c.reason);

  let attestationSignature: string | undefined;
  let attestationPayload: string | undefined;
  let attestationNonce: string | undefined;

  if (authorized && quote.quote && quote.transactions?.swap) {
    const calldataHash = crypto
      .createHash('sha256')
      .update(quote.transactions.swap.data)
      .digest('hex');

    const att = generatePolicyAttestation({
      userId: ctx.userId || '',
      treasuryId: ctx.treasuryId || mandate.treasuryId,
      mandateId: mandate.id,
      agentId: ctx.agentId || mandate.agentId,
      executionId: ctx.executionId || '',
      rfqId: quote.rfqId,
      chainId: quote.transactions.swap.chainId,
      sellToken: mandate.sellToken,
      buyToken: mandate.buyToken,
      takerPays: quote.quote.takerPays,
      minimumBuyAmount: quote.quote.buyAmount,
      swapTo: quote.transactions.swap.to,
      calldataHash,
      quoteExpiry: quote.quote.expiresAt,
      attestationExpiry: new Date(nowMs + 60_000).toISOString(),
    });
    attestationSignature = att.signature;
    attestationPayload = att.payload;
    attestationNonce = att.nonce;
  }

  return {
    authorized,
    mandateId: mandate.id,
    evaluatedAt: new Date(nowMs).toISOString(),
    checks,
    failedReasons,
    attestationSignature,
    attestationPayload,
    attestationNonce,
  };
}

/**
 * Deterministic Policy Check for x402 / buy External Service Purchases (Section 11.5)
 */
export function evaluateServicePurchasePolicy(params: {
  mandate: TreasuryMandate;
  capabilityId: string;
  providerUrl: string;
  priceAtomic: string;
  currentDailyServiceSpendAtomic: string;
  allowedCapabilityPrefixes?: string[];
}): PolicyEvaluationResult {
  const checks: PolicyCheckDetail[] = [];
  const { mandate } = params;

  const allowedPrefixes = params.allowedCapabilityPrefixes ?? [
    'chainstack.',
    'cencori.',
    'x.posts.',
    'browser.sessions.',
    'monid.',
    'agent402.',
  ];

  // 1. Not paused
  checks.push({
    ruleId: 'MANDATE_ACTIVE',
    ruleName: 'Mandate Not Paused',
    passed: !mandate.paused,
    reason: mandate.paused ? 'Mandate is paused.' : 'Mandate is active.',
  });

  // 2. Provider & Capability Allowlist
  const providerAllowed =
    params.providerUrl.startsWith('https://gateway.usebuy.ai') ||
    params.providerUrl.startsWith('https://agent402.tools') ||
    params.providerUrl.startsWith('https://api.x402.celo.org');
  const capabilityAllowed = allowedPrefixes.some((p) => params.capabilityId.startsWith(p));
  checks.push({
    ruleId: 'SERVICE_ALLOWLIST',
    ruleName: 'Allowlisted x402 Provider & Capability',
    passed: providerAllowed && capabilityAllowed,
    reason:
      providerAllowed && capabilityAllowed
        ? `Verified x402 capability "${params.capabilityId}" on ${params.providerUrl}.`
        : `Provider (${params.providerUrl}) or capability (${params.capabilityId}) is not allowlisted.`,
    actualValue: params.capabilityId,
    thresholdValue: allowedPrefixes.join(', '),
  });

  // 3. Per-Call Spend Cap
  const price = BigInt(params.priceAtomic);
  const perCallCap = BigInt(mandate.serviceSpendPerCallAtomic);
  const withinPerCall = price <= perCallCap;
  checks.push({
    ruleId: 'SERVICE_PER_CALL_CAP',
    ruleName: 'Within Per-Call x402 Budget',
    passed: withinPerCall,
    reason: withinPerCall
      ? `Service cost (${params.priceAtomic} atomic USD) is within per-call limit (${mandate.serviceSpendPerCallAtomic}).`
      : `Service cost (${params.priceAtomic}) exceeds per-call limit (${mandate.serviceSpendPerCallAtomic}).`,
    actualValue: params.priceAtomic,
    thresholdValue: mandate.serviceSpendPerCallAtomic,
  });

  // 4. Daily Service Spend Cap
  const currentDaily = BigInt(params.currentDailyServiceSpendAtomic);
  const dailyCap = BigInt(mandate.serviceDailyCapAtomic);
  const projected = currentDaily + price;
  const withinDaily = projected <= dailyCap;
  checks.push({
    ruleId: 'SERVICE_DAILY_CAP',
    ruleName: 'Within Daily x402 Service Budget',
    passed: withinDaily,
    reason: withinDaily
      ? `Projected daily service spend (${projected.toString()}) is within limit (${mandate.serviceDailyCapAtomic}).`
      : `Projected daily service spend (${projected.toString()}) exceeds daily cap (${mandate.serviceDailyCapAtomic}).`,
    actualValue: projected.toString(),
    thresholdValue: mandate.serviceDailyCapAtomic,
  });

  const failedReasons = checks.filter((c) => !c.passed).map((c) => c.reason);
  return {
    authorized: failedReasons.length === 0,
    mandateId: mandate.id,
    evaluatedAt: new Date().toISOString(),
    checks,
    failedReasons,
  };
}

/**
 * Deterministic Natural-Language Mandate Parser (Section 12.5)
 * Converts a plain-English treasury instruction into a draft structured policy
 * that the user explicitly inspects and confirms.
 */
export function compileNaturalLanguageMandateDraft(
  intentText: string,
  currentMandate: TreasuryMandate
): {
  draft: TreasuryMandate;
  extractedSummary: string[];
} {
  const lower = intentText.toLowerCase();
  const summary: string[] = [];
  const next: TreasuryMandate = {
    ...currentMandate,
    naturalLanguageIntent: intentText,
    updatedAt: new Date().toISOString(),
  };

  // Detect corridor
  if (lower.includes('wars') || lower.includes('peso') || lower.includes('argentin')) {
    next.sellToken = CELO_VERIFIED_ASSETS.wARS.address;
    next.buyToken = CELO_VERIFIED_ASSETS.USDT.address;
    summary.push('Corridor set to wARS (Argentine Peso) → USD₮ on Celo Mainnet.');
  } else if (lower.includes('wbrl') || lower.includes('real') || lower.includes('reais') || lower.includes('brazil')) {
    next.sellToken = CELO_VERIFIED_ASSETS.wBRL.address;
    next.buyToken = CELO_VERIFIED_ASSETS.USDT.address;
    summary.push('Corridor set to wBRL (Brazilian Real) → USD₮ on Celo Mainnet.');
  } else if (lower.includes('wcop') || lower.includes('colombia')) {
    next.sellToken = CELO_VERIFIED_ASSETS.wCOP.address;
    next.buyToken = CELO_VERIFIED_ASSETS.USDT.address;
    summary.push('Corridor set to wCOP (Colombian Peso) → USD₮ on Celo Mainnet.');
  } else if (lower.includes('cngn') || lower.includes('naira') || lower.includes('nigeria')) {
    next.sellToken = CELO_VERIFIED_ASSETS.cNGN.address;
    next.buyToken = CELO_VERIFIED_ASSETS.USDT.address;
    summary.push('Corridor set to cNGN (Compliant Naira) → USD₮ on Celo Mainnet.');
  }

  const sellAsset = findAssetByAddress(next.sellToken) ?? CELO_VERIFIED_ASSETS.cNGN;

  // Detect operating mode
  if (lower.includes('monitor only') || lower.includes('read-only') || lower.includes('observe')) {
    next.mode = 'monitor';
    summary.push('Operating mode set to Monitor (read-only, no signing).');
  } else if (lower.includes('approval') || lower.includes('ask me') || lower.includes('confirm')) {
    next.mode = 'approval_required';
    summary.push('Operating mode set to Approval Required.');
  } else if (lower.includes('autonomous') || lower.includes('auto')) {
    next.mode = 'autonomous';
    summary.push('Operating mode set to Autonomous (strictly bounded by policy).');
  }

  // Detect reserve amount (e.g. "reserve 50000" or "keep 50,000")
  const reserveMatch = intentText.match(/(?:reserve|keep|preserve|minimum)\s+(?:of\s+)?([\d,]+(?:\.\d+)?)/i);
  if (reserveMatch) {
    const cleanNum = reserveMatch[1].replace(/,/g, '');
    next.minimumReserveAtomic = parseAtomicUnits(cleanNum, sellAsset.decimals);
    summary.push(
      `Minimum operating reserve set to ${formatAtomicUnits(next.minimumReserveAtomic, sellAsset.decimals)} ${sellAsset.symbol}.`
    );
  }

  // Detect max trade (e.g. "max trade 10000" or "per trade 10,000")
  const tradeMatch = intentText.match(/(?:max\s+trade|per\s+trade|up\s+to)\s+([\d,]+(?:\.\d+)?)/i);
  if (tradeMatch) {
    const cleanNum = tradeMatch[1].replace(/,/g, '');
    next.maxTradeAtomic = parseAtomicUnits(cleanNum, sellAsset.decimals);
    summary.push(
      `Maximum single trade cap set to ${formatAtomicUnits(next.maxTradeAtomic, sellAsset.decimals)} ${sellAsset.symbol}.`
    );
  }

  // Detect daily cap (e.g. "daily cap 50000" or "daily limit 50,000")
  const dailyMatch = intentText.match(/(?:daily\s+cap|daily\s+limit|per\s+day)\s+([\d,]+(?:\.\d+)?)/i);
  if (dailyMatch) {
    const cleanNum = dailyMatch[1].replace(/,/g, '');
    next.dailySellCapAtomic = parseAtomicUnits(cleanNum, sellAsset.decimals);
    summary.push(
      `24h conversion cap set to ${formatAtomicUnits(next.dailySellCapAtomic, sellAsset.decimals)} ${sellAsset.symbol}.`
    );
  }

  if (summary.length === 0) {
    summary.push('Preserved existing deterministic bounds; review structured fields below before saving.');
  }

  return { draft: next, extractedSummary: summary };
}

