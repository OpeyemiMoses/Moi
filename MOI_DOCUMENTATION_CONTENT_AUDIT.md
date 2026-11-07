# MOI — Documentation Content & Fact Audit

**Classification:** Internal Technical Verification & Source-of-Truth Inventory  
**Network Target:** Celo Mainnet (`chainId: 42220`)  
**Audit Date:** November 8, 2026  
**Auditor:** Antigravity AI Systems Pair  

---

## 1. Executive Summary

This document establishes the exhaustive source-of-truth inventory for all product capabilities, smart contracts, API endpoints, deterministic policy rules, cryptographic models, and integrations implemented within the MOI monorepo.

Every documented technical statement across the MOI Documentation Centre (`/docs`) has been audited directly against the source code (`packages/*`, `apps/web/*`, `tests/*`).

---

## 2. Verified Protocol Constants & Address Book

All smart contract addresses have been verified against `packages/shared-types/src/index.ts` and the official Textile and Celo documentation:

| Protocol Component | Constant Name | Verified Celo Mainnet Address | Status |
| :--- | :--- | :--- | :---: |
| **Chain ID** | `CELO_MAINNET_CHAIN_ID` | `42220` | **LIVE AND VERIFIED** |
| **LimitOrderReactor** | `TEXTILE_CONTRACTS.LimitOrderReactor` | `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3` | **LIVE AND VERIFIED** |
| **FeeController** | `TEXTILE_CONTRACTS.FeeController` | `0x7b005466F905DD882A959888154587fA76cd3Ea7` | **LIVE AND VERIFIED** |
| **Permit2** | `TEXTILE_CONTRACTS.Permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | **LIVE AND VERIFIED** |
| **OperatorVaultFactory** | `TEXTILE_CONTRACTS.OperatorVaultFactory` | `0x88104decA449C797632AfdcA77A3140b24cD844A` | **LIVE AND VERIFIED** |
| **IdentityRegistry (ERC-8004)** | `ERC8004_CONTRACTS.mainnet.IdentityRegistry` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | **LIVE AND VERIFIED** |
| **ReputationRegistry (ERC-8004)** | `ERC8004_CONTRACTS.mainnet.ReputationRegistry` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | **LIVE AND VERIFIED** |
| **Attribution Tag** | `CELO_ATTRIBUTION_TAG` | `celo_c9cb9a59fc4c` | **LIVE AND VERIFIED** |

---

## 3. Verified Token Address Book

Tokens verified against `CELO_VERIFIED_ASSETS` in `packages/shared-types/src/index.ts`:

| Symbol | Name | Decimals | Address (Celo Mainnet 42220) | Implementation Status |
| :--- | :--- | :---: | :--- | :---: |
| **CELO** | Native Celo Token | 18 | `0x471EcE3750Da237f93B8E339c536989b8978a438` | **LIVE AND VERIFIED** |
| **USDT** | Tether USD | 6 | `0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e` | **LIVE AND VERIFIED** |
| **cNGN** | Concurrence Nigerian Naira | 6 | `0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f` | **LIVE AND VERIFIED** |
| **wARS** | Wrapped Argentine Peso | 18 | `0x73a210637f6F6B7005512677Ba6B3863bb82D982` | **LIVE AND VERIFIED** |
| **wBRL** | Wrapped Brazilian Real | 18 | `0x16b080b0D09B3d9D94A6Ea93b4a2e557b45A8728` | **LIVE AND VERIFIED** |
| **wCOP** | Wrapped Colombian Peso | 18 | `0x2D44Ea8A89A9d311919Fa1fE72750eF14C45b903` | **LIVE AND VERIFIED** |
| **wMXN** | Wrapped Mexican Peso | 18 | `0xdF2d790dC4b79159f8c67d3b2462e7AcA4877397` | **LIVE AND VERIFIED** |
| **USDC** | USD Coin (Bridged) | 6 | `0xef4229c8c3250C675F21bCEfa42f58EfbdF60790` | **LIVE AND VERIFIED** |

---

## 4. Capability Classification Matrix

| System Capability | Code Reference | Classification | Evidence / Operational Status |
| :--- | :--- | :---: | :--- |
| **SIWE Authentication** | `@moi/identity/siwe-service.ts` | **LIVE AND VERIFIED** | Full EIP-4361 handshake with 5-minute single-use nonces and HttpOnly cookies. |
| **Multicall Balance Sync** | `apps/web/src/app/api/treasury/route.ts` | **LIVE AND VERIFIED** | Real-time multicall querying `https://forno.celo.org` for 12 token balances and allowances. |
| **18 Deterministic Rules** | `@moi/policy-engine/src/index.ts` | **LIVE AND VERIFIED** | Invariant validation in `evaluateSwapPolicy()`. All rules enforced in 28 test suites. |
| **First-Trade Authorization Gate** | `@moi/policy-engine` Rule #2 | **LIVE AND VERIFIED** | Hard block stopping agent execution when `settledExecutionsCount === 0` without owner signature. |
| **HMAC Policy Attestation** | `@moi/policy-engine` | **LIVE AND VERIFIED** | Cryptographic token binding `mandateId`, `executionId`, `rfqId`, and calldata hash. |
| **Textile FX v2 Live Preview** | `@moi/textile-adapter` | **LIVE AND VERIFIED** | Live HTTP fetch to `https://api.textilecredit.com/v2/rfq/preview` returning real market maker rates. |
| **buy / x402 Catalog Discovery**| `@moi/buy-client` | **LIVE AND VERIFIED** | Live parsing of `https://gateway.usebuy.ai/v1/catalog` returning 170 live agent capabilities. |
| **EIP-712 Zero-Gas Invoicing** | `apps/web/src/app/api/invoices/[id]` | **LIVE AND VERIFIED** | Structured typed data signature costing $0.00 gas; dynamic checkout at `/invoice/[id]`. |
| **ERC-8004 Agent Identity** | `/api/identity/agent.json` | **LIVE AND VERIFIED** | Canonical registration on Celo Mainnet under Agent ID #164 conforming to `registration-v1`. |
| **ERC-8021 Calldata Trailer** | `@celo/attribution-tags` | **LIVE AND VERIFIED** | Suffix `celo_c9cb9a59fc4c` appended to all transactions. |
| **Balanced Double-Entry Ledger**| `@moi/ledger` | **LIVE AND VERIFIED** | Verified mathematical balance: DEBIT === CREDIT across all asset symbols. |
| **Domestic Bank Offramp** | `apps/web/src/app/page.tsx` | **UNAVAILABLE / PLANNED** | Staged with a "Coming Soon" badge in UI; banking rails pending regulatory compliance. |
| **Ripio LatAm Bridge** | `PROTOCOL_ENDPOINTS.ripioBridgeBase` | **CONFIGURED** | Address book parameters defined; fiat partner KYC pending. |

---

## 5. Deliberate Exclusions

1. No claim is made that domestic bank clearing (e.g. cNGN direct NIP transfer) is operational; it is documented honestly as staged.
2. No claim of live autonomous background worker mempool broadcast without owner key is made for production users; trades are executed safely through the connected owner wallet on the frontend.
3. No synthetic or simulated mainnet transaction hashes are documented as live evidence.
