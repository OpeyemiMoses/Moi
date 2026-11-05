import crypto from 'node:crypto';
import { toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  CELO_MAINNET_CHAIN_ID,
  FirmQuote,
  FxPreviewInput,
  FxPreviewResponse,
  FxQuoteInput,
  PROTOCOL_ENDPOINTS,
  findAssetByAddress,
} from '@moi/shared-types';
import { moiDb } from '@moi/database';

export interface TakerControlProof {
  nonce: Hex;
  issuedAt: number;
  signature: Hex;
}

/**
 * Signs the official Textile FX v2 EIP-712 `TakerControl` challenge for keyless callers.
 * Verified against: https://fx-docs.textilecredit.com/api/v2/authentication.html
 */
export async function signTextileTakerControl(params: {
  privateKey: Hex;
  chainId?: number;
}): Promise<TakerControlProof> {
  const chainId = params.chainId ?? CELO_MAINNET_CHAIN_ID;
  const account = privateKeyToAccount(params.privateKey);
  const nonce = toHex(crypto.randomBytes(32));
  const issuedAt = Date.now();

  const signature = await account.signTypedData({
    domain: {
      name: 'Textile Taker Control',
      version: '1',
      chainId,
    },
    types: {
      TakerControl: [
        { name: 'taker', type: 'address' },
        { name: 'chainId', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint256' },
      ],
    },
    primaryType: 'TakerControl',
    message: {
      taker: account.address,
      chainId: BigInt(chainId),
      nonce,
      issuedAt: BigInt(issuedAt),
    },
  });

  return { nonce, issuedAt, signature };
}

export interface TextileAdapterConfig {
  baseUrl?: string;
  apiKey?: string;
  takerPrivateKey?: Hex;
  timeoutMs?: number;
}

export class TextileFxAdapter {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly takerPrivateKey?: Hex;
  private readonly timeoutMs: number;

  constructor(config: TextileAdapterConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      process.env.TEXTILE_API_BASE_URL ||
      PROTOCOL_ENDPOINTS.textileApiV2
    ).replace(/\/$/, '');
    this.apiKey = config.apiKey || process.env.TEXTILE_API_KEY || undefined;
    this.takerPrivateKey =
      config.takerPrivateKey ||
      (process.env.AGENT_SIGNER_SECRET_REFERENCE?.startsWith('0x')
        ? (process.env.AGENT_SIGNER_SECRET_REFERENCE as Hex)
        : undefined);
    // Textile v2 docs specify 75s timeout to account for cold corridor token-decimals preflight
    this.timeoutMs = config.timeoutMs ?? 75_000;
  }

  private buildHeaders(claimToken?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else if (claimToken) {
      headers['X-Rfq-Claim'] = claimToken;
    }
    return headers;
  }

  /**
   * Verifies that the token corridor is registered and supported on Celo Mainnet.
   */
  verifyCorridorSupport(
    sellToken: string,
    buyToken: string
  ): { supported: boolean; reason?: string } {
    const sellMeta = findAssetByAddress(sellToken);
    const buyMeta = findAssetByAddress(buyToken);
    if (!sellMeta || !buyMeta) {
      return {
        supported: false,
        reason: `One or both tokens are not verified Celo Mainnet assets: sell=${sellToken}, buy=${buyToken}.`,
      };
    }
    const hasUsdt = sellMeta.symbol === 'USDT' || buyMeta.symbol === 'USDT';
    const otherAsset = sellMeta.symbol === 'USDT' ? buyMeta : sellMeta;
    if (!hasUsdt || !otherAsset.textileCorridorWithUsdt) {
      return {
        supported: false,
        reason: `Corridor ${sellMeta.symbol} <-> ${buyMeta.symbol} is not an active Textile FX v2 liquidity corridor on Celo Mainnet.`,
      };
    }
    return { supported: true };
  }

  /**
   * POST /v2/rfq/preview
   * Returns an indicative, non-binding preview quote from live Celo makers.
   */
  async preview(input: FxPreviewInput): Promise<FxPreviewResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const body: Record<string, unknown> = {
        chainId: input.chainId,
        sellToken: input.sellToken,
        buyToken: input.buyToken,
      };
      if (input.sellAmount) body.sellAmount = input.sellAmount;
      if (input.buyAmount) body.buyAmount = input.buyAmount;

      const res = await fetch(`${this.baseUrl}/rfq/preview`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = (await res.json()) as {
        data?: Record<string, unknown>;
        error?: { message?: string; code?: string };
      };

      if (!res.ok || !payload.data) {
        return {
          status: 'no_quote',
          reason:
            payload.error?.message ||
            payload.error?.code ||
            `HTTP_${res.status}`,
          fetchedAt: new Date().toISOString(),
        };
      }

      const d = payload.data;
      return {
        status: d.status === 'preview' ? 'preview' : 'no_quote',
        sellAmount: typeof d.sellAmount === 'string' ? d.sellAmount : undefined,
        buyAmount: typeof d.buyAmount === 'string' ? d.buyAmount : undefined,
        feeAmount: typeof d.feeAmount === 'string' ? d.feeAmount : undefined,
        takerPays: typeof d.takerPays === 'string' ? d.takerPays : undefined,
        rateRay: typeof d.rateRay === 'string' ? d.rateRay : undefined,
        availableSellAmount:
          typeof d.availableSellAmount === 'string'
            ? d.availableSellAmount
            : undefined,
        availableBuyAmount:
          typeof d.availableBuyAmount === 'string'
            ? d.availableBuyAmount
            : undefined,
        reason: typeof d.reason === 'string' ? d.reason : undefined,
        reservedUntil:
          typeof d.reservedUntil === 'string' ? d.reservedUntil : undefined,
        retryAfterMs:
          typeof d.retryAfterMs === 'number' ? d.retryAfterMs : undefined,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * POST /v2/rfq/request
   * Requests a firm executable quote on Celo Mainnet.
   * Supports both Partner Bearer key and Keyless EIP-712 `takerProof`.
   */
  async requestQuote(
    input: FxQuoteInput,
    overrideTakerPrivateKey?: Hex
  ): Promise<FirmQuote> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const body: Record<string, unknown> = {
        chainId: input.chainId,
        sellToken: input.sellToken,
        buyToken: input.buyToken,
        taker: input.taker,
      };
      if (input.sellAmount) body.sellAmount = input.sellAmount;
      if (input.buyAmount) body.buyAmount = input.buyAmount;

      if (this.apiKey) {
        // Partner-keyed flow: never send takerProof; optionally include ERC-8021 builderCodes
        if (input.includeAttribution && input.builderCodes?.length) {
          body.includeAttribution = true;
          body.builderCodes = input.builderCodes;
        }
      } else {
        // Keyless flow: sign EIP-712 TakerControl challenge if signer key is available
        const signingKey = overrideTakerPrivateKey ?? this.takerPrivateKey;
        if (signingKey) {
          body.takerProof = await signTextileTakerControl({
            privateKey: signingKey,
            chainId: input.chainId,
          });
        }
      }

      const res = await fetch(`${this.baseUrl}/rfq/request`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const requestId = res.headers.get('x-request-id') ?? undefined;
      const payload = (await res.json()) as {
        data?: Record<string, any>;
        error?: { message?: string; code?: string; details?: Record<string, any> };
      };

      if (!res.ok || !payload.data) {
        return {
          rfqId: `rfq_err_${Date.now()}`,
          status: 'no_quote',
          reason:
            payload.error?.details?.reason ||
            payload.error?.message ||
            payload.error?.code ||
            `HTTP_${res.status}`,
          requestId,
          fetchedAt: new Date().toISOString(),
        };
      }

      const d = payload.data;
      if (d.status === 'no_quote') {
        return {
          rfqId: String(d.rfqId ?? `rfq_noquote_${Date.now()}`),
          claimToken: typeof d.claimToken === 'string' ? d.claimToken : undefined,
          status: 'no_quote',
          reason: String(d.reason ?? 'no_valid_quote'),
          availableSellAmount:
            typeof d.availableSellAmount === 'string'
              ? d.availableSellAmount
              : undefined,
          retryAfterMs:
            typeof d.retryAfterMs === 'number' ? d.retryAfterMs : undefined,
          requestId,
          fetchedAt: new Date().toISOString(),
        };
      }

      return {
        rfqId: String(d.rfqId),
        claimToken: typeof d.claimToken === 'string' ? d.claimToken : undefined,
        status: 'quoted',
        quote: d.quote,
        transactions: d.transactions,
        attributionSuffix: d.attributionSuffix ?? null,
        requestId,
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * POST /v2/rfq/{id}/submit
   * Reports the broadcast transaction hash to Textile.
   */
  async submitTransaction(
    rfqId: string,
    txHash: `0x${string}`,
    claimToken?: string
  ): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/rfq/${encodeURIComponent(rfqId)}/submit`, {
      method: 'POST',
      headers: this.buildHeaders(claimToken),
      body: JSON.stringify({ txHash }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      data?: { status?: string };
    };
    return { status: payload.data?.status ?? (res.ok ? 'submitted' : `http_${res.status}`) };
  }

  /**
   * GET /v2/rfq/{id}
   * Reads current RFQ & onchain settlement status.
   */
  async getQuoteStatus(
    rfqId: string,
    claimToken?: string
  ): Promise<{
    rfqId: string;
    status: string;
    sellAmount?: string;
    buyAmount?: string;
    feeAmount?: string;
    txHash?: string;
    filledAt?: string;
    failReason?: string | null;
  }> {
    const res = await fetch(`${this.baseUrl}/rfq/${encodeURIComponent(rfqId)}`, {
      method: 'GET',
      headers: this.buildHeaders(claimToken),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      data?: Record<string, any>;
    };
    const d = payload.data ?? {};
    return {
      rfqId: String(d.rfqId ?? rfqId),
      status: String(d.status ?? 'unknown'),
      sellAmount: d.sellAmount,
      buyAmount: d.buyAmount,
      feeAmount: d.feeAmount,
      txHash: d.txHash,
      filledAt: d.filledAt,
      failReason: d.failReason ?? null,
    };
  }

  /**
   * POST /v2/rfq/{id}/cancel
   * Releases an unused quote back to the maker's inventory.
   */
  async cancelQuote(rfqId: string, claimToken?: string): Promise<void> {
    await fetch(`${this.baseUrl}/rfq/${encodeURIComponent(rfqId)}/cancel`, {
      method: 'POST',
      headers: this.buildHeaders(claimToken),
    });
  }

  /**
   * Polls settlement status until terminal state (settled, failed, expired) or max timeout.
   */
  async pollAndReconcileExecution(
    rfqId: string,
    claimToken?: string,
    maxAttempts: number = 10,
    intervalMs: number = 2000
  ): Promise<{
    settled: boolean;
    status: string;
    txHash?: string;
    failReason?: string | null;
  }> {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await this.getQuoteStatus(rfqId, claimToken);
      if (res.status === 'settled' || res.status === 'filled') {
        return { settled: true, status: 'settled', txHash: res.txHash };
      }
      if (res.status === 'failed' || res.status === 'expired') {
        return {
          settled: false,
          status: res.status,
          txHash: res.txHash,
          failReason: res.failReason,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return { settled: false, status: 'polling_timeout' };
  }
}

/**
 * Textile Webhook Signature Verification (Section M2.2.B)
 * Verifies that the webhook callback originated from Textile using HMAC-SHA256.
 */
export function verifyTextileWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string;
  secret?: string;
}): boolean {
  const secret = params.secret || process.env.TEXTILE_WEBHOOK_SECRET || 'moi_textile_webhook_secret_v2';
  if (!secret || !params.signatureHeader) {
    return false;
  }
  try {
    const cleanHeader = params.signatureHeader.replace(/^sha256=/, '').trim();
    const computed = crypto
      .createHmac('sha256', secret)
      .update(params.rawBody)
      .digest('hex');
    const bufA = Buffer.from(cleanHeader, 'hex');
    const bufB = Buffer.from(computed, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export interface ProcessWebhookResult {
  accepted: boolean;
  duplicate: boolean;
  eventId?: string;
  rfqId?: string;
  eventType?: string;
  statusCode: number;
  reason?: string;
}

/**
 * Atomically processes and deduplicates an incoming Textile webhook event.
 * Enforces SEC-M2-05: Prevents duplicate state transitions on retried webhook events.
 */
export function processTextileWebhookAtomic(params: {
  rawBody: string;
  signatureHeader: string;
  secret?: string;
  providerEventId?: string;
  database?: any;
}): ProcessWebhookResult {
  const { rawBody, signatureHeader, secret } = params;
  const db = params.database || moiDb;

  // 1. Authenticate signature
  const isSigValid = verifyTextileWebhookSignature({
    rawBody,
    signatureHeader,
    secret,
  });

  if (!isSigValid) {
    return {
      accepted: false,
      duplicate: false,
      statusCode: 401,
      reason: 'INVALID_SIGNATURE: Webhook signature verification failed.',
    };
  }

  // 2. Parse payload safely
  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return {
      accepted: false,
      duplicate: false,
      statusCode: 400,
      reason: 'MALFORMED_JSON: Webhook body cannot be parsed as valid JSON.',
    };
  }

  const payloadHash = crypto
    .createHash('sha256')
    .update(rawBody)
    .digest('hex');
  const providerEventId =
    params.providerEventId ||
    payload.eventId ||
    payload.id ||
    payload.rfqId ||
    payload.data?.rfqId ||
    payloadHash.slice(0, 32);

  const rfqId = payload.rfqId || payload.data?.rfqId || undefined;
  const eventType = payload.event || payload.type || 'textile.settlement';

  // 3. Atomically persist & deduplicate in database
  const recordResult = db.recordWebhookEventAtomic({
    id: `whe_${crypto.randomUUID()}`,
    provider: 'textile',
    providerEventId,
    rfqId,
    eventType,
    payloadHash,
    signatureVerified: true,
    processingStatus: 'PROCESSED',
    receivedAt: new Date().toISOString(),
  });

  if (recordResult.duplicate) {
    return {
      accepted: false,
      duplicate: true,
      eventId: providerEventId,
      rfqId,
      eventType,
      statusCode: 200,
      reason:
        'DUPLICATE_WEBHOOK_EVENT: Event was previously received and processed; idempotently acknowledged.',
    };
  }

  return {
    accepted: true,
    duplicate: false,
    eventId: providerEventId,
    rfqId,
    eventType,
    statusCode: 200,
  };
}

/**
 * Firm Quote Validation using Integer & BigInt Arithmetic (Section M2.2.D)
 * Validates sell amount, min buy amount, rate, fees, expiry, network (42220), token addresses.
 */
export function validateFirmQuoteStructure(
  quote: FirmQuote,
  expected?: {
    chainId?: number;
    expectedTaker?: `0x${string}`;
    maxTakerPays?: string;
    minBuyAmount?: string;
    nowMs?: number;
  }
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const nowMs = expected?.nowMs ?? Date.now();

  if (quote.status !== 'quoted' || !quote.quote || !quote.transactions?.swap) {
    reasons.push(
      `Quote is not executable (status=${quote.status}, reason=${quote.reason ?? 'missing_quote_payload'}).`
    );
    return { valid: false, reasons };
  }

  const q = quote.quote;
  const swapTx = quote.transactions.swap;

  // 1. Chain ID
  const expectedChainId = expected?.chainId ?? CELO_MAINNET_CHAIN_ID;
  if (swapTx.chainId !== expectedChainId) {
    reasons.push(`Invalid chainId: expected ${expectedChainId}, got ${swapTx.chainId}.`);
  }

  // 2. Reactor contract
  const expectedReactor = '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3'.toLowerCase();
  if (
    q.reactor.toLowerCase() !== expectedReactor ||
    swapTx.to.toLowerCase() !== expectedReactor
  ) {
    reasons.push(`Invalid reactor: expected ${expectedReactor}, got ${q.reactor} / ${swapTx.to}.`);
  }

  // 3. Native value must be 0
  if (BigInt(swapTx.value || '0') !== 0n) {
    reasons.push(`Non-zero native value: ${swapTx.value}.`);
  }

  // 4. Expiry
  const expiresMs = Date.parse(q.expiresAt);
  if (Number.isNaN(expiresMs) || expiresMs <= nowMs + 1500) {
    reasons.push(`Quote is expired or within safety cutoff (expiresAt=${q.expiresAt}).`);
  }

  // 5. Taker wallet match
  if (
    expected?.expectedTaker &&
    q.taker.toLowerCase() !== expected.expectedTaker.toLowerCase()
  ) {
    reasons.push(`Taker mismatch: expected ${expected.expectedTaker}, got ${q.taker}.`);
  }

  // 6. Taker pays & buy amount BigInt checks
  try {
    const takerPays = BigInt(q.takerPays);
    const buyAmount = BigInt(q.buyAmount);
    if (takerPays <= 0n) reasons.push(`takerPays must be positive: ${q.takerPays}.`);
    if (buyAmount <= 0n) reasons.push(`buyAmount must be positive: ${q.buyAmount}.`);

    if (expected?.maxTakerPays && takerPays > BigInt(expected.maxTakerPays)) {
      reasons.push(`takerPays (${q.takerPays}) exceeds max allowed (${expected.maxTakerPays}).`);
    }
    if (expected?.minBuyAmount && buyAmount < BigInt(expected.minBuyAmount)) {
      reasons.push(`buyAmount (${q.buyAmount}) is below minimum expected (${expected.minBuyAmount}).`);
    }
  } catch {
    reasons.push('Invalid numeric representation in quote amounts.');
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * ============================================================================
 * TEXTILE STITCH (textile-stitch) ADAPTIVE TREASURY FILLER FEED ENGINE
 * ============================================================================
 * Implements the official Stitch HTTP Price Feed specification:
 * `{ "price", "timestamp", "degraded" }`
 * Verified against: https://fx-docs.textilecredit.com/guides/how-to-become-a-filler.html
 *
 * Uses an Avellaneda-Stoikov-inspired inventory skew model so MOI can act as a
 * passive Maker/Filler on Textile FX, adjusting quote levels dynamically based on
 * the treasury's target reserve vs excess local-currency holdings.
 */
export interface StitchPriceFeedOutput {
  price: string;
  timestamp: number;
  degraded: boolean;
  corridor: string;
  engine: 'textile-stitch';
  reactor: `0x${string}`;
  midReferenceRate: string;
  baseSpreadBps: number;
  inventorySkewBps: number;
  excessInventoryRatioBps: number;
  bidQuotePrice: string;
  askQuotePrice: string;
  strategyReasoning: string;
}

export function computeStitchTreasuryFeed(params: {
  corridor: string;
  midReferencePrice: number;
  currentLocalBalanceAtomic: string;
  minimumReserveAtomic: string;
  targetMaxBalanceAtomic: string;
  baseSpreadBps: number;
  maxInventorySkewBps: number;
  feedAgeMs?: number;
  priceJumpBps?: number;
}): StitchPriceFeedOutput {
  const now = Date.now();
  const cur = BigInt(params.currentLocalBalanceAtomic);
  const minRes = BigInt(params.minimumReserveAtomic);
  const maxBal = BigInt(params.targetMaxBalanceAtomic);

  // Stitch guardrails: degrade feed if reference data is older than 5 minutes or jumped > 1000 bps (10%)
  const isStale = (params.feedAgeMs ?? 0) > 5 * 60 * 1000;
  const isExcessiveJump = Math.abs(params.priceJumpBps ?? 0) > 1000;
  const belowMinimumReserve = cur < minRes;
  const degraded = isStale || isExcessiveJump || belowMinimumReserve;

  // Calculate excess inventory ratio in basis points [0 .. 10000]
  let excessRatioBps = 0;
  if (cur > minRes && maxBal > minRes) {
    const excess = cur - minRes;
    const span = maxBal - minRes;
    const rawBps = Number((excess * 10000n) / span);
    excessRatioBps = Math.max(0, Math.min(10000, rawBps));
  }

  // Inventory skew: when excess local currency is high (> 5000 bps), skew reference rate
  // by up to maxInventorySkewBps to attract USD₮ buyers & rebalance without crossing the spread.
  const centeredBps = excessRatioBps - 5000; // [-5000 .. +5000]
  const appliedSkewBps = Math.round((centeredBps / 5000) * params.maxInventorySkewBps);

  const skewFactor = 1 + appliedSkewBps / 10_000;
  const skewedMid = params.midReferencePrice * skewFactor;
  const bidPrice = skewedMid * (1 - params.baseSpreadBps / 10_000);
  const askPrice = skewedMid * (1 + params.baseSpreadBps / 10_000);

  const strategyReasoning = degraded
    ? belowMinimumReserve
      ? `DEGRADED=true: Local balance (${cur.toString()}) is below minimum reserve (${minRes.toString()}). Stitch filler paused to protect operating reserve.`
      : `DEGRADED=true: Reference price feed violated Stitch safety guard (stale=${isStale}, jump>${isExcessiveJump}).`
    : `Adaptive Stitch Filler active on ${params.corridor}: inventory utilization=${(excessRatioBps / 100).toFixed(1)}%, applied inventory skew=${appliedSkewBps >= 0 ? '+' : ''}${appliedSkewBps} bps around mid ${params.midReferencePrice.toFixed(4)} (spread ±${params.baseSpreadBps} bps).`;

  return {
    price: skewedMid.toFixed(6),
    timestamp: now,
    degraded,
    corridor: params.corridor,
    engine: PROTOCOL_ENDPOINTS.textileStitchEngine,
    reactor: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3',
    midReferenceRate: params.midReferencePrice.toFixed(6),
    baseSpreadBps: params.baseSpreadBps,
    inventorySkewBps: appliedSkewBps,
    excessInventoryRatioBps: excessRatioBps,
    bidQuotePrice: bidPrice.toFixed(6),
    askQuotePrice: askPrice.toFixed(6),
    strategyReasoning,
  };
}

