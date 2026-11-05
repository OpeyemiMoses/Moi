import fs from 'node:fs';
import path from 'node:path';
import { MoiPostgresEngine } from './postgres-engine';
import { MoiDatabaseState } from './index';

export interface MigrationSummary {
  timestamp: string;
  backupPath: string;
  sourceRecordCounts: Record<string, number>;
  migratedRecordCounts: Record<string, number>;
  financialTotalsBefore: {
    totalRequestedSellAtomic: string;
    totalSettledSellAtomic: string;
    totalSettledBuyAtomic: string;
    totalSettledFeeAtomic: string;
  };
  financialTotalsAfter: {
    totalRequestedSellAtomic: string;
    totalSettledSellAtomic: string;
    totalSettledBuyAtomic: string;
    totalSettledFeeAtomic: string;
  };
  reconciled: boolean;
  warnings: string[];
  repairs: string[];
}

export async function runSafePostgresMigration(
  postgresEngine: MoiPostgresEngine,
  sourceJsonPath: string = path.resolve(process.cwd(), 'data/moi-store.json')
): Promise<MigrationSummary> {
  // 1. Validate file exists
  if (!fs.existsSync(sourceJsonPath)) {
    throw new Error(`Migration source file not found at: ${sourceJsonPath}`);
  }

  // 2. Create timestamped recoverable backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${sourceJsonPath}.backup_${timestamp}`;
  fs.copyFileSync(sourceJsonPath, backupPath);

  // 3. Read and parse JSON store
  const raw = fs.readFileSync(sourceJsonPath, 'utf-8');
  const state: MoiDatabaseState = JSON.parse(raw);

  await postgresEngine.initialize();

  const warnings: string[] = [];
  const repairs: string[] = [];

  const sourceCounts: Record<string, number> = {
    users: (state.registeredUsers?.length || 0) + (state.userProfile ? 1 : 0),
    treasuries: (state.treasuries?.length || 0) + (state.treasury ? 1 : 0),
    agents: state.agents?.length || 0,
    mandates: state.mandates?.length || 0,
    executions: state.executions?.length || 0,
    ledgerEntries: state.ledgerEntries?.length || 0,
    servicePurchases: state.servicePurchases?.length || 0,
    auditEvents: state.auditEvents?.length || 0,
    sessions: state.sessions?.length || 0,
    nonces: state.nonces?.length || 0,
  };

  // Compute pre-migration financial totals
  let preReqSell = 0n;
  let preSetSell = 0n;
  let preSetBuy = 0n;
  let preSetFee = 0n;

  for (const ex of state.executions || []) {
    preReqSell += BigInt(ex.requestedSellAtomic || '0');
    preSetSell += BigInt(ex.settledSellAtomic || '0');
    preSetBuy += BigInt(ex.settledBuyAtomic || '0');
    preSetFee += BigInt(ex.settledFeeAtomic || '0');
  }

  // 4. Begin transactional data migration
  await postgresEngine.adminExec('BEGIN;');
  try {
    // A. Migrate Users (deduplicate by id and walletAddress)
    const userMap = new Map<string, any>();
    const walletToUserMap = new Map<string, any>();

    if (state.userProfile && state.userProfile.id) {
      userMap.set(state.userProfile.id, state.userProfile);
      if (state.userProfile.walletAddress) {
        walletToUserMap.set(state.userProfile.walletAddress.toLowerCase(), state.userProfile);
      }
    }
    for (const u of state.registeredUsers || []) {
      if (u.id && !userMap.has(u.id)) {
        userMap.set(u.id, u);
        if (u.walletAddress) {
          walletToUserMap.set(u.walletAddress.toLowerCase(), u);
        }
      }
    }

    for (const user of userMap.values()) {
      await postgresEngine.adminQuery(
        `INSERT INTO users (
          id, email, wallet_address, name, role, company, avatar_initials,
          notify_on_policy_reject, notify_on_swap_settled, notify_on_x402_purchase,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          company = EXCLUDED.company,
          updated_at = NOW();`,
        [
          user.id,
          user.email || null,
          user.walletAddress,
          user.displayName || user.name || 'Treasury Operator',
          user.roleTitle || user.role || 'treasurer',
          user.organization || user.company || null,
          user.avatarInitials || 'TO',
          user.notifyOnPolicyReject !== undefined ? user.notifyOnPolicyReject : true,
          user.notifyOnSwapSettled !== undefined ? user.notifyOnSwapSettled : true,
          user.notifyOnX402Purchase !== undefined ? user.notifyOnX402Purchase : true,
          new Date(user.updatedAt || Date.now()),
          new Date(user.updatedAt || Date.now()),
        ]
      );
    }

    // B. Migrate Treasuries (sanitize malformed IDs)
    const treasuryMap = new Map<string, any>();
    if (state.treasury && state.treasury.id) {
      treasuryMap.set(state.treasury.id, state.treasury);
    }
    for (const t of state.treasuries || []) {
      if (!t.id) continue;

      let sanitizedId = t.id;
      let ownerId = typeof t.ownerUserId === 'string' ? t.ownerUserId : null;

      // Handle malformed treasury_[object Object]
      if (sanitizedId === 'treasury_[object Object]' || typeof t.ownerUserId === 'object') {
        const matchingUser = t.ownerWalletAddress
          ? walletToUserMap.get(t.ownerWalletAddress.toLowerCase())
          : null;
        if (matchingUser) {
          sanitizedId = `treasury_${matchingUser.id}`;
          ownerId = matchingUser.id;
          repairs.push(`Repaired malformed treasury ID "treasury_[object Object]" -> "${sanitizedId}" for wallet ${t.ownerWalletAddress}`);
        } else {
          warnings.push(`Discarded orphan malformed treasury: ${t.id}`);
          continue;
        }
      }

      if (ownerId && !userMap.has(ownerId)) {
        warnings.push(`Treasury ${sanitizedId} references non-existent owner ${ownerId}. Setting NULL.`);
        ownerId = null;
      }

      const normalizedTreasury = {
        ...t,
        id: sanitizedId,
        ownerUserId: ownerId,
      };

      treasuryMap.set(sanitizedId, normalizedTreasury);
    }

    for (const t of treasuryMap.values()) {
      await postgresEngine.adminQuery(
        `INSERT INTO treasuries (
          id, owner_user_id, name, owner_wallet_address, agent_wallet_address, chain_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          owner_wallet_address = EXCLUDED.owner_wallet_address,
          agent_wallet_address = EXCLUDED.agent_wallet_address,
          updated_at = NOW();`,
        [
          t.id,
          t.ownerUserId || null,
          t.name,
          t.ownerWalletAddress,
          t.agentWalletAddress,
          t.chainId || 42220,
          new Date(t.createdAt || Date.now()),
          new Date(t.updatedAt || Date.now()),
        ]
      );
    }

    // C. Migrate Agents (sanitize malformed treasury references)
    for (const a of state.agents || []) {
      let targetTreasuryId = a.treasuryId;
      if (targetTreasuryId === 'treasury_[object Object]') {
        const match = Array.from(treasuryMap.values()).find(
          (t) => t.ownerWalletAddress?.toLowerCase() === a.walletAddress?.toLowerCase()
        );
        if (match) {
          targetTreasuryId = match.id;
          repairs.push(`Repaired agent ${a.id} target treasury -> ${targetTreasuryId}`);
        }
      }

      if (!treasuryMap.has(targetTreasuryId)) {
        warnings.push(`Agent ${a.id} references orphaned treasury ${a.treasuryId}. Skipped.`);
        continue;
      }

      let agentId = a.id;
      if (agentId.includes('[object Object]')) {
        agentId = agentId.replace('[object Object]', targetTreasuryId.replace('treasury_', ''));
        repairs.push(`Repaired malformed agent ID -> ${agentId}`);
      }

      await postgresEngine.adminQuery(
        `INSERT INTO agents (
          id, treasury_id, name, role, description, wallet_address,
          erc8004_agent_id, erc8004_registry, active, mandate_id, last_cycle_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          description = EXCLUDED.description,
          active = EXCLUDED.active,
          last_cycle_at = EXCLUDED.last_cycle_at;`,
        [
          agentId,
          targetTreasuryId,
          a.name,
          a.role,
          a.description,
          a.walletAddress,
          a.erc8004AgentId || null,
          a.erc8004Registry || '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
          a.active !== undefined ? a.active : true,
          a.mandateId,
          a.lastCycleAt ? new Date(a.lastCycleAt) : null,
          new Date(a.createdAt || Date.now()),
        ]
      );
    }

    // D. Migrate Mandates (sanitize string spreads & malformed IDs)
    for (const m of state.mandates || []) {
      let mandateId = m.id;
      let targetTreasuryId = m.treasuryId;

      // Detect spread string artifact: e.g. {"0": "m", "1": "a", ...}
      const rawRecord = m as Record<string, unknown>;
      if (!mandateId && rawRecord['0'] === 'm' && rawRecord['1'] === 'a') {
        const reconstructed = Object.keys(m)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => (m as any)[k])
          .join('');
        repairs.push(`Reconstructed mandate ID from spread string artifact -> "${reconstructed}"`);
        mandateId = reconstructed;
      }

      if (!mandateId) {
        warnings.push(`Skipped nameless/corrupt mandate record with no ID.`);
        continue;
      }

      if (targetTreasuryId === 'treasury_[object Object]') {
        // Resolve to primary or matching treasury
        const match = Array.from(treasuryMap.values()).find(
          (t) => t.id !== 'treasury_main'
        ) || treasuryMap.get('treasury_main');
        if (match) {
          targetTreasuryId = match.id;
          repairs.push(`Repaired mandate ${mandateId} target treasury -> ${targetTreasuryId}`);
        }
      }

      if (mandateId.includes('[object Object]')) {
        mandateId = mandateId.replace('[object Object]', targetTreasuryId.replace('treasury_', ''));
        repairs.push(`Repaired malformed mandate ID -> ${mandateId}`);
      }

      if (!treasuryMap.has(targetTreasuryId)) {
        warnings.push(`Mandate ${mandateId} references orphaned treasury ${targetTreasuryId}. Skipped.`);
        continue;
      }

      await postgresEngine.adminQuery(
        `INSERT INTO mandates (
          id, treasury_id, agent_id, name, natural_language_intent, mode, execution_strategy, chain_id,
          sell_token, buy_token, minimum_reserve_atomic, max_trade_atomic, daily_sell_cap_atomic,
          min_buy_amount_atomic, max_slippage_bps, max_protocol_fee_bps, max_daily_loss_atomic,
          allowed_targets, service_spend_per_call_atomic, service_daily_cap_atomic,
          stitch_base_spread_bps, stitch_inventory_skew_bps, paused, version, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          minimum_reserve_atomic = EXCLUDED.minimum_reserve_atomic,
          max_trade_atomic = EXCLUDED.max_trade_atomic,
          daily_sell_cap_atomic = EXCLUDED.daily_sell_cap_atomic,
          paused = EXCLUDED.paused,
          updated_at = NOW();`,
        [
          mandateId,
          targetTreasuryId,
          m.agentId || 'agent_fx_treasury',
          m.name || 'Celo Operating Mandate',
          m.naturalLanguageIntent || null,
          m.mode || 'approval_required',
          m.executionStrategy || 'hybrid',
          m.chainId || 42220,
          m.sellToken || '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f',
          m.buyToken || '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
          m.minimumReserveAtomic || '50000000000',
          m.maxTradeAtomic || '25000000000',
          m.dailySellCapAtomic || '100000000000',
          m.minBuyAmountAtomic || null,
          m.maxSlippageBps || 100,
          m.maxProtocolFeeBps || 25,
          m.maxDailyLossAtomic || null,
          m.allowedTargets || [],
          m.serviceSpendPerCallAtomic || '50000',
          m.serviceDailyCapAtomic || '500000',
          m.stitchBaseSpreadBps || 18,
          m.stitchInventorySkewBps || 12,
          Boolean(m.paused),
          1,
          new Date(m.updatedAt || Date.now()),
        ]
      );
    }

    // E. Migrate Executions
    for (const ex of state.executions || []) {
      let targetTreasuryId = ex.treasuryId;
      if (!treasuryMap.has(targetTreasuryId)) {
        targetTreasuryId = 'treasury_main';
        repairs.push(`Linked execution ${ex.id} to treasury_main (was ${ex.treasuryId})`);
      }

      await postgresEngine.adminQuery(
        `INSERT INTO executions (
          id, idempotency_key, treasury_id, mandate_id, agent_id, rfq_id, claim_token,
          state, sell_token, buy_token, sell_symbol, buy_symbol, requested_sell_atomic,
          quoted_taker_pays_atomic, quoted_buy_amount_atomic, quoted_fee_atomic,
          settled_sell_atomic, settled_buy_atomic, settled_fee_atomic, gas_used_atomic,
          rate_ray, quote_expires_at, approval_tx_hash, swap_tx_hash, block_number,
          attribution_tag, attribution_verified, failure_reason, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
        )
        ON CONFLICT (idempotency_key) DO NOTHING;`,
        [
          ex.id,
          ex.idempotencyKey,
          targetTreasuryId,
          ex.mandateId,
          ex.agentId,
          ex.rfqId || null,
          ex.claimToken || null,
          ex.state,
          ex.sellToken || null,
          ex.buyToken || null,
          ex.sellSymbol || null,
          ex.buySymbol || null,
          ex.requestedSellAtomic || '0',
          ex.quotedTakerPaysAtomic || null,
          ex.quotedBuyAmountAtomic || null,
          ex.quotedFeeAtomic || null,
          ex.settledSellAtomic || null,
          ex.settledBuyAtomic || null,
          ex.settledFeeAtomic || null,
          ex.gasUsedAtomic || null,
          ex.rateRay || null,
          ex.quoteExpiresAt ? new Date(ex.quoteExpiresAt) : null,
          ex.approvalTxHash || null,
          ex.swapTxHash || null,
          ex.blockNumber || null,
          ex.attributionTag || null,
          ex.attributionVerified !== undefined ? ex.attributionVerified : null,
          ex.failureReason || null,
          new Date(ex.createdAt || Date.now()),
          new Date(ex.updatedAt || Date.now()),
        ]
      );
    }

    // F. Migrate Ledger Entries
    for (const l of state.ledgerEntries || []) {
      const targetTreasuryId = treasuryMap.has(l.treasuryId) ? l.treasuryId : 'treasury_main';
      await postgresEngine.adminQuery(
        `INSERT INTO ledger_entries (
          id, journal_id, execution_id, service_purchase_id, treasury_id,
          account_code, account_name, account_type, direction, asset_symbol,
          amount_atomic, decimals, tx_hash, block_number, memo, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO NOTHING;`,
        [
          l.id,
          l.journalId,
          l.executionId || null,
          l.servicePurchaseId || null,
          targetTreasuryId,
          l.accountCode,
          l.accountName,
          l.accountType,
          l.direction,
          l.assetSymbol,
          l.amountAtomic,
          l.decimals,
          l.txHash || null,
          l.blockNumber || null,
          l.memo,
          new Date(l.createdAt || Date.now()),
        ]
      );
    }

    // G. Migrate Service Purchases
    for (const s of state.servicePurchases || []) {
      const targetTreasuryId = treasuryMap.has(s.treasuryId) ? s.treasuryId : 'treasury_main';
      await postgresEngine.adminQuery(
        `INSERT INTO service_purchases (
          id, treasury_id, agent_id, execution_id, capability_id, provider_name,
          endpoint_url, payment_token_symbol, payment_token_address, price_usd,
          amount_atomic, status, payment_tx_hash, pay_to_address, erc8004_provider_agent_id,
          request_summary, response_summary, policy_reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO NOTHING;`,
        [
          s.id,
          targetTreasuryId,
          s.agentId,
          s.executionId || null,
          s.capabilityId,
          s.providerName,
          s.endpointUrl,
          s.paymentTokenSymbol,
          s.paymentTokenAddress,
          s.priceUsd,
          s.amountAtomic,
          s.status,
          s.paymentTxHash || null,
          s.payToAddress,
          s.erc8004ProviderAgentId || null,
          s.requestSummary,
          s.responseSummary,
          s.policyReason || null,
          new Date(s.createdAt || Date.now()),
        ]
      );
    }

    // H. Migrate Audit Events
    for (const ev of state.auditEvents || []) {
      const targetTreasuryId = treasuryMap.has(ev.treasuryId) ? ev.treasuryId : 'treasury_main';
      await postgresEngine.adminQuery(
        `INSERT INTO audit_events (
          id, treasury_id, agent_id, execution_id, category, severity, title, detail, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING;`,
        [
          ev.id,
          targetTreasuryId,
          ev.agentId || null,
          ev.executionId || null,
          ev.category,
          ev.severity,
          ev.title,
          ev.detail,
          new Date(ev.createdAt || Date.now()),
        ]
      );
    }

    // I. Migrate Sessions (deduplicate by id and token_hash)
    const seenSessionIds = new Set<string>();
    const seenTokenHashes = new Set<string>();

    for (const sess of state.sessions || []) {
      if (!userMap.has(sess.userId)) {
        warnings.push(`Session ${sess.id} references non-existent user ${sess.userId}. Skipped.`);
        continue;
      }

      if (seenTokenHashes.has(sess.tokenHash)) {
        continue; // duplicate token hash
      }

      let sessionId = sess.id;
      if (seenSessionIds.has(sessionId)) {
        sessionId = `${sessionId}_${Math.random().toString(36).slice(2, 7)}`;
        repairs.push(`Resolved duplicate session ID ${sess.id} -> ${sessionId}`);
      }

      seenSessionIds.add(sessionId);
      seenTokenHashes.add(sess.tokenHash);

      await postgresEngine.adminQuery(
        `INSERT INTO sessions (
          id, user_id, wallet_address, token_hash, created_at, last_active_at,
          expires_at, absolute_expires_at, revoked, revoked_at, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING;`,
        [
          sessionId,
          sess.userId,
          sess.walletAddress,
          sess.tokenHash,
          new Date(sess.createdAt),
          new Date(sess.lastActivityAt || sess.createdAt),
          new Date(sess.expiresAt),
          new Date(sess.expiresAt),
          Boolean(sess.revoked),
          sess.revoked ? new Date(sess.lastActivityAt || sess.createdAt) : null,
          sess.ipAddress || null,
          sess.userAgent || null,
        ]
      );
    }

    // J. Migrate Nonces
    for (const n of state.nonces || []) {
      await postgresEngine.adminQuery(
        `INSERT INTO nonces (
          nonce, wallet_address, expires_at, consumed, consumed_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (nonce) DO NOTHING;`,
        [
          n.nonce,
          n.walletAddress,
          n.expiresAt ? new Date(n.expiresAt) : new Date(Date.now() + 300_000),
          Boolean(n.consumed),
          (n as any).consumedAt ? new Date((n as any).consumedAt) : (n.consumed ? new Date() : null),
          new Date(n.createdAt || Date.now()),
        ]
      );
    }

    await postgresEngine.adminExec('COMMIT;');
  } catch (err) {
    await postgresEngine.adminExec('ROLLBACK;');
    throw err;
  }

  // 5. Compute post-migration financial totals and record counts
  const health = await postgresEngine.checkHealth();
  const execRows = await postgresEngine.adminQuery<any>(
    `SELECT requested_sell_atomic, settled_sell_atomic, settled_buy_atomic, settled_fee_atomic FROM executions;`
  );

  let postReqSell = 0n;
  let postSetSell = 0n;
  let postSetBuy = 0n;
  let postSetFee = 0n;

  for (const ex of execRows) {
    postReqSell += BigInt(ex.requested_sell_atomic || '0');
    postSetSell += BigInt(ex.settled_sell_atomic || '0');
    postSetBuy += BigInt(ex.settled_buy_atomic || '0');
    postSetFee += BigInt(ex.settled_fee_atomic || '0');
  }

  const totalsMatch =
    preReqSell === postReqSell &&
    preSetSell === postSetSell &&
    preSetBuy === postSetBuy &&
    preSetFee === postSetFee;

  return {
    timestamp: new Date().toISOString(),
    backupPath,
    sourceRecordCounts: sourceCounts,
    migratedRecordCounts: health.tableCounts,
    financialTotalsBefore: {
      totalRequestedSellAtomic: preReqSell.toString(),
      totalSettledSellAtomic: preSetSell.toString(),
      totalSettledBuyAtomic: preSetBuy.toString(),
      totalSettledFeeAtomic: preSetFee.toString(),
    },
    financialTotalsAfter: {
      totalRequestedSellAtomic: postReqSell.toString(),
      totalSettledSellAtomic: postSetSell.toString(),
      totalSettledBuyAtomic: postSetBuy.toString(),
      totalSettledFeeAtomic: postSetFee.toString(),
    },
    reconciled: totalsMatch,
    warnings,
    repairs,
  };
}
