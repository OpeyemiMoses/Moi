import type { DocGroup } from '../types';

export const integrationsGroup: DocGroup = {
  id: 'integrations',
  label: 'Integrations',
  pages: [
    {
      slug: 'integrations/textile-fx',
      title: 'Textile FX',
      description:
        'The primary hackathon integration: institutional RFQ liquidity, Permit2 limit orders, and zero-slippage settlement.',
      blocks: [
        {
          type: 'p',
          text: '**Textile FX** is the institutional foreign exchange settlement protocol on Celo Mainnet. MOI integrates Textile FX v2 as its primary execution venue for emerging market currency swaps.',
        },
        {
          type: 'h2',
          text: 'Verified Contract Addresses',
        },
        {
          type: 'table',
          headers: ['Contract Role', 'Address on Celo Mainnet (42220)', 'Verification Status'],
          rows: [
            ['`LimitOrderReactor`', '`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`', 'Live and Verified'],
            ['`FeeController`', '`0x7b005466F905DD882A959888154587fA76cd3Ea7`', 'Live and Verified'],
            ['`Permit2`', '`0x000000000022D473030F116dDEE9F6B43aC78BA3`', 'Live and Verified'],
            ['`OperatorVaultFactory`', '`0x88104decA449C797632AfdcA77A3140b24cD844A`', 'Live and Verified'],
          ],
        },
        {
          type: 'h2',
          text: 'Why RFQ Beats Automated Market Makers for FX',
        },
        {
          type: 'list',
          items: [
            '**Zero Price Impact**: Large enterprise rebalances do not suffer slippage or moving spot prices inside shallow AMM pools.',
            '**Guaranteed Execution Rates**: Market makers lock the rateRay for a fixed validity window (typically 30–60 seconds).',
            '**MEV & Front-Running Immunity**: Trades execute directly through the `LimitOrderReactor` with pre-signed intent hashes, eliminating sandwich attacks.',
          ],
        },
      ],
    },
    {
      slug: 'integrations/cngn-usdt-corridor',
      title: 'cNGN / USD₮ Corridor',
      description:
        'Technical specification of the Nigerian Naira to Tether USD cross-border settlement rail.',
      blocks: [
        {
          type: 'p',
          text: 'The `cNGN / USD₮` corridor is MOI’s flagship implementation corridor. It enables Nigerian businesses to hold working capital in compliant onchain Naira and automatically protect corporate reserves against currency depreciation.',
        },
        {
          type: 'table',
          headers: ['Parameter', 'cNGN Token', 'USD₮ Token'],
          rows: [
            ['Contract Address', '`0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f`', '`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`'],
            ['Decimals', '6 (1 cNGN = 1,000,000 atomic units)', '6 (1 USD₮ = 1,000,000 atomic units)'],
            ['Quoting Unit', 'Atomic cNGN per atomic USD₮', 'Fixed ray math (10^27 precision)'],
            ['Settlement Target', 'Permit2 -> LimitOrderReactor', 'Direct credit to Treasury address'],
          ],
        },
        {
          type: 'callout',
          variant: 'note',
          title: 'Bank Offramp Status',
          text: 'While onchain conversions between `cNGN` and `USD₮` are fully functional and live-verified, domestic bank account withdrawal (offramp into local Nigerian bank accounts via NIP/Interswitch rails) is currently staged with a **Coming Soon** badge in the user interface pending production banking gateway compliance.',
        },
      ],
    },
    {
      slug: 'integrations/buy-integration',
      title: 'Buy Integration',
      description:
        'Agent capability discovery, live catalog parsing from gateway.usebuy.ai, and service procurement.',
      blocks: [
        {
          type: 'p',
          text: 'MOI integrates with **usebuy.ai** (`@celo/buy` and `@x402/fetch`) to enable software agents to dynamically discover and purchase external services using onchain micro-payments.',
        },
        {
          type: 'h2',
          text: 'Live Discovery Capabilities',
        },
        {
          type: 'p',
          text: 'The MOI backend connects directly to `https://gateway.usebuy.ai/v1/catalog`, dynamically indexing over 170 live agent capabilities across four categories:',
        },
        {
          type: 'list',
          items: [
            '**Onchain Reconciliation**: Chainstack Celo RPC verification endpoints.',
            '**Market Intelligence**: Live macro feeds and sentiment analysis.',
            '**AI Inference**: LLM inference endpoints billed per token invocation.',
            '**Browser Automation**: Headless browser verification engines.',
          ],
        },
      ],
    },
    {
      slug: 'integrations/x402-payment-protocol',
      title: 'x402 Payment Protocol',
      description:
        'HTTP 402 Payment Required integration for programmatic machine-to-machine service settlement.',
      blocks: [
        {
          type: 'p',
          text: 'The **x402 protocol** standardizes machine-to-machine payments over HTTP. When an agent requests a protected API endpoint, the server responds with HTTP 402 and payment parameters in the `PAYMENT-REQUIRED` response header.',
        },
        {
          type: 'p',
          text: 'MOI uses `@x402/fetch` and `@x402/evm` to parse payment requirements, verify that the purchase cost falls within the mandate’s `serviceSpendPerCallAtomic` cap, sign an onchain payment authorization, and retry the request seamlessly.',
        },
      ],
    },
    {
      slug: 'integrations/erc-8004-agent-identity',
      title: 'ERC-8004 Agent Identity',
      description:
        'Onchain agent registration, identity document metadata, and trust verification.',
      blocks: [
        {
          type: 'p',
          text: '**ERC-8004** is the Celo standard for verifiable, autonomous AI agent identities registered onchain in canonical identity and reputation registries.',
        },
        {
          type: 'table',
          headers: ['Identity Parameter', 'Value on Celo Mainnet'],
          rows: [
            ['Canonical Registry Address', '`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`'],
            ['Reputation Registry Address', '`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`'],
            ['Agent Token ID', '`#164`'],
            ['Registered Agent Name', 'MOI Autonomous Treasury Agent'],
            ['Public Document Endpoint', '`https://moi-theta-three.vercel.app/api/identity/agent.json`'],
            ['Schema Standard', '`https://eips.ethereum.org/EIPS/eip-8004#registration-v1`'],
          ],
        },
      ],
    },
  ],
};
