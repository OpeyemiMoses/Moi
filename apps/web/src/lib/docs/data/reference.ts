import type { DocGroup } from '../types';

export const referenceGroup: DocGroup = {
  id: 'reference',
  label: 'Reference',
  pages: [
    {
      slug: 'reference/glossary',
      title: 'Glossary',
      description:
        'A comprehensive dictionary of MOI and Celo financial and cryptographic terms.',
      blocks: [
        {
          type: 'table',
          headers: ['Term', 'Definition'],
          rows: [
            ['`rateRay`', 'Fixed-point exchange rate representation scaled to 10^27 precision, used by Textile FX to eliminate floating-point rounding errors.'],
            ['`Permit2`', 'Uniswap Foundation standard enabling signature-based token approvals, eliminating multiple onchain approve() transactions.'],
            ['`LimitOrderReactor`', 'Textile FX smart contract that cryptographically fills signed RFQ orders directly against market maker inventory.'],
            ['`ERC-8004`', 'Celo onchain standard for registering and verifying autonomous AI agent identities and operational metadata.'],
            ['`ERC-8021`', 'Standardized trailer format for appending application attribution tags to EVM transaction calldata without altering execution semantics.'],
            ['`SIWE`', 'Sign-In with Ethereum (EIP-4361), standardizing wallet-based cryptographic authentication for Web2/Web3 applications.'],
            ['`EIP-712`', 'Standard for hashing and signing typed structured data, providing clear human-readable confirmation screens in wallets.'],
          ],
        },
      ],
    },
    {
      slug: 'reference/supported-assets',
      title: 'Supported Assets',
      description:
        'Complete asset parameters, decimals, and token contracts verified on Celo Mainnet.',
      blocks: [
        {
          type: 'table',
          headers: ['Symbol', 'Asset Name', 'Decimals', 'Token Contract (42220)'],
          rows: [
            ['`CELO`', 'Native Celo Network Token', '18', '`0x471EcE3750Da237f93B8E339c536989b8978a438`'],
            ['`USDT`', 'Tether USD', '6', '`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`'],
            ['`cNGN`', 'Concurrence Nigerian Naira', '6', '`0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f`'],
            ['`wARS`', 'Wrapped Argentine Peso (Ripio)', '18', '`0x73a210637f6F6B7005512677Ba6B3863bb82D982`'],
            ['`wBRL`', 'Wrapped Brazilian Real (Ripio)', '18', '`0x16b080b0D09B3d9D94A6Ea93b4a2e557b45A8728`'],
            ['`wCOP`', 'Wrapped Colombian Peso (Ripio)', '18', '`0x2D44Ea8A89A9d311919Fa1fE72750eF14C45b903`'],
            ['`wMXN`', 'Wrapped Mexican Peso (Ripio)', '18', '`0xdF2d790dC4b79159f8c67d3b2462e7AcA4877397`'],
            ['`USDC`', 'USD Coin (Bridged)', '6', '`0xef4229c8c3250C675F21bCEfa42f58EfbdF60790`'],
          ],
        },
      ],
    },
    {
      slug: 'reference/contract-addresses',
      title: 'Contract Addresses',
      description:
        'Official protocol and infrastructure contract addresses on Celo Mainnet.',
      blocks: [
        {
          type: 'table',
          headers: ['Protocol / System', 'Contract Name', 'Celo Mainnet Address (42220)'],
          rows: [
            ['Textile FX v2', 'LimitOrderReactor', '`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`'],
            ['Textile FX v2', 'FeeController', '`0x7b005466F905DD882A959888154587fA76cd3Ea7`'],
            ['Textile FX v2', 'Permit2', '`0x000000000022D473030F116dDEE9F6B43aC78BA3`'],
            ['Textile FX v2', 'OperatorVaultFactory', '`0x88104decA449C797632AfdcA77A3140b24cD844A`'],
            ['ERC-8004', 'Identity Registry', '`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`'],
            ['ERC-8004', 'Reputation Registry', '`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`'],
          ],
        },
      ],
    },
    {
      slug: 'reference/environment-and-configuration',
      title: 'Environment & Configuration',
      description:
        'Reference guide for all required and optional environment variables.',
      blocks: [
        {
          type: 'p',
          text: 'The following environment variable names configure MOI deployments (validated via `packages/shared-types/src/env-validator.ts`):',
        },
        {
          type: 'table',
          headers: ['Variable Name', 'Requirement', 'Purpose'],
          rows: [
            ['`DATABASE_URL`', 'Required', 'PostgreSQL connection string with pooling support.'],
            ['`NEXT_PUBLIC_CHAIN_ID`', 'Required', 'EVM Chain ID (`42220` for Celo Mainnet).'],
            ['`NEXT_PUBLIC_RPC_URL`', 'Required', 'Celo JSON-RPC provider (`https://forno.celo.org`).'],
            ['`INTERNAL_POLICY_HMAC_SECRET`', 'Required', 'HMAC-SHA256 enclave key for policy attestation tokens.'],
            ['`TEXTILE_API_BASE_URL`', 'Optional', 'Textile FX API endpoint (defaults to `https://api.textilecredit.com/v2`).'],
            ['`BUY_GATEWAY_URL`', 'Optional', 'usebuy.ai catalog endpoint (defaults to `https://gateway.usebuy.ai`).'],
            ['`CELO_ATTRIBUTION_TAG`', 'Required', 'ERC-8021 protocol marker (`celo_c9cb9a59fc4c`).'],
          ],
        },
      ],
    },
    {
      slug: 'reference/faq',
      title: 'Frequently Asked Questions',
      description:
        'Common questions regarding custody, pricing, slippage, and agent permissions.',
      blocks: [
        {
          type: 'h2',
          text: 'Does MOI ever hold custody of my private keys?',
        },
        {
          type: 'p',
          text: 'No. MOI is strictly non-custodial. The treasury owner connects via their own Web3 wallet and retains exclusive authority. Software agents use isolated, restricted signing boundaries with mathematical spend ceilings.',
        },
        {
          type: 'h2',
          text: 'What happens if an agent attempts an unauthorized trade?',
        },
        {
          type: 'p',
          text: 'The trade is intercepted and rejected by the policy engine. If the agent attempts a raw onchain transaction directly, the transaction will revert because target contracts are restricted to the approved Textile LimitOrderReactor.',
        },
        {
          type: 'h2',
          text: 'Are there gas costs for issuing invoices?',
        },
        {
          type: 'p',
          text: 'No. MOI invoices use EIP-712 cryptographic structured data signatures. Generating and issuing an invoice costs exactly $0.00 in network gas. Gas is only paid by the client when they settle the invoice onchain.',
        },
      ],
    },
    {
      slug: 'reference/changelog',
      title: 'Changelog',
      description:
        'Release notes across Milestones 1 through 8.',
      blocks: [
        {
          type: 'list',
          items: [
            '**v1.0.0 (November 2026)**: Production release on Celo Mainnet. Textile FX v2 RFQ integration, 18 deterministic policy rules, ERC-8004 Agent #164 canonical registration, EIP-712 zero-gas invoicing, ERC-8021 calldata attribution, reveal animations, and comprehensive Documentation Centre.',
            '**v0.8.0**: Elimination of synthetic data; live Celo Mainnet RPC querying and verified Textile preview feeds.',
            '**v0.5.0**: Implementation of restricted signer boundary, HMAC policy attestation, and double-entry accounting ledger.',
            '**v0.1.0**: Core architecture and EIP-4361 SIWE authentication.',
          ],
        },
      ],
    },
    {
      slug: 'reference/roadmap',
      title: 'Roadmap',
      description:
        'Upcoming features, bank offramp integrations, and multi-chain expansion.',
      blocks: [
        {
          type: 'table',
          headers: ['Quarter', 'Target Milestone', 'Status'],
          rows: [
            ['Q4 2026', 'Textile FX v2 RFQ settlement on Celo Mainnet', 'Live and Verified'],
            ['Q4 2026', 'ERC-8004 Canonical Identity & ERC-8021 Attribution', 'Live and Verified'],
            ['Q1 2027', 'Domestic Nigerian Naira (cNGN) bank account direct clearing (NIP)', 'Planned / Staged in UI'],
            ['Q1 2027', 'Ripio LatAm fiat on/offramp compliance bridge (ARS, BRL, COP)', 'Configured'],
            ['Q2 2027', 'AWS KMS & Hardware Enclave signing for enterprise agent runners', 'Planned'],
          ],
        },
      ],
    },
  ],
};

