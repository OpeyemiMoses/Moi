import crypto from 'node:crypto';
import {
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  http,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import {
  codeFromHostname,
  codeFromRepo,
  fromDataSuffix,
  toDataSuffix,
  verifyTx,
  withAttribution,
} from '@celo/attribution-tags';
import {
  CELO_MAINNET_CHAIN_ID,
  CELO_VERIFIED_ASSETS,
  FirmQuote,
  PolicyEvaluationResult,
  TEXTILE_CONTRACTS,
  TreasuryMandate,
  FirstTradeAuthorizationRecord,
  findAssetByAddress,
} from '@moi/shared-types';
import { verifyPolicyAttestation, parseAttestationPayload } from '@moi/policy-engine';
import { moiDb } from '@moi/database';

export interface WalletSeparationVerification {
  valid: boolean;
  ownerWallet: `0x${string}`;
  agentWallet: `0x${string}`;
  isDistinct: boolean;
  reasons: string[];
}

/**
 * Strict Wallet Separation Validator (Section M2.1.A)
 * Confirms that Master Owner Wallet and Restricted Agent Wallet are distinct authorities.
 * Guarantees that agent signer credentials can never access or control the owner's wallet.
 */
export function verifyWalletSeparation(params: {
  ownerWallet: `0x${string}`;
  agentWallet: `0x${string}`;
  requestedSignerAddress?: `0x${string}`;
}): WalletSeparationVerification {
  const reasons: string[] = [];
  const isDistinct =
    params.ownerWallet.toLowerCase() !== params.agentWallet.toLowerCase();

  if (!isDistinct) {
    reasons.push(
      'CRITICAL_SECURITY_VIOLATION: Owner wallet and Agent signer wallet must be distinct authorities.'
    );
  }

  if (params.requestedSignerAddress) {
    if (
      params.requestedSignerAddress.toLowerCase() ===
      params.ownerWallet.toLowerCase()
    ) {
      reasons.push(
        'FORBIDDEN_SIGNER_ACCESS: Agent signer cannot access or sign transactions using the master owner wallet.'
      );
    }
    if (
      params.requestedSignerAddress.toLowerCase() !==
      params.agentWallet.toLowerCase()
    ) {
      reasons.push(
        `SIGNER_AUTHORITY_MISMATCH: Requested signer ${params.requestedSignerAddress} does not match configured agent wallet ${params.agentWallet}.`
      );
    }
  }

  return {
    valid: reasons.length === 0,
    ownerWallet: params.ownerWallet,
    agentWallet: params.agentWallet,
    isDistinct,
    reasons,
  };
}

export interface SigningAuthorizationRequest {
  userId: string;
  treasuryId: string;
  agentId: string;
  mandateId: string;
  executionId: string;
  chainId: number;
  destinationContract: `0x${string}`;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  amountInAtomic: string;
  expectedBuyAmountAtomic?: string;
  calldata: Hex;
  idempotencyKey: string;
  policyResult?: PolicyEvaluationResult;
  quote?: FirmQuote;
  firstTradeAuthorization?: FirstTradeAuthorizationRecord;
}

export interface SigningServerValidationContext {
  trustedTreasury: {
    id: string;
    ownerUserId: string;
    ownerWalletAddress: `0x${string}`;
    agentWalletAddress: `0x${string}`;
    chainId: number;
  };
  trustedMandate: TreasuryMandate;
  trustedAgent: {
    id: string;
    treasuryId: string;
    walletAddress: `0x${string}`;
    active: boolean;
  };
  trustedExecution?: {
    id: string;
    treasuryId: string;
    mandateId: string;
    agentId: string;
    idempotencyKey: string;
    status: string;
  };
  availableBalanceAtomic: string;
  dailySpentAtomic: string;
  nowMs?: number;
  settledExecutionsCount?: number;
  firstTradeAuthorization?: FirstTradeAuthorizationRecord;
}

export interface SignerInspectionResult {
  valid: boolean;
  reasons: string[];
  errorCode?: string;
  approvedCalldata?: Hex;
  requiresApproval: boolean;
}

/**
 * Restricted Signer Transaction Inspector (Section M2.1.B & C)
 * Inspects all parameters against trusted server records BEFORE signing or broadcasting.
 * Enforces destination allowlists, function selectors, non-unlimited allowances,
 * exact spending limits, replay guards, and cryptographic policy attestations.
 */
export function inspectTransactionBeforeSigning(
  req: SigningAuthorizationRequest,
  ctx: SigningServerValidationContext
): SignerInspectionResult {
  const reasons: string[] = [];
  const nowMs = ctx.nowMs ?? Date.now();

  // 1. Authenticated User & Treasury Ownership
  if (req.userId !== ctx.trustedTreasury.ownerUserId) {
    return {
      valid: false,
      reasons: [
        `UNAUTHORIZED_USER: User ${req.userId} does not own treasury ${ctx.trustedTreasury.id}.`,
      ],
      errorCode: 'UNAUTHORIZED_USER',
      requiresApproval: false,
    };
  }

  // 2. Treasury, Agent, and Mandate Relationships
  if (req.treasuryId !== ctx.trustedTreasury.id) {
    reasons.push(
      `TREASURY_MISMATCH: Request treasury ${req.treasuryId} does not match trusted treasury ${ctx.trustedTreasury.id}.`
    );
  }
  if (
    req.agentId !== ctx.trustedAgent.id ||
    ctx.trustedAgent.treasuryId !== ctx.trustedTreasury.id
  ) {
    reasons.push(
      `AGENT_MISMATCH: Agent ${req.agentId} is not an authorized agent of treasury ${ctx.trustedTreasury.id}.`
    );
  }
  if (!ctx.trustedAgent.active) {
    reasons.push(`AGENT_INACTIVE: Agent ${req.agentId} is disabled.`);
  }
  if (
    req.mandateId !== ctx.trustedMandate.id ||
    ctx.trustedMandate.treasuryId !== ctx.trustedTreasury.id
  ) {
    reasons.push(
      `MANDATE_MISMATCH: Mandate ${req.mandateId} does not govern treasury ${ctx.trustedTreasury.id}.`
    );
  }

  // 3. Emergency Pause & Circuit Breakers
  if (ctx.trustedMandate.paused || Boolean((ctx.trustedMandate as any).emergencyStopped)) {
    return {
      valid: false,
      reasons: [
        'EMERGENCY_PAUSED: Mandate is in emergency pause status; signing is prohibited.',
      ],
      errorCode: 'EMERGENCY_PAUSED',
      requiresApproval: false,
    };
  }

  // 4. Chain ID Verification (Strictly Celo Mainnet 42220)
  if (
    req.chainId !== CELO_MAINNET_CHAIN_ID ||
    ctx.trustedTreasury.chainId !== CELO_MAINNET_CHAIN_ID
  ) {
    return {
      valid: false,
      reasons: [
        `INVALID_CHAIN_ID: Signer strictly restricted to Celo Mainnet (${CELO_MAINNET_CHAIN_ID}). Got: ${req.chainId}.`,
      ],
      errorCode: 'INVALID_CHAIN_ID',
      requiresApproval: false,
    };
  }

  // 5. Destination Contract Allowlist Check
  const destLower = req.destinationContract.toLowerCase();
  const allowedContracts = [
    TEXTILE_CONTRACTS.LimitOrderReactor.toLowerCase(),
    TEXTILE_CONTRACTS.Permit2.toLowerCase(),
    req.sellToken.toLowerCase(), // Token contract allowed only for bounded ERC20 approve
    ...(ctx.trustedMandate.allowedTargets || []).map((t) => t.toLowerCase()),
  ];
  if (!allowedContracts.includes(destLower)) {
    return {
      valid: false,
      reasons: [
        `UNTRUSTED_DESTINATION_CONTRACT: Target ${req.destinationContract} is not in the authorized contract allowlist.`,
      ],
      errorCode: 'UNTRUSTED_DESTINATION_CONTRACT',
      requiresApproval: false,
    };
  }

  // 6. Token Contract Allowlist & Approved Corridor Check
  const sellAsset = findAssetByAddress(req.sellToken);
  const buyAsset = findAssetByAddress(req.buyToken);
  if (!sellAsset || !buyAsset) {
    return {
      valid: false,
      reasons: [
        `UNVERIFIED_TOKEN: Token pair (${req.sellToken} -> ${req.buyToken}) is not registered in Celo verified assets.`,
      ],
      errorCode: 'UNVERIFIED_TOKEN',
      requiresApproval: false,
    };
  }
  if (
    req.sellToken.toLowerCase() !==
      ctx.trustedMandate.sellToken.toLowerCase() ||
    req.buyToken.toLowerCase() !== ctx.trustedMandate.buyToken.toLowerCase()
  ) {
    return {
      valid: false,
      reasons: [
        `CORRIDOR_MISMATCH: Requested tokens (${req.sellToken} -> ${req.buyToken}) do not match approved mandate corridor (${ctx.trustedMandate.sellToken} -> ${ctx.trustedMandate.buyToken}).`,
      ],
      errorCode: 'CORRIDOR_MISMATCH',
      requiresApproval: false,
    };
  }

  // 7. Function Selector Inspection & Unlimited Approval Rejection
  const selector = req.calldata.slice(0, 10).toLowerCase();
  const isErc20Approve = selector === '0x095ea7b3'; // approve(address,uint256)

  if (isErc20Approve) {
    try {
      const decoded = decodeFunctionData({
        abi: erc20Abi,
        data: req.calldata,
      });
      const spender = (decoded.args?.[0] as string).toLowerCase();
      const allowanceAmount = decoded.args?.[1] as bigint;

      // Spender must be official Textile LimitOrderReactor or Permit2
      const validSpenders = [
        TEXTILE_CONTRACTS.LimitOrderReactor.toLowerCase(),
        TEXTILE_CONTRACTS.Permit2.toLowerCase(),
      ];
      if (!validSpenders.includes(spender)) {
        return {
          valid: false,
          reasons: [
            `UNTRUSTED_APPROVAL_SPENDER: Approval spender ${spender} is not Textile LimitOrderReactor or Permit2.`,
          ],
          errorCode: 'UNTRUSTED_APPROVAL_SPENDER',
          requiresApproval: false,
        };
      }

      // Check unlimited allowance: reject max uint256 or amounts exceeding maxTradeAtomic
      const maxUint256 = 2n ** 256n - 1n;
      const maxTradeCap = BigInt(ctx.trustedMandate.maxTradeAtomic);
      if (allowanceAmount === maxUint256 || allowanceAmount > maxTradeCap) {
        return {
          valid: false,
          reasons: [
            `UNLIMITED_ALLOWANCE_REJECTED: Signer strictly forbids unlimited or excessive allowances (${allowanceAmount.toString()}). Approvals must be exact and bounded to max trade cap (${maxTradeCap.toString()}).`,
          ],
          errorCode: 'UNLIMITED_ALLOWANCE_REJECTED',
          requiresApproval: false,
        };
      }
    } catch {
      return {
        valid: false,
        reasons: [
          'MALFORMED_APPROVAL_CALLDATA: Failed to decode ERC-20 approve parameters.',
        ],
        errorCode: 'MALFORMED_APPROVAL_CALLDATA',
        requiresApproval: false,
      };
    }
  }

  // 8. Spending Controls: Per-Trade Cap, Daily Cap, Available Balance, Reserve Floor
  const requestedAmount = BigInt(req.amountInAtomic);
  const maxTradeCap = BigInt(ctx.trustedMandate.maxTradeAtomic);
  if (requestedAmount <= 0n || requestedAmount > maxTradeCap) {
    return {
      valid: false,
      reasons: [
        `PER_TRADE_CAP_EXCEEDED: Requested amount ${req.amountInAtomic} exceeds mandate max trade cap ${ctx.trustedMandate.maxTradeAtomic}.`,
      ],
      errorCode: 'PER_TRADE_CAP_EXCEEDED',
      requiresApproval: false,
    };
  }

  const dailySpent = BigInt(ctx.dailySpentAtomic);
  const dailyCap = BigInt(ctx.trustedMandate.dailySellCapAtomic);
  if (dailySpent + requestedAmount > dailyCap) {
    return {
      valid: false,
      reasons: [
        `DAILY_SPEND_CAP_EXCEEDED: Projected 24h spend ${(dailySpent + requestedAmount).toString()} exceeds mandate daily cap ${ctx.trustedMandate.dailySellCapAtomic}.`,
      ],
      errorCode: 'DAILY_SPEND_CAP_EXCEEDED',
      requiresApproval: false,
    };
  }

  const currentBalance = BigInt(ctx.availableBalanceAtomic);
  const minReserve = BigInt(ctx.trustedMandate.minimumReserveAtomic);
  if (currentBalance < requestedAmount + minReserve) {
    return {
      valid: false,
      reasons: [
        `INSUFFICIENT_TREASURY_RESERVE: Balance (${currentBalance.toString()}) insufficient to fund trade (${requestedAmount.toString()}) while maintaining reserve floor (${minReserve.toString()}).`,
      ],
      errorCode: 'INSUFFICIENT_TREASURY_RESERVE',
      requiresApproval: false,
    };
  }

  // 9. Replay Protection: Execution status & Idempotency Key
  if (ctx.trustedExecution) {
    const s = ctx.trustedExecution.status;
    if (s === 'SUBMITTED' || s === 'SETTLED' || s === 'EXPIRED') {
      return {
        valid: false,
        reasons: [
          `REPLAYED_EXECUTION: Execution ${ctx.trustedExecution.id} is already in finalized/submitted status (${s}).`,
        ],
        errorCode: 'REPLAYED_EXECUTION',
        requiresApproval: false,
      };
    }
    if (ctx.trustedExecution.idempotencyKey !== req.idempotencyKey) {
      return {
        valid: false,
        reasons: [
          `IDEMPOTENCY_KEY_MISMATCH: Request key ${req.idempotencyKey} does not match server record key ${ctx.trustedExecution.idempotencyKey}.`,
        ],
        errorCode: 'IDEMPOTENCY_KEY_MISMATCH',
        requiresApproval: false,
      };
    }
  }

  // 10. Quote Expiry Check & Recipient Check
  if (req.quote?.quote) {
    const expiresAtMs = Date.parse(req.quote.quote.expiresAt);
    if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs + 1500) {
      return {
        valid: false,
        reasons: [
          `QUOTE_EXPIRED: Quote accept window closed (expiresAt: ${req.quote.quote.expiresAt}).`,
        ],
        errorCode: 'QUOTE_EXPIRED',
        requiresApproval: false,
      };
    }

    // Recipient must match restricted agent wallet
    if (
      req.quote.quote.taker.toLowerCase() !==
      ctx.trustedAgent.walletAddress.toLowerCase()
    ) {
      return {
        valid: false,
        reasons: [
          `UNEXPECTED_RECIPIENT: Quote taker (${req.quote.quote.taker}) does not match trusted agent wallet (${ctx.trustedAgent.walletAddress}).`,
        ],
        errorCode: 'UNEXPECTED_RECIPIENT',
        requiresApproval: false,
      };
    }
  }

  const calldataHash = crypto
    .createHash('sha256')
    .update(req.calldata)
    .digest('hex');

  // 10b. SEC-M2-02: Mandatory First-Trade Owner Authorization Gate
  const settledCount =
    ctx.settledExecutionsCount ??
    moiDb.getSettledExecutionsCount(ctx.trustedTreasury.id);
  const isFirstTrade = settledCount === 0;

  if (isFirstTrade) {
    const dbAuth = moiDb.getFirstTradeAuthorization(req.executionId);
    const auth =
      dbAuth ||
      req.firstTradeAuthorization ||
      ctx.firstTradeAuthorization;

    if (!auth) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_UNAUTHORIZED: Treasury ${ctx.trustedTreasury.id} has 0 settled executions. Mandatory first-trade owner authorization is required before signing.`,
        ],
        errorCode: 'FIRST_TRADE_UNAUTHORIZED',
        requiresApproval: true,
      };
    }
    if (auth.consumed || (dbAuth && dbAuth.consumed)) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_ALREADY_CONSUMED: First-trade authorization for execution "${req.executionId}" has already been consumed.`,
        ],
        errorCode: 'FIRST_TRADE_ALREADY_CONSUMED',
        requiresApproval: false,
      };
    }
    if (new Date(auth.expiresAt).getTime() < nowMs) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_AUTH_EXPIRED: First-trade authorization for execution "${req.executionId}" expired at ${auth.expiresAt}.`,
        ],
        errorCode: 'FIRST_TRADE_AUTH_EXPIRED',
        requiresApproval: false,
      };
    }
    if (auth.executionId && auth.executionId !== req.executionId) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_MISMATCH: Authorization executionId "${auth.executionId}" does not match request executionId "${req.executionId}".`,
        ],
        errorCode: 'FIRST_TRADE_MISMATCH',
        requiresApproval: false,
      };
    }
    if (auth.treasuryId !== ctx.trustedTreasury.id) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_MISMATCH: Authorization treasury "${auth.treasuryId}" does not match trusted treasury "${ctx.trustedTreasury.id}".`,
        ],
        errorCode: 'FIRST_TRADE_MISMATCH',
        requiresApproval: false,
      };
    }
    if (
      auth.sellToken.toLowerCase() !== req.sellToken.toLowerCase() ||
      auth.buyToken.toLowerCase() !== req.buyToken.toLowerCase()
    ) {
      return {
        valid: false,
        reasons: [
          'FIRST_TRADE_TOKEN_MISMATCH: Sell or buy token does not match authorized first-trade corridor.',
        ],
        errorCode: 'FIRST_TRADE_TOKEN_MISMATCH',
        requiresApproval: false,
      };
    }
    if (BigInt(auth.amountInAtomic) < BigInt(req.amountInAtomic)) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_AMOUNT_EXCEEDED: Requested amount (${req.amountInAtomic}) exceeds authorized first-trade ceiling (${auth.amountInAtomic}).`,
        ],
        errorCode: 'FIRST_TRADE_AMOUNT_EXCEEDED',
        requiresApproval: false,
      };
    }
    if (
      auth.destinationContract.toLowerCase() !==
      req.destinationContract.toLowerCase()
    ) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_TARGET_MISMATCH: Destination contract "${req.destinationContract}" does not match authorized target "${auth.destinationContract}".`,
        ],
        errorCode: 'FIRST_TRADE_TARGET_MISMATCH',
        requiresApproval: false,
      };
    }
    if (auth.calldataHash.toLowerCase() !== calldataHash.toLowerCase()) {
      return {
        valid: false,
        reasons: [
          `FIRST_TRADE_CALLDATA_MISMATCH: Authorized calldata hash "${auth.calldataHash}" does not match transaction calldata "${calldataHash}".`,
        ],
        errorCode: 'FIRST_TRADE_CALLDATA_MISMATCH',
        requiresApproval: false,
      };
    }

    // Atomically consume first-trade authorization before signing
    const consumeRes = moiDb.atomicConsumeFirstTradeAuthorization(
      auth.executionId,
      calldataHash
    );
    if (!consumeRes.consumed) {
      if (
        consumeRes.reason &&
        consumeRes.reason.includes('already been consumed')
      ) {
        return {
          valid: false,
          reasons: [
            `FIRST_TRADE_ALREADY_CONSUMED: First-trade authorization for execution "${req.executionId}" has already been consumed.`,
          ],
          errorCode: 'FIRST_TRADE_ALREADY_CONSUMED',
          requiresApproval: false,
        };
      }
      return {
        valid: false,
        reasons: [`FIRST_TRADE_CONSUMPTION_FAILED: ${consumeRes.reason}`],
        errorCode: 'FIRST_TRADE_CONSUMPTION_FAILED',
        requiresApproval: false,
      };
    }
  }

  // 11. Policy Attestation Verification (HMAC Signature Coupling & Replay Prevention)
  if (req.policyResult) {
    if (!req.policyResult.authorized) {
      return {
        valid: false,
        reasons: [
          `POLICY_UNAUTHORIZED: Policy evaluation did not authorize execution: ${req.policyResult.failedReasons.join('; ')}`,
        ],
        errorCode: 'POLICY_UNAUTHORIZED',
        requiresApproval: false,
      };
    }
    if (
      req.policyResult.attestationSignature &&
      req.policyResult.attestationPayload
    ) {
      const isAttestationValid = verifyPolicyAttestation(
        req.policyResult.attestationPayload,
        req.policyResult.attestationSignature
      );
      if (!isAttestationValid) {
        return {
          valid: false,
          reasons: [
            'TAMPERED_POLICY_ATTESTATION: Cryptographic HMAC signature on policy result is invalid or forged.',
          ],
          errorCode: 'TAMPERED_POLICY_ATTESTATION',
          requiresApproval: false,
        };
      }

      const parsed = parseAttestationPayload(
        req.policyResult.attestationPayload
      );
      if (parsed.isCanonical16) {
        if (new Date(parsed.attestationExpiry!).getTime() < nowMs) {
          return {
            valid: false,
            reasons: ['ATTESTATION_EXPIRED: Policy attestation has expired.'],
            errorCode: 'ATTESTATION_EXPIRED',
            requiresApproval: false,
          };
        }
        if (parsed.userId && req.userId && parsed.userId !== req.userId) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: userId mismatch (${parsed.userId} vs ${req.userId}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (
          parsed.executionId &&
          req.executionId &&
          parsed.executionId !== req.executionId
        ) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: executionId mismatch (${parsed.executionId} vs ${req.executionId}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (parsed.treasuryId && parsed.treasuryId !== req.treasuryId) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: treasuryId mismatch (${parsed.treasuryId} vs ${req.treasuryId}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (parsed.mandateId && parsed.mandateId !== req.mandateId) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: mandateId mismatch (${parsed.mandateId} vs ${req.mandateId}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (parsed.agentId && parsed.agentId !== req.agentId) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: agentId mismatch (${parsed.agentId} vs ${req.agentId}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (parsed.chainId && parsed.chainId !== req.chainId) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: chainId mismatch (${parsed.chainId} vs ${req.chainId}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (
          parsed.sellToken &&
          parsed.sellToken.toLowerCase() !== req.sellToken.toLowerCase()
        ) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: sellToken mismatch (${parsed.sellToken} vs ${req.sellToken}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (
          parsed.buyToken &&
          parsed.buyToken.toLowerCase() !== req.buyToken.toLowerCase()
        ) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: buyToken mismatch (${parsed.buyToken} vs ${req.buyToken}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (
          parsed.swapTo &&
          parsed.swapTo.toLowerCase() !== req.destinationContract.toLowerCase()
        ) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: destinationContract mismatch (${parsed.swapTo} vs ${req.destinationContract}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }
        if (
          parsed.calldataHash &&
          parsed.calldataHash.toLowerCase() !== calldataHash.toLowerCase()
        ) {
          return {
            valid: false,
            reasons: [
              `ATTESTATION_PARAM_MISMATCH: calldataHash mismatch (${parsed.calldataHash} vs ${calldataHash}).`,
            ],
            errorCode: 'ATTESTATION_PARAM_MISMATCH',
            requiresApproval: false,
          };
        }

        // Atomically consume attestation nonce before signing to prevent replay attacks
        const consumeNonceRes = moiDb.atomicConsumeAttestation(
          parsed.nonce!,
          req.executionId,
          calldataHash,
          new Date(parsed.attestationExpiry!)
        );
        if (!consumeNonceRes.consumed) {
          return {
            valid: false,
            reasons: [`ATTESTATION_REPLAY_DETECTED: ${consumeNonceRes.reason}`],
            errorCode: 'ATTESTATION_REPLAY_DETECTED',
            requiresApproval: false,
          };
        }
      }
    }
  }

  // Append Celo ERC-8021 Attribution tag to approved calldata
  const attr = resolveAttributionTagStatus();
  const taggedCalldata = appendAttributionToCalldata(
    req.calldata,
    attr.configuredTag
  );

  return {
    valid: reasons.length === 0,
    reasons,
    approvedCalldata: taggedCalldata,
    requiresApproval: false,
  };
}

export interface AttributionTagStatus {
  configuredTag: string;
  derivedRepoTag?: string;
  repoSlug?: string;
  matchesRepoDerivation?: boolean;
  encodedSuffixHex: Hex;
  decodedPreview: { codes: string[]; schemaId: number } | null;
}

/**
 * Resolves and validates the Celo ERC-8021 Attribution Tag using the official
 * `@celo/attribution-tags` SDK.
 * Verified against: https://github.com/celo-org/attribution-tags/blob/main/BUILDERS.md
 */
export function resolveAttributionTagStatus(params?: {
  explicitTag?: string;
  githubRepo?: string;
  hostname?: string;
}): AttributionTagStatus {
  const repoSlug = params?.githubRepo || process.env.GITHUB_REPO || 'moi-org/moi';
  const derivedRepoTag = codeFromRepo(repoSlug);
  const explicitTag =
    params?.explicitTag ||
    process.env.CELO_ATTRIBUTION_TAG ||
    derivedRepoTag ||
    codeFromHostname(params?.hostname || 'moi.finance');

  // Clean tag to match [a-z0-9_]{1,32}
  const safeTag = explicitTag.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 32);
  const hasExplicit = Boolean(params?.explicitTag || process.env.CELO_ATTRIBUTION_TAG);
  const codes = hasExplicit
    ? [safeTag]
    : safeTag !== derivedRepoTag
      ? [safeTag, derivedRepoTag]
      : [safeTag];

  const encodedSuffixHex = toDataSuffix(codes) as Hex;
  const decodedPreview = fromDataSuffix(encodedSuffixHex);

  return {
    configuredTag: safeTag,
    derivedRepoTag,
    repoSlug,
    matchesRepoDerivation: safeTag === derivedRepoTag,
    encodedSuffixHex,
    decodedPreview,
  };
}

/**
 * Appends the ERC-8021 attribution suffix to raw transaction calldata if not already present.
 * Note: When `withAttribution` is attached to the viem wallet client, it also merges Schema 0 tags.
 */
export function appendAttributionToCalldata(
  rawCalldata: Hex,
  attributionCode?: string | string[]
): Hex {
  const existing = fromDataSuffix(rawCalldata);
  const status = resolveAttributionTagStatus(
    typeof attributionCode === 'string' ? { explicitTag: attributionCode } : undefined
  );
  const targetCodes = Array.isArray(attributionCode)
    ? attributionCode
    : [status.configuredTag];

  if (existing && existing.schemaId === 0) {
    const merged = Array.from(new Set([...existing.codes, ...targetCodes]));
    // Strip old suffix bytes and re-append merged suffix
    const oldSuffix = toDataSuffix(existing.codes);
    const oldSuffixNo0x = oldSuffix.slice(2);
    const baseData = rawCalldata.toLowerCase().endsWith(oldSuffixNo0x.toLowerCase())
      ? (rawCalldata.slice(0, rawCalldata.length - oldSuffixNo0x.length) as Hex)
      : rawCalldata;
    const newSuffix = toDataSuffix(merged).slice(2);
    return `${baseData}${newSuffix}` as Hex;
  }

  const suffixNo0x = toDataSuffix(targetCodes).slice(2);
  return `${rawCalldata}${suffixNo0x}` as Hex;
}

export interface SignerValidationOutcome {
  valid: boolean;
  reasons: string[];
  approvalRequired: boolean;
  taggedSwapCalldata?: Hex;
  taggedApprovalCalldata?: Hex;
  attributionSuffix?: Hex;
}

/**
 * Restricted Signer Pre-Broadcast Validator (Section 8.7 & Section 9.3)
 * Validates transaction target, value, chainId, and exact calldata match against
 * the authorized quote BEFORE appending the ERC-8021 attribution suffix.
 */
export function validateQuoteBeforeSigning(params: {
  quote: FirmQuote;
  policyResult: PolicyEvaluationResult;
  expectedTaker: `0x${string}`;
  currentAllowanceAtomic: string;
  attributionCode?: string;
  nowMs?: number;
}): SignerValidationOutcome {
  const reasons: string[] = [];
  const nowMs = params.nowMs ?? Date.now();

  if (!params.policyResult.authorized) {
    reasons.push(
      `Policy engine did not authorize execution: ${params.policyResult.failedReasons.join('; ')}`
    );
  }

  if (
    params.quote.status !== 'quoted' ||
    !params.quote.quote ||
    !params.quote.transactions?.swap
  ) {
    reasons.push('Quote does not contain executable swap transaction data.');
    return { valid: false, reasons, approvalRequired: false };
  }

  const q = params.quote.quote;
  const swapTx = params.quote.transactions.swap;

  // 1. Chain ID === 42220
  if (swapTx.chainId !== CELO_MAINNET_CHAIN_ID) {
    reasons.push(`Signer rejected non-Celo chainId: ${swapTx.chainId}`);
  }

  // 2. Taker wallet matches restricted agent wallet
  if (q.taker.toLowerCase() !== params.expectedTaker.toLowerCase()) {
    reasons.push(`Signer taker mismatch: quote=${q.taker}, signer=${params.expectedTaker}`);
  }

  // 3. Re-check quote expiry immediately before signing
  const expiresAtMs = Date.parse(q.expiresAt);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= nowMs + 1500) {
    reasons.push(`Signer rejected expired quote (expiresAt=${q.expiresAt}).`);
  }

  // 4. Target is official Textile LimitOrderReactor
  if (swapTx.to.toLowerCase() !== TEXTILE_CONTRACTS.LimitOrderReactor.toLowerCase()) {
    reasons.push(
      `Signer rejected untrusted swap target ${swapTx.to}; expected LimitOrderReactor (${TEXTILE_CONTRACTS.LimitOrderReactor}).`
    );
  }

  // 5. Value must be "0"
  if (BigInt(swapTx.value || '0') !== 0n) {
    reasons.push(`Signer rejected non-zero native value (${swapTx.value}).`);
  }

  // 6. Check if ERC-20 approval is needed
  const requiredAllowance = BigInt(q.takerPays);
  const currentAllowance = BigInt(params.currentAllowanceAtomic);
  const approvalRequired = currentAllowance < requiredAllowance;

  const attrStatus = resolveAttributionTagStatus({
    explicitTag: params.attributionCode,
  });

  // 7. Tag calldata AFTER verifying raw swapTx.data integrity
  const taggedSwapCalldata = appendAttributionToCalldata(
    swapTx.data,
    attrStatus.configuredTag
  );

  let taggedApprovalCalldata: Hex | undefined;
  if (approvalRequired) {
    // Encode exact bounded approval for takerPays to quote.reactor
    const rawApprove = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [q.reactor, requiredAllowance],
    });
    taggedApprovalCalldata = appendAttributionToCalldata(
      rawApprove,
      attrStatus.configuredTag
    );
  }

  return {
    valid: reasons.length === 0,
    reasons,
    approvalRequired,
    taggedSwapCalldata,
    taggedApprovalCalldata,
    attributionSuffix: attrStatus.encodedSuffixHex,
  };
}

/**
 * Production Readiness Gate: Fails closed when AGENT_SIGNER_SECRET_REFERENCE is unconfigured.
 */
export function verifySignerProductionReadiness(): {
  ready: boolean;
  signerAddress?: `0x${string}`;
  reasons: string[];
} {
  const reasons: string[] = [];
  const secret = process.env.AGENT_SIGNER_SECRET_REFERENCE;
  if (!secret) {
    reasons.push(
      'FAIL_CLOSED: AGENT_SIGNER_SECRET_REFERENCE is unconfigured. Real onchain settlement cannot proceed without a valid restricted signer secret.'
    );
  } else if (!/^0x[a-fA-F0-9]{64}$/.test(secret)) {
    reasons.push(
      'FAIL_CLOSED: AGENT_SIGNER_SECRET_REFERENCE is not a valid 32-byte hexadecimal private key.'
    );
  }

  if (reasons.length > 0) {
    return {
      ready: false,
      reasons,
    };
  }

  try {
    const account = privateKeyToAccount(secret as Hex);
    return {
      ready: true,
      signerAddress: account.address,
      reasons: [],
    };
  } catch (err: any) {
    return {
      ready: false,
      reasons: [
        `FAIL_CLOSED: Failed to initialize signer account from AGENT_SIGNER_SECRET_REFERENCE: ${err.message}`,
      ],
    };
  }
}

/**
 * Celo Mainnet Public & Restricted Wallet Client Service
 */
export class CeloChainService {
  private readonly rpcUrl: string;
  public readonly publicClient: any;

  constructor(rpcUrl?: string) {
    this.rpcUrl =
      rpcUrl || process.env.CELO_RPC_URL || 'https://forno.celo.org';
    this.publicClient = createPublicClient({
      chain: celo,
      transport: http(this.rpcUrl, { timeout: 15_000 }),
    });
  }

  getAgentWalletAddress(): `0x${string}` {
    if (
      process.env.AGENT_WALLET_ADDRESS &&
      /^0x[a-fA-F0-9]{40}$/.test(process.env.AGENT_WALLET_ADDRESS)
    ) {
      return process.env.AGENT_WALLET_ADDRESS as `0x${string}`;
    }
    if (
      process.env.AGENT_SIGNER_SECRET_REFERENCE &&
      /^0x[a-fA-F0-9]{64}$/.test(process.env.AGENT_SIGNER_SECRET_REFERENCE)
    ) {
      const account = privateKeyToAccount(
        process.env.AGENT_SIGNER_SECRET_REFERENCE as Hex
      );
      return account.address;
    }
    // Default deterministic read-only Celo Mainnet treasury observation address when no secret key is configured yet
    return '0x7a9d56e55Aa0C069118F47aF2ebe675cf0fc1fF6';
  }

  isSignerConfigured(): boolean {
    return Boolean(
      process.env.AGENT_SIGNER_SECRET_REFERENCE &&
        /^0x[a-fA-F0-9]{64}$/.test(process.env.AGENT_SIGNER_SECRET_REFERENCE)
    );
  }

  verifyProductionReadiness(): {
    ready: boolean;
    signerAddress?: `0x${string}`;
    reasons: string[];
  } {
    return verifySignerProductionReadiness();
  }

  /**
   * Reads live Celo Mainnet balances for all verified assets on a wallet address.
   */
  async readWalletBalances(walletAddress: `0x${string}`): Promise<
    Array<{
      symbol: string;
      name: string;
      address: `0x${string}`;
      decimals: number;
      balanceAtomic: string;
      allowanceReactorAtomic: string;
      flag: string;
      region: string;
      fetchedAt: string;
      status: 'LIVE' | 'UNAVAILABLE';
      error?: string;
    }>
  > {
    const assets = Object.values(CELO_VERIFIED_ASSETS);
    const fetchedAt = new Date().toISOString();

    const results = await Promise.all(
      assets.map(async (asset) => {
        try {
          const [balance, allowance] = await Promise.all([
            this.publicClient.readContract({
              address: asset.address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [walletAddress],
            }),
            this.publicClient.readContract({
              address: asset.address,
              abi: erc20Abi,
              functionName: 'allowance',
              args: [walletAddress, TEXTILE_CONTRACTS.LimitOrderReactor],
            }),
          ]);

          let finalBalance = balance;
          if (asset.symbol === 'CELO') {
            try {
              const nativeBal = await this.publicClient.getBalance({ address: walletAddress });
              if (nativeBal > balance) {
                finalBalance = nativeBal;
              }
            } catch {}
          }

          return {
            symbol: asset.symbol,
            name: asset.name,
            address: asset.address,
            decimals: asset.decimals,
            balanceAtomic: finalBalance.toString(),
            allowanceReactorAtomic: allowance.toString(),
            flag: asset.flag,
            region: asset.region,
            fetchedAt,
            status: 'LIVE' as const,
          };
        } catch (err) {
          return {
            symbol: asset.symbol,
            name: asset.name,
            address: asset.address,
            decimals: asset.decimals,
            balanceAtomic: '0',
            allowanceReactorAtomic: '0',
            flag: asset.flag,
            region: asset.region,
            fetchedAt,
            status: 'UNAVAILABLE' as const,
            error: err instanceof Error ? err.message : 'RPC_UNAVAILABLE',
          };
        }
      })
    );

    return results;
  }

  /**
   * Verifies an onchain Celo transaction receipt and checks its ERC-8021 attribution tag.
   */
  async verifyTransactionAndAttribution(txHash: `0x${string}`): Promise<{
    confirmed: boolean;
    status: 'success' | 'reverted' | 'not_found';
    blockNumber?: string;
    gasUsed?: string;
    effectiveGasPrice?: string;
    attribution: { codes: string[]; schemaId: number } | null;
  }> {
    try {
      const [receipt, attribution] = await Promise.all([
        this.publicClient.getTransactionReceipt({ hash: txHash }),
        verifyTx({ client: this.publicClient as any, hash: txHash }),
      ]);
      return {
        confirmed: receipt.status === 'success',
        status: receipt.status,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
        attribution,
      };
    } catch {
      return {
        confirmed: false,
        status: 'not_found',
        attribution: null,
      };
    }
  }

  /**
   * Executes a validated FirmQuote on Celo Mainnet using the restricted signer
   * with `@celo/attribution-tags` `withAttribution` attached at the client level.
   */
  async executeValidatedQuoteOnchain(params: {
    quote: FirmQuote;
    sellToken: `0x${string}`;
    policyResult: PolicyEvaluationResult;
    attributionCode?: string;
  }): Promise<{
    approvalTxHash?: `0x${string}`;
    swapTxHash: `0x${string}`;
    blockNumber: string;
    gasUsed: string;
    attributionTag: string;
    attributionVerified: boolean;
    receipt?: any;
  }> {
    if (!this.isSignerConfigured()) {
      throw new Error(
        'SIGNER_NOT_CONFIGURED: Set AGENT_SIGNER_SECRET_REFERENCE to a funded Celo Mainnet private key to broadcast live transactions.'
      );
    }

    const privateKey = process.env.AGENT_SIGNER_SECRET_REFERENCE as Hex;
    const account = privateKeyToAccount(privateKey);
    const attrStatus = resolveAttributionTagStatus({
      explicitTag: params.attributionCode,
    });

    // Build walletClient extended with official `@celo/attribution-tags` `withAttribution`
    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(this.rpcUrl),
    }).extend(withAttribution(attrStatus.configuredTag));

    const currentAllowance = await this.publicClient.readContract({
      address: params.sellToken,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [account.address, TEXTILE_CONTRACTS.LimitOrderReactor],
    });

    const validation = validateQuoteBeforeSigning({
      quote: params.quote,
      policyResult: params.policyResult,
      expectedTaker: account.address,
      currentAllowanceAtomic: currentAllowance.toString(),
      attributionCode: attrStatus.configuredTag,
    });

    if (!validation.valid || !validation.taggedSwapCalldata) {
      throw new Error(
        `SIGNER_VALIDATION_REJECTED: ${validation.reasons.join('; ')}`
      );
    }

    let approvalTxHash: `0x${string}` | undefined;
    if (validation.approvalRequired && params.quote.quote) {
      approvalTxHash = await walletClient.writeContract({
        address: params.sellToken,
        abi: erc20Abi,
        functionName: 'approve',
        args: [
          params.quote.quote.reactor,
          BigInt(params.quote.quote.takerPays),
        ],
      });
      await this.publicClient.waitForTransactionReceipt({
        hash: approvalTxHash,
      });
    }

    // Re-check quote expiry after approval lands
    const expiresAtMs = Date.parse(params.quote.quote!.expiresAt);
    if (Date.now() + 1000 >= expiresAtMs) {
      throw new Error(
        'QUOTE_EXPIRED_AFTER_APPROVAL: Quote accept window closed while waiting for approval receipt.'
      );
    }

    const swapTxHash = await walletClient.sendTransaction({
      to: params.quote.transactions!.swap.to,
      data: validation.taggedSwapCalldata,
      value: 0n,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: swapTxHash,
    });

    const verifiedAttr = await verifyTx({
      client: this.publicClient as any,
      hash: swapTxHash,
    });

    return {
      approvalTxHash,
      swapTxHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
      attributionTag: attrStatus.configuredTag,
      attributionVerified: Boolean(
        verifiedAttr?.codes.includes(attrStatus.configuredTag)
      ),
      receipt,
    };
  }

  /**
   * Executes a direct Celo or ERC-20 transfer from the restricted agent wallet
   * with official attribution tagging.
   */
  async executeTransferOnchain(params: {
    tokenAddress: `0x${string}`;
    recipient: `0x${string}`;
    amountAtomic: string;
    attributionCode?: string;
  }): Promise<{
    txHash: `0x${string}`;
    blockNumber: string;
    gasUsed: string;
  }> {
    if (!this.isSignerConfigured()) {
      throw new Error(
        'SIGNER_NOT_CONFIGURED: Set AGENT_SIGNER_SECRET_REFERENCE to a funded Celo Mainnet private key to broadcast live transfers.'
      );
    }

    const privateKey = process.env.AGENT_SIGNER_SECRET_REFERENCE as Hex;
    const account = privateKeyToAccount(privateKey);
    const attrStatus = resolveAttributionTagStatus({
      explicitTag: params.attributionCode,
    });

    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(this.rpcUrl),
    }).extend(withAttribution(attrStatus.configuredTag));

    const isNativeCelo =
      params.tokenAddress.toLowerCase() ===
      '0x471ece3750da237f93b8e339c536989b8978a438'.toLowerCase();

    let txHash: `0x${string}`;

    if (isNativeCelo) {
      txHash = await walletClient.sendTransaction({
        to: params.recipient,
        value: BigInt(params.amountAtomic),
      });
    } else {
      txHash = await walletClient.writeContract({
        address: params.tokenAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [params.recipient, BigInt(params.amountAtomic)],
      });
    }

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    return {
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      gasUsed: receipt.gasUsed.toString(),
    };
  }
}

export const MoiWalletSigner = CeloChainService;
