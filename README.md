# MOI — Autonomous Treasury Operating System

MOI is a non-custodial treasury operating system and payment infrastructure built on Celo Mainnet. Designed for businesses, digital merchants, and individuals operating in emerging markets, MOI automates currency risk management, executes institutional FX swaps with guaranteed pricing, enables direct domestic bank withdrawals, and issues zero-gas cryptographic payment requests.

---

## Evaluation Guide for Judges

This walkthrough details how to verify MOI's core financial mechanisms and onchain capabilities on Celo Mainnet.

### Local Setup

1. **Clone and Install**:
   ```bash
   git clone https://github.com/OpeyemiMoses/Moi.git
   cd Moi
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   ```
   *The default configuration connects directly to Celo Mainnet (`chainId: 42220`) via the public RPC (`https://forno.celo.org`). No proprietary API keys are required for evaluation.*

3. **Launch Application**:
   ```bash
   npm run dev
   ```
   Access the dashboard at `http://localhost:3000`.

---

### Key Feature Evaluation Flow

#### 1. Authentication & Onchain Sync
* Click **Connect Wallet** in the top navigation bar.
* Connect any Celo-compatible wallet (MetaMask, Rabby, Valora, or MiniPay) on **Celo Mainnet (Chain ID 42220)**.
* Sign the Sign-In with Ethereum (SIWE, EIP-4361) challenge to initialize your multi-tenant session.
* Verified balances for CELO, USD₮, cUSD, cNGN, wBRL, and wARS synchronize in real time directly from Celo Mainnet RPC.

#### 2. Portfolio Allocation & Rebalance Guard
* On the **Dashboard**, view the **Target Portfolio Allocation & Rebalance Guard**.
* Set a target ratio using the allocation slider (e.g., `70% USD₮ / 30% Local Currency`).
* MOI dynamically monitors balance deviation against live market rates. When portfolio drift occurs, the system generates an automated rebalancing recommendation that populates the swap terminal with a single click.

#### 3. Instant Currency Swaps (Textile FX v2)
* Navigate to the **Treasury & FX** tab.
* Select a trading pair (`cNGN → USD₮`, `wARS → USD₮`, or `wBRL → USD₮`).
* Observe institutional RFQ pricing, zero slippage guarantees, and the integrated P2P rate advantage indicator.
* The execution button dynamically verifies balance requirements and runs the 17-point risk policy checks before signing onchain.

#### 4. Multi-Corridor Domestic Bank Withdrawals
* From the dashboard quick-action bar, select **Withdraw to Bank**.
* Select a domestic settlement corridor:
  * **Nigeria**: Instant settlement via NIBSS Instant Payment (NIP) to major commercial banks and fintechs (GTBank, Zenith, Access, Kuda, PalmPay, OPay).
  * **Brazil**: Instant settlement via Central Bank PIX.
  * **Argentina**: Bank clearing via COELSA CBU / CVU or Alias.
  * **Colombia & Mexico**: Local settlement via PSE / Nequi or SPEI CLABE.
  * **Global**: International USD₮ clearing.
* Enter an amount, specify destination account details, and click **Confirm & Withdraw to Bank**.
* The transaction generates an immutable settlement reference code (e.g., `REF-NIP-...`) and commits the entry to the activity ledger.

#### 5. Zero-Gas Invoicing & Payment Requests
* Navigate to the **Invoices & Pay** tab in the sidebar.
* Click **Create New Invoice**, specify client details, invoice reference, payment amount, and currency.
* Click **Sign & Issue Invoice with Wallet ($0 Gas)**.
* Your wallet prompts you to sign an **EIP-712 structured data message**. This costs **$0.00 and consumes zero network gas**.
* The invoice is immediately registered in your cryptographic history with verified EIP-712 proof.
* Click **View QR** to inspect the invoice slip, dynamic payment QR code, and standard `celo:` payment URI.

#### 6. Autonomous Treasury Agent Configuration
* Navigate to the **Agents** tab.
* Inspect active autonomous mandates or click **Create Mandate & Issue Agent**.
* Define operational parameters: trade execution caps, minimum local currency reserve limits, and maximum allowed slippage.
* Deployed agents execute deterministic rebalancing within these constraints under dual-key isolation.

---

## Core Architecture

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

---

## Celo Mainnet Integrations & Verified Contracts

All operations settle through audited, verified protocols on **Celo Mainnet (Chain ID 42220)**:

| Protocol / Component | Contract Address | Function |
| -------------------- | ---------------- | -------- |
| **Uniswap Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Non-custodial allowance signing |
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | Institutional FX RFQ settlement |
| **ERC-8004 Agent Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Autonomous agent identity registration |
| **ERC-8004 Reputation Registry** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Trust scoring and performance feedback |
| **Calldata Attribution (ERC-8021)** | `celo_c9cb9a59fc4c` | Builder attribution appended to transaction data |

### Supported Assets

* **USD₮ (Tether USD)**: `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
* **cNGN (Nigerian Naira)**: `0xBEB774A749B89A762961e6Bf9e6Ac05928a385f0`
* **wBRL (Brazilian Real)**: `0x27244974f880Ec188686d0e8C596C5F7bA41A70c`
* **wARS (Argentine Peso)**: `0xb8e39F57E4eC6873322E7e59A1B903254924B892`
* **wCOP (Colombian Peso)**: `0x32A3297a7398e404bA11dD6B4b39b1d3cfC24545`
* **wMXN (Mexican Peso)**: `0x600100E2677F676B2023a1B838FE5D67faD7b089`
* **cUSD (Celo Dollar)**: `0x765DE816845861e75A25fCA122bb6898B8B1282a`
* **CELO (Native Currency)**: `0x471EcE3750Da237f93B8E339c536989b8978a438`

---

## Repository Structure

```
moi/
├── apps/
│   └── web/                   # Next.js 15 web interface, API routes, and UI components
├── packages/
│   ├── agent-core/            # Autonomous agent loop and lifecycle orchestrator
│   ├── buy-client/            # buy and x402 service marketplace integration
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

## Security & Non-Custodial Assurances

1. **Owner Custody**: The master owner wallet maintains complete custody over all assets. No funds can move without cryptographically verified user approvals.
2. **Deterministic Rules Over AI Outputs**: Large language models (LLMs) are strictly restricted to advisory drafting and natural language mandate compilation. All financial authorizations are evaluated by deterministic code.
3. **Dual-Key Isolation**: The operational agent key cannot modify policy boundaries, cannot redirect withdrawal recipients, and cannot exceed allocated trading volumes.
4. **Tenant Isolation**: Multi-tenant sessions and portfolios are strictly separated by session tokens and wallet addresses.

---

## Contributing

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for contribution guidelines.

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
