import type { DocGroup } from '../types';

export const developersGroup: DocGroup = {
  id: 'developers',
  label: 'Developers',
  pages: [
    {
      slug: 'developers/developer-overview',
      title: 'Developer Overview',
      description:
        'Getting started with the MOI developer ecosystem, monorepo packages, and local test runners.',
      blocks: [
        {
          type: 'p',
          text: 'MOI is designed as an open, modular treasury runtime. Developers can interact with MOI via its REST endpoints, consume its packages (`@moi/policy-engine`, `@moi/textile-adapter`), or integrate external autonomous agents with its ERC-8004 identity registry.',
        },
        {
          type: 'code',
          lang: 'bash',
          title: 'Package Installation',
          code: `# Clone the monorepo
git clone https://github.com/OpeyemiMoses/Moi.git
cd Moi

# Install dependencies across all packages
npm install

# Run the test suite
npm test`,
        },
      ],
    },
    {
      slug: 'developers/integration-architecture',
      title: 'Integration Architecture',
      description:
        'HTTP endpoints, Next.js App Router API structure, and package boundaries.',
      blocks: [
        {
          type: 'p',
          text: 'All API routes are served under `/api` and implemented via Next.js 15 Route Handlers (`apps/web/src/app/api/**/route.ts`). Endpoints enforce JSON schemas via Zod and communicate with PostgreSQL through `@moi/database`.',
        },
      ],
    },
    {
      slug: 'developers/authentication',
      title: 'Authentication',
      description:
        'Programmatic EIP-4361 SIWE handshake: nonce generation, signature validation, and session cookies.',
      blocks: [
        {
          type: 'p',
          text: 'To access authenticated treasury endpoints programmatically, clients execute the two-step SIWE handshake:',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Obtain Nonce',
              text: 'Dispatch `GET /api/auth/nonce`. The response returns `{ nonce: string }`.',
            },
            {
              title: 'Format SIWE Message',
              text: 'Format standard EIP-4361 string with domain, address, uri, version "1", chainId 42220, and the received nonce.',
            },
            {
              title: 'Sign and Verify',
              text: 'Sign with private key and dispatch `POST /api/auth/verify` with `{ message, signature }`. The server responds with 200 OK and sets the `moi_session` cookie.',
            },
          ],
        },
      ],
    },
    {
      slug: 'developers/api-reference',
      title: 'API Reference',
      description:
        'Exhaustive documentation of all production API endpoints, request schemas, and responses.',
      blocks: [
        {
          type: 'h2',
          text: 'Authentication Endpoints',
        },
        {
          type: 'table',
          headers: ['Method & Route', 'Auth Required', 'Request Body', 'Response Shape'],
          rows: [
            ['`GET /api/auth/nonce`', 'Public', 'None', '`{ nonce: string }`'],
            ['`POST /api/auth/verify`', 'Public', '`{ message: string, signature: string }`', '`{ user: UserProfile, ok: true }`'],
            ['`GET /api/auth/session`', 'Cookie', 'None', '`{ authenticated: boolean, user?: UserProfile }`'],
            ['`POST /api/auth/logout`', 'Cookie', 'None', '`{ ok: true }`'],
          ],
        },
        {
          type: 'h2',
          text: 'Treasury & Execution Endpoints',
        },
        {
          type: 'table',
          headers: ['Method & Route', 'Auth Required', 'Request Body', 'Response Shape'],
          rows: [
            ['`GET /api/treasury`', 'Authenticated', 'None', '`{ treasury, assets, mandates, telemetry }`'],
            ['`POST /api/treasury/controls`', 'Authenticated', '`{ paused: boolean, mandateId?: string }`', '`{ updated: boolean, paused: boolean }`'],
            ['`POST /api/fx/quote`', 'Authenticated', '`{ sellToken, buyToken, amount, takerAddress }`', '`{ quote: FirmQuote, policyResult: PolicyEvaluationResult }`'],
            ['`GET /api/pricing/stitch`', 'Public', '`?pair=cNGN-USDT`', '`{ bidRay, askRay, spreadBps, inventorySkew }`'],
            ['`GET /api/invoices/[id]`', 'Public', 'None', '`{ invoice: InvoiceRecord, qrSvg: string }`'],
            ['`POST /api/buy`', 'Authenticated', '`{ capabilityId, amountUsd }`', '`{ transactionReceipt, serviceResult }`'],
            ['`GET /api/identity/agent.json`', 'Public', 'None', 'ERC-8004 Registration Document JSON'],
          ],
        },
      ],
    },
    {
      slug: 'developers/data-models',
      title: 'Data Models',
      description:
        'TypeScript interfaces and Zod schemas for Mandates, Executions, Invoices, and Quotes.',
      blocks: [
        {
          type: 'code',
          lang: 'typescript',
          title: 'TreasuryMandate Schema',
          code: `export interface TreasuryMandate {
  id: string;
  treasuryId: string;
  agentId: string;
  name: string;
  mode: 'monitor' | 'approval_required' | 'autonomous';
  executionStrategy: 'taker_rfq' | 'passive_stitch_filler' | 'hybrid';
  chainId: 42220;
  sellToken: \`0x\${string}\`;
  buyToken: \`0x\${string}\`;
  minimumReserveAtomic: string;
  maxTradeAtomic: string;
  dailySellCapAtomic: string;
  maxSlippageBps: number;
  maxProtocolFeeBps: number;
  allowedTargets: \`0x\${string}\`[];
  paused: boolean;
}`,
        },
      ],
    },
    {
      slug: 'developers/events-and-webhooks',
      title: 'Events & Webhooks',
      description:
        'Subscribing to execution state changes and verifying inbound Textile HMAC signatures.',
      blocks: [
        {
          type: 'p',
          text: 'Inbound webhooks from Textile FX servers arrive at `/api/webhooks/textile` with the `X-Textile-Signature` header. The payload is validated using HMAC-SHA256 with the shared webhook secret before updating the execution state in the database.',
        },
      ],
    },
    {
      slug: 'developers/error-responses',
      title: 'Error Responses',
      description:
        'Standardized error envelopes, HTTP status codes, and policy rejection codes.',
      blocks: [
        {
          type: 'table',
          headers: ['HTTP Code', 'Error Code', 'Meaning'],
          rows: [
            ['`400 Bad Request`', '`INVALID_PARAMETERS`', 'Payload failed Zod schema validation.'],
            ['`401 Unauthorized`', '`UNAUTHENTICATED_SESSION`', 'Missing or invalid SIWE session cookie.'],
            ['`403 Forbidden`', '`POLICY_VIOLATION`', 'One or more of the 18 deterministic rules failed.'],
            ['`404 Not Found`', '`RESOURCE_NOT_FOUND`', 'Requested invoice, mandate, or execution ID does not exist.'],
            ['`409 Conflict`', '`EXECUTION_IN_FLIGHT`', 'A concurrent trade is already executing on this mandate.'],
            ['`410 Gone`', '`QUOTE_EXPIRED`', 'Textile firm quote accept deadline has lapsed.'],
          ],
        },
      ],
    },
    {
      slug: 'developers/idempotency',
      title: 'Idempotency',
      description:
        'Single-execution guarantees and atomic database locks preventing double-spend.',
      blocks: [
        {
          type: 'p',
          text: 'All trade submissions must include an `Idempotency-Key` or unique `executionId`. PostgreSQL atomic transactions with unique constraint indexes guarantee that identical execution requests return the existing execution record rather than broadcasting duplicate onchain transactions.',
        },
      ],
    },
    {
      slug: 'developers/integration-examples',
      title: 'Integration Examples',
      description:
        'TypeScript code snippets demonstrating end-to-end quote retrieval and policy verification.',
      blocks: [
        {
          type: 'code',
          lang: 'typescript',
          title: 'Direct Quote & Policy Evaluation',
          code: `import { evaluateSwapPolicy } from '@moi/policy-engine';
import { TextileAdapter } from '@moi/textile-adapter';

// 1. Initialize adapter
const adapter = new TextileAdapter();

// 2. Fetch firm RFQ quote from Textile FX v2
const quote = await adapter.requestFirmQuote({
  sellToken: '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f', // cNGN
  buyToken: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',  // USDT
  sellAmountAtomic: '50000000000', // 50,000 cNGN
  takerAddress: agentWalletAddress,
});

// 3. Evaluate 18 deterministic rules
const evaluation = evaluateSwapPolicy({
  mandate,
  quote,
  settledExecutionsCount: 5,
});

if (evaluation.passed) {
  console.log('Policy approved! Attestation token:', evaluation.attestationToken);
} else {
  console.error('Policy rejected:', evaluation.checks.filter(c => !c.passed));
}`,
        },
      ],
    },
    {
      slug: 'developers/security-requirements',
      title: 'Security Requirements',
      description:
        'Guidelines for developers building custom agents or integrating external microservices.',
      blocks: [
        {
          type: 'list',
          items: [
            '**Never expose private keys in client bundles**: Restricted signer credentials must reside exclusively in backend environment variables or secure enclaves.',
            '**Always verify calldata hashes**: Before signing an onchain transaction, assert that the calldata hash matches the policy attestation payload.',
            '**Always encode attribution metadata**: Ensure the ERC-8021 trailer `celo_c9cb9a59fc4c` is appended to all transaction calldata.',
          ],
        },
      ],
    },
  ],
};
