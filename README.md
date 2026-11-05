# MOI — Autonomous Treasury Operating System

MOI (Multi-currency Operations & Intelligence) is a non-custodial digital treasury application built on Celo Mainnet. It enables individuals, startups, and businesses across emerging markets to protect their purchasing power against local currency devaluation, automate foreign exchange swaps, issue zero-gas cryptographic payment requests, and withdraw funds directly into their domestic bank accounts.

---

## Note for Judges on How to Test

Welcome judges and evaluators of the **Agents on Open Rails** hackathon. This guide provides exact instructions to evaluate MOI on Celo Mainnet locally or via your Web3 browser client.

### Quick Start (Under 2 Minutes)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/OpeyemiMoses/Moi.git
   cd Moi
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   ```
   *Note: The default `.env.example` is preconfigured for Celo Mainnet (`chainId: 42220`) using the official public RPC (`https://forno.celo.org`) and public explorer (`https://celoscan.io`). No paid API keys are required to run or test the application.*

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser to: `http://localhost:3000`

---

### Step-by-Step Evaluation Walkthrough

#### 1. Truthful Disconnected State
* Open `http://localhost:3000`.
* Notice that when disconnected, MOI displays **zero synthetic data**: all asset balances show `0.00`, execution tables are empty, and the receive drawer displays a prompt to connect.
* Verified Celo Mainnet contracts (`LimitOrderReactor`, `Permit2`, `ERC-8004 Registry`) and the active attribution tag (`celo_c9cb9a59fc4c`) are displayed transparently.

#### 2. Connect Your Celo Mainnet Wallet
* Click **Connect Wallet** in the top navigation bar.
* Connect any Celo-compatible wallet (MetaMask, Rabby, Valora, or MiniPay) switched to **Celo Mainnet (Chain ID 42220)**.
* Sign the Sign-In with Ethereum (SIWE, EIP-4361) challenge to authenticate your multi-tenant session.
* Your live onchain balances for CELO, USD₮, cUSD, cNGN, wBRL, and wARS are immediately fetched directly from Celo Mainnet via RPC.

#### 3. Test the Smart Portfolio Guard & Drift Rebalancer (NairaGuard Feature)
* On the **Dashboard**, locate the **Target Portfolio Allocation & Rebalance Guard** card.
* Adjust the target ratio slider (e.g., set to `70% USD₮ / 30% Local Currency`).
* MOI dynamically monitors balance deviation. If your portfolio drifts beyond tolerance, a **1-Click Rebalance** card surfaces with exact required rebalancing quantities and pre-populates the swap terminal.

#### 4. Test the Instant Currency Swap Terminal (Textile FX v2 & Ayo Rate Advantage)
* Navigate to the **Treasury & FX** tab in the sidebar.
* Select a trading pair (e.g., `cNGN → USD₮`, `wARS → USD₮`, or `wBRL → USD₮`).
* Observe the live RFQ market preview and the **+0.4% Better than Centralized P2P** badge.
* The smart action button enforces wallet balance checks: if your balance is zero, it indicates `Insufficient Balance`; if sufficient, it evaluates all safety checks under the hood and allows seamless execution.

#### 5. Test Multi-Country Bank Off-Ramps (Withdraw to Bank Modal)
* In the dashboard quick-action bar, click **Withdraw to Bank**.
* Select any supported regional corridor:
  * **Nigeria (NG)**: Instant settlement via NIBSS Instant Payment (NIP) to banks including GTBank, Zenith, Access, Kuda, and PalmPay.
  * **Brazil (BR)**: Instant settlement via Central Bank PIX key.
  * **Argentina (AR)**: Settlement via COELSA CBU / CVU or Alias.
  * **Colombia (CO)** / **Mexico (MX)**: Settlement via PSE / Nequi or SPEI CLABE.
  * **Global**: Settle USD₮ via international wire.
* Enter an amount (or click `MAX`), provide account details, and click **Confirm & Withdraw to Bank**.
* An immutable dispatch receipt is generated with a verified settlement reference code (e.g., `REF-NIP-...`) and recorded into your double-entry ledger.

#### 6. Test Zero-Gas Invoicing & Payment Requests (Dedicated Invoices Page)
* Click **Invoices & Pay** in the sidebar.
* Click **Create New Invoice**.
* Enter a client name, invoice reference, amount, and token (e.g., `USD₮` or `cNGN`).
* Click **Sign & Issue Invoice with Wallet ($0 Gas)**.
* Your Web3 browser wallet prompts you to sign an **EIP-712 structured data message**.
* Notice the transaction fee is **$0.00 and zero gas**.
* Once signed, the invoice is saved to your cryptographic registry with a verified EIP-712 proof badge.
* Click **View QR** to inspect the invoice slip, complete with a scannable payment QR code and shareable `celo:` URI link.

---

## Core Capabilities

### 1. Smart Portfolio Guard & Inflation Protection
Emerging market currencies experience rapid depreciation. MOI allows users to define target allocation thresholds (e.g., 70% USD₮ / 30% Local Currency). The policy engine tracks portfolio drift in real-time and provides one-click automated rebalancing recommendations to preserve capital value.

### 2. Instant Currency Swaps Without P2P Escrow Risk
Traditional peer-to-peer (P2P) crypto exchanges expose users to bank account freezes, counterparty delays, and escrow fraud. MOI integrates Textile FX v2 on Celo Mainnet, providing guaranteed RFQ pricing, zero slippage, and atomic onchain settlement.

### 3. Direct Multi-Corridor Bank Off-Ramping
Users are never locked onchain. MOI integrates real-world payment networks to allow direct cash-out into domestic accounts:
* **Nigeria**: NIBSS Instant Payments (NIP) to commercial banks and fintechs (GTBank, Zenith, Kuda, PalmPay, OPay).
* **Brazil**: Central Bank PIX instant settlement.
* **Argentina**: COELSA CBU / CVU and Alias bank clearing.
* **Colombia & Mexico**: PSE, Nequi, and SPEI bank rails.
* **Global**: International USD₮ clearing.

### 4. Zero-Gas Cryptographic Invoicing (EIP-712)
Issuing invoices should not cost gas fees. MOI enables businesses and freelancers to generate formal client invoices cryptographically signed by their wallet using EIP-712 typed structured data. Clients scan a dynamic QR code using Valora, MiniPay, or MetaMask to settle directly into the merchant treasury.

---

## Celo Mainnet Integrations & Contract Addresses

All transactions and contracts interact strictly with verified protocols on **Celo Mainnet (Chain ID 42220)**:

| Protocol / Contract | Address | Purpose |
| ------------------- | ------- | ------- |
| **Uniswap Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Non-custodial signature approvals |
| **Textile LimitOrderReactor** | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | Institutional FX RFQ settlement |
| **ERC-8004 Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Autonomous agent identity and registration |
| **ERC-8004 Reputation** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Trust scoring and feedback registry |
| **Attribution Tag (ERC-8021)** | `celo_c9cb9a59fc4c` | Builder attribution appended to calldata |

### Verified Stablecoin & Local Currency Assets

* **USD₮ (Tether USD)**: `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`
* **cNGN (Nigerian Naira)**: `0xBEB774A749B89A762961e6Bf9e6Ac05928a385f0`
* **wBRL (Brazilian Real)**: `0x27244974f880Ec188686d0e8C596C5F7bA41A70c`
* **wARS (Argentine Peso)**: `0xb8e39F57E4eC6873322E7e59A1B903254924B892`
* **wCOP (Colombian Peso)**: `0x32A3297a7398e404bA11dD6B4b39b1d3cfC24545`
* **wMXN (Mexican Peso)**: `0x600100E2677F676B2023a1B838FE5D67faD7b089`
* **cUSD (Celo Dollar)**: `0x765DE816845861e75A25fCA122bb6898B8B1282a`
* **CELO (Native Currency)**: `0x471EcE3750Da237f93B8E339c536989b8978a438`

---

## Security Architecture & Dual-Key Boundaries

MOI adheres to a strict dual-key security model:

```
[ Master Owner Custody ] (MetaMask / Rabby / MiniPay)
         │
         │  1. Grants explicit token allowance (Permit2)
         │  2. Configures deterministic trade parameters
         ▼
[ Policy Engine Boundary ] (Zero-Trust TypeScript Execution)
         │
         │  17 Immutable Policy Constraints:
         │  - Daily volume caps
         │  - Minimum local operating reserves
         │  - Maximum allowed slippage
         │  - Atomic HMAC attestation verification
         ▼
[ Restricted Agent Signer ] (Backend Signer)
         │
         │  Executes signed settlement orders strictly within bounds.
         │  Zero ability to drain funds or redirect recipient addresses.
         ▼
[ Celo Mainnet Settlement ] (Textile LimitOrderReactor)
```

1. **Non-Custodial Owner Custody**: The master owner wallet retains full sovereignty. No smart contract or agent can move funds without verified signature approvals.
2. **Deterministic Rules Over AI Prompts**: Natural language models (LLMs) are used solely for drafting mandates or explaining state. Trade authorization is performed exclusively by deterministic code.
3. **Multi-Tenant Data Isolation**: User portfolios, mandates, and invoices are strictly isolated by session ID and owner wallet.

---

## Repository Structure

```
moi/
├── apps/
│   └── web/                   # Next.js 15 front-end application and API routes
├── packages/
│   ├── agent-core/            # Autonomous agent loop and lifecycle orchestrator
│   ├── buy-client/            # buy and x402 service marketplace client
│   ├── database/              # Multi-tenant data store and ledger interface
│   ├── identity/              # SIWE (EIP-4361) authentication and session manager
│   ├── ledger/                # Double-entry bookkeeping and portfolio analytics
│   ├── policy-engine/         # 17-point deterministic financial risk engine
│   ├── shared-types/          # Canonical schemas, constants, and token metadata
│   ├── textile-adapter/       # Textile FX v2 RFQ client and Stitch feed
│   └── wallet-signer/         # Dual-key service and ERC-8021 calldata attribution
├── docs/                      # Architectural specifications and evaluation documents
├── prisma/                    # Relational database schema
├── .env.example               # Preconfigured Celo Mainnet environment template
├── .gitignore                 # Production git ignore configuration
├── LICENSE                    # MIT Open Source License
├── CONTRIBUTING.md            # Guidelines for open source contributors
├── CODE_OF_CONDUCT.md        # Contributor Covenant Code of Conduct
└── SECURITY.md                # Security policy and vulnerability disclosure
```

---

## Contributing

We welcome contributions from the community. Please review our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

---

## Security

To report security vulnerabilities, please refer to our [Security Policy](SECURITY.md).

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
