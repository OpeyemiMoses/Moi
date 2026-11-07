import type { DocGroup } from '../types';

export const productGroup: DocGroup = {
  id: 'product',
  label: 'Product',
  pages: [
    {
      slug: 'product/treasury-overview',
      title: 'Treasury Overview',
      description:
        'The foundational treasury structure, multi-currency accounting, and asset protection models in MOI.',
      blocks: [
        {
          type: 'p',
          text: 'The MOI Treasury is an enterprise-grade financial coordination unit designed for businesses holding multiple currencies on Celo Mainnet. Rather than managing isolated token accounts, MOI treats the treasury as a unified balance sheet with real-time mark-to-market valuations and drift telemetry.',
        },
        {
          type: 'h2',
          text: 'Treasury Architecture & Balance Sheet',
        },
        {
          type: 'p',
          text: 'A treasury manages four primary financial components:',
        },
        {
          type: 'list',
          items: [
            '**Reserve Assets**: USD-pegged stablecoins (`USD₮`, `USDC`) designed to preserve corporate purchasing power.',
            '**Operational Working Capital**: Local emerging market currencies (`cNGN`, `wARS`, `wBRL`, `wCOP`) required for day-to-day vendor and payroll settlements.',
            '**Gas Provisions**: Native `CELO` utilized for onchain execution and Permit2 approvals.',
            '**Pending Receivables & Invoices**: Cryptographic invoices issued via EIP-712 awaiting onchain client settlement.',
          ],
        },
      ],
    },
    {
      slug: 'product/treasury-wallets',
      title: 'Treasury Wallets',
      description:
        'The role of the Master Owner Wallet and custody security boundaries.',
      blocks: [
        {
          type: 'p',
          text: 'The **Master Owner Wallet** represents the legal and ultimate cryptographic authority over all corporate funds. In MOI, this address is connected via standard Web3 interfaces (MetaMask, Rabby, Valora) and authenticated through Sign-In with Ethereum (EIP-4361).',
        },
        {
          type: 'h2',
          text: 'Owner Wallet Capabilities & Exclusivities',
        },
        {
          type: 'list',
          items: [
            '**Mandate Configuration**: Only the owner wallet can create, edit, pause, or terminate a spending mandate.',
            '**First-Trade Authorization Gate**: An agent cannot execute its first transaction without explicit EIP-712 cryptographic authorization from the owner.',
            '**Emergency Circuit Breakers**: The owner wallet possesses an instantaneous, non-revocable killswitch to halt all automated agent executions.',
            '**Capital Extraction**: Agent signers can never transfer capital out of the treasury to arbitrary unapproved addresses.',
          ],
        },
      ],
    },
    {
      slug: 'product/agent-wallets',
      title: 'Agent Wallets',
      description:
        'Restricted signer architecture, key isolation, and operational bounds.',
      blocks: [
        {
          type: 'p',
          text: 'The **Agent Wallet** is a restricted signer configured to execute routine financial operations (such as Textile RFQ swaps and x402 capability payments) without requiring continuous human signatures for micro-transactions.',
        },
        {
          type: 'callout',
          variant: 'security',
          title: 'Cryptographic Wallet Separation',
          text: 'The agent wallet is strictly isolated from the owner wallet. The agent possesses no access to the owner private key or seed phrase. Furthermore, any transaction signed by the agent must pass the restricted signer verification pipeline, which validates policy attestations and target contracts before generating a signature.',
        },
      ],
    },
    {
      slug: 'product/spending-mandates',
      title: 'Spending Mandates',
      description:
        'The programmatic policy rulebook governing all agent financial activities.',
      blocks: [
        {
          type: 'p',
          text: 'A **Spending Mandate** is a typed data structure defining the precise financial boundaries within which an agent is permitted to operate. Mandates are validated against the `TreasuryMandateSchema` in `@moi/shared-types`.',
        },
        {
          type: 'table',
          headers: ['Mandate Parameter', 'Type', 'Description', 'Default / Constraint'],
          rows: [
            ['`mode`', '`AgentOperatingModeEnum`', 'Operating autonomy level: `monitor`, `approval_required`, `autonomous`', 'Required'],
            ['`executionStrategy`', 'Enum', 'Strategy: `taker_rfq`, `passive_stitch_filler`, `hybrid`', '`taker_rfq`'],
            ['`sellToken`', 'Address', 'Allowed asset to convert from (e.g. `cNGN`)', 'Verified Celo token'],
            ['`buyToken`', 'Address', 'Target asset to convert into (e.g. `USD₮`)', 'Verified Celo token'],
            ['`maxTradeAtomic`', 'BigInt String', 'Maximum single-trade conversion cap in atomic units', 'Required by policy'],
            ['`dailySellCapAtomic`', 'BigInt String', 'Maximum 24-hour cumulative spend cap', 'Required by policy'],
            ['`minimumReserveAtomic`', 'BigInt String', 'Minimum balance of base token that must remain in treasury', 'Inviolable reserve floor'],
            ['`maxSlippageBps`', 'Number (bps)', 'Maximum allowable slippage in basis points (100 bps = 1.0%)', 'Default: 100 bps'],
            ['`allowedTargets`', 'Address Array', 'Strict list of contract addresses the agent may call', '`LimitOrderReactor` (`0xa9AA...`)'],
          ],
        },
      ],
    },
    {
      slug: 'product/approval-workflows',
      title: 'Approval Workflows',
      description:
        'Human-in-the-loop governance for trades exceeding autonomous thresholds.',
      blocks: [
        {
          type: 'p',
          text: 'When a treasury operates in `approval_required` mode, or when a proposed execution in `autonomous` mode encounters specific threshold gates (such as the mandatory First-Trade Gate or a large deviation), MOI stages the transaction in an `APPROVAL_PENDING` state.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Proposal Staging',
              text: 'The agent identifies a rebalance opportunity and requests a firm quote from Textile FX, generating a valid policy check and staging the trade in PostgreSQL.',
            },
            {
              title: 'Operator Notification',
              text: 'The pending approval is displayed on the dashboard with full telemetry: sell asset, buy asset, exchange rate, fee breakdown, and policy compliance verification.',
            },
            {
              title: 'Cryptographic Signature',
              text: 'The treasury owner clicks Approve, triggering an EIP-712 structured data signature in their connected Web3 wallet.',
            },
            {
              title: 'Mempool Broadcast',
              text: 'The approved transaction is combined with the Schema 0 attribution trailer and broadcast to Celo Mainnet for execution.',
            },
          ],
        },
      ],
    },
    {
      slug: 'product/autonomous-mode',
      title: 'Autonomous Mode',
      description:
        'Hands-free treasury rebalancing within pre-approved deterministic rules.',
      blocks: [
        {
          type: 'p',
          text: 'In **Autonomous Mode**, the MOI background orchestrator evaluates portfolio drift and automatically executes trades that strictly satisfy all 18 deterministic policy rules without requiring manual owner clicks for each transaction.',
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'The Mandatory First-Trade Exception',
          text: 'Even in fully autonomous mode, Rule #2 (`FIRST_TRADE_OWNER_AUTHORIZATION`) strictly forbids the agent from executing its very first trade without explicit owner wallet authorization. Once the first trade is signed and settled onchain, subsequent trades execute autonomously within the configured daily and per-trade caps.',
        },
      ],
    },
    {
      slug: 'product/monitoring-and-analytics',
      title: 'Monitoring & Analytics',
      description:
        'Real-time portfolio telemetry, drift analysis, and market-making spreads.',
      blocks: [
        {
          type: 'p',
          text: 'The MOI dashboard provides continuous real-time telemetry into treasury health and market opportunities:',
        },
        {
          type: 'list',
          items: [
            '**Real-Time Multicall Balances**: Onchain token balances queried directly from Celo Mainnet RPC nodes (`forno.celo.org`).',
            '**Portfolio Allocation Gauge**: Visual calculation of current stablecoin vs local currency asset ratios against the target mandate ratio.',
            '**Drift Calculation**: Live measurement of portfolio deviation triggering rebalance recommendations when drift exceeds 5%.',
            '**Textile Stitch Spread Telemetry**: Real-time bid/ask rates, inventory skew, and corridor volatility indicators.',
          ],
        },
      ],
    },
    {
      slug: 'product/transaction-history',
      title: 'Transaction History',
      description:
        'Comprehensive onchain settlement records with CeloScan block links.',
      blocks: [
        {
          type: 'p',
          text: 'Every execution conducted through MOI is permanently recorded in PostgreSQL and indexed with its corresponding CeloScan block explorer link, gas fees, block number, and execution state.',
        },
        {
          type: 'p',
          text: 'Transactions are filterable by currency pair, status (`SETTLED`, `FAILED`, `REJECTED`), and initiating authority (Owner vs Autonomous Agent).',
        },
      ],
    },
    {
      slug: 'product/audit-trail',
      title: 'Audit Trail',
      description:
        'Immutable event logs, policy check outcomes, and double-entry reconciliations.',
      blocks: [
        {
          type: 'p',
          text: 'For institutional compliance and internal audit, MOI maintains an unalterable audit trail. Each execution record links the originating Textile `rfqId`, the 18-rule policy check results, the HMAC policy attestation hash, and the resulting balanced double-entry journal entries.',
        },
      ],
    },
  ],
};
