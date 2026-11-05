import {
  AssetSymbol,
  CELO_VERIFIED_ASSETS,
  ExecutionRecord,
  LedgerEntryRecord,
  ServicePurchaseRecord,
} from '@moi/shared-types';

export interface JournalVerificationResult {
  balanced: boolean;
  totalsByAsset: Record<string, { debit: bigint; credit: bigint }>;
}

/**
 * Verifies that for every asset within a journal or ledger set,
 * total DEBIT atomic units === total CREDIT atomic units.
 */
export function verifyDoubleEntryBalance(
  entries: LedgerEntryRecord[]
): JournalVerificationResult {
  const totalsByAsset: Record<string, { debit: bigint; credit: bigint }> = {};

  for (const entry of entries) {
    const key = entry.assetSymbol;
    if (!totalsByAsset[key]) {
      totalsByAsset[key] = { debit: 0n, credit: 0n };
    }
    const amt = BigInt(entry.amountAtomic);
    if (entry.direction === 'DEBIT') {
      totalsByAsset[key].debit += amt;
    } else {
      totalsByAsset[key].credit += amt;
    }
  }

  const balanced = Object.values(totalsByAsset).every(
    (t) => t.debit === t.credit
  );

  return { balanced, totalsByAsset };
}

/**
 * Creates a strictly balanced double-entry accounting journal for a settled FX conversion (Section 13.3).
 *
 * Leg 1 (Sell Asset):
 *   - CREDIT: TREASURY_ASSET:<sellSymbol> (total takerPays leaving treasury)
 *   - DEBIT:  FX_SETTLEMENT_CLEARING:<sellSymbol> (net principal converted = takerPays - feeAmount)
 *   - DEBIT:  PROTOCOL_FEE_EXPENSE:<sellSymbol> (Textile 1 bps protocol fee)
 *
 * Leg 2 (Buy Asset):
 *   - DEBIT:  TREASURY_ASSET:<buySymbol> (actual buyAmount received by treasury)
 *   - CREDIT: FX_SETTLEMENT_CLEARING:<buySymbol> (counter-entry for FX conversion acquisition)
 */
export function createSwapSettlementJournal(params: {
  execution: ExecutionRecord;
  settledTakerPaysAtomic: string;
  settledBuyAmountAtomic: string;
  settledFeeAtomic: string;
  txHash: `0x${string}`;
  blockNumber?: string;
}): LedgerEntryRecord[] {
  const { execution } = params;
  const sellMeta = CELO_VERIFIED_ASSETS[execution.sellSymbol];
  const buyMeta = CELO_VERIFIED_ASSETS[execution.buySymbol];
  const now = new Date().toISOString();
  const journalId = `jrnl_swap_${execution.id}`;

  const totalSellDebit = BigInt(params.settledTakerPaysAtomic);
  const feeAmt = BigInt(params.settledFeeAtomic || '0');
  const netPrincipalSell =
    totalSellDebit >= feeAmt ? totalSellDebit - feeAmt : totalSellDebit;

  const entries: LedgerEntryRecord[] = [
    // Sell-side Credit (Asset reduction)
    {
      id: `${journalId}_1`,
      journalId,
      executionId: execution.id,
      treasuryId: execution.treasuryId,
      accountCode: `1010-${execution.sellSymbol}`,
      accountName: `Treasury Asset · ${execution.sellSymbol}`,
      accountType: 'ASSET',
      direction: 'CREDIT',
      assetSymbol: execution.sellSymbol,
      amountAtomic: totalSellDebit.toString(),
      decimals: sellMeta.decimals,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      memo: `Outflow of ${execution.sellSymbol} for Textile FX RFQ ${execution.rfqId ?? execution.id}`,
      createdAt: now,
    },
    // Sell-side Debit (FX Settlement Clearing)
    {
      id: `${journalId}_2`,
      journalId,
      executionId: execution.id,
      treasuryId: execution.treasuryId,
      accountCode: `3010-${execution.sellSymbol}`,
      accountName: `FX Conversion Clearing · ${execution.sellSymbol}`,
      accountType: 'CLEARING',
      direction: 'DEBIT',
      assetSymbol: execution.sellSymbol,
      amountAtomic: netPrincipalSell.toString(),
      decimals: sellMeta.decimals,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      memo: `Net principal converted in ${execution.sellSymbol} → ${execution.buySymbol}`,
      createdAt: now,
    },
  ];

  if (feeAmt > 0n) {
    entries.push({
      id: `${journalId}_3`,
      journalId,
      executionId: execution.id,
      treasuryId: execution.treasuryId,
      accountCode: `5010-${execution.sellSymbol}`,
      accountName: `Textile Protocol Fee Expense · ${execution.sellSymbol}`,
      accountType: 'EXPENSE',
      direction: 'DEBIT',
      assetSymbol: execution.sellSymbol,
      amountAtomic: feeAmt.toString(),
      decimals: sellMeta.decimals,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      memo: `1 bps Textile FX protocol fee on ${execution.sellSymbol}`,
      createdAt: now,
    });
  }

  // Buy-side Debit (Asset increase) & Credit (FX Settlement Clearing)
  entries.push(
    {
      id: `${journalId}_4`,
      journalId,
      executionId: execution.id,
      treasuryId: execution.treasuryId,
      accountCode: `1010-${execution.buySymbol}`,
      accountName: `Treasury Asset · ${execution.buySymbol}`,
      accountType: 'ASSET',
      direction: 'DEBIT',
      assetSymbol: execution.buySymbol,
      amountAtomic: params.settledBuyAmountAtomic,
      decimals: buyMeta.decimals,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      memo: `Settled inflow of ${execution.buySymbol} from LimitOrderReactor`,
      createdAt: now,
    },
    {
      id: `${journalId}_5`,
      journalId,
      executionId: execution.id,
      treasuryId: execution.treasuryId,
      accountCode: `3010-${execution.buySymbol}`,
      accountName: `FX Conversion Clearing · ${execution.buySymbol}`,
      accountType: 'CLEARING',
      direction: 'CREDIT',
      assetSymbol: execution.buySymbol,
      amountAtomic: params.settledBuyAmountAtomic,
      decimals: buyMeta.decimals,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      memo: `Counter-entry for ${execution.buySymbol} settled via Textile FX`,
      createdAt: now,
    }
  );

  const check = verifyDoubleEntryBalance(entries);
  if (!check.balanced) {
    throw new Error(
      `LEDGER_INVARIANT_VIOLATION: Journal ${journalId} is not balanced.`
    );
  }

  return entries;
}

/**
 * Creates a balanced double-entry journal for an x402 / buy external service purchase.
 */
export function createServicePurchaseJournal(
  purchase: ServicePurchaseRecord
): LedgerEntryRecord[] {
  const tokenMeta = CELO_VERIFIED_ASSETS[purchase.paymentTokenSymbol];
  const journalId = `jrnl_x402_${purchase.id}`;
  const now = new Date().toISOString();

  const entries: LedgerEntryRecord[] = [
    {
      id: `${journalId}_1`,
      journalId,
      servicePurchaseId: purchase.id,
      executionId: purchase.executionId,
      treasuryId: purchase.treasuryId,
      accountCode: `5020-${purchase.paymentTokenSymbol}`,
      accountName: `Agent Service Expense (x402 / buy) · ${purchase.paymentTokenSymbol}`,
      accountType: 'EXPENSE',
      direction: 'DEBIT',
      assetSymbol: purchase.paymentTokenSymbol,
      amountAtomic: purchase.amountAtomic,
      decimals: tokenMeta.decimals,
      txHash: purchase.paymentTxHash,
      memo: `x402 payment to ${purchase.providerName} (${purchase.capabilityId})`,
      createdAt: now,
    },
    {
      id: `${journalId}_2`,
      journalId,
      servicePurchaseId: purchase.id,
      executionId: purchase.executionId,
      treasuryId: purchase.treasuryId,
      accountCode: `1010-${purchase.paymentTokenSymbol}`,
      accountName: `Treasury Asset · ${purchase.paymentTokenSymbol}`,
      accountType: 'ASSET',
      direction: 'CREDIT',
      assetSymbol: purchase.paymentTokenSymbol,
      amountAtomic: purchase.amountAtomic,
      decimals: tokenMeta.decimals,
      txHash: purchase.paymentTxHash,
      memo: `Outflow for x402 service call ${purchase.capabilityId}`,
      createdAt: now,
    },
  ];

  return entries;
}

/**
 * Computes separate Treasury Accounting & Strategy Metrics (Section 13.4)
 */
export function computeTreasuryAnalytics(params: {
  executions: ExecutionRecord[];
  servicePurchases: ServicePurchaseRecord[];
}) {
  let totalRfqCount = 0;
  let quotesReceivedCount = 0;
  let noQuoteCount = 0;
  let policyRejectedCount = 0;
  let settledSwapsCount = 0;
  let quotedBuyVolumeUsdtAtomic = 0n;
  let filledBuyVolumeUsdtAtomic = 0n;
  let totalServiceSpendAtomic = 0n;

  for (const ex of params.executions) {
    totalRfqCount += 1;
    if (ex.state === 'NO_QUOTE') {
      noQuoteCount += 1;
    } else if (ex.quotedBuyAmountAtomic) {
      quotesReceivedCount += 1;
      if (ex.buySymbol === 'USDT' || ex.buySymbol === 'USDC' || ex.buySymbol === 'USAT') {
        quotedBuyVolumeUsdtAtomic += BigInt(ex.quotedBuyAmountAtomic);
      }
    }

    if (ex.state === 'REJECTED') {
      policyRejectedCount += 1;
    }

    if (ex.state === 'CONFIRMED' || ex.state === 'RECONCILED') {
      settledSwapsCount += 1;
      const settledBuy = ex.settledBuyAtomic || ex.quotedBuyAmountAtomic || '0';
      if (ex.buySymbol === 'USDT' || ex.buySymbol === 'USDC' || ex.buySymbol === 'USAT') {
        filledBuyVolumeUsdtAtomic += BigInt(settledBuy);
      }
    }
  }

  for (const sp of params.servicePurchases) {
    if (sp.status === 'PAID_AND_VERIFIED' || sp.status === 'AUTHORIZED') {
      totalServiceSpendAtomic += BigInt(sp.amountAtomic);
    }
  }

  return {
    totalRfqCount,
    quotesReceivedCount,
    noQuoteCount,
    noQuoteRatePct:
      totalRfqCount > 0 ? Math.round((noQuoteCount / totalRfqCount) * 100) : 0,
    policyRejectedCount,
    settledSwapsCount,
    quotedBuyVolumeUsdtAtomic: quotedBuyVolumeUsdtAtomic.toString(),
    filledBuyVolumeUsdtAtomic: filledBuyVolumeUsdtAtomic.toString(),
    totalServiceSpendAtomic: totalServiceSpendAtomic.toString(),
    benchmarkMethodology:
      'Execution quality is measured in basis points against live Textile v2 indicative mid-preview at quote timestamp. Ordinary currency conversion from cNGN/wARS/wBRL into USD₮ is booked as a balance-sheet asset conversion, never misrepresented as trading profit.',
  };
}

// =========================================================================
// MILESTONE 2.5: EVENT-DRIVEN SETTLEMENT ACCOUNTING (SEC-M2-04)
// =========================================================================

export const ERC20_TRANSFER_EVENT_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface DecodedTransferEvent {
  contractAddress: `0x${string}`;
  from: `0x${string}`;
  to: `0x${string}`;
  valueAtomic: string;
  logIndex?: number;
}

export interface DecodedSettlementEventsResult {
  status: 'CONFIRMED' | 'REQUIRES_RECONCILIATION';
  actualSellAmountAtomic?: string;
  actualBuyAmountAtomic?: string;
  actualFeeAmountAtomic?: string;
  sellTransfers: DecodedTransferEvent[];
  buyTransfers: DecodedTransferEvent[];
  reason?: string;
}

/**
 * Decodes actual ERC-20 Transfer event logs from an onchain transaction receipt.
 * Enforces SEC-M2-04: Ledger settlement amounts must reflect verified onchain event logs,
 * never unverified offchain quote parameters.
 */
export function decodeOnchainSettlementEvents(
  receipt: {
    status?: string | number | boolean;
    logs?: Array<{
      address: string;
      topics?: string[];
      data?: string;
      logIndex?: number;
    }>;
  },
  expected: {
    takerWallet: `0x${string}`;
    sellToken: `0x${string}`;
    buyToken: `0x${string}`;
    feeController?: `0x${string}`;
  }
): DecodedSettlementEventsResult {
  if (!receipt) {
    return {
      status: 'REQUIRES_RECONCILIATION',
      sellTransfers: [],
      buyTransfers: [],
      reason: 'Transaction receipt is missing or null.',
    };
  }

  // Check receipt status if present
  if (
    receipt.status === 'reverted' ||
    receipt.status === 0 ||
    receipt.status === '0x0' ||
    receipt.status === false
  ) {
    return {
      status: 'REQUIRES_RECONCILIATION',
      sellTransfers: [],
      buyTransfers: [],
      reason: 'Onchain transaction execution reverted or failed.',
    };
  }

  const logs = receipt.logs || [];
  if (logs.length === 0) {
    return {
      status: 'REQUIRES_RECONCILIATION',
      sellTransfers: [],
      buyTransfers: [],
      reason:
        'Transaction receipt contains 0 logs; cannot verify token transfer events.',
    };
  }

  const cleanAddr = (addr: string): `0x${string}` => {
    const raw = addr.toLowerCase();
    if (raw.length === 66) {
      return `0x${raw.slice(26)}` as `0x${string}`;
    }
    return raw as `0x${string}`;
  };

  const sellTransfers: DecodedTransferEvent[] = [];
  const buyTransfers: DecodedTransferEvent[] = [];

  const expectedTaker = expected.takerWallet.toLowerCase();
  const expectedSell = expected.sellToken.toLowerCase();
  const expectedBuy = expected.buyToken.toLowerCase();

  for (const log of logs) {
    const topics = log.topics || [];
    if (
      topics.length >= 3 &&
      topics[0].toLowerCase() === ERC20_TRANSFER_EVENT_TOPIC
    ) {
      const contract = log.address.toLowerCase() as `0x${string}`;
      const from = cleanAddr(topics[1]);
      const to = cleanAddr(topics[2]);
      let valueAtomic = '0';
      try {
        valueAtomic = BigInt(
          log.data && log.data !== '0x' ? log.data : '0'
        ).toString();
      } catch {
        valueAtomic = '0';
      }

      const decoded: DecodedTransferEvent = {
        contractAddress: contract,
        from,
        to,
        valueAtomic,
        logIndex: log.logIndex,
      };

      if (contract === expectedSell && from === expectedTaker) {
        sellTransfers.push(decoded);
      }
      if (contract === expectedBuy && to === expectedTaker) {
        buyTransfers.push(decoded);
      }
    }
  }

  // Verify that we found genuine transfers
  if (sellTransfers.length === 0 || buyTransfers.length === 0) {
    return {
      status: 'REQUIRES_RECONCILIATION',
      sellTransfers,
      buyTransfers,
      reason: `Ambiguous or missing onchain event logs: found ${sellTransfers.length} sell transfers and ${buyTransfers.length} buy transfers.`,
    };
  }

  // Sum total sell outflow from taker wallet
  const totalSellAtomic = sellTransfers.reduce(
    (acc, t) => acc + BigInt(t.valueAtomic),
    0n
  );
  // Sum total buy inflow to taker wallet
  const totalBuyAtomic = buyTransfers.reduce(
    (acc, t) => acc + BigInt(t.valueAtomic),
    0n
  );

  return {
    status: 'CONFIRMED',
    actualSellAmountAtomic: totalSellAtomic.toString(),
    actualBuyAmountAtomic: totalBuyAtomic.toString(),
    actualFeeAmountAtomic: '0',
    sellTransfers,
    buyTransfers,
  };
}

