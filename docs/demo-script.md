# MOI Demonstration Script & Evaluation Walkthrough

**Purpose**: Guided judging and evaluation walkthrough demonstrating MOI's capabilities without broadcasting unapproved onchain transactions.  
**Network**: Celo Mainnet (`chainId: 42220`)  
**Core Thesis**: Autonomous treasury operations. Within your rules.  

---

## Stage 1: Treasury Dashboard & Verified Asset Balances

1. Navigate to `http://localhost:3000`.
2. Notice the **Midnight & Mint-Green** interface displaying:
   - Treasury: **Nigeria Operating Treasury (cNGN → USD₮)**.
   - Connected Owner Wallet: `0xb9F4...a211`.
   - Restricted Agent Signer: `0x7a9d...1fF6` (separated by design).
   - Live Token Balances read directly from Celo Mainnet RPC (`forno.celo.org`).

---

## Stage 2: Natural Language Mandate Compilation

1. Click on the **Treasury & FX** tab in the sidebar.
2. In the **Natural Language Treasury Mandate** box, inspect the sample directive:
   ```text
   Preserve 50,000 cNGN operating reserve. Convert excess up to 25,000 per trade with daily cap 100,000 in approval_required mode
   ```
3. Click **Compile with Maximo Atlas**.
4. The compiler transforms natural language into structured parameters:
   - `minimumReserveAtomic`: `50,000,000,000` (50,000 cNGN)
   - `maxTradeAtomic`: `25,000,000,000` (25,000 cNGN)
   - `dailySellCapAtomic`: `100,000,000,000` (100,000 cNGN)
   - `mode`: `approval_required`
5. The mandate updates in the persistent database immediately.

---

## Stage 3: Live Textile FX v2 Observation & 17 Policy Checks

1. Under **Textile FX v2 Conversion**, select **cNGN** (Sell) and **USD₮** (Buy).
2. Enter an amount of **2,000 cNGN**.
3. Toggle the **Preflight Simulation** balance so the treasury meets the reserve requirement.
4. Click **Evaluate Quote & Run 17 Policy Checks**.
5. Observe:
   - MOI fetches live liquidity and indicative rates from `https://api.textilecredit.com/v2/rfq/preview`.
   - The 17-point deterministic policy engine evaluates all 17 rules in real time.
   - Because the mandate is in `approval_required` mode, the policy engine marks the trade as **APPROVAL_PENDING** and safely stops at the authorization boundary.

---

## Stage 4: Owner Approval Queue & Controlled Authorization

1. Click on the **Transactions** tab in the sidebar.
2. Click the **Approval Queue** sub-tab (notice the red/amber pending counter badge).
3. The pending trade appears with complete context:
   - Execution ID, RFQ ID, Sell Amount (`2,000 cNGN`), Expected Buy Amount (`~1.45 USD₮`).
   - Official Celo ERC-8021 Attribution Tag (`celo_moi`).
   - Verified Settlement Target Reactor (`0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`).
4. Click **Approve Trade**.
5. The state transitions to **POLICY_VALIDATED** and logs a tamper-evident audit event.

---

## Stage 5: Passive Maker Strategy (Textile Stitch)

1. Open a new terminal tab or browser window and visit:
   ```text
   http://localhost:3000/api/pricing/stitch?symbol=cNGN
   ```
2. Observe the live JSON output:
   - Market mid-rate dynamically tracked from live Textile makers.
   - Applied inventory skew (widens ask when cNGN is heavy, lowers bid to acquire USD₮).
   - Dynamic spreads and strategy reasoning.

---

## Stage 6: Audit Trail & Compliance Export

1. Under the **Transactions** tab, switch to the **Audit Trail** view.
2. Review the chronological record:
   - Agent cycle start.
   - Live Textile preview observation.
   - 17-rule deterministic policy decision.
   - Owner approval action.
3. Click **Export →** to download the complete audit trail as a signed JSON bundle.

---

## Summary for Judges

MOI demonstrates that autonomous AI agents can operate safely on open rails when bounded by deterministic risk rules, cryptographic authorization boundaries, and verifiable onchain identities.

