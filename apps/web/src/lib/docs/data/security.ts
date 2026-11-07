import type { DocGroup } from '../types';

export const securityGroup: DocGroup = {
  id: 'security',
  label: 'Security',
  pages: [
    {
      slug: 'security/security-overview',
      title: 'Security Overview',
      description:
        'Defense-in-depth security model: threat models, cryptographic bounds, and invariants.',
      blocks: [
        {
          type: 'p',
          text: 'MOI is engineered from first principles under the assumption that software agents and external RPC endpoints may be untrusted, compromised, or adversarial. Capital is safeguarded through a layered defense-in-depth model.',
        },
        {
          type: 'h2',
          text: 'Threat Models & Architectural Mitigations',
        },
        {
          type: 'table',
          headers: ['Threat Vector', 'Potential Impact', 'MOI Architectural Defense'],
          rows: [
            ['Agent Compromise / Prompt Injection', 'Unauthorized capital transfer to attacker', 'Restricted signer cannot transfer funds; target contracts restricted to `0xa9AA...`'],
            ['Front-Running / Sandwich Attacks', 'Slippage loss on decentralized exchanges', 'Textile RFQ firm quotes execute at guaranteed rateRay via direct limit reactor'],
            ['Replay / Double-Spend Attacks', 'Duplicate execution of a valid quote', 'Single-use nonces, Permit2 expiration, and database uniqueness locks'],
            ['Unauthorized Initial Execution', 'Agent begins trading before owner review', 'Rule #2: Mandatory First-Trade Owner Authorization Gate'],
            ['Cross-Tenant Data Leakage', 'Tenant B reads or executes against Tenant A treasury', 'EIP-4361 SIWE session with PostgreSQL Row-Level Security (RLS)'],
            ['Sudden Market Dislocation', 'Depleting reserves in volatile devaluations', 'Dynamic circuit breaker tripping on cumulative daily loss'],
          ],
        },
      ],
    },
    {
      slug: 'security/wallet-separation',
      title: 'Wallet Separation',
      description:
        'Cryptographic and architectural decoupling of Master Owner and Restricted Agent wallets.',
      blocks: [
        {
          type: 'p',
          text: 'MOI enforces strict wallet separation (`packages/wallet-signer/src/index.ts`). The Master Owner Wallet and Restricted Agent Wallet are cryptographically distinct accounts with mutually exclusive capabilities.',
        },
        {
          type: 'list',
          items: [
            '**Owner Wallet**: Retains full custody, signs first-trade authorizations, sets mandates, triggers emergency pauses, and receives invoice settlements.',
            '**Agent Wallet**: Holds minimal operational gas, possesses zero withdrawal rights, and can only sign transactions that carry a valid HMAC policy attestation for an approved target reactor.',
          ],
        },
      ],
    },
    {
      slug: 'security/restricted-signing',
      title: 'Restricted Signing',
      description:
        'How the agent signer is constrained to pre-approved contracts and calldata encodings.',
      blocks: [
        {
          type: 'p',
          text: 'The restricted signer (`RestrictedSigner` in `@moi/wallet-signer`) acts as a cryptographic sandbox. Before signing any raw EVM transaction, it asserts:',
        },
        {
          type: 'list',
          items: [
            '`to` address matches the allowlisted Textile `LimitOrderReactor` (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`).',
            '`value` is strictly 0 (no native CELO transfers allowed).',
            'Calldata decodes into valid Textile reactor or Permit2 orders.',
            'A valid, unexpired HMAC policy attestation is presented matching the calldata hash.',
          ],
        },
      ],
    },
    {
      slug: 'security/spending-authorization',
      title: 'Spending Authorization',
      description:
        'Per-trade ceilings, 24-hour cumulative caps, and reserve floor invariants.',
      blocks: [
        {
          type: 'p',
          text: 'Spending authority is bounded by mathematical limits stored in the database and checked by the policy engine on every quote:',
        },
        {
          type: 'list',
          items: [
            '**`maxTradeAtomic`**: Absolute upper bound on tokens that can be committed in a single conversion.',
            '**`dailySellCapAtomic`**: Rolling 24-hour cumulative ceiling. Every trade increments a rolling ledger window; if current_sum + trade > cap, execution is blocked.',
            '**`minimumReserveAtomic`**: Inviolable floor. An agent can never trade if remaining balance would drop below this safety margin.',
          ],
        },
      ],
    },
    {
      slug: 'security/owner-approval',
      title: 'Owner Approval',
      description:
        'Cryptographic EIP-712 structured data approvals for privileged operations.',
      blocks: [
        {
          type: 'p',
          text: 'Privileged actions in MOI require structured cryptographic consent signed by the owner wallet using EIP-712 standards. This ensures that the user sees human-readable fields (contract, token, amount, deadline) in their wallet before confirming, rather than signing blind hex data.',
        },
      ],
    },
    {
      slug: 'security/first-trade-authorization',
      title: 'First-Trade Authorization Gate',
      description:
        'The mandatory security gate requiring explicit human sign-off on the first agent trade.',
      blocks: [
        {
          type: 'callout',
          variant: 'security',
          title: 'SEC-M2-02 Invariant',
          text: 'Even if a mandate is set to `autonomous` mode, Rule #2 of the policy engine enforces that if `settledExecutionsCount === 0`, the agent **CANNOT** broadcast an onchain transaction without an unconsumed `FirstTradeAuthorizationRecord` signed by the treasury owner.',
        },
        {
          type: 'p',
          text: 'This prevents automated agents from taking actions on newly created treasuries before the owner has personally reviewed the first trade parameters on live mainnet.',
        },
      ],
    },
    {
      slug: 'security/session-security',
      title: 'Session Security',
      description:
        'Sign-In with Ethereum (EIP-4361), single-use nonces, and secure cookie hygiene.',
      blocks: [
        {
          type: 'p',
          text: 'User authentication conforms to EIP-4361 standards:',
        },
        {
          type: 'list',
          items: [
            '**Single-Use Nonces**: Nonces are cryptographically generated, stored in PostgreSQL with a 5-minute TTL, and deleted immediately upon first verification to prevent replay attacks.',
            '**Session Cookies**: Sessions are issued as `HttpOnly`, `SameSite=Strict`, `Secure` JWT cookies, preventing JavaScript injection attacks and cross-site request forgery.',
            '**Session Expiry**: Sessions automatically expire after 24 hours of inactivity or upon explicit logout.',
          ],
        },
      ],
    },
    {
      slug: 'security/tenant-isolation',
      title: 'Tenant Isolation',
      description:
        'Database Row-Level Security (RLS) guaranteeing strict multi-tenant boundary separation.',
      blocks: [
        {
          type: 'p',
          text: 'All PostgreSQL tables (mandates, executions, invoices, ledger entries) enforce multi-tenant isolation via `tenant_id` and Row-Level Security policies. Queries executed within a session automatically filter to the authenticated user wallet address, ensuring zero cross-tenant data leakage.',
        },
      ],
    },
    {
      slug: 'security/attestation-and-replay-protection',
      title: 'Attestation & Replay Protection',
      description:
        'HMAC-SHA256 policy tokens and cryptographic nonce binding.',
      blocks: [
        {
          type: 'p',
          text: 'Policy attestations are generated using HMAC-SHA256 with an enclave secret (`INTERNAL_POLICY_HMAC_SECRET`). The canonical payload hashes the `mandateId`, `executionId`, `rfqId`, `sellToken`, `buyToken`, `takerPays`, `buyAmount`, and `nonce`. If any byte of the transaction is modified, the attestation becomes invalid.',
        },
      ],
    },
    {
      slug: 'security/webhook-verification',
      title: 'Webhook Verification',
      description:
        'HMAC signature verification and idempotency locks for inbound Textile updates.',
      blocks: [
        {
          type: 'p',
          text: 'Inbound webhooks from Textile FX servers are verified using HMAC signatures (`X-Textile-Signature`) before ingestion. Webhook deliveries are deduplicated using database idempotency locks on the `event_id` to guarantee that duplicate network deliveries never cause double accounting.',
        },
      ],
    },
    {
      slug: 'security/onchain-reconciliation',
      title: 'Onchain Reconciliation',
      description:
        'Independent receipt log parsing verifying token deltas against ledger records.',
      blocks: [
        {
          type: 'p',
          text: 'MOI does not rely on offchain status messages to confirm settlement. After every transaction confirmation, the system reads raw ERC-20 `Transfer(from, to, value)` logs from the Celo blockchain to confirm that the exact quoted token amounts were transferred before marking an execution `RECONCILED`.',
        },
      ],
    },
    {
      slug: 'security/emergency-controls',
      title: 'Emergency Controls',
      description:
        '1-click emergency stop halting all autonomous trading across all mandates.',
      blocks: [
        {
          type: 'p',
          text: 'The sidebar features an **Emergency Pause All** control. Clicking this control dispatches `POST /api/treasury/controls` to toggle `paused = true` across all mandates. Rule #1 of the policy engine (`MANDATE_NOT_PAUSED`) instantly rejects any subsequent trade attempts.',
        },
      ],
    },
    {
      slug: 'security/known-limitations',
      title: 'Known Limitations',
      description:
        'Transparent documentation of current platform constraints and staging features.',
      blocks: [
        {
          type: 'p',
          text: 'In accordance with our commitment to absolute technical transparency, the following limitations are documented:',
        },
        {
          type: 'list',
          items: [
            '**Domestic Bank Offramps**: Direct bank withdrawals (e.g. cNGN to Nigerian bank accounts via NIP) are staged as "Coming Soon" in the UI pending licensing and banking partner integration.',
            '**Ripio LatAm Bridge**: Endpoints for Latin American fiat rails (`wARS`, `wBRL`) are configured in the address book but require local partner KYC for fiat onramping.',
            '**Single-Tenant Agent Key**: In local development, the restricted signer uses an environment secret reference; in enterprise deployments, this delegates to an HSM or AWS KMS enclave.',
          ],
        },
      ],
    },
  ],
};
