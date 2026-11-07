import type { DocGroup } from '../types';

export const howItWorksGroup: DocGroup = {
  id: 'how-it-works',
  label: 'How It Works',
  pages: [
    {
      slug: 'how-it-works/system-architecture',
      title: 'System Architecture',
      description:
        'Technical architectural layers: Frontend, Backend API, Policy Engine, Adapter layer, and Celo Network.',
      blocks: [
        {
          type: 'p',
          text: 'MOI is organized as a clean TypeScript monorepo with strict package boundaries, ensuring that execution logic, signing boundaries, and policy validation remain decoupled from user-interface rendering.',
        },
        {
          type: 'table',
          headers: ['Monorepo Package', 'Path', 'Responsibility'],
          rows: [
            ['`@moi/shared-types`', '`packages/shared-types`', 'Protocol constants, Zod schemas, Celo token address books, and type definitions.'],
            ['`@moi/policy-engine`', '`packages/policy-engine`', '18 deterministic trade rules, HMAC attestation generation, and policy verification.'],
            ['`@moi/wallet-signer`', '`packages/wallet-signer`', 'Restricted agent signer, wallet separation validator, and ERC-8021 trailer encoding.'],
            ['`@moi/textile-adapter`', '`packages/textile-adapter`', 'Textile FX v2 RFQ client, preview calculator, and webhook idempotency handlers.'],
            ['`@moi/buy-client`', '`packages/buy-client`', '`@x402/fetch` EVM client, capability catalog discovery, and microservice billing.'],
            ['`@moi/identity`', '`packages/identity`', 'SIWE challenge management, JWT session cookies, and ERC-8004 document schemas.'],
            ['`@moi/ledger`', '`packages/ledger`', 'Strict balanced double-entry accounting journal generator and verification tests.'],
            ['`@moi/database`', '`packages/database`', 'PostgreSQL engine, migration runner, Row-Level Security, and backup/recovery.'],
            ['`@moi/web`', '`apps/web`', 'Next.js 15 application shell, App Router API endpoints, and real-time Web3 dashboard.'],
          ],
        },
      ],
    },
    {
      slug: 'how-it-works/agent-lifecycle',
      title: 'Autonomous Agent Lifecycle',
      description:
        'The continuous background loop: telemetry polling, drift evaluation, quoting, and reconciliation.',
      blocks: [
        {
          type: 'p',
          text: 'The MOI Agent worker runs an event-driven execution loop that continuously monitors onchain states without consuming unnecessary RPC bandwidth.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'State Polling & Invariant Check',
              text: 'The agent queries Celo RPC via multicall to fetch current token balances. It validates that the mandate has not been paused by an emergency stop.',
            },
            {
              title: 'Drift & Opportunity Detection',
              text: 'The agent compares the live asset distribution against the mandate target. If drift exceeds 5% and the local asset exceeds the minimum reserve, a rebalancing intent is formed.',
            },
            {
              title: 'RFQ Request & Quote Retrieval',
              text: 'The agent contacts the Textile FX v2 liquidity network for an institutional firm quote with guaranteed rate and zero price impact.',
            },
            {
              title: 'Policy Evaluation & Signing Gate',
              text: 'The quote is handed to the deterministic policy engine. If all 18 rules pass, the restricted signer generates the transaction payload.',
            },
            {
              title: 'Broadcast, Settlement & Ingestion',
              text: 'The transaction is submitted with the ERC-8021 attribution tag, confirmed in a Celo block, verified onchain, and journaled into the double-entry ledger.',
            },
          ],
        },
      ],
    },
    {
      slug: 'how-it-works/policy-engine',
      title: 'Deterministic Policy Engine',
      description:
        'Deep technical specification of the 18 deterministic rules evaluated in evaluateSwapPolicy().',
      blocks: [
        {
          type: 'p',
          text: 'The **Deterministic Policy Engine** (`packages/policy-engine/src/index.ts`) is the heart of MOI security. Every proposed transaction must pass every rule before a signature or broadcast is permitted.',
        },
        {
          type: 'table',
          headers: ['#', 'Rule Identifier', 'Check Description', 'Failure Action'],
          rows: [
            ['1', '`MANDATE_NOT_PAUSED`', 'Verifies treasury and mandate are not under emergency stop.', 'REJECT with 403 Forbidden'],
            ['2', '`FIRST_TRADE_OWNER_AUTHORIZATION`', 'Enforces explicit owner signature if treasury has 0 settled executions.', 'REQUIRE_OWNER_APPROVAL'],
            ['3', '`OPERATING_MODE`', 'Confirms current mode permits automated or staged execution.', 'STAGE for approval if not autonomous'],
            ['4', '`NO_DUPLICATE_LOCK`', 'Prevents race conditions by rejecting if an execution is already in flight.', 'REJECT with 409 Conflict'],
            ['5', '`SIGNER_HEALTHY`', 'Confirms restricted signer environment is operational and separated.', 'ABORT with 500 Error'],
            ['6', '`CHAIN_ID_CELO_MAINNET`', 'Verifies target network is strictly Celo Mainnet (`42220`).', 'REJECT immediately'],
            ['7', '`FIRM_QUOTE_PRESENT`', 'Requires a firm executable RFQ quote, rejecting indicative previews.', 'REJECT unexecutable quote'],
            ['8', '`TAKER_WALLET_MATCH`', 'Ensures quote taker matches the authorized agent wallet address.', 'REJECT spoofed taker'],
            ['9', '`QUOTE_NOT_EXPIRED`', 'Validates current timestamp is strictly before quote accept deadline.', 'REJECT with 410 Expired'],
            ['10', '`ALLOWLISTED_CORRIDOR`', 'Validates sellToken and buyToken match the approved mandate corridor.', 'REJECT unauthorized corridor'],
            ['11', '`APPROVED_REACTOR_TARGET`', 'Target contract must strictly be Textile LimitOrderReactor (`0xa9AA...`).', 'REJECT invalid destination'],
            ['12', '`CALLDATA_AND_VALUE_GUARD`', 'Requires msg.value == 0 and valid Permit2/Reactor calldata encoding.', 'REJECT unsafe calldata'],
            ['13', '`PER_TRADE_CAP`', 'Ensures sell amount in atomic units does not exceed `maxTradeAtomic`.', 'REJECT trade cap breach'],
            ['14', '`DAILY_SELL_CAP`', 'Ensures 24h rolling cumulative volume does not exceed `dailySellCapAtomic`.', 'REJECT daily limit breach'],
            ['15', '`MINIMUM_RESERVE_PRESERVED`', 'Validates post-trade balance will strictly remain >= `minimumReserveAtomic`.', 'REJECT reserve exhaustion'],
            ['16', '`MIN_BUY_OUTPUT_THRESHOLD`', 'Verifies buy output satisfies minimum amount after maxSlippageBps.', 'REJECT price impact / slippage'],
            ['17', '`PROTOCOL_FEE_BOUND`', 'Verifies Textile protocol fee does not exceed fee ceiling (default 25 bps).', 'REJECT excessive fee'],
            ['18', '`DAILY_LOSS_CIRCUIT_BREAKER`', 'Trips if daily realized negative drift exceeds `maxDailyLossAtomic`.', 'TRIP circuit breaker & pause'],
          ],
        },
      ],
    },
    {
      slug: 'how-it-works/quote-discovery',
      title: 'Quote Discovery',
      description:
        'Indicative previews vs. firm RFQ quotes, rateRay math, and pricing sources.',
      blocks: [
        {
          type: 'p',
          text: 'MOI interacts with two quoting paradigms via `@moi/textile-adapter`:',
        },
        {
          type: 'h2',
          text: '1. Indicative Previews (Unsigned)',
        },
        {
          type: 'p',
          text: 'Dispatched via `POST https://api.textilecredit.com/v2/rfq/preview` to obtain real-time indicative market maker pricing for UI rendering and drift modeling. Previews carry no cryptographic commitment, expire within seconds, and **cannot be broadcast to the blockchain**.',
        },
        {
          type: 'h2',
          text: '2. Firm RFQ Quotes (Cryptographically Committed)',
        },
        {
          type: 'p',
          text: 'Requested via `POST https://api.textilecredit.com/v2/rfq/request` with a signed `TakerControl` proof. The market maker signs a binding commitment specifying `rateRay`, `takerPays`, `buyAmount`, `feeAmount`, and `acceptDeadline`. This firm quote forms the basis of the onchain order.',
        },
      ],
    },
    {
      slug: 'how-it-works/execution-lifecycle',
      title: 'Execution Lifecycle',
      description:
        'Verbatim state machine transitions from CREATED to SETTLED or RECONCILED.',
      blocks: [
        {
          type: 'p',
          text: 'All trade executions transition through the strict state machine defined in `ExecutionStateEnum` (`packages/shared-types/src/index.ts`):',
        },
        {
          type: 'table',
          headers: ['State Identifier', 'Category', 'Description'],
          rows: [
            ['`CREATED`', 'Initialization', 'Trade opportunity detected and recorded in database.'],
            ['`QUOTE_REQUESTED`', 'Quoting', 'Outbound RFQ dispatched to Textile liquidity network.'],
            ['`QUOTE_RECEIVED`', 'Quoting', 'Firm quote returned with valid rateRay and accept deadline.'],
            ['`POLICY_VALIDATED`', 'Enforcement', 'All 18 deterministic rules evaluated and passed.'],
            ['`APPROVAL_PENDING`', 'Governance', 'Staged awaiting human owner signature (if in approval mode).'],
            ['`EXECUTION_PENDING`', 'Signing', 'Signed by restricted signer; preparing mempool broadcast.'],
            ['`SUBMITTED`', 'Onchain', 'Broadcast to Celo Mainnet mempool; awaiting block inclusion.'],
            ['`CONFIRMED`', 'Onchain', 'Included in a Celo block with confirmed receipt.'],
            ['`SETTLED`', 'Settlement', 'Textile LimitOrderReactor settled and verified onchain.'],
            ['`RECONCILED`', 'Ledger', 'Double-entry journal entries verified and balanced in ledger.'],
            ['`REJECTED`', 'Terminal', 'Policy engine rejected proposal due to rule violation.'],
            ['`EXPIRED`', 'Terminal', 'Quote accept deadline lapsed before onchain inclusion.'],
            ['`FAILED`', 'Terminal', 'Onchain transaction reverted or network error occurred.'],
            ['`REQUIRES_RECONCILIATION`', 'Exception', 'Onchain trade confirmed but ledger balance mismatch detected.'],
          ],
        },
      ],
    },
    {
      slug: 'how-it-works/settlement-verification',
      title: 'Settlement Verification',
      description:
        'How MOI confirms that onchain token transfers match the exact agreed quote.',
      blocks: [
        {
          type: 'p',
          text: 'After an onchain transaction confirms in a Celo block, MOI does not assume success from the transaction status alone. The settlement worker executes a forensic verification routine:',
        },
        {
          type: 'list',
          items: [
            '**ERC-20 Transfer Log Parsing**: Reads raw event logs from the Celo block to verify that the treasury debited exactly `takerPays` and received >= `buyAmount`.',
            '**Permit2 Allowance Invalidation**: Confirms that single-use Permit2 nonces have been successfully consumed, preventing replay attempts.',
            '**Reactor Verification**: Validates that the event emitter matches the Textile `LimitOrderReactor` address (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`).',
          ],
        },
      ],
    },
    {
      slug: 'how-it-works/double-entry-ledger',
      title: 'Double-Entry Ledger',
      description:
        'Mathematical verification of balanced journal entries across all currency conversions.',
      blocks: [
        {
          type: 'p',
          text: 'Every settled trade generates a balanced double-entry accounting journal in PostgreSQL (`packages/ledger/src/index.ts`). Every transaction satisfies the fundamental invariant:',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'The Double-Entry Invariant',
          text: '$$\\sum \\text{DEBITS} \\equiv \\sum \\text{CREDITS} \\quad \\text{across every individual asset symbol}$$',
        },
        {
          type: 'table',
          headers: ['Account Name', 'Direction', 'Asset', 'Purpose'],
          rows: [
            ['`TREASURY_ASSET:<sellToken>`', 'CREDIT', 'Sold Asset', 'Deducts principal leaving the treasury balance.'],
            ['`FX_SETTLEMENT_CLEARING:<sellToken>`', 'DEBIT', 'Sold Asset', 'Clearing account receiving net principal for exchange.'],
            ['`PROTOCOL_FEE_EXPENSE:<sellToken>`', 'DEBIT', 'Sold Asset', 'Records 1 bps Textile network protocol fee.'],
            ['`TREASURY_ASSET:<buyToken>`', 'DEBIT', 'Bought Asset', 'Credits new currency acquired into the treasury.'],
            ['`FX_SETTLEMENT_CLEARING:<buyToken>`', 'CREDIT', 'Bought Asset', 'Balances the clearing leg upon settlement receipt.'],
          ],
        },
      ],
    },
    {
      slug: 'how-it-works/failure-handling-and-recovery',
      title: 'Failure Handling & Recovery',
      description:
        'Crash-safety, database recovery, worker restart handling, and reconciliation protocols.',
      blocks: [
        {
          type: 'p',
          text: 'Financial systems must guarantee consistent state even across sudden power failure, container restarts, or RPC outages. MOI implements multi-tier recovery:',
        },
        {
          type: 'list',
          items: [
            '**Orphaned Execution Recovery**: On worker startup, `recoverOrphanedExecutions()` identifies any records stuck in `SUBMITTED` state, queries Celo RPC for transaction receipts, and advances them to `CONFIRMED` or `FAILED`.',
            '**Automated Database Snapshots**: PostgreSQL automated WAL archiving and daily checksummed backups verified by SHA-256 integrity hashes.',
            '**Deterministic State Resumption**: Idempotency keys on all webhook ingestion endpoints ensure network retries never trigger duplicate execution records.',
          ],
        },
      ],
    },
  ],
};
