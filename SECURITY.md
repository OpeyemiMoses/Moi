# Security Policy

## Supported Versions

MOI is actively maintained and accepts security disclosures for the following release tracks:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | Yes                |
| < 1.0   | No                 |

## Security Architecture & Guarantees

MOI is built around zero-trust financial architecture:

1. **Non-Custodial Master Key Boundary**: The owner wallet retains absolute asset custody. Funds can never be transferred, locked, or seized outside explicit user authorization.
2. **Deterministic Policy Boundary**: Agent operational signers operate under strict TypeScript policy rules (daily volume caps, minimum local currency reserves, maximum slippage bounds).
3. **Dual-Key Isolation**: The backend agent signer private key is strictly isolated from browser clients, front-end state, and probabilistic LLM prompts.
4. **Calldata Attribution (ERC-8021)**: All transactions dispatched by MOI contain verified builder attribution tags (`celo_c9cb9a59fc4c`) appended to transaction calldata.
5. **No Private Keys in Git**: Environment templates (`.env.example`) contain no secrets or private keys. Production secrets must be managed via secure key managers or environment secret injection.

## Reporting a Vulnerability

If you discover a potential security vulnerability within MOI, please do not report it through public GitHub issues or discussions.

Instead, please send an encrypted or direct email report to:

* **Email**: security@moi.network (or contact the maintainer directly via GitHub profile contact).
* **Subject**: `[SECURITY VULNERABILITY] MOI Repository - <Brief Description>`

### Please include the following details in your report:

1. Type of issue (e.g. key isolation bypass, unauthorized quote execution, IDOR tenant vulnerability, policy engine escape).
2. Step-by-step instructions or proof of concept to reproduce the issue.
3. Impact assessment and potential attack vectors.
4. Any proposed patches or mitigations.

### Response Timeline

* **Acknowledgment**: Within 24 hours of report receipt.
* **Triage & Assessment**: Within 72 hours.
* **Remediation & Patch**: Target delivery within 7 days, depending on severity.
* **Public Disclosure**: Coordinated after fixes have been applied and deployed.

