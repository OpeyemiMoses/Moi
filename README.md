# MOI — Autonomous Treasury Operating System

MOI is an institutional, non-custodial treasury operating system and financial automation platform built on Celo Mainnet (`chainId: 42220`). Engineered specifically for enterprises, digital merchants, and fintech operators in high-inflation emerging markets across Africa and Latin America, MOI protects capital against rapid currency depreciation, automates institutional foreign exchange swaps, settles domestic bank transfers directly through local central clearing rails, and issues cryptographic zero-gas payment requests.

---

## Evaluation Guide for Judges

This walkthrough details how to verify MOI's onchain operations, deterministic security controls, and multi-currency rails on Celo Mainnet.

### Quickstart

1. **Clone & Install**:
   ```bash
   git clone https://github.com/OpeyemiMoses/Moi.git
   cd Moi
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   *The default configuration connects directly to Celo Mainnet (`chainId: 42220`) via the public RPC (`https://forno.celo.org`). No external API keys are required for evaluation.*

3. **Launch Dashboard**:
   ```bash
   npm run dev
   ```
   Access the web interface at `http://localhost:3000`.

---

### Step-by-Step Feature Walkthrough

#### 1. Authentication & Onchain Asset Synchronization
* Navigate to `http://localhost:3000` and click **Connect Wallet** in the top navigation bar.
* Connect any standard Celo wallet (MetaMask, Rabby, Valora, or MiniPay) switched to **Celo Mainnet (Chain ID 42220)**.
* Sign the Sign-In with Ethereum (SIWE, EIP-4361) challenge to establish a cryptographically verified multi-tenant session.
* Your live balances for **CELO**, **USD₮**, **cUSD**, **cNGN**, **wBRL**, **wARS**, **wCOP**, and **wMXN** synchronize in real time directly from Celo Mainnet smart contracts.

#### 2. Target Portfolio Allocation & Dynamic Rebalance Guard
* On the main **Dashboard**, locate the **Target Portfolio Allocation & Rebalance Guard**.
* Adjust the target allocation slider to set a preferred ratio (for example, `75% USD₮ / 25% Local Currency`).
* MOI monitors real-time balance deviation against live market rates. When portfolio drift exceeds the configured tolerance threshold, the system displays an automated rebalancing recommendation that populates the swap terminal with a single click.

#### 3. Instant Currency Swaps (Textile FX v2)
* Navigate to the **Treasury & FX** tab.
* Select an emerging market trading pair (e.g., `cNGN → USD₮`, `wARS → USD₮`, or `wBRL → USD₮`).
* Observe institutional RFQ pricing, zero price slippage guarantees, and live P2P rate comparisons.
* The swap execution pipeline enforces the 17-point deterministic risk policy before any transaction is signed or broadcast.

#### 4. Multi-Corridor Domestic Bank Withdrawals
* Click **Withdraw to Bank** from the dashboard quick actions.
* Choose a destination clearing corridor:
  * **Nigeria**: Instant settlement via NIBSS Instant Payment (NIP) to major commercial banks and digital institutions (GTBank, Zenith, Access, Kuda, PalmPay, OPay).
  * **Brazil**: Instant settlement via Central Bank PIX.
  * **Argentina**: Bank clearing via COELSA CBU / CVU or Alias.
  * **Colombia & Mexico**: Local settlement via PSE / Nequi or SPEI CLABE.
  * **Global**: International USD₮ clearing.
* Enter the withdrawal amount and recipient account details, then confirm the transfer.
* The transaction generates an immutable settlement reference code (e.g., `REF-NIP-...`) and commits the entry to the activity ledger.

#### 5. Zero-Gas Invoicing & Payment Requests
* Click **Invoices & Pay** in the sidebar navigation to open the dedicated invoicing terminal (`/invoices`).
* Click **Create New Invoice**, enter the client name, reference identifier, payment amount, and select the settlement token.
* Click **Sign & Issue Invoice with Wallet ($0 Gas)**.
* Your wallet prompts you to sign an **EIP-712 structured data message**. This cryptographic signature costs **$0.00 and consumes zero network gas**.
* The invoice is immediately registered in your cryptographic history with verified EIP-712 proof.
* Click **View QR** to inspect the invoice slip, dynamic payment QR code, and standard `celo:` payment URI.

#### 6. Autonomous Treasury Mandates & Dual-Key Agent Execution
* Navigate to the **Agents** tab.
* Inspect active autonomous mandates or click **Create Mandate & Issue Agent**.
* Define operational parameters: trade execution caps, minimum local currency reserve limits, and maximum allowed slippage.
* Deployed agents execute deterministic rebalancing within these constraints under dual-key isolation.

---

## The Problem: The Emerging Market Treasury Dilemma

Corporate treasuries, online merchants, and remote contractors in emerging markets face compounding structural risks:

1. **Severe Currency Depreciation**: Currencies such as the Nigerian Naira (NGN), Argentine Peso (ARS), and Brazilian Real (BRL) experience persistent devaluation against the US Dollar. Unhedged cash balances erode working capital monthly.
2. **P2P Counterparty & Escrow Scams**: Without institutional access, operators rely on informal peer-to-peer (P2P) crypto desks. This exposes businesses to fraudulent bank reversals, frozen accounts, and predatory 4–8% spreads.
3. **Execution Bottlenecks**: Treasury teams cannot monitor exchange rates around the clock. Manual conversions introduce delays, human error, and execution slippage during high-volatility events.
4. **Unsafe Autonomous Systems**: Traditional AI trading bots operate as black boxes with unconstrained private key access. A single hallucinated model output or API glitch can liquidate an entire corporate treasury.

---

## Core Architecture & Product Pillars

MOI solves these challenges by combining non-custodial asset custody, guaranteed RFQ execution, direct domestic banking rails, and deterministic risk policy enforcement:

```
[ Master Owner Custody ] (MetaMask / Rabby / MiniPay / Valora)
         │
         │  1. Non-custodial asset custody (Permit2 approvals)
         │  2. Policy rule parameter configuration
         ▼
[ Deterministic Policy Engine ] (Zero-Trust TypeScript Execution)
         │
         │  Enforces 17 Financial Invariants:
         │  - Daily trading caps
         │  - Minimum local currency reserve preservation
         │  - Maximum allowed slippage bounds
         │  - HMAC attestation verification
         ▼
[ Restricted Agent Signer ] (Backend Operational Signer)
         │
         │  Dispatches authorized transactions strictly within policy.
         │  Zero access to owner custody; cannot redirect payout targets.
         ▼
[ Celo Mainnet Settlement ] (Textile LimitOrderReactor · Chain ID 42220)
```

### 1. Dual-Key Institutional Security Model
* **Master Owner Key**: Retains absolute custody of all treasury assets. Only the master key can authorize new policy parameters, initiate first-trade allowances, or modify withdrawal allowlists.
* **Restricted Operational Signer Key**: Holds zero asset custody. Can only dispatch pre-authorized transactions through the Textile LimitOrderReactor after passing all 17 deterministic checks.
* **First-Trade Authorization**: The operational agent cannot execute any trade autonomously until the master wallet signs an explicit EIP-712 first-trade mandate for that specific corridor and contract target.
* **16-Field HMAC Attestation**: Every approved trade generates an atomic HMAC attestation binding the execution ID, treasury ID, mandate, RFQ, tokens, amounts, reactor, and calldata hash to a single-use atomic nonce.

### 2. Textile FX v2 Integration (Active Taker & Passive Maker)
* **Active Taker (`taker_rfq`)**: Requests firm, executable quotes via Textile FX v2. Orders are executed against the official `LimitOrderReactor` on Celo Mainnet with zero price slippage.
* **Passive Maker (`textile-stitch`)**: Serves an Avellaneda-Stoikov inventory-skewed pricing feed (`/api/pricing/stitch`), enabling treasuries to earn maker spread while rebalancing excess local currency reserves.
* **Protocol Fee Enforcement**: Guaranteed maximum fee compliance bounded to 1 bps routing through the Textile Fee Controller (`0x7b005466F905DD882A959888154587fA76cd3Ea7`).

### 3. Direct Domestic Bank Off-Ramps
MOI bridges onchain stable assets directly into sovereign fiat clearing systems without intermediary P2P exchange risk:
* **Nigeria**: Direct integration with NIBSS Instant Payment (NIP) for instant credit to Nigerian bank accounts and mobile money operators.
* **Brazil**: Instant Brazilian Real settlements via Central Bank PIX.
* **Argentina**: Direct clearing to Argentine bank and virtual accounts via COELSA CBU, CVU, and Alias.
* **Colombia & Mexico**: Automated transfers via Colombia PSE / Nequi and Mexico SPEI CLABE.

### 4. Zero-Gas Invoicing & Payment Standard (`celo:`)
* Merchants generate structured cryptographic invoices signed via EIP-712 directly from their connected wallet.
* Invoice creation consumes **$0.00 in network gas** and produces an immutable cryptographic record.
* Generates standard `celo:` payment URIs and scannable dynamic QR codes compliant with MiniPay, Valora, and standard mobile wallets.
* Automatic payment detection reconciles customer settlements directly into the merchant's double-entry ledger.

### 5. Onchain Identity & Transaction Attribution
* **ERC-8004 Agent Trust Protocol**: Registers verifiable agent identity (`/api/identity/agent.json`) on Celo's canonical `IdentityRegistry` and `ReputationRegistry`.
* **ERC-8021 Transaction Attribution**: 100% of outgoing transactions append the official Schema 0 suffix (`0xce10` magic marker) with idempotency protection, attributing onchain volume without modifying transaction execution semantics.

### 6. Autonomous Microservices Settlement (`x402` & `buy`)
* Settles external API intelligence and data feeds over HTTP 402 using **USA₮**, **USD₮**, and **USDC** on Celo Mainnet.
* Autonomous agent capabilities query and pay for intelligence (FX volatility indexes, compliance checks) programmatically.

---

## The 17 Deterministic Risk Policy Rules

Every financial transaction in MOI must evaluate to `PASS` across all 17 deterministic policy rules in `packages/policy-engine/src/index.ts`. If any rule evaluates to `FAIL`, execution is aborted immediately and logged to the immutable audit trail.

| # | Rule Identifier | Category | Verification Invariant |
| - | --------------- | -------- | ---------------------- |
| 1 | `MANDATE_NOT_PAUSED` | State | `mandate.status !== 'paused' && mandate.status !== 'revoked'` |
| 2 | `OPERATING_MODE_PERMITTED` | Authorization | `mode === 'autonomous' \|\| (mode === 'approval_required' && isApproved)` |
| 3 | `NO_DUPLICATE_EXECUTION_LOCK` | Concurrency | `activeLock[mandateId] === null && lockAcquired(mandateId)` |
| 4 | `SIGNER_HEALTH_VERIFIED` | Infrastructure | `signerProcess.isHealthy() && signer.hasValidKeyReference()` |
| 5 | `CHAIN_ID_IS_CELO_MAINNET` | Network | `chainId === 42220` |
| 6 | `FIRM_QUOTE_PRESENT` | Liquidity | `quote.type === 'firm' && quote.calldata.length > 2` |
| 7 | `TAKER_WALLET_MATCH` | Identity | `normalizeAddress(quote.taker) === normalizeAddress(agentWallet)` |
| 8 | `QUOTE_NOT_EXPIRED` | Time | `quote.expiresAt > now + 1500ms && quote.orderDeadline > now + 1500ms` |
| 9 | `ALLOWLISTED_CORRIDOR` | Security | `tokenIn ∈ VerifiedCorridors && tokenOut ∈ VerifiedCorridors` |
| 10 | `APPROVED_REACTOR_TARGET` | Destination | `tx.to === 0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` |
| 11 | `CALLDATA_AND_VALUE_GUARD` | Contract | `tx.value === 0n && isValidReactorSelector(tx.calldata)` |
| 12 | `PER_TRADE_CAP` | Exposure | `takerPaysAtomic <= mandate.maxTradeAtomic` |
| 13 | `DAILY_SELL_CAP` | Exposure | `rolling24hVolumeAtomic + takerPaysAtomic <= mandate.dailySellCapAtomic` |
| 14 | `MINIMUM_RESERVE_PRESERVED` | Solvency | `currentReserveAtomic - takerPaysAtomic >= mandate.minimumReserveAtomic` |
| 15 | `MIN_BUY_OUTPUT_THRESHOLD` | Pricing | `takerReceivesAtomic >= quote.minExpectedOutputAtomic` |
| 16 | `PROTOCOL_FEE_BOUND` | Cost | `quote.protocolFeeBps <= mandate.maxProtocolFeeBps (1 bps)` |
| 17 | `DAILY_LOSS_CIRCUIT_BREAKER`| Risk | `rolling24hRealizedLossAtomic <= mandate.dailyLossLimitAtomic` |

---

## Verified Celo Mainnet Contracts (`chainId: 42220`)

All operations settle through audited, verified smart contracts on **Celo Mainnet**:

### Protocol Contracts

| Component | Contract Address | Function |
| --------- | ---------------- | -------- |
| **Uniswap Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Non-custodial allowance signing |
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | Institutional FX RFQ settlement |
| **Textile Fee Controller** | `0x7b005466F905DD882A959888154587fA76cd3Ea7` | Verified 1 bps fee distribution |
| **ERC-8004 Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Autonomous agent identity registration |
| **ERC-8004 Reputation Registry**| `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Trust scoring and performance feedback |
| **ERC-8021 Calldata Attribution**| `celo_c9cb9a59fc4c` | Builder attribution appended to transaction calldata |

### Supported Assets

| Asset Symbol | Asset Name | Contract Address | Decimals |
| :--- | :--- | :--- | :---: |
| **USD₮** | Tether USD | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | 6 |
| **USA₮** | America USD | `0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771` | 6 |
| **USDC** | Circle USD | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |
| **cNGN** | Compliant Nigerian Naira | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | 6 |
| **wBRL** | Ripio Brazilian Real | `0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0` | 18 |
| **wARS** | Ripio Argentine Peso | `0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D` | 18 |
| **wCOP** | Ripio Colombian Peso | `0x8a1D45e102e886510e891d2Ec656a708991e2D76` | 18 |
| **cUSD** | Celo Dollar | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |
| **CELO** | Native Celo Currency | `0x471EcE3750Da237f93B8E339c536989b8978a438` | 18 |

---

## Monorepo Architecture

```
moi/
├── apps/
│   └── web/                   # Next.js 15 application, dashboard UI, and API routes
├── packages/
│   ├── agent-core/            # Autonomous agent loop, lifecycle, and task dispatcher
│   ├── buy-client/            # buy and x402 HTTP microservice settlement client
│   ├── database/              # Multi-tenant data store and double-entry ledger interface
│   ├── identity/              # SIWE (EIP-4361) authentication and session validation
│   ├── ledger/                # Accounting engine and portfolio analytics
│   ├── policy-engine/         # 17-point deterministic financial risk engine
│   ├── shared-types/          # Canonical schemas, constants, and token metadata
│   ├── textile-adapter/       # Textile FX v2 RFQ client and Stitch liquidity feed
│   └── wallet-signer/         # Dual-key service and ERC-8021 calldata attribution
├── docs/                      # Architectural specifications and evaluation documents
├── prisma/                    # Relational database schema
├── .env.example               # Preconfigured Celo Mainnet environment template
├── .gitignore                 # Production git ignore configuration
├── LICENSE                    # MIT Open Source License
├── CONTRIBUTING.md            # Guidelines for open source contributors
├── CODE_OF_CONDUCT.md        # Contributor Covenant Code of Conduct
└── SECURITY.md                # Security policy and disclosure process
```

---

## API Reference

| Endpoint | Method | Authentication | Description |
| -------- | :----: | :------------: | ----------- |
| `/api/health` | `GET` | Public | System status, database health, and process uptime |
| `/api/health/live` | `GET` | Public | Kubernetes liveness probe |
| `/api/health/ready` | `GET` | Public | Kubernetes readiness probe |
| `/api/identity/agent.json` | `GET` | Public | ERC-8004 machine-readable agent registration |
| `/api/pricing/stitch` | `GET` | Public | Textile Stitch Avellaneda-Stoikov pricing feed |
| `/api/auth/nonce` | `GET` | Public | Single-use SIWE challenge nonce generation |
| `/api/auth/verify` | `POST` | Public | Cryptographic SIWE signature verification |
| `/api/auth/session` | `GET` | Session | Current authenticated session details |
| `/api/auth/logout` | `POST` | Session | Revoke session credentials |
| `/api/treasury` | `GET` | Session | Live portfolio balances, metrics, and mandates |
| `/api/treasury` | `POST` | Session | Update treasury settings and target allocations |
| `/api/treasury/controls` | `GET` | Session | Approval queue, audit logs, and policy events |
| `/api/treasury/controls` | `POST` | Session | Execute approval actions, pause/resume mandates |
| `/api/fx/quote` | `POST` | Session | Request Textile RFQ quote and run 17 policy checks |
| `/api/buy` | `GET` | Session | Catalog of x402-enabled intelligence microservices |
| `/api/buy` | `POST` | Session | Execute autonomous x402 payment and service call |

---

## Production Runbook & Verification

### Automated Test Suite
Run the test suite across all packages:
```bash
npm test
```

### Type Checking & Build Verification
Verify TypeScript compilation and Next.js production build:
```bash
npm run typecheck
npm run build
```

### Docker Deployment
Build and run the production container:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Security & Non-Custodial Assurances

1. **Non-Custodial Design**: MOI never takes custody of treasury funds. All trades and transfers execute through verified smart contracts via Permit2 allowances.
2. **Deterministic Engine Over AI Outputs**: Large language models are strictly restricted to advisory drafting and natural language mandate compilation. All financial authorizations are evaluated by deterministic code.
3. **Dual-Key Isolation**: The operational agent key cannot modify policy boundaries, cannot redirect withdrawal recipients, and cannot exceed allocated trading volumes.
4. **Tenant Isolation**: Portfolios, activity ledgers, and invoice records are strictly partitioned by authenticated wallet address.

---

## Contributing

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for contribution guidelines.

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
