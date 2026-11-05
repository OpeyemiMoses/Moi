# MOI — Autonomous Treasury Operating System
## Official Hackathon Submission Document: Agents on Open Rails

**Hackathon Platform**: [Loops House: Agents on Open Rails](https://www.loops.house/agents-on-open-rails)  
**Submission Deadline**: November 9, 2026, 09:00 GMT  
**Target Tracks**:
1. **Stable Agents: Open Corridors — Textile FX** (`LimitOrderReactor: 0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`)
2. **Stable Agents: LatAm (Ripio × Celo Core Co.)** (wARS, wBRL, wCOP, wMXN)
3. **Build with `buy` & Open Corridors: USA₮ with `x402`** (`0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771`)

---

## 1. Project Overview & Thesis

> **"Autonomous treasury operations. Within your rules."**

Corporate treasuries across Latin America and Africa hold substantial reserves in local fiat currencies (`cNGN`, `wARS`, `wBRL`, `wCOP`). Managing currency depreciation, fragmented foreign exchange counterparties, and volatile cross-border settlements requires 24/7 attention.

**MOI** is an autonomous treasury operating system built on Celo Mainnet. It equips corporate treasuries with an identifiable, verifiable AI agent that actively rebalances holdings into dollar stablecoins (`USD₮`, `USA₮`, `USDC`) via **Textile FX v2**, earns maker spreads via **Textile Stitch**, and consumes onchain intelligence microservices settled via **`x402`** and **`buy`**.

Crucially, MOI solves the primary risk of autonomous financial agents: **rogue execution**. All agent operations are bounded by a **17-point deterministic risk policy engine** running in zero-trust isolation from the probabilistic LLM compiler, protected by mandatory first-trade owner authorization, atomic HMAC policy attestations, and immutable double-entry accounting.

---

## 2. Key Hackathon Innovations & Verified Architecture

### A. Identifiable Agent Identity (ERC-8004 Agent Trust Protocol)
- **Celo Mainnet IdentityRegistry**: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Celo Mainnet ReputationRegistry**: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- **Machine-Readable Metadata Endpoint**: `GET /api/identity/agent.json` conforms to `https://eips.ethereum.org/EIPS/eip-8004#registration-v1`.
- Exposes declared capabilities (`takerRfq`, `passiveStitchFiller`, `x402Microservices`), verified corridor allowlists, policy restrictions, and agent wallet endpoints.

### B. Official Celo ERC-8021 Transaction Attribution
- Integrated with official `@celo/attribution-tags` (v0.1.2) SDK.
- Outgoing transactions append Schema 0 suffix (`0xce10` magic marker) with idempotency protection against double-tagging.
- Suffixing preserves exact calldata function selectors and parameters with zero financial variance.

### C. Live Textile FX v2 Integration (Active Taker & Passive Maker)
- **Active Taker (`taker_rfq`)**: Requests firm quotes via `https://api.textilecredit.com/v2` using keyless EIP-712 `TakerControl` proof or partner keys.
- **Passive Maker (`textile-stitch`)**: Serves an Avellaneda-Stoikov inventory-skewed pricing feed on `GET /api/pricing/stitch` allowing treasuries to capture bid-ask spread while rebalancing.
- **Protocol Fee Compliance**: Bounded to 1 bps fee routing through Textile Fee Controller `0x7b005466F905DD882A959888154587fA76cd3Ea7`.

### D. Institutional Security Architecture
- **Zero-LLM Authority**: The LLM compiler can only draft mandates or explain logs; it has zero signing access.
- **Mandatory First-Trade Owner Authorization (SEC-M2-02)**: The agent cannot trade autonomously until the owner cryptographically approves the first trade for the exact corridor and destination target.
- **16-Field HMAC Attestation (SEC-M2-03)**: Binds execution ID, treasury ID, mandate, RFQ, tokens, amounts, reactor, and calldata hash to a single-use atomic nonce.
- **Event-Driven Accounting (SEC-M2-04)**: Ledger balances are updated exclusively from parsed onchain `Transfer` logs, never from optimistic quote promises.
- **Zero-Leak Client Bundles**: Strict isolation ensures signing credentials and API secrets are never bundled into client JavaScript.

---

## 3. Verified Celo Mainnet (`chainId: 42220`) Contracts

| Component | Verified Mainnet Address | Purpose |
| :--- | :--- | :--- |
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | Settlement contract for Textile FX v2 trades |
| **Textile Fee Controller (1 bps)** | `0x7b005466F905DD882A959888154587fA76cd3Ea7` | Verified 1 bps fee distributor |
| **ERC-8004 IdentityRegistry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Canonical ERC-8004 Agent Identity Registry |
| **ERC-8004 ReputationRegistry**| `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Canonical Agent Reputation Registry |
| **Canonical Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Nonce and allowance management |
| **USD₮ (Tether USD, 6 dec)** | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | Primary stable settlement asset |
| **USA₮ (Tether America, 6 dec)**| `0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771` | America USD settlement asset |
| **USDC (Circle USD, 6 dec)** | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | Circle USD on Celo |
| **cNGN (Compliant Naira, 6 dec)**| `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | Nigerian Naira fiat token |
| **wARS (Ripio Peso, 18 dec)** | `0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D` | Argentine Peso fiat token |
| **wBRL (Ripio Real, 18 dec)** | `0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0` | Brazilian Real fiat token |
| **wCOP (Ripio Peso, 18 dec)** | `0x8a1D45e102e886510e891d2Ec656a708991e2D76` | Colombian Peso fiat token |

---

## 4. Verification & Testing Rigor

- **Automated Tests**: **202 / 202 tests passing** across 26 test suites (`npm test -- run`).
- **Adversarial Hardening**: 31 dedicated attack test scenarios verifying bypass prevention, attestation tampering rejection, and replay defense.
- **Production Next.js Build**: **17 / 17 routes compiled cleanly** (`npm run build`).
- **Live Probes**: `/api/health`, `/api/health/ready`, `/api/health/live`, and `/api/identity/agent.json` responding with HTTP 200.

---

## 5. Live Staging & Run Instructions

```bash
# 1. Clone repository
git clone <repository-url>
cd moi

# 2. Install dependencies
npm install

# 3. Run full automated verification suite
npm test

# 4. Run production build
npm run build

# 5. Launch development or production server
npm run dev
# Or with Docker:
docker compose -f docker-compose.prod.yml up -d
```

Visit `http://localhost:3000` to access the MOI Treasury Operating System dashboard.

