# Contributing to MOI

Thank you for your interest in contributing to MOI (Multi-currency Operations & Intelligence). We welcome contributions from developers, researchers, and community members.

## Development Principles

1. Non-Custodial Security: The user's primary wallet remains sovereign at all times. Agent signers are strictly bounded by deterministic policy mandates.
2. Zero Mock Data: All onchain state, balances, and RFQ quotes must reflect verified data sources or clear, truthful disconnected states.
3. Strict Separation of Concerns: Natural language compilation (LLMs) is purely advisory and must never bypass the deterministic TypeScript policy engine.
4. Clean Code and Type Safety: Strict TypeScript rules apply across all workspace packages and apps.

## Monorepo Architecture

MOI is structured as an npm workspaces monorepo:

* `apps/web`: Next.js 15 front-end application, responsive dashboard, swap terminal, and API route handlers.
* `packages/shared-types`: Canonical type definitions, schemas, contract addresses, and token metadata.
* `packages/policy-engine`: Deterministic 17-point rule engine, reserve checks, slippage validation, and compiler interfaces.
* `packages/wallet-signer`: Dual-key abstraction, CeloChainService, ERC-8021 calldata attribution, and Permit2 signing.
* `packages/textile-adapter`: Textile FX v2 client, live RFQ quoting, EIP-712 TakerControl proofs, and Stitch maker feed.
* `packages/buy-client`: Client interface for `@celo/buy` and `x402` service marketplace.
* `packages/ledger`: Double-entry accounting engine and portfolio analytics.
* `packages/database`: ACID JSON and PostgreSQL engine with multi-tenant isolation.
* `packages/identity`: EIP-4361 (Sign-In with Ethereum) authentication and session validation.
* `packages/agent-core`: Autonomous loop orchestrator and life-cycle manager.

## Getting Started

### Prerequisites

* Node.js v20.x or higher
* npm v10.x or higher
* Git

### Local Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/OpeyemiMoses/Moi.git
   cd Moi
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Run type checks:
   ```bash
   npm run typecheck
   ```

## Pull Request Guidelines

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Keep commits concise and meaningful following Conventional Commits format (`feat:`, `fix:`, `docs:`, `refactor:`).
3. Ensure `npm run typecheck` passes with zero errors before submitting.
4. Open a Pull Request referencing any relevant issues. Fill out the PR template completely.

## Code Standards

* Format code with standard formatting conventions.
* Maintain clean error handling without unhandled promise rejections.
* Never introduce hardcoded private keys, credentials, or sensitive test data into git.

## Reporting Issues

* Use the GitHub Issue Tracker to report bugs or submit feature requests.
* For security-sensitive issues, please refer to [SECURITY.md](SECURITY.md).
