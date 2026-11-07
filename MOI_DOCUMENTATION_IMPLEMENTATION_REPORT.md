# MOI — Documentation Implementation Report

**Project:** MOI — Autonomous Treasury Operating System  
**Implementation Date:** November 8, 2026  
**Target URL:** `/docs`  
**Classification:** Documentation Centre Architecture & Code Delivery Report  

---

## 1. Documentation Routes Implemented

The MOI Documentation Centre has been built as a multi-page, responsive, accessible technical documentation system within Next.js 15:

* `/docs`: Documentation Centre home page with section directory and hero overview.
* `/docs/getting-started/introduction`: Executive and technical overview.
* `/docs/getting-started/what-is-moi`: Architectural philosophy and boundary separation.
* `/docs/getting-started/why-moi`: Emerging market macroeconomic problem statement.
* `/docs/getting-started/core-concepts`: Core terminology (Mandates, Modes, Attestations, Attributions).
* `/docs/getting-started/how-it-works`: 12-step deterministic execution pipeline.
* `/docs/getting-started/quick-start`: Quick start guide for production and local evaluation.
* `/docs/getting-started/supported-networks-and-assets`: Celo Mainnet token address book.
* `/docs/product/treasury-overview`: Balance sheet and reserve management.
* `/docs/product/treasury-wallets`: Master Owner Wallet custody model.
* `/docs/product/agent-wallets`: Restricted signer key isolation.
* `/docs/product/spending-mandates`: Mandate parameters and schema definitions.
* `/docs/product/approval-workflows`: Dual-control human-in-the-loop workflows.
* `/docs/product/autonomous-mode`: Autonomous rebalancing mechanics and first-trade gate.
* `/docs/product/monitoring-and-analytics`: Portfolio drift telemetry and allocation sliders.
* `/docs/product/transaction-history`: Ledger filters and CeloScan explorer links.
* `/docs/product/audit-trail`: Immutable event logs and policy check outcomes.
* `/docs/how-it-works/system-architecture`: Monorepo package boundaries and responsibilities.
* `/docs/how-it-works/agent-lifecycle`: Event-driven background orchestrator loop.
* `/docs/how-it-works/policy-engine`: In-depth specification of all 18 deterministic rules.
* `/docs/how-it-works/quote-discovery`: Previews vs. firm quotes and rateRay math.
* `/docs/how-it-works/execution-lifecycle`: Exact 17 states from `ExecutionStateEnum`.
* `/docs/how-it-works/settlement-verification`: Onchain ERC-20 log parsing.
* `/docs/how-it-works/double-entry-ledger`: Strict balanced debit/credit accounting formulas.
* `/docs/how-it-works/failure-handling-and-recovery`: Crash-safety, WAL archiving, and orphan recovery.
* `/docs/integrations/textile-fx`: LimitOrderReactor, Permit2, and zero-slippage RFQ.
* `/docs/integrations/cngn-usdt-corridor`: Flagship Nigerian Naira to Tether USD rail.
* `/docs/integrations/buy-integration`: usebuy.ai catalog parsing (170 capabilities).
* `/docs/integrations/x402-payment-protocol`: HTTP 402 machine-to-machine micropayments.
* `/docs/integrations/erc-8004-agent-identity`: Celo canonical agent identity registry #164.
* `/docs/security/security-overview`: Threat models, defense-in-depth, and attack surface.
* `/docs/security/wallet-separation`: Cryptographic separation of owner and agent.
* `/docs/security/restricted-signing`: Target contract call filtering and calldata assertions.
* `/docs/security/spending-authorization`: Spend ceilings and reserve floor invariants.
* `/docs/security/owner-approval`: EIP-712 structured data signing.
* `/docs/security/first-trade-authorization`: SEC-M2-02 mandatory first-trade gate.
* `/docs/security/session-security`: EIP-4361 SIWE, single-use nonces, and HttpOnly cookies.
* `/docs/security/tenant-isolation`: PostgreSQL Row-Level Security (RLS).
* `/docs/security/attestation-and-replay-protection`: HMAC-SHA256 tokens and nonce binding.
* `/docs/security/webhook-verification`: Inbound HMAC signatures and database idempotency locks.
* `/docs/security/onchain-reconciliation`: Independent receipt verification.
* `/docs/security/emergency-controls`: 1-click global emergency pause.
* `/docs/security/known-limitations`: Transparent documentation of staged features.
* `/docs/guides/*`: 9 practical user guides covering wallet setup, mandates, and troubleshooting.
* `/docs/developers/*`: 10 developer reference guides covering authentication, API endpoints, and schemas.
* `/docs/reference/*`: Glossary, contract addresses, environment variables, FAQ, changelog, and roadmap.

---

## 2. Navigation Changes & Entry Points

All three required entry points have been connected and verified:

1. **Public Landing Page Navigation**: Added a prominent **Documentation** link (`/docs`) in the header navigation and a dedicated mobile-friendly `Docs` pill button next to "Enter Treasury OS".
2. **Website Footer**: Added a dedicated **MOI Documentation Centre** navigation band with deep links to Introduction, Getting Started, Architecture, Security, Developers, and FAQ.
3. **Authenticated Application Sidebar**: Added a permanent **Documentation** menu item in the `#0B0F14` sidebar that links to `/docs` for all authenticated operators.

---

## 3. Reusable Components Created

* `DocsLayout` (`apps/web/src/app/docs/layout.tsx`): Persistent documentation shell with responsive mobile drawer and desktop sidebar.
* `DocsSidebar` (`apps/web/src/components/docs/DocsSidebar.tsx`): Grouped navigation with active route highlights.
* `DocsHeader` (`apps/web/src/components/docs/DocsHeader.tsx`): Breadcrumbs, search trigger, mobile drawer toggle, and "Exit to App" button.
* `DocsToc` (`apps/web/src/components/docs/DocsToc.tsx`): Right-side table of contents with scroll-spy intersection observers.
* `DocsPagination` (`apps/web/src/components/docs/DocsPagination.tsx`): Linear Previous and Next navigation controls.
* `DocsSearchModal` (`apps/web/src/components/docs/DocsSearchModal.tsx`): Keyboard-navigable instant search modal (`Cmd+K`).
* `DocBlocks` (`apps/web/src/components/docs/DocBlocks.tsx`): Semantic renderer supporting headings, callouts, tables, diagrams, steps, code blocks, and status labels.
* `DocsCodeBlock` (`apps/web/src/components/docs/DocsCodeBlock.tsx`): Syntax block with 1-click clipboard copy.
* `DocsContext` (`apps/web/src/components/docs/DocsContext.tsx`): Global state management for mobile menu and search modal.

---

## 4. Dependencies & Technical Footprint

* Zero heavyweight external documentation dependencies introduced (no Docusaurus or external CMS).
* Built natively within Next.js 15 using static site generation (`generateStaticParams`).
* 88 static routes prerendered in 14.3 seconds.
