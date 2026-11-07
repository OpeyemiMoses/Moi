import type { DocGroup } from '../types';

export const guidesGroup: DocGroup = {
  id: 'guides',
  label: 'User Guides',
  pages: [
    {
      slug: 'guides/connecting-your-wallet',
      title: 'Connecting Your Wallet',
      description:
        'Step-by-step instructions for connecting MetaMask, Rabby, or Valora to Celo Mainnet.',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Open MOI Web Application',
              text: 'Navigate to [https://moi-theta-three.vercel.app](https://moi-theta-three.vercel.app).',
            },
            {
              title: 'Select Connect Wallet',
              text: 'Click Connect Wallet in the top right corner and choose your preferred EVM wallet (MetaMask, Rabby, Valora, or Coinbase Wallet).',
            },
            {
              title: 'Confirm Celo Mainnet Network',
              text: 'Ensure your wallet is connected to Celo Mainnet (`Chain ID: 42220`, RPC: `https://forno.celo.org`). If prompted, accept the automatic network switch.',
            },
            {
              title: 'Sign In With Ethereum (SIWE)',
              text: 'Sign the cryptographic challenge in your wallet. This verifies wallet ownership and establishes an isolated multi-tenant session with zero gas cost.',
            },
          ],
        },
      ],
    },
    {
      slug: 'guides/creating-a-treasury',
      title: 'Creating a Treasury',
      description:
        'Setting up a new multi-currency enterprise treasury on Celo.',
      blocks: [
        {
          type: 'p',
          text: 'Upon your first sign-in, MOI automatically provisions a primary treasury instance linked to your connected wallet address in PostgreSQL. You can view your real-time balances for CELO, USD₮, cNGN, and regional stablecoins immediately on the dashboard.',
        },
      ],
    },
    {
      slug: 'guides/configuring-a-mandate',
      title: 'Configuring a Mandate',
      description:
        'How to set trading pairs, spend caps, slippage tolerance, and target portfolio ratios.',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Navigate to Settings',
              text: 'Click Settings in the left sidebar and select the Spending Mandates section.',
            },
            {
              title: 'Select Asset Corridor',
              text: 'Choose your conversion corridor (for example: Sell `cNGN`, Buy `USD₮`).',
            },
            {
              title: 'Define Numerical Limits',
              text: 'Enter your Max Per-Trade Cap (e.g. 50,000 cNGN), 24h Cumulative Cap (e.g. 500,000 cNGN), and Minimum Reserve Floor (e.g. 10,000 cNGN).',
            },
            {
              title: 'Save & Sign Mandate',
              text: 'Click Save Mandate. The configuration is validated by Zod and persisted to your isolated database record.',
            },
          ],
        },
      ],
    },
    {
      slug: 'guides/configuring-an-agent',
      title: 'Configuring an Agent',
      description:
        'Assigning execution strategies (taker_rfq vs passive_stitch_filler) to software agents.',
      blocks: [
        {
          type: 'p',
          text: 'Agents can be configured with distinct execution strategies depending on your operational goals:',
        },
        {
          type: 'list',
          items: [
            '**`taker_rfq`**: The agent consumes liquidity from institutional market makers to rebalance treasury drift immediately.',
            '**`passive_stitch_filler`**: The agent provides inventory-skewed automated market making via Textile Stitch, earning bid/ask spreads from incoming takers.',
            '**`hybrid`**: Combines passive filling with taker sweeping when drift exceeds 10%.',
          ],
        },
      ],
    },
    {
      slug: 'guides/choosing-an-operating-mode',
      title: 'Choosing an Operating Mode',
      description:
        'Understanding when to use Monitor Only, Approval Required, or Autonomous mode.',
      blocks: [
        {
          type: 'table',
          headers: ['Operating Mode', 'Best Used For', 'Autonomous Execution Permitted?'],
          rows: [
            ['`monitor`', 'Initial testing, auditing, and telemetry observation', 'No (Read-only recommendations)'],
            ['`approval_required`', 'High-value corporate treasuries requiring dual-control human sign-off', 'No (Human must approve every trade)'],
            ['`autonomous`', 'High-frequency merchant rebalancing within pre-approved spending caps', 'Yes (Except for the mandatory First-Trade Gate)'],
          ],
        },
      ],
    },
    {
      slug: 'guides/reviewing-pending-approvals',
      title: 'Reviewing Pending Approvals',
      description:
        'Inspecting proposed conversions, policy check evidence, and signing transactions.',
      blocks: [
        {
          type: 'p',
          text: 'When an agent stages an execution in `approval_required` mode, an alert appears in your dashboard. Clicking the notification opens the approval modal displaying the exact exchange rate, quote expiry countdown, and verification results for all 18 policy rules.',
        },
        {
          type: 'p',
          text: 'Click **Approve & Sign** to broadcast the trade through your connected wallet, or click **Reject** to abort the proposal immediately.',
        },
      ],
    },
    {
      slug: 'guides/understanding-execution-status',
      title: 'Understanding Execution Status',
      description:
        'Deciphering trade statuses from CREATED to SETTLED, EXPIRED, and RECONCILED.',
      blocks: [
        {
          type: 'list',
          items: [
            '**`POLICY_VALIDATED`**: The quote conforms to all mandate rules and an HMAC attestation has been generated.',
            '**`SUBMITTED`**: The transaction is broadcasting in the Celo Mainnet mempool.',
            '**`CONFIRMED`**: Block inclusion verified; awaiting settlement log confirmation.',
            '**`SETTLED`**: The Textile LimitOrderReactor has settled token transfers.',
            '**`RECONCILED`**: Balanced double-entry journal verified in PostgreSQL.',
            '**`REJECTED`**: A deterministic policy rule was violated (e.g. slippage exceeded or trade cap breached).',
          ],
        },
      ],
    },
    {
      slug: 'guides/reading-transaction-history',
      title: 'Reading Your Transaction History',
      description:
        'Filtering by corridor, inspecting gas metrics, and reviewing CeloScan block proofs.',
      blocks: [
        {
          type: 'p',
          text: 'Open the **Transactions** tab from the sidebar to review your complete transaction ledger. Each row includes the transaction timestamp, initiating agent ID, currency pair, amount debited, amount credited, effective exchange rate, and a direct link to view the verified transaction receipt on CeloScan.',
        },
      ],
    },
    {
      slug: 'guides/troubleshooting',
      title: 'Troubleshooting',
      description:
        'Resolving common issues: wallet connection errors, nonce expiration, and RPC timeouts.',
      blocks: [
        {
          type: 'table',
          headers: ['Symptom', 'Probable Cause', 'Recommended Resolution'],
          rows: [
            ['Wallet prompts wrong network', 'Wallet configured to Ethereum or Polygon', 'Switch network to Celo Mainnet (`Chain ID: 42220`) in your wallet settings.'],
            ['SIWE challenge fails with 401', 'Nonce expired (> 5 minutes old)', 'Refresh the page to obtain a fresh cryptographic nonce and re-sign.'],
            ['Quote displays "Expired"', 'Accept deadline lapsed before broadcast', 'Textile firm quotes expire in ~30s. Click Refresh Quote to request a live price.'],
            ['Trade rejected with PER_TRADE_CAP', 'Requested trade exceeds mandate limit', 'Adjust the trade amount or update your mandate per-trade ceiling in Settings.'],
            ['Balances show 0 or fail to refresh', 'Celo RPC endpoint rate limit', 'MOI automatically falls back across redundant Celo RPC endpoints; check network connection.'],
          ],
        },
      ],
    },
  ],
};
