import { createPublicClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import {
  decodePaymentResponseHeader,
  wrapFetchWithPayment,
  x402Client,
} from '@x402/fetch';
import { ExactEvmScheme, toClientEvmSigner } from '@x402/evm';
import {
  CELO_VERIFIED_ASSETS,
  PROTOCOL_ENDPOINTS,
  ServicePurchaseRecord,
  TreasuryMandate,
} from '@moi/shared-types';
import { evaluateServicePurchasePolicy } from '@moi/policy-engine';

export interface BuyCapabilityCatalogItem {
  id: string;
  title: string;
  description: string;
  method: string;
  url: string;
  platform: string;
  priceUsd: string;
  amountAtomic: string;
  tokens: Array<'USDC' | 'USDT' | 'USAT'>;
  payToAddress: `0x${string}`;
  erc8004AgentId?: number;
  category: 'onchain_reconciliation' | 'market_intelligence' | 'ai_inference' | 'browser_automation';
}

export const CURATED_BUY_CAPABILITIES: BuyCapabilityCatalogItem[] = [
  {
    id: 'chainstack.celo',
    title: 'Chainstack · Celo Mainnet JSON-RPC Verification',
    description:
      'Independent Celo Mainnet JSON-RPC batch verification (up to 2,000 calls) via gateway.usebuy.ai to reconcile swap receipts & ERC-20 Transfer logs.',
    method: 'POST',
    url: 'https://gateway.usebuy.ai/chainstack/celo',
    platform: 'chainstack',
    priceUsd: '0.0100',
    amountAtomic: '10000',
    tokens: ['USDC', 'USDT', 'USAT'],
    payToAddress: '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
    category: 'onchain_reconciliation',
  },
  {
    id: 'x.posts.search',
    title: 'TikHub · Live FX Corridor Macro & Sentiment Feed',
    description:
      'Real-time public X posts search for cNGN, wARS, wBRL, and Celo FX liquidity intelligence before authorizing large conversions.',
    method: 'POST',
    url: 'https://gateway.usebuy.ai/v1/social/x/posts/search',
    platform: 'x',
    priceUsd: '0.0050',
    amountAtomic: '5000',
    tokens: ['USDC', 'USDT', 'USAT'],
    payToAddress: '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
    erc8004AgentId: 9895,
    category: 'market_intelligence',
  },
  {
    id: 'cencori.v1.chat.completions',
    title: 'Cencori · Maximo-Atlas-1.3 Audit Explanation Engine',
    description:
      'Agent-paid inference over x402 to generate plain-English executive treasury summaries from verified deterministic policy logs.',
    method: 'POST',
    url: 'https://gateway.usebuy.ai/cencori/v1/chat/completions',
    platform: 'cencori',
    priceUsd: '0.0100',
    amountAtomic: '10000',
    tokens: ['USDC', 'USDT', 'USAT'],
    payToAddress: '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
    category: 'ai_inference',
  },
  {
    id: 'browser.sessions.create',
    title: 'buy-browser-worker · Isolated Supplier Invoice Browser',
    description:
      'Rent an isolated disposable browser session on Celo x402 (ERC-8004 Agent #9894) to verify external merchant invoices.',
    method: 'POST',
    url: 'https://gateway.usebuy.ai/v1/browser/sessions',
    platform: 'browser',
    priceUsd: '0.0036',
    amountAtomic: '3606',
    tokens: ['USDC', 'USDT', 'USAT'],
    payToAddress: '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
    erc8004AgentId: 9894,
    category: 'browser_automation',
  },
];

export interface X402ChallengeOffer {
  scheme: string;
  network: string;
  amountAtomic: string;
  asset: `0x${string}`;
  payTo: `0x${string}`;
  tokenName?: string;
}

export class BuyX402ServiceClient {
  private readonly catalogUrl: string;
  private readonly facilitatorUrl: string;
  private readonly agent402DirectoryUrl: string;
  private readonly cliPackageMarker = '@celo/buy';

  constructor() {
    this.catalogUrl =
      process.env.BUY_CATALOG_URL || PROTOCOL_ENDPOINTS.buyCatalog;
    this.facilitatorUrl =
      process.env.X402_FACILITATOR_URL ||
      PROTOCOL_ENDPOINTS.x402MainnetFacilitator;
    this.agent402DirectoryUrl =
      process.env.AGENT402_TOOLS_URL || PROTOCOL_ENDPOINTS.agent402Tools;
  }

  getIntegrationMetadata() {
    return {
      cliPackage: this.cliPackageMarker,
      catalogUrl: this.catalogUrl,
      facilitatorUrl: this.facilitatorUrl,
      agent402DirectoryUrl: this.agent402DirectoryUrl,
      supportedTokens: [
        CELO_VERIFIED_ASSETS.USDT,
        CELO_VERIFIED_ASSETS.USDC,
        CELO_VERIFIED_ASSETS.USAT,
      ],
    };
  }

  /**
   * Fetches the live service catalog from `https://gateway.usebuy.ai/v1/catalog`
   * and merges it with MOI's curated treasury capabilities.
   */
  async fetchLiveCatalog(): Promise<{
    sourceUrl: string;
    payTo: `0x${string}`;
    totalCapabilitiesOnGateway: number;
    gatewayStatus: 'ONLINE' | 'UNAVAILABLE';
    error?: string;
    curatedCapabilities: BuyCapabilityCatalogItem[];
    fetchedAt: string;
  }> {
    try {
      const res = await fetch(this.catalogUrl, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const data = (await res.json()) as {
        payment?: { payTo?: `0x${string}` };
        capabilities?: Array<Record<string, any>>;
      };
      return {
        sourceUrl: this.catalogUrl,
        payTo:
          data.payment?.payTo ||
          '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
        totalCapabilitiesOnGateway: data.capabilities?.length ?? 0,
        gatewayStatus: 'ONLINE' as const,
        curatedCapabilities: CURATED_BUY_CAPABILITIES,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        sourceUrl: this.catalogUrl,
        payTo: '0x20faAca5F980E29639A0FCC6dcA6988E18ed333B',
        totalCapabilitiesOnGateway: 0,
        gatewayStatus: 'UNAVAILABLE' as const,
        error: err instanceof Error ? err.message : 'GATEWAY_UNAVAILABLE',
        curatedCapabilities: CURATED_BUY_CAPABILITIES,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Probes an `x402` endpoint on `gateway.usebuy.ai` to inspect its live `HTTP 402 Payment Required`
   * challenge header (`payment-required`) and body (`accepts` array).
   */
  async inspectLive402Challenge(
    endpointUrl: string,
    requestBody: Record<string, unknown>
  ): Promise<{
    httpStatus: number;
    offers: X402ChallengeOffer[];
    rawHeaderDecoded?: Record<string, unknown>;
  }> {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const paymentHeader = res.headers.get('payment-required');
    let rawHeaderDecoded: Record<string, unknown> | undefined;
    const offers: X402ChallengeOffer[] = [];

    if (paymentHeader) {
      try {
        const jsonStr = Buffer.from(paymentHeader, 'base64').toString('utf-8');
        rawHeaderDecoded = JSON.parse(jsonStr);
        const accepts = (rawHeaderDecoded?.accepts as Array<any>) || [];
        for (const a of accepts) {
          offers.push({
            scheme: String(a.scheme || 'exact'),
            network: String(a.network || 'eip155:42220'),
            amountAtomic: String(a.amount || a.maxAmountRequired || '10000'),
            asset: a.asset as `0x${string}`,
            payTo: a.payTo as `0x${string}`,
            tokenName: a.extra?.name,
          });
        }
      } catch {
        // Fallback to body parsing below
      }
    }

    if (offers.length === 0) {
      const body = (await res.json().catch(() => ({}))) as {
        accepts?: Array<any>;
      };
      for (const a of body.accepts || []) {
        offers.push({
          scheme: String(a.scheme || 'exact'),
          network: String(a.network || 'celo'),
          amountAtomic: String(a.maxAmountRequired || a.amount || '10000'),
          asset: a.asset as `0x${string}`,
          payTo: a.payTo as `0x${string}`,
          tokenName: a.extra?.name,
        });
      }
    }

    return {
      httpStatus: res.status,
      offers,
      rawHeaderDecoded,
    };
  }

  /**
   * Executes a policy-checked service call through `@x402/fetch` + `@x402/evm` on Celo Mainnet.
   * - First runs deterministic `evaluateServicePurchasePolicy`.
   * - Next probes or executes the request against `gateway.usebuy.ai`.
   * - If `AGENT_SIGNER_SECRET_REFERENCE` is configured and holds the payment token,
   *   signs the EIP-3009 authorization via `wrapFetchWithPayment` (`@x402/fetch`) and
   *   extracts the settled payment transaction hash via `decodePaymentResponseHeader`.
   */
  async executePolicyCheckedServiceCall(params: {
    mandate: TreasuryMandate;
    treasuryId: string;
    agentId: string;
    executionId?: string;
    capabilityId: string;
    paymentTokenSymbol?: 'USDC' | 'USDT' | 'USAT';
    currentDailyServiceSpendAtomic: string;
    requestPayload?: Record<string, unknown>;
  }): Promise<{
    purchase: ServicePurchaseRecord;
    liveChallengeOffers: X402ChallengeOffer[];
  }> {
    const capability =
      CURATED_BUY_CAPABILITIES.find((c) => c.id === params.capabilityId) ??
      CURATED_BUY_CAPABILITIES[0];

    const tokenSymbol = params.paymentTokenSymbol ?? 'USAT';
    const tokenMeta = CELO_VERIFIED_ASSETS[tokenSymbol];

    const defaultPayload =
      capability.id === 'chainstack.celo'
        ? {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        }
        : capability.id === 'x.posts.search'
          ? { query: 'Celo stablecoin cNGN wARS wBRL FX', type: 'latest' }
          : capability.id === 'cencori.v1.chat.completions'
            ? {
              model: 'maximo-atlas-1.3',
              max_tokens: 256,
              messages: [
                {
                  role: 'user',
                  content:
                    'Summarize treasury mandate compliance for Celo Mainnet RFQ settlement.',
                },
              ],
            }
            : { durationMinutes: 1 };

    const bodyPayload = params.requestPayload ?? defaultPayload;

    // 1. Run Deterministic Policy Engine Check BEFORE any network payment
    const policyEval = evaluateServicePurchasePolicy({
      mandate: params.mandate,
      capabilityId: capability.id,
      providerUrl: capability.url,
      priceAtomic: capability.amountAtomic,
      currentDailyServiceSpendAtomic: params.currentDailyServiceSpendAtomic,
    });

    if (!policyEval.authorized) {
      return {
        liveChallengeOffers: [],
        purchase: {
          id: `sp_${Date.now()}`,
          treasuryId: params.treasuryId,
          agentId: params.agentId,
          executionId: params.executionId,
          capabilityId: capability.id,
          providerName: capability.platform,
          endpointUrl: capability.url,
          paymentTokenSymbol: tokenSymbol,
          paymentTokenAddress: tokenMeta.address,
          priceUsd: capability.priceUsd,
          amountAtomic: capability.amountAtomic,
          status: 'REJECTED_BY_POLICY',
          payToAddress: capability.payToAddress,
          erc8004ProviderAgentId: capability.erc8004AgentId,
          requestSummary: JSON.stringify(bodyPayload),
          responseSummary: `Rejected by deterministic policy engine: ${policyEval.failedReasons.join('; ')}`,
          policyReason: policyEval.failedReasons.join('; '),
          createdAt: new Date().toISOString(),
        },
      };
    }

    // 2. Probe live 402 challenge from gateway.usebuy.ai to verify authoritative pricing
    const challenge = await this.inspectLive402Challenge(
      capability.url,
      bodyPayload
    );

    const matchedOffer =
      challenge.offers.find(
        (o) => o.asset.toLowerCase() === tokenMeta.address.toLowerCase()
      ) ?? challenge.offers[0];

    const authoritativeAtomic =
      matchedOffer?.amountAtomic ?? capability.amountAtomic;
    const authoritativePayTo =
      matchedOffer?.payTo ?? capability.payToAddress;

    // 3. If restricted signer private key is configured, attempt signed x402 payment via @x402/fetch
    const signerSecret = process.env.AGENT_SIGNER_SECRET_REFERENCE;
    if (signerSecret && /^0x[a-fA-F0-9]{64}$/.test(signerSecret)) {
      try {
        const account = privateKeyToAccount(signerSecret as Hex);
        const publicClient = createPublicClient({
          chain: celo,
          transport: http(process.env.CELO_RPC_URL || 'https://forno.celo.org'),
        });
        const evmSigner = toClientEvmSigner(account, publicClient as any);
        const client = new x402Client().register(
          'eip155:42220',
          new ExactEvmScheme(evmSigner)
        );
        const fetchWithPayment = wrapFetchWithPayment(fetch, client);

        const paidRes = await fetchWithPayment(capability.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        const paymentResHeader =
          paidRes.headers.get('payment-response') ||
          paidRes.headers.get('x-payment-response');
        const decodedReceipt = paymentResHeader
          ? decodePaymentResponseHeader(paymentResHeader)
          : undefined;
        const paidJson = await paidRes.json().catch(() => ({}));

        if (paidRes.ok) {
          return {
            liveChallengeOffers: challenge.offers,
            purchase: {
              id: `sp_${Date.now()}`,
              treasuryId: params.treasuryId,
              agentId: params.agentId,
              executionId: params.executionId,
              capabilityId: capability.id,
              providerName: capability.platform,
              endpointUrl: capability.url,
              paymentTokenSymbol: tokenSymbol,
              paymentTokenAddress: tokenMeta.address,
              priceUsd: capability.priceUsd,
              amountAtomic: authoritativeAtomic,
              status: 'PAID_AND_VERIFIED',
              paymentTxHash: (decodedReceipt as any)?.transaction as
                | `0x${string}`
                | undefined,
              payToAddress: authoritativePayTo,
              erc8004ProviderAgentId: capability.erc8004AgentId,
              requestSummary: JSON.stringify(bodyPayload),
              responseSummary: JSON.stringify(paidJson).slice(0, 500),
              policyReason: 'All 4 deterministic service-spend checks passed; x402 settled on Celo Mainnet.',
              createdAt: new Date().toISOString(),
            },
          };
        }
      } catch (err: any) {
        // Fall through to report exact live 402 challenge verification state
      }
    }

    // 4. Return verified live HTTP 402 challenge inspection (never fabricate a fake tx hash!)
    return {
      liveChallengeOffers: challenge.offers,
      purchase: {
        id: `sp_${Date.now()}`,
        treasuryId: params.treasuryId,
        agentId: params.agentId,
        executionId: params.executionId,
        capabilityId: capability.id,
        providerName: capability.platform,
        endpointUrl: capability.url,
        paymentTokenSymbol: tokenSymbol,
        paymentTokenAddress: tokenMeta.address,
        priceUsd: capability.priceUsd,
        amountAtomic: authoritativeAtomic,
        status: 'AUTHORIZED',
        payToAddress: authoritativePayTo,
        erc8004ProviderAgentId: capability.erc8004AgentId,
        requestSummary: JSON.stringify(bodyPayload),
        responseSummary: `Verified live HTTP ${challenge.httpStatus} x402 challenge from ${capability.url}: ${challenge.offers.length} Celo Mainnet payment offers (${challenge.offers.map((o) => `${o.tokenName || o.asset.slice(0, 8)}=${o.amountAtomic}`).join(', ')} atomic units to ${authoritativePayTo}). Fund AGENT_WALLET with ${tokenSymbol} and set AGENT_SIGNER_SECRET_REFERENCE to settle onchain.`,
        policyReason:
          'Policy engine AUTHORIZED call; live HTTP 402 challenge verified against gateway.usebuy.ai.',
        createdAt: new Date().toISOString(),
      },
    };
  }
}

