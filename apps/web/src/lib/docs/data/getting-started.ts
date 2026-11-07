import type { DocGroup } from '../types';

export const gettingStartedGroup: DocGroup = {
  id: 'getting-started',
  label: 'Getting Started',
  pages: [
    {
      slug: 'getting-started/introduction',
      title: 'Introduction',
      description:
        'An executive and technical overview of MOI — the autonomous stablecoin treasury operating system built natively on Celo Mainnet.',
      blocks: [
        {
          type: 'p',
          text: '**MOI** is an institutional-grade, non-custodial treasury operating system that allows businesses, digital merchants, and fintech operators to delegate financial workflows to software agents **strictly within deterministic rules defined by the treasury owner**.',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'The Core Governance Distinction',
          text: '**AI proposes. MOI enforces. The user controls. Execution infrastructure executes.** Software agents in MOI never possess unilateral authority over treasury capital; every potential transaction is intercepted and evaluated against deterministic smart contract and policy engine invariants before broadcast.',
        },
        {
          type: 'h2',
          text: 'Who MOI is Built For',
        },
        {
          type: 'p',
          text: 'MOI is specifically engineered for enterprises operating in volatile, high-inflation emerging markets across Sub-Saharan Africa and Latin America. Key user profiles include:',
        },
        {
          type: 'list',
          items: [
            '**Cross-Border Exporters & Importers**: Businesses earning in local fiat currencies (such as Nigerian Naira `cNGN`, Argentine Peso `wARS`, or Brazilian Real `wBRL`) with immediate obligations in USD-pegged stablecoins (`USD₮` / `USDC`).',
            '**Digital Merchants & Remote Agencies**: Teams collecting global payments via zero-gas payment links who require automatic reserve protection against local currency depreciation.',
            '**Autonomous Agents & FinTech Integrators**: Autonomous microservices needing onchain payment rails, automated FX rebalancing, and programmatic service procurement via the `x402` HTTP payment protocol.',
          ],
        },
        {
          type: 'h2',
          text: 'How MOI Differs from Other Architectures',
        },
        {
          type: 'table',
          headers: ['Dimension', 'Conventional Multisig / Wallet', 'Unrestricted AI Agent', 'MOI Treasury OS'],
          rows: [
            ['Signing Authority', 'Manual human key per transaction', 'Full private key access', 'Restricted session signer bound by HMAC attestation'],
            ['Policy Enforcement', 'Offchain governance / human discretion', 'Unconstrained prompt outputs', '18 deterministic rules evaluated in sandboxed engine'],
            ['Execution Speed', 'Hours to days (quorum delay)', 'Instantaneous (unsafe)', 'Instantaneous within pre-approved owner mandate limits'],
            ['FX Settlement Rail', 'Manual DEX swaps with slippage', 'Arbitrary routing / DEX contracts', 'Textile FX v2 institutional RFQ limit reactor (`0xa9AA...`)'],
            ['Attribution & Audit', 'None (anonymous calldata)', 'Unstructured logs', 'ERC-8021 calldata trailer + ERC-8004 canonical agent identity'],
          ],
        },
        {
          type: 'h2',
          text: 'Next Steps',
        },
        {
          type: 'cards',
          items: [
            {
              title: 'What is MOI?',
              text: 'Explore the fundamental design philosophy, multi-agent architecture, and Celo Mainnet deployment.',
              href: '/docs/getting-started/what-is-moi',
            },
            {
              title: 'Why MOI?',
              text: 'Understand the macro challenges of emerging market treasuries and currency depreciation.',
              href: '/docs/getting-started/why-moi',
            },
            {
              title: 'Quick Start',
              text: 'Connect a Celo wallet, set a mandate, and test live rebalancing in under two minutes.',
              href: '/docs/getting-started/quick-start',
            },
          ],
        },
      ],
    },
    {
      slug: 'getting-started/what-is-moi',
      title: 'What is MOI?',
      description:
        'Understanding the non-custodial treasury operating system, its boundary separation, and core operating principles.',
      blocks: [
        {
          type: 'p',
          text: 'MOI is not a generic chatbot, an unregulated trading bot, or a custodial bank. It is a **deterministic orchestration runtime** deployed on Celo Mainnet (`chainId: 42220`) that couples programmatic agent intelligence with strict cryptographic policy boundaries.',
        },
        {
          type: 'diagram',
          title: 'MOI System Boundary & Governance Architecture',
          layers: [
            {
              label: 'Owner Authority',
              nodes: [
                { name: 'Master Owner Wallet', detail: 'Controls funds, sets mandates, signs first trade' },
                { name: 'EIP-4361 SIWE Session', detail: 'HttpOnly secure JWT with cryptographic nonce' },
              ],
            },
            {
              label: 'Enforcement Layer',
              nodes: [
                { name: 'Deterministic Policy Engine', detail: '18 invariant checks (caps, corridor, reactor)' },
                { name: 'HMAC Policy Attestation', detail: 'Cryptographic binding between quote and execution' },
              ],
            },
            {
              label: 'Execution Subsystem',
              nodes: [
                { name: 'Textile FX v2 RFQ', detail: 'Zero-slippage market maker settlement reactor' },
                { name: 'buy / x402 Protocol', detail: 'HTTP 402 agent-to-agent microservice payments' },
              ],
            },
            {
              label: 'Audit & Telemetry',
              nodes: [
                { name: 'ERC-8004 Identity #164', detail: 'Onchain canonical registry verification' },
                { name: 'ERC-8021 Attribution', detail: 'Tag celo_c9cb9a59fc4c on every transaction' },
                { name: 'Double-Entry Ledger', detail: 'Strict balanced journal entries in PostgreSQL' },
              ],
            },
          ],
          caption: 'Figure 1: Complete separation of powers between Owner Governance, Policy Enforcement, and Execution Infrastructure.',
        },
        {
          type: 'h2',
          text: 'The Three Inviolable Architectural Principles',
        },
        {
          type: 'list',
          items: [
            '**Separation of Custody and Execution**: The owner wallet retains ultimate legal and cryptographic title to treasury capital. The agent wallet holds only strictly allocated operational balances or signing delegation within immutable spending ceilings.',
            '**Zero-Slippage Institutional Settlement**: Rather than dumping tokens into automated market maker liquidity pools with high price impact and front-running risk, MOI routes conversions exclusively through Textile FX v2 RFQ reactors.',
            '**Cryptographic Audit Trail**: Every transaction broadcast to Celo Mainnet appends the official ERC-8021 attribution tag `celo_c9cb9a59fc4c` and resolves against the ERC-8004 Agent Identity #164.',
          ],
        },
      ],
    },
    {
      slug: 'getting-started/why-moi',
      title: 'Why MOI?',
      description:
        'The macroeconomic necessity of autonomous treasury operations in high-inflation markets.',
      blocks: [
        {
          type: 'p',
          text: 'Businesses operating in emerging markets face an existential currency dilemma: daily revenues are generated in volatile local currencies, while operational software, server hosting, hardware procurement, and international suppliers require US Dollar or Euro stablecoins.',
        },
        {
          type: 'h2',
          text: 'The Cost of Manual Treasury Management',
        },
        {
          type: 'list',
          items: [
            '**Rapid Currency Depreciation**: Holding local currency (e.g. `cNGN` or `wARS`) overnight exposes enterprise capital to severe devaluation before manual wire transfers or P2P swaps can be executed.',
            '**Fragmented Banking Rails**: Traditional banking corridors require manual paper invoices, arbitrary foreign exchange rationing, and multi-day clearing delays with 3–7% opaque FX spreads.',
            '**Human Operational Latency**: Currency volatility peaks outside of normal banking hours. Manual rebalancing cannot protect working capital during sudden overnight devaluations.',
            '**Unrestricted Agent Risk**: Giving an AI bot direct API keys or private keys to corporate funds introduces catastrophic prompt injection and unauthorized spending risks.',
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'The Real-World Nigerian Enterprise Scenario',
          text: 'A Lagos digital logistics company generates **15,000,000 cNGN** daily from merchant deliveries, but must pay **$9,500 USD₮** weekly for AWS cloud hosting and global API services. Under manual operations, cash sits in local bank accounts losing purchasing power while an accountant seeks FX liquidity. With MOI, the treasury mandate automatically sweeps excess cNGN into USD₮ through Textile FX v2 firm quotes whenever drift exceeds 5%, ensuring zero slippage, verified settlement, and an automated double-entry accounting log.',
        },
      ],
    },
    {
      slug: 'getting-started/core-concepts',
      title: 'Core Concepts',
      description:
        'Fundamental terms and mechanisms: Mandates, Quoting, Policy Attestations, and Attributions.',
      blocks: [
        {
          type: 'h2',
          text: 'Key Terminology',
        },
        {
          type: 'table',
          headers: ['Concept', 'Definition', 'Code Implementation'],
          rows: [
            ['Treasury Mandate', 'A cryptographic policy document defining authorized assets, spend caps, slippage limits, and operating modes.', '`TreasuryMandateSchema` in `@moi/shared-types`'],
            ['Operating Mode', 'The autonomy level of the agent: `monitor` (read-only), `approval_required` (human-in-the-loop), or `autonomous` (self-executing).', '`AgentOperatingModeEnum`'],
            ['Firm RFQ Quote', 'An executable cryptographic trade commitment from Textile FX liquidity providers with a guaranteed rateRay and accept deadline.', '`FirmQuote` interface in `@moi/shared-types`'],
            ['Policy Attestation', 'An HMAC-SHA256 signature generated by the policy engine attesting that a specific quote conforms to all mandate rules.', '`generatePolicyAttestation()` in `@moi/policy-engine`'],
            ['First-Trade Gate', 'A mandatory security requirement requiring an explicit owner signature before any agent can execute its first live trade.', '`FirstTradeAuthorizationRecord`'],
            ['Attribution Tag', 'An ERC-8021 Schema 0 calldata suffix encoding the protocol identifier `celo_c9cb9a59fc4c`.', '`@celo/attribution-tags` trailer encoding'],
          ],
        },
      ],
    },
    {
      slug: 'getting-started/how-it-works',
      title: 'How MOI Works',
      description:
        'Step-by-step breakdown of the end-to-end treasury execution pipeline.',
      blocks: [
        {
          type: 'p',
          text: 'The MOI execution pipeline consists of 12 deterministic stages coordinating the owner, agent orchestrator, policy engine, Textile reactor, and Celo blockchain.',
        },
        {
          type: 'flow',
          title: 'Deterministic 12-Step Execution Pipeline',
          states: [
            'CONNECT',
            'MANDATE',
            'MONITOR',
            'PREVIEW',
            'FIRM_RFQ',
            'POLICY_CHECK',
            'ATTESTATION',
            'SUBMIT',
            'CONFIRM',
            'SETTLE',
            'RECONCILE',
            'AUDIT',
          ],
          caption: 'Figure 2: Linear state progression of an authorized MOI treasury trade.',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Owner Authentication & Treasury Connection',
              text: 'The owner connects their wallet and completes an EIP-4361 SIWE challenge, initializing an isolated PostgreSQL tenant session.',
            },
            {
              title: 'Mandate Registration',
              text: 'The owner sets policy constraints: allowed corridor (e.g. `cNGN/USD₮`), daily spend caps, max slippage, and target portfolio allocation.',
            },
            {
              title: 'Telemetry & Drift Detection',
              text: 'The agent continuously calculates portfolio drift. If local currency balances exceed the target threshold, a rebalance intent is triggered.',
            },
            {
              title: 'Textile FX Quote Discovery',
              text: 'MOI requests a firm RFQ from Textile FX v2 (`POST /v2/rfq/request`), receiving guaranteed rates and calldata targeted at the `LimitOrderReactor`.',
            },
            {
              title: 'Deterministic Policy Evaluation',
              text: 'The policy engine evaluates all 18 rules. If all pass, it signs an HMAC-SHA256 policy attestation token binding the execution parameters.',
            },
            {
              title: 'Execution & Settlement Verification',
              text: 'The transaction is signed by the restricted signer (or approved by the owner), tagged with ERC-8021 metadata, broadcast to Celo Mainnet, and verified onchain.',
            },
            {
              title: 'Double-Entry Ledger Reconciliation',
              text: 'The journal entry engine records debit and credit legs across treasury assets, clearing accounts, and protocol fee expenses.',
            },
          ],
        },
      ],
    },
    {
      slug: 'getting-started/quick-start',
      title: 'Quick Start',
      description:
        'Get up and running with MOI on Celo Mainnet in under two minutes.',
      blocks: [
        {
          type: 'p',
          text: 'Follow this guide to evaluate MOI on Celo Mainnet (`chainId: 42220`) using the live web application or your local environment.',
        },
        {
          type: 'h2',
          text: 'Option A: Test via Live Production Deployments',
        },
        {
          type: 'steps',
          items: [
            {
              title: 'Visit the Production Application',
              text: 'Open [https://moi-theta-three.vercel.app](https://moi-theta-three.vercel.app) in any Web3 browser.',
            },
            {
              title: 'Connect Celo Wallet',
              text: 'Click Connect Wallet and select MetaMask or Rabby configured to Celo Mainnet (RPC: `https://forno.celo.org`).',
            },
            {
              title: 'Sign the SIWE Challenge',
              text: 'Sign the Sign-In with Ethereum challenge. Your multi-tenant session is established and onchain balances load immediately.',
            },
            {
              title: 'Execute Live Swap or Issue Invoice',
              text: 'Navigate to Treasury & FX to execute an RFQ swap, or open Invoices & Pay to create an EIP-712 zero-gas invoice.',
            },
          ],
        },
        {
          type: 'h2',
          text: 'Option B: Run the Full Test Suite Locally',
        },
        {
          type: 'code',
          lang: 'bash',
          title: 'Terminal Commands',
          code: `# Clone repository
git clone https://github.com/OpeyemiMoses/Moi.git
cd Moi

# Install dependencies across monorepo packages
npm install

# Run the complete test suite (28 test suites, 212 tests)
npm test

# Run Next.js web application locally
npm run dev`,
        },
      ],
    },
    {
      slug: 'getting-started/supported-networks-and-assets',
      title: 'Supported Networks & Assets',
      description:
        'Verified token contracts, decimals, and protocol addresses on Celo Mainnet.',
      blocks: [
        {
          type: 'p',
          text: 'All smart contract interactions and token balances are verified against official Celo Mainnet deployments (`chainId: 42220`).',
        },
        {
          type: 'table',
          headers: ['Asset Symbol', 'Name', 'Contract Address', 'Decimals', 'Role'],
          rows: [
            ['CELO', 'Native Celo Token', '`0x471EcE3750Da237f93B8E339c536989b8978a438`', '18', 'Gas & Base Treasury Asset'],
            ['USD₮', 'Tether USD', '`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`', '6', 'Primary Treasury Reserve Stablecoin'],
            ['cNGN', 'Concurrence Nigerian Naira', '`0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f`', '6', 'Sub-Saharan African FX Corridor'],
            ['wARS', 'Wrapped Argentine Peso (Ripio)', '`0x73a210637f6F6B7005512677Ba6B3863bb82D982`', '18', 'Latin America FX Corridor'],
            ['wBRL', 'Wrapped Brazilian Real (Ripio)', '`0x16b080b0D09B3d9D94A6Ea93b4a2e557b45A8728`', '18', 'Latin America FX Corridor'],
            ['wCOP', 'Wrapped Colombian Peso (Ripio)', '`0x2D44Ea8A89A9d311919Fa1fE72750eF14C45b903`', '18', 'Latin America FX Corridor'],
            ['USDC', 'USD Coin (Bridged)', '`0xef4229c8c3250C675F21bCEfa42f58EfbdF60790`', '6', 'Secondary Reserve Stablecoin'],
          ],
        },
      ],
    },
  ],
};
