import { z } from 'zod';

/**
 * ============================================================================
 * VERIFIED CELO MAINNET (chainId: 42220) ADDRESS BOOK & PROTOCOL CONSTANTS
 * Verified against:
 * - https://fx-docs.textilecredit.com/protocol/address-book.html
 * - https://docs.celo.org/build-on-celo/build-with-ai/8004
 * - https://www.loops.house/agents-on-open-rails
 * - https://gateway.usebuy.ai/v1/catalog
 * ============================================================================
 */
export const CELO_MAINNET_CHAIN_ID = 42220 as const;
export const CELO_SEPOLIA_CHAIN_ID = 11142220 as const;

export const TEXTILE_CONTRACTS = {
  LimitOrderReactor: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3' as `0x${string}`,
  FeeController: '0x7b005466F905DD882A959888154587fA76cd3Ea7' as `0x${string}`,
  Permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as `0x${string}`,
  OperatorVaultFactory: '0x88104decA449C797632AfdcA77A3140b24cD844A' as `0x${string}`,
  VaultOrderExecutor: '0x01b006d5c687bde182aa36F542f1f014144742e2' as `0x${string}`,
} as const;

export const ERC8004_CONTRACTS = {
  mainnet: {
    IdentityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
    ReputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as `0x${string}`,
  },
  sepolia: {
    IdentityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as `0x${string}`,
    ReputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713' as `0x${string}`,
  },
} as const;

export const PROTOCOL_ENDPOINTS = {
  textileApiV2: 'https://api.textilecredit.com/v2',
  textileStitchEngine: 'textile-stitch',
  x402MainnetFacilitator: 'https://api.x402.celo.org',
  x402SepoliaFacilitator: 'https://api.x402.sepolia.celo.org',
  buyGateway: 'https://gateway.usebuy.ai',
  buyCatalog: 'https://gateway.usebuy.ai/v1/catalog',
  agent402Tools: 'https://agent402.tools',
  ripioRampBase: 'https://ramp.ripio.com',
  ripioBridgeBase: 'https://bridge.ripio.com',
  celoscan: 'https://celoscan.io',
  scan8004: 'https://8004scan.io',
} as const;

export const HACKATHON_TECH_MARKERS = {
  textileFx: [
    '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3',
    'api.textilecredit.com',
    'textile-stitch',
  ],
  latamRipio: [
    '0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D',
    '0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0',
    '0x337E7456B420bD3481e7FA61fA9850343d610d34',
    '0x8a1D45e102e886510e891d2Ec656a708991e2D76',
    '0x4F34c8b3b5FB6D98Da888F0feA543d4d9C9F2eBE',
    '0x61D450a098b6a7f69fC4b98CE68198fe59768651',
  ],
  buildWithBuy: [
    '@celo/buy',
    'gateway.usebuy.ai',
    'agent402.tools',
    '@x402/fetch',
  ],
  usatX402: [
    '0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771',
    'api.x402.celo.org',
    '@x402/fetch',
    '@x402/evm',
  ],
} as const;

export type AssetSymbol =
  | 'USDT'
  | 'cNGN'
  | 'wARS'
  | 'wBRL'
  | 'wCOP'
  | 'wMXN'
  | 'wPEN'
  | 'wCLP'
  | 'USDC'
  | 'USAT'
  | 'IDRX'
  | 'CELO';

export interface VerifiedAssetMetadata {
  symbol: AssetSymbol;
  name: string;
  address: `0x${string}`;
  decimals: number;
  chainId: 42220;
  region: string;
  flag: string;
  textileCorridorWithUsdt: boolean;
  x402Supported: boolean;
  ripioRampCountry?: 'AR' | 'BR' | 'MX' | 'CO' | 'PE' | 'CL';
  ripioRampTokenCode?: string;
  feeCurrencyAdapter?: `0x${string}`;
  referenceUsdRateAtomic?: string; // 1 USD in atomic units of this token (for baseline display only)
}

export const CELO_VERIFIED_ASSETS: Record<AssetSymbol, VerifiedAssetMetadata> = {
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD (USD₮)',
    address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    decimals: 6,
    chainId: 42220,
    region: 'Global Reserve',
    flag: '',
    textileCorridorWithUsdt: false,
    x402Supported: true,
    feeCurrencyAdapter: '0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72',
  },
  cNGN: {
    symbol: 'cNGN',
    name: 'Compliant Nigerian Naira',
    address: '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f',
    decimals: 6,
    chainId: 42220,
    region: 'Nigeria (West Africa)',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: false,
  },
  wARS: {
    symbol: 'wARS',
    name: 'Ripio Wrapped Argentine Peso',
    address: '0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D',
    decimals: 18,
    chainId: 42220,
    region: 'Argentina (LatAm)',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: true,
    ripioRampCountry: 'AR',
    ripioRampTokenCode: 'WARS',
  },
  wBRL: {
    symbol: 'wBRL',
    name: 'Ripio Wrapped Brazilian Real',
    address: '0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0',
    decimals: 18,
    chainId: 42220,
    region: 'Brazil (LatAm)',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: true,
    ripioRampCountry: 'BR',
    ripioRampTokenCode: 'WBRL',
  },
  wCOP: {
    symbol: 'wCOP',
    name: 'Ripio Wrapped Colombian Peso',
    address: '0x8a1D45e102e886510e891d2Ec656a708991e2D76',
    decimals: 18,
    chainId: 42220,
    region: 'Colombia (LatAm)',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: true,
    ripioRampCountry: 'CO',
    ripioRampTokenCode: 'WCOP',
  },
  wMXN: {
    symbol: 'wMXN',
    name: 'Ripio Wrapped Mexican Peso',
    address: '0x337E7456B420bD3481e7FA61fA9850343d610d34',
    decimals: 18,
    chainId: 42220,
    region: 'Mexico (LatAm)',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: false,
    ripioRampCountry: 'MX',
    ripioRampTokenCode: 'WMXN',
  },
  wPEN: {
    symbol: 'wPEN',
    name: 'Ripio Wrapped Peruvian Sol',
    address: '0x4F34c8b3b5FB6D98Da888F0feA543d4d9C9F2eBE',
    decimals: 18,
    chainId: 42220,
    region: 'Peru (LatAm)',
    flag: '',
    textileCorridorWithUsdt: false,
    x402Supported: false,
    ripioRampCountry: 'PE',
    ripioRampTokenCode: 'WPEN',
  },
  wCLP: {
    symbol: 'wCLP',
    name: 'Ripio Wrapped Chilean Peso',
    address: '0x61D450a098b6a7f69fC4b98CE68198fe59768651',
    decimals: 18,
    chainId: 42220,
    region: 'Chile (LatAm)',
    flag: '',
    textileCorridorWithUsdt: false,
    x402Supported: false,
    ripioRampCountry: 'CL',
    ripioRampTokenCode: 'WCLP',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin (Circle)',
    address: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    decimals: 6,
    chainId: 42220,
    region: 'Global USD',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: true,
    feeCurrencyAdapter: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
  },
  USAT: {
    symbol: 'USAT',
    name: 'Tether America USD (USA₮)',
    address: '0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771',
    decimals: 6,
    chainId: 42220,
    region: 'United States (GENIUS Act)',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: true,
    feeCurrencyAdapter: '0x0357EE22278c922e1D36cFe6b899269b161880C4',
  },
  IDRX: {
    symbol: 'IDRX',
    name: 'Indonesian Rupiah Stablecoin',
    address: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22',
    decimals: 2,
    chainId: 42220,
    region: 'Indonesia (APAC)',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: false,
  },
  CELO: {
    symbol: 'CELO',
    name: 'Celo Native Asset',
    address: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    decimals: 18,
    chainId: 42220,
    region: 'Celo Network Gas',
    flag: '',
    textileCorridorWithUsdt: true,
    x402Supported: false,
  },
};

export function findAssetByAddress(address: string): VerifiedAssetMetadata | undefined {
  const lower = address.toLowerCase();
  return Object.values(CELO_VERIFIED_ASSETS).find(
    (a) => a.address.toLowerCase() === lower
  );
}

/**
 * Build a zero-credential Ripio Ramp URL for funding or off-ramping wFIAT tokens on Celo Mainnet
 * Verified against: https://www.loops.house/agents-on-open-rails
 */
export function buildRipioRampUrl(params: {
  direction: 'onramp' | 'offramp';
  symbol: AssetSymbol;
  amountWhole: string;
  walletAddress: `0x${string}`;
}): string | null {
  const asset = CELO_VERIFIED_ASSETS[params.symbol];
  if (!asset || !asset.ripioRampCountry || !asset.ripioRampTokenCode) {
    return null;
  }
  const path = params.direction === 'offramp' ? '/offramp' : '/';
  const url = new URL(`https://ramp.ripio.com${path}`);
  url.searchParams.set('country', asset.ripioRampCountry);
  url.searchParams.set('chain', String(CELO_MAINNET_CHAIN_ID));
  url.searchParams.set('token', asset.ripioRampTokenCode);
  url.searchParams.set('amount', params.amountWhole);
  url.searchParams.set('address', params.walletAddress);
  return url.toString();
}

/**
 * ============================================================================
 * EXACT ATOMIC-UNIT BIGINT ARITHMETIC (Rule 10: Zero floating-point math!)
 * ============================================================================
 */
export const AtomicStringSchema = z
  .string()
  .regex(/^\d+$/, 'Amount must be a non-negative integer string in atomic units');

/**
 * Converts a human-readable decimal string (e.g. "1250.55") into an atomic unit string
 * using pure string & BigInt operations. Never uses parseFloat or Number.
 */
export function parseAtomicUnits(humanAmount: string, decimals: number): string {
  const trimmed = humanAmount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal string amount: "${humanAmount}"`);
  }
  const [wholePart, fracPart = ''] = trimmed.split('.');
  if (fracPart.length > decimals) {
    throw new Error(
      `Precision overflow: "${humanAmount}" has ${fracPart.length} fractional digits, max allowed is ${decimals}`
    );
  }
  const paddedFrac = fracPart.padEnd(decimals, '0');
  const combined = `${wholePart}${paddedFrac}`.replace(/^0+(?=\d)/, '');
  return BigInt(combined || '0').toString();
}

/**
 * Formats an atomic unit string into a human-readable decimal string
 * using pure BigInt & string slicing.
 */
export function formatAtomicUnits(
  atomicAmount: string,
  decimals: number,
  maxDisplayDecimals?: number
): string {
  const clean = BigInt(atomicAmount);
  if (clean < 0n) {
    throw new Error(`Negative atomic unit not supported in formatAtomicUnits: ${atomicAmount}`);
  }
  if (decimals === 0) return clean.toString();
  const str = clean.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, str.length - decimals);
  let frac = str.slice(str.length - decimals);
  if (typeof maxDisplayDecimals === 'number' && maxDisplayDecimals >= 0) {
    frac = frac.slice(0, maxDisplayDecimals);
  }
  frac = frac.replace(/0+$/, '');
  return frac.length > 0 ? `${whole}.${frac}` : whole;
}

/**
 * Formats an atomic unit string with thousand separators for UI display (pure string operations).
 */
export function formatAtomicWithCommas(
  atomicAmount: string,
  decimals: number,
  displayDecimals = 2
): string {
  const raw = formatAtomicUnits(atomicAmount, decimals, displayDecimals);
  const [whole, frac = ''] = raw.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (displayDecimals === 0) return withCommas;
  return `${withCommas}.${frac.padEnd(displayDecimals, '0')}`;
}

/**
 * Computes implied exchange rate in 1e18 scale (WAD) of sellToken per 1 buyToken:
 * e.g. for cNGN (6 dec) -> USDT (6 dec), selling 10,000,000,000 (10,000 cNGN) for 7,262,823 (7.262823 USDT)
 * returns how many atomic sell units per 1 whole buyToken normalized to 1e18.
 */
export function computeImpliedInverseRateWad(
  sellAmountAtomic: string,
  sellDecimals: number,
  buyAmountAtomic: string,
  buyDecimals: number
): bigint {
  const sell = BigInt(sellAmountAtomic);
  const buy = BigInt(buyAmountAtomic);
  if (buy === 0n) return 0n;
  // Normalize both to 18 decimals, then compute (sell_18 * 1e18) / buy_18
  const sellScale = 10n ** BigInt(18 - Math.min(18, sellDecimals));
  const buyScale = 10n ** BigInt(18 - Math.min(18, buyDecimals));
  const sell18 = sell * sellScale;
  const buy18 = buy * buyScale;
  return (sell18 * 10n ** 18n) / buy18;
}

/**
 * ============================================================================
 * EXECUTION STATE MACHINE & TREASURY MANDATE TYPES (Sections 12 & 14)
 * ============================================================================
 */
export const ExecutionStateEnum = z.enum([
  'CREATED',
  'QUOTE_REQUESTED',
  'QUOTE_RECEIVED',
  'POLICY_VALIDATED',
  'APPROVAL_PENDING',
  'EXECUTION_PENDING',
  'SUBMITTED',
  'CONFIRMED',
  'RECONCILED',
  'SETTLED',
  'REJECTED',
  'NO_QUOTE',
  'EXPIRED',
  'FAILED',
  'CANCELLED',
  'REQUIRES_REVIEW',
  'REQUIRES_RECONCILIATION',
]);

export type ExecutionState = z.infer<typeof ExecutionStateEnum>;

export const AgentOperatingModeEnum = z.enum([
  'monitor',
  'approval_required',
  'autonomous',
]);

export type AgentOperatingMode = z.infer<typeof AgentOperatingModeEnum>;

export const TreasuryMandateSchema = z.object({
  id: z.string(),
  treasuryId: z.string(),
  agentId: z.string(),
  name: z.string().min(1),
  naturalLanguageIntent: z.string().optional(),
  mode: AgentOperatingModeEnum,
  executionStrategy: z.enum(['taker_rfq', 'passive_stitch_filler', 'hybrid']),
  chainId: z.literal(42220),
  sellToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>,
  buyToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>,
  minimumReserveAtomic: AtomicStringSchema,
  maxTradeAtomic: AtomicStringSchema,
  dailySellCapAtomic: AtomicStringSchema,
  minBuyAmountAtomic: AtomicStringSchema.optional(),
  maxSlippageBps: z.number().int().min(0).max(5000).default(100),
  maxProtocolFeeBps: z.number().int().min(0).max(500).default(25),
  maxDailyLossAtomic: AtomicStringSchema.optional(),
  allowedTargets: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/) as unknown as z.ZodType<`0x${string}`>),
  serviceSpendPerCallAtomic: AtomicStringSchema.default('50000'), // 0.05 USDT/USDC default max per call
  serviceDailyCapAtomic: AtomicStringSchema.default('500000'), // 0.50 USDT/USDC default daily cap
  stitchBaseSpreadBps: z.number().int().min(1).max(1000).default(18),
  stitchInventorySkewBps: z.number().int().min(0).max(500).default(12),
  paused: z.boolean().default(false),
  updatedAt: z.string(),
});

export type TreasuryMandate = z.infer<typeof TreasuryMandateSchema>;

export interface PolicyCheckDetail {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  reason: string;
  actualValue?: string;
  thresholdValue?: string;
}

export interface PolicyEvaluationResult {
  authorized: boolean;
  mandateId: string;
  evaluatedAt: string;
  checks: PolicyCheckDetail[];
  failedReasons: string[];
  attestationSignature?: string;
  attestationPayload?: string;
  attestationNonce?: string;
}

export interface FirstTradeAuthorizationRecord {
  id: string;
  treasuryId: string;
  agentId: string;
  executionId: string;
  chainId: 42220;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  amountInAtomic: string;
  minBuyAmountAtomic: string;
  destinationContract: `0x${string}`;
  calldataHash: string;
  maxSlippageBps: number;
  maxFeeAtomic: string;
  quoteId: string;
  quoteExpiresAt: string;
  approvalSignature: string;
  approvedByUserId: string;
  approvedAt: string;
  expiresAt: string;
  consumed: boolean;
  consumedAt?: string;
}

export interface AttestationConsumptionRecord {
  nonce: string;
  executionId: string;
  payloadHash: string;
  consumedAt: string;
  expiresAt: string;
}

export interface WebhookEventRecord {
  id: string;
  provider: string;
  providerEventId: string;
  rfqId?: string;
  eventType: string;
  payloadHash: string;
  signatureVerified: boolean;
  processingStatus: 'PENDING' | 'PROCESSED' | 'FAILED' | 'DUPLICATE';
  receivedAt: string;
  processedAt?: string;
  failureReason?: string;
}

/**
 * ============================================================================
 * TEXTILE FX v2 SCHEMAS (Section 8)
 * ============================================================================
 */
export interface FxPreviewInput {
  chainId: 42220;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount?: string;
  buyAmount?: string;
}

export interface FxPreviewResponse {
  status: 'preview' | 'no_quote';
  sellAmount?: string;
  buyAmount?: string;
  feeAmount?: string;
  takerPays?: string;
  rateRay?: string;
  availableSellAmount?: string;
  availableBuyAmount?: string;
  reason?: string;
  reservedUntil?: string;
  retryAfterMs?: number;
  fetchedAt: string;
}

export interface FxQuoteInput {
  chainId: 42220;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount?: string;
  buyAmount?: string;
  taker: `0x${string}`;
  includeAttribution?: boolean;
  builderCodes?: string[];
}

export interface FirmQuote {
  rfqId: string;
  claimToken?: string;
  status: 'quoted' | 'no_quote';
  reason?: string;
  availableSellAmount?: string;
  retryAfterMs?: number;
  quote?: {
    sellAmount: string;
    buyAmount: string;
    feeAmount: string;
    takerPays: string;
    rateRay: string;
    expiresAt: string;
    orderDeadline: string;
    latestOrderDeadline: string;
    reactor: `0x${string}`;
    taker: `0x${string}`;
    encodedOrder: `0x${string}`;
    signature: `0x${string}`;
    orders: Array<{
      encodedOrder: `0x${string}`;
      signature: `0x${string}`;
      sellAmount: string;
      buyAmount: string;
      feeAmount: string;
      maker: `0x${string}`;
    }>;
  };
  transactions?: {
    approval?: {
      to: `0x${string}`;
      data: `0x${string}`;
      value: string;
      chainId: number;
    };
    swap: {
      to: `0x${string}`;
      data: `0x${string}`;
      value: string;
      chainId: number;
    };
  };
  attributionSuffix?: `0x${string}` | null;
  requestId?: string;
  fetchedAt: string;
}

/**
 * ============================================================================
 * DOUBLE-ENTRY LEDGER & AUDIT TRAIL TYPES (Section 13)
 * ============================================================================
 */
export type LedgerAccountType = 'ASSET' | 'EXPENSE' | 'EQUITY' | 'CLEARING';

export interface LedgerEntryRecord {
  id: string;
  journalId: string;
  executionId?: string;
  servicePurchaseId?: string;
  treasuryId: string;
  accountCode: string;
  accountName: string;
  accountType: LedgerAccountType;
  direction: 'DEBIT' | 'CREDIT';
  assetSymbol: AssetSymbol;
  amountAtomic: string;
  decimals: number;
  txHash?: `0x${string}`;
  blockNumber?: string;
  memo: string;
  createdAt: string;
}

export * from './env-validator';

export interface ExecutionRecord {
  id: string;
  idempotencyKey: string;
  treasuryId: string;
  mandateId: string;
  agentId: string;
  rfqId?: string;
  claimToken?: string;
  state: ExecutionState;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellSymbol: AssetSymbol;
  buySymbol: AssetSymbol;
  requestedSellAtomic: string;
  quotedTakerPaysAtomic?: string;
  quotedBuyAmountAtomic?: string;
  quotedFeeAtomic?: string;
  settledSellAtomic?: string;
  settledBuyAtomic?: string;
  settledFeeAtomic?: string;
  gasUsedAtomic?: string;
  rateRay?: string;
  quoteExpiresAt?: string;
  approvalTxHash?: `0x${string}`;
  swapTxHash?: `0x${string}`;
  blockNumber?: string;
  attributionTag?: string;
  attributionVerified?: boolean;
  policyResult?: PolicyEvaluationResult;
  reconciliationServicePurchaseId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePurchaseRecord {
  id: string;
  treasuryId: string;
  agentId: string;
  executionId?: string;
  capabilityId: string;
  providerName: string;
  endpointUrl: string;
  paymentTokenSymbol: 'USDC' | 'USDT' | 'USAT';
  paymentTokenAddress: `0x${string}`;
  priceUsd: string;
  amountAtomic: string;
  status: 'AUTHORIZED' | 'PAID_AND_VERIFIED' | 'REJECTED_BY_POLICY' | 'FAILED';
  paymentTxHash?: `0x${string}`;
  payToAddress: `0x${string}`;
  erc8004ProviderAgentId?: number;
  requestSummary: string;
  responseSummary: string;
  policyReason?: string;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  treasuryId: string;
  agentId?: string;
  executionId?: string;
  category:
    | 'AGENT_CYCLE'
    | 'MARKET_OBSERVATION'
    | 'RFQ_QUOTE'
    | 'POLICY_DECISION'
    | 'SIGNER_VALIDATION'
    | 'ONCHAIN_TX'
    | 'LEDGER_RECONCILIATION'
    | 'X402_SERVICE_PURCHASE'
    | 'SECURITY_CONTROL';
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  title: string;
  detail: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export * from './env-validator';

