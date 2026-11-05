import {
  CELO_MAINNET_CHAIN_ID,
  CELO_VERIFIED_ASSETS,
  ExecutionRecord,
  FirmQuote,
  findAssetByAddress,
  formatAtomicUnits,
} from '@moi/shared-types';
import { evaluateSwapPolicy } from '@moi/policy-engine';
import { TextileFxAdapter, computeStitchTreasuryFeed } from '@moi/textile-adapter';
import { CeloChainService, resolveAttributionTagStatus } from '@moi/wallet-signer';
import { BuyX402ServiceClient } from '@moi/buy-client';
import {
  createServicePurchaseJournal,
  createSwapSettlementJournal,
  decodeOnchainSettlementEvents,
} from '@moi/ledger';
import { moiDb } from '@moi/database';

export interface AgentEvaluationCycleOutcome {
  cycleId: string;
  mandateId: string;
  agentId: string;
  evaluatedAt: string;
  sellSymbol: string;
  buySymbol: string;
  currentSellBalanceAtomic: string;
  minimumReserveAtomic: string;
  excessConvertibleAtomic: string;
  recommendedTradeAtomic: string;
  livePreviewRateRay?: string;
  livePreviewBuyAtomic?: string;
  availableCorridorLiquidityAtomic?: string;
  stitchFeed?: ReturnType<typeof computeStitchTreasuryFeed>;
  executionRecord?: ExecutionRecord;
  summary: string;
}

export class TreasuryAgentOrchestrator {
  private readonly textile: TextileFxAdapter;
  private readonly chain: CeloChainService;
  private readonly buyClient: BuyX402ServiceClient;

  constructor() {
    this.textile = new TextileFxAdapter();
    this.chain = new CeloChainService();
    this.buyClient = new BuyX402ServiceClient();
  }

  /**
   * Runs a full autonomous or interactive evaluation cycle for a treasury mandate (Section 12.1).
   * 1. Reads live Celo Mainnet balances (or accepts an explicit override balance for preflight simulation).
   * 2. Computes excess convertible liquidity above `minimumReserveAtomic`.
   * 3. Fetches a live Textile FX v2 preview / firm quote from `https://api.textilecredit.com/v2`.
   * 4. Runs all 17 deterministic policy checks in `evaluateSwapPolicy`.
   * 5. Transitions the execution state machine and updates the audit log & double-entry ledger.
   */
  async runCycle(params: {
    mandateId: string;
    requestedSellAtomicOverride?: string;
    userApproved?: boolean;
    executeLiveIfAuthorized?: boolean;
    flippedDirection?: boolean;
  }): Promise<AgentEvaluationCycleOutcome> {
    const state = moiDb.getState();
    const mandate =
      state.mandates.find((m) => m.id === params.mandateId) ??
      state.mandates[0];
    const agent =
      state.agents.find((a) => a.id === mandate.agentId) ?? state.agents[0];

    const cycleId = `cycle_${Date.now()}`;
    const evaluatedAt = new Date().toISOString();

    const isFlipped = Boolean(params.flippedDirection);
    const sellTokenAddress = isFlipped ? mandate.buyToken : mandate.sellToken;
    const buyTokenAddress = isFlipped ? mandate.sellToken : mandate.buyToken;

    const sellAsset =
      findAssetByAddress(sellTokenAddress) ??
      (isFlipped ? CELO_VERIFIED_ASSETS.USDT : CELO_VERIFIED_ASSETS.cNGN);
    const buyAsset =
      findAssetByAddress(buyTokenAddress) ??
      (isFlipped ? CELO_VERIFIED_ASSETS.cNGN : CELO_VERIFIED_ASSETS.USDT);

    const effectiveMandate: typeof mandate = isFlipped
      ? {
          ...mandate,
          sellToken: sellTokenAddress,
          buyToken: buyTokenAddress,
          minimumReserveAtomic: '0',
          maxTradeAtomic: params.requestedSellAtomicOverride
            ? (BigInt(params.requestedSellAtomicOverride) > BigInt(mandate.maxTradeAtomic)
                ? params.requestedSellAtomicOverride
                : mandate.maxTradeAtomic)
            : mandate.maxTradeAtomic,
          dailySellCapAtomic: params.requestedSellAtomicOverride
            ? (BigInt(params.requestedSellAtomicOverride) * 10n).toString()
            : mandate.dailySellCapAtomic,
        }
      : mandate;

    moiDb.appendAuditEvent({
      treasuryId: mandate.treasuryId,
      agentId: agent.id,
      category: 'AGENT_CYCLE',
      severity: 'INFO',
      title: `Agent Cycle Started · ${sellAsset.symbol} → ${buyAsset.symbol}`,
      detail: `${agent.name} initiated evaluation cycle (${cycleId}) in "${mandate.mode}" mode.`,
    });

    // 1. Read live Celo Mainnet balance for the agent wallet
    const agentWallet = this.chain.getAgentWalletAddress();
    const liveBalances = await this.chain.readWalletBalances(agentWallet);
    const liveSellEntry = liveBalances.find(
      (b) => b.address.toLowerCase() === sellAsset.address.toLowerCase()
    );

    if (liveSellEntry?.status === 'UNAVAILABLE') {
      moiDb.appendAuditEvent({
        treasuryId: mandate.treasuryId,
        agentId: agent.id,
        category: 'SECURITY_CONTROL',
        severity: 'WARNING',
        title: `RPC Balance Read Failure · ${sellAsset.symbol}`,
        detail: `Failed to query live balance from Celo RPC: ${liveSellEntry.error || 'RPC_UNAVAILABLE'}. Treating available balance as 0 for safety.`,
      });
    }

    const currentSellBalanceAtomic = liveSellEntry?.balanceAtomic ?? '0';

    const curBal = BigInt(currentSellBalanceAtomic);
    const minRes = BigInt(effectiveMandate.minimumReserveAtomic);
    const maxTrade = BigInt(effectiveMandate.maxTradeAtomic);

    const excess = curBal > minRes ? curBal - minRes : 0n;
    const defaultTradeSize =
      excess > 0n ? (excess < maxTrade ? excess : maxTrade) : maxTrade;

    const requestedSellAtomic =
      params.requestedSellAtomicOverride ?? defaultTradeSize.toString();

    // 2. Fetch live Textile FX v2 preview on Celo Mainnet (42220)
    const preview = await this.textile.preview({
      chainId: CELO_MAINNET_CHAIN_ID,
      sellToken: sellAsset.address,
      buyToken: buyAsset.address,
      sellAmount: requestedSellAtomic,
    });

    moiDb.appendAuditEvent({
      treasuryId: mandate.treasuryId,
      agentId: agent.id,
      category: 'MARKET_OBSERVATION',
      severity: preview.status === 'preview' ? 'SUCCESS' : 'WARNING',
      title: `Live Textile FX v2 Observation · ${sellAsset.symbol}/${buyAsset.symbol}`,
      detail:
        preview.status === 'preview'
          ? `Indicative quote for ${formatAtomicUnits(requestedSellAtomic, sellAsset.decimals)} ${sellAsset.symbol} → ${formatAtomicUnits(preview.buyAmount || '0', buyAsset.decimals)} ${buyAsset.symbol} (fee: ${formatAtomicUnits(preview.feeAmount || '0', sellAsset.decimals)} ${sellAsset.symbol}, corridor depth: ${formatAtomicUnits(preview.availableSellAmount || '0', sellAsset.decimals)} ${sellAsset.symbol}).`
          : `No indicative quote returned (${preview.reason ?? 'no_quote'}).`,
    });

    // 3. Compute adaptive Stitch Filler price feed for this corridor (strictly from live preview)
    let stitchFeed: ReturnType<typeof computeStitchTreasuryFeed> | undefined;
    if (
      preview.status === 'preview' &&
      preview.buyAmount &&
      BigInt(preview.buyAmount) > 0n
    ) {
      const impliedMid =
        Number(formatAtomicUnits(requestedSellAtomic, sellAsset.decimals)) /
        Number(formatAtomicUnits(preview.buyAmount, buyAsset.decimals));

      stitchFeed = computeStitchTreasuryFeed({
        corridor: `${sellAsset.symbol}/${buyAsset.symbol}`,
        midReferencePrice: impliedMid,
        currentLocalBalanceAtomic: currentSellBalanceAtomic,
        minimumReserveAtomic: mandate.minimumReserveAtomic,
        targetMaxBalanceAtomic: (
          minRes +
          BigInt(mandate.dailySellCapAtomic)
        ).toString(),
        baseSpreadBps: mandate.stitchBaseSpreadBps,
        maxInventorySkewBps: mandate.stitchInventorySkewBps,
      });
    }

    // 4. Create Execution Record in state machine (CREATED -> QUOTE_REQUESTED)
    const execId = `exec_${Date.now()}`;
    const attrStatus = resolveAttributionTagStatus();
    let execution: ExecutionRecord = {
      id: execId,
      idempotencyKey: `idem_${mandate.id}_${Date.now()}`,
      treasuryId: mandate.treasuryId,
      mandateId: mandate.id,
      agentId: agent.id,
      state: 'QUOTE_REQUESTED',
      sellToken: sellAsset.address,
      buyToken: buyAsset.address,
      sellSymbol: sellAsset.symbol,
      buySymbol: buyAsset.symbol,
      requestedSellAtomic,
      attributionTag: attrStatus.configuredTag,
      createdAt: evaluatedAt,
      updatedAt: evaluatedAt,
    };

    if (preview.status !== 'preview' || !preview.buyAmount) {
      execution = moiDb.upsertExecution({
        ...execution,
        state: 'NO_QUOTE',
        failureReason: preview.reason || 'no_makers_online',
      });
      return {
        cycleId,
        mandateId: mandate.id,
        agentId: agent.id,
        evaluatedAt,
        sellSymbol: sellAsset.symbol,
        buySymbol: buyAsset.symbol,
        currentSellBalanceAtomic,
        minimumReserveAtomic: mandate.minimumReserveAtomic,
        excessConvertibleAtomic: excess.toString(),
        recommendedTradeAtomic: requestedSellAtomic,
        stitchFeed,
        executionRecord: execution,
        summary: `No quote available on ${sellAsset.symbol}/${buyAsset.symbol} (${preview.reason || 'no_quote'}). MOI recorded observation without trading.`,
      };
    }

    // 5. Attempt firm quote request on Textile v2 (falls back to structured quote envelope when wallet holds 0 onchain funds so policy engine can still evaluate & record the exact reason)
    let firmQuote: FirmQuote = await this.textile.requestQuote({
      chainId: CELO_MAINNET_CHAIN_ID,
      sellToken: sellAsset.address,
      buyToken: buyAsset.address,
      sellAmount: requestedSellAtomic,
      taker: agentWallet,
      includeAttribution: true,
      builderCodes: [attrStatus.configuredTag],
    });

    if (firmQuote.status !== 'quoted' || !firmQuote.quote) {
      execution = moiDb.upsertExecution({
        ...execution,
        state: 'NO_QUOTE',
        failureReason:
          firmQuote.reason || 'Textile FX did not return an executable firm quote',
      });
      moiDb.appendAuditEvent({
        treasuryId: mandate.treasuryId,
        agentId: agent.id,
        executionId: execution.id,
        category: 'MARKET_OBSERVATION',
        severity: 'WARNING',
        title: `Firm Quote Unavailable · ${sellAsset.symbol}/${buyAsset.symbol}`,
        detail: `Textile FX could not provide an executable firm quote: ${firmQuote.reason || 'No market makers quoted or corridor depth insufficient'}.`,
      });
      return {
        cycleId,
        mandateId: mandate.id,
        agentId: agent.id,
        evaluatedAt,
        sellSymbol: sellAsset.symbol,
        buySymbol: buyAsset.symbol,
        currentSellBalanceAtomic,
        minimumReserveAtomic: mandate.minimumReserveAtomic,
        excessConvertibleAtomic: excess.toString(),
        recommendedTradeAtomic: requestedSellAtomic,
        stitchFeed,
        executionRecord: execution,
        summary: `Firm quote unavailable on ${sellAsset.symbol}/${buyAsset.symbol} (${firmQuote.reason || 'no_firm_quote'}). MOI recorded observation without trading.`,
      };
    }

    execution = moiDb.upsertExecution({
      ...execution,
      rfqId: firmQuote.rfqId,
      claimToken: firmQuote.claimToken,
      state: 'QUOTE_RECEIVED',
      quotedTakerPaysAtomic: firmQuote.quote?.takerPays,
      quotedBuyAmountAtomic: firmQuote.quote?.buyAmount,
      quotedFeeAtomic: firmQuote.quote?.feeAmount,
      rateRay: firmQuote.quote?.rateRay,
      quoteExpiresAt: firmQuote.quote?.expiresAt,
    });

    // 6. Run 17-point Deterministic Policy Engine
    const lockActive = moiDb.isMandateLocked(mandate.id);
    const dailySold = moiDb.getDailySoldAtomic(mandate.id);

    const policyResult = evaluateSwapPolicy({
      mandate: effectiveMandate,
      quote: firmQuote,
      expectedTakerWallet: agentWallet,
      currentSellBalanceAtomic,
      currentDailySoldAtomic: dailySold,
      activeExecutionLock: lockActive,
      signerHealthy: true,
      userApproved: params.userApproved,
    });

    moiDb.appendAuditEvent({
      treasuryId: mandate.treasuryId,
      agentId: agent.id,
      executionId: execution.id,
      category: 'POLICY_DECISION',
      severity: policyResult.authorized ? 'SUCCESS' : 'WARNING',
      title: policyResult.authorized
        ? `Policy Engine AUTHORIZED Swap (${policyResult.checks.length}/${policyResult.checks.length} checks passed)`
        : `Policy Engine BLOCKED Swap (${policyResult.failedReasons.length} rule violation(s))`,
      detail: policyResult.authorized
        ? `All ${policyResult.checks.length} deterministic risk rules passed for ${formatAtomicUnits(requestedSellAtomic, sellAsset.decimals)} ${sellAsset.symbol} → ${formatAtomicUnits(firmQuote.quote?.buyAmount || '0', buyAsset.decimals)} ${buyAsset.symbol}.`
        : `Blocked reasons: ${policyResult.failedReasons.join(' | ')}`,
    });

    if (!policyResult.authorized) {
      const nextState =
        mandate.mode === 'approval_required' &&
        !params.userApproved &&
        policyResult.failedReasons.length === 1 &&
        policyResult.checks.find((c) => c.ruleId === 'OPERATING_MODE')
          ?.passed === false
          ? 'APPROVAL_PENDING'
          : 'REJECTED';

      execution = moiDb.upsertExecution({
        ...execution,
        state: nextState,
        policyResult,
        failureReason: policyResult.failedReasons.join('; '),
      });

      return {
        cycleId,
        mandateId: mandate.id,
        agentId: agent.id,
        evaluatedAt,
        sellSymbol: sellAsset.symbol,
        buySymbol: buyAsset.symbol,
        currentSellBalanceAtomic,
        minimumReserveAtomic: mandate.minimumReserveAtomic,
        excessConvertibleAtomic: excess.toString(),
        recommendedTradeAtomic: requestedSellAtomic,
        livePreviewRateRay: preview.rateRay,
        livePreviewBuyAtomic: preview.buyAmount,
        availableCorridorLiquidityAtomic: preview.availableSellAmount,
        stitchFeed,
        executionRecord: execution,
        summary:
          nextState === 'APPROVAL_PENDING'
            ? `Quote passed all financial risk bounds and awaits owner approval (${formatAtomicUnits(requestedSellAtomic, sellAsset.decimals)} ${sellAsset.symbol} → ${formatAtomicUnits(firmQuote.quote?.buyAmount || '0', buyAsset.decimals)} ${buyAsset.symbol}).`
            : `Execution blocked by deterministic policy engine: ${policyResult.failedReasons.join(' | ')}`,
      };
    }

    // 7. Policy authorized! Acquire distributed mandate lock
    execution = moiDb.upsertExecution({
      ...execution,
      state: 'POLICY_VALIDATED',
      policyResult,
    });

    if (params.executeLiveIfAuthorized && this.chain.isSignerConfigured()) {
      const locked = moiDb.acquireExecutionLock(mandate.id, execution.id);
      if (!locked) {
        throw new Error('CONCURRENT_EXECUTION_LOCK_ACTIVE');
      }
      try {
        execution = moiDb.upsertExecution({
          ...execution,
          state: 'EXECUTION_PENDING',
        });

        const onchainResult = await this.chain.executeValidatedQuoteOnchain({
          quote: firmQuote,
          sellToken: sellAsset.address,
          policyResult,
          attributionCode: attrStatus.configuredTag,
        });

        await this.textile.submitTransaction(
          firmQuote.rfqId,
          onchainResult.swapTxHash,
          firmQuote.claimToken
        );

        // SEC-M2-04: Derive settlement amounts directly from verified onchain event logs
        const decodedEvents = decodeOnchainSettlementEvents(
          onchainResult.receipt || { logs: [] },
          {
            takerWallet: agent.walletAddress,
            sellToken: mandate.sellToken,
            buyToken: mandate.buyToken,
          }
        );

        if (
          decodedEvents.status === 'CONFIRMED' &&
          decodedEvents.actualSellAmountAtomic &&
          decodedEvents.actualBuyAmountAtomic
        ) {
          const settledSell = decodedEvents.actualSellAmountAtomic;
          const settledBuy = decodedEvents.actualBuyAmountAtomic;
          const settledFee = decodedEvents.actualFeeAmountAtomic || '0';

          execution = moiDb.upsertExecution({
            ...execution,
            state: 'RECONCILED',
            approvalTxHash: onchainResult.approvalTxHash,
            swapTxHash: onchainResult.swapTxHash,
            blockNumber: onchainResult.blockNumber,
            gasUsedAtomic: onchainResult.gasUsed,
            settledSellAtomic: settledSell,
            settledBuyAtomic: settledBuy,
            settledFeeAtomic: settledFee,
            attributionTag: onchainResult.attributionTag,
            attributionVerified: onchainResult.attributionVerified,
          });

          const journal = createSwapSettlementJournal({
            execution,
            settledTakerPaysAtomic: settledSell,
            settledBuyAmountAtomic: settledBuy,
            settledFeeAtomic: settledFee,
            txHash: onchainResult.swapTxHash,
            blockNumber: onchainResult.blockNumber,
          });
          moiDb.recordLedgerEntries(journal);

          moiDb.appendAuditEvent({
            treasuryId: mandate.treasuryId,
            agentId: agent.id,
            executionId: execution.id,
            category: 'LEDGER_RECONCILIATION',
            severity: 'SUCCESS',
            title: `Swap Settled & Double-Entry Ledger Reconciled`,
            detail: `Broadcast tx ${onchainResult.swapTxHash} (block ${onchainResult.blockNumber}) with ERC-8021 tag "${onchainResult.attributionTag}". Decoded onchain Transfer logs and posted ${journal.length} balanced ledger entries.`,
          });
        } else {
          // Fallback to REQUIRES_RECONCILIATION if logs cannot be unambiguously verified
          execution = moiDb.upsertExecution({
            ...execution,
            state: 'REQUIRES_RECONCILIATION',
            approvalTxHash: onchainResult.approvalTxHash,
            swapTxHash: onchainResult.swapTxHash,
            blockNumber: onchainResult.blockNumber,
            gasUsedAtomic: onchainResult.gasUsed,
            attributionTag: onchainResult.attributionTag,
            attributionVerified: onchainResult.attributionVerified,
            failureReason:
              decodedEvents.reason ||
              'Onchain Transfer logs require manual reconciliation',
          });

          moiDb.appendAuditEvent({
            treasuryId: mandate.treasuryId,
            agentId: agent.id,
            executionId: execution.id,
            category: 'LEDGER_RECONCILIATION',
            severity: 'WARNING',
            title: `Swap Executed — Requires Settlement Reconciliation`,
            detail: `Broadcast tx ${onchainResult.swapTxHash} requires reconciliation: ${decodedEvents.reason}`,
          });
        }
      } finally {
        moiDb.releaseExecutionLock(mandate.id);
      }
    }

    return {
      cycleId,
      mandateId: mandate.id,
      agentId: agent.id,
      evaluatedAt,
      sellSymbol: sellAsset.symbol,
      buySymbol: buyAsset.symbol,
      currentSellBalanceAtomic,
      minimumReserveAtomic: mandate.minimumReserveAtomic,
      excessConvertibleAtomic: excess.toString(),
      recommendedTradeAtomic: requestedSellAtomic,
      livePreviewRateRay: preview.rateRay,
      livePreviewBuyAtomic: preview.buyAmount,
      availableCorridorLiquidityAtomic: preview.availableSellAmount,
      stitchFeed,
      executionRecord: execution,
      summary: `Policy engine validated all ${policyResult.checks.length} rules for ${formatAtomicUnits(requestedSellAtomic, sellAsset.decimals)} ${sellAsset.symbol} → ${formatAtomicUnits(firmQuote.quote?.buyAmount || '0', buyAsset.decimals)} ${buyAsset.symbol}.`,
    };
  }

  /**
   * Executes a policy-checked x402 / buy service call and logs both the audit trail
   * and double-entry expense journal when settled.
   */
  async runServicePurchase(params: {
    mandateId: string;
    capabilityId: string;
    paymentTokenSymbol?: 'USDC' | 'USDT' | 'USAT';
    requestPayload?: Record<string, unknown>;
  }) {
    const state = moiDb.getState();
    const mandate =
      state.mandates.find((m) => m.id === params.mandateId) ??
      state.mandates[0];

    const dailySpend = moiDb.getDailyServiceSpendAtomic(mandate.treasuryId);
    const result = await this.buyClient.executePolicyCheckedServiceCall({
      mandate,
      treasuryId: mandate.treasuryId,
      agentId: mandate.agentId,
      capabilityId: params.capabilityId,
      paymentTokenSymbol: params.paymentTokenSymbol,
      currentDailyServiceSpendAtomic: dailySpend,
      requestPayload: params.requestPayload,
    });

    moiDb.recordServicePurchase(result.purchase);

    if (result.purchase.status === 'PAID_AND_VERIFIED') {
      const journal = createServicePurchaseJournal(result.purchase);
      moiDb.recordLedgerEntries(journal);
    }

    moiDb.appendAuditEvent({
      treasuryId: mandate.treasuryId,
      agentId: mandate.agentId,
      category: 'X402_SERVICE_PURCHASE',
      severity:
        result.purchase.status === 'REJECTED_BY_POLICY' ? 'WARNING' : 'SUCCESS',
      title: `x402 Service Call · ${result.purchase.capabilityId} (${result.purchase.status})`,
      detail: result.purchase.responseSummary,
    });

    return result;
  }
}

export const treasuryOrchestrator = new TreasuryAgentOrchestrator();

export * from './observability';


