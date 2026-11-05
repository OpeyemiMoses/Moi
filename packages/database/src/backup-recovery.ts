import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { MoiPostgresEngine } from './postgres-engine';

export interface DatabaseBackupSnapshot {
  version: string;
  timestamp: string;
  checksum: string;
  tableCounts: Record<string, number>;
  financialTotals: {
    totalRequestedSellAtomic: string;
    totalSettledSellAtomic: string;
    totalSettledBuyAtomic: string;
    totalSettledFeeAtomic: string;
  };
  tables: {
    users: any[];
    treasuries: any[];
    agents: any[];
    mandates: any[];
    executions: any[];
    ledger_entries: any[];
    service_purchases: any[];
    audit_events: any[];
    sessions: any[];
    nonces: any[];
  };
}

export async function exportDatabaseBackup(
  engine: MoiPostgresEngine,
  targetPath?: string
): Promise<{ backupPath: string; snapshot: DatabaseBackupSnapshot }> {
  await engine.initialize();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile =
    targetPath || path.resolve(process.cwd(), `data/backups/moi-backup_${timestamp}.json`);

  const backupDir = path.dirname(backupFile);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const tableNames = [
    'users',
    'treasuries',
    'agents',
    'mandates',
    'executions',
    'ledger_entries',
    'service_purchases',
    'audit_events',
    'sessions',
    'nonces',
  ];

  const tables: Record<string, any[]> = {};
  const tableCounts: Record<string, number> = {};

  for (const table of tableNames) {
    const rows = await engine.adminQuery(`SELECT * FROM ${table};`);
    tables[table] = rows;
    tableCounts[table] = rows.length;
  }

  // Compute financial totals
  let totalReqSell = 0n;
  let totalSetSell = 0n;
  let totalSetBuy = 0n;
  let totalSetFee = 0n;

  for (const ex of tables['executions'] || []) {
    totalReqSell += BigInt(ex.requested_sell_atomic || '0');
    totalSetSell += BigInt(ex.settled_sell_atomic || '0');
    totalSetBuy += BigInt(ex.settled_buy_atomic || '0');
    totalSetFee += BigInt(ex.settled_fee_atomic || '0');
  }

  const financialTotals = {
    totalRequestedSellAtomic: totalReqSell.toString(),
    totalSettledSellAtomic: totalSetSell.toString(),
    totalSettledBuyAtomic: totalSetBuy.toString(),
    totalSettledFeeAtomic: totalSetFee.toString(),
  };

  const payloadToHash = JSON.stringify({ tables, financialTotals });
  const checksum = createHash('sha256').update(payloadToHash).digest('hex');

  const snapshot: DatabaseBackupSnapshot = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checksum,
    tableCounts,
    financialTotals,
    tables: tables as DatabaseBackupSnapshot['tables'],
  };

  fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf-8');

  return { backupPath: backupFile, snapshot };
}

export async function restoreDatabaseBackup(
  engine: MoiPostgresEngine,
  backupPath: string
): Promise<{
  success: boolean;
  restoredRecordCounts: Record<string, number>;
  checksumVerified: boolean;
  financialTotals: DatabaseBackupSnapshot['financialTotals'];
}> {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at: ${backupPath}`);
  }

  const raw = fs.readFileSync(backupPath, 'utf-8');
  const snapshot: DatabaseBackupSnapshot = JSON.parse(raw);

  // 1. Verify Checksum
  const payloadToHash = JSON.stringify({
    tables: snapshot.tables,
    financialTotals: snapshot.financialTotals,
  });
  const computedChecksum = createHash('sha256').update(payloadToHash).digest('hex');
  if (computedChecksum !== snapshot.checksum) {
    throw new Error(
      `Backup checksum mismatch! File may be corrupted or tampered. Expected ${snapshot.checksum}, got ${computedChecksum}`
    );
  }

  await engine.initialize();

  // 2. Perform Atomic Restore inside transaction
  await engine.adminExec('BEGIN;');
  try {
    // Truncate tables in reverse topological order
    await engine.adminExec(`
      TRUNCATE TABLE nonces, sessions, audit_events, service_purchases, ledger_entries, executions, mandates, agents, treasuries, users CASCADE;
    `);

    // Restore users
    for (const u of snapshot.tables.users) {
      await engine.adminQuery(
        `INSERT INTO users (id, email, wallet_address, name, role, company, avatar_initials, notify_on_policy_reject, notify_on_swap_settled, notify_on_x402_purchase, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          u.id,
          u.email,
          u.wallet_address,
          u.name,
          u.role,
          u.company,
          u.avatar_initials,
          u.notify_on_policy_reject,
          u.notify_on_swap_settled,
          u.notify_on_x402_purchase,
          u.created_at,
          u.updated_at,
        ]
      );
    }

    // Restore treasuries
    for (const t of snapshot.tables.treasuries) {
      await engine.adminQuery(
        `INSERT INTO treasuries (id, owner_user_id, name, owner_wallet_address, agent_wallet_address, chain_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          t.id,
          t.owner_user_id,
          t.name,
          t.owner_wallet_address,
          t.agent_wallet_address,
          t.chain_id,
          t.created_at,
          t.updated_at,
        ]
      );
    }

    // Restore agents
    for (const a of snapshot.tables.agents) {
      await engine.adminQuery(
        `INSERT INTO agents (id, treasury_id, name, role, description, wallet_address, erc8004_agent_id, erc8004_registry, active, mandate_id, last_cycle_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          a.id,
          a.treasury_id,
          a.name,
          a.role,
          a.description,
          a.wallet_address,
          a.erc8004_agent_id,
          a.erc8004_registry,
          a.active,
          a.mandate_id,
          a.last_cycle_at,
          a.created_at,
        ]
      );
    }

    // Restore mandates
    for (const m of snapshot.tables.mandates) {
      await engine.adminQuery(
        `INSERT INTO mandates (id, treasury_id, agent_id, name, natural_language_intent, mode, execution_strategy, chain_id, sell_token, buy_token, minimum_reserve_atomic, max_trade_atomic, daily_sell_cap_atomic, min_buy_amount_atomic, max_slippage_bps, max_protocol_fee_bps, max_daily_loss_atomic, allowed_targets, service_spend_per_call_atomic, service_daily_cap_atomic, stitch_base_spread_bps, stitch_inventory_skew_bps, paused, version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);`,
        [
          m.id,
          m.treasury_id,
          m.agent_id,
          m.name,
          m.natural_language_intent,
          m.mode,
          m.execution_strategy,
          m.chain_id,
          m.sell_token,
          m.buy_token,
          m.minimum_reserve_atomic,
          m.max_trade_atomic,
          m.daily_sell_cap_atomic,
          m.min_buy_amount_atomic,
          m.max_slippage_bps,
          m.max_protocol_fee_bps,
          m.max_daily_loss_atomic,
          m.allowed_targets,
          m.service_spend_per_call_atomic,
          m.service_daily_cap_atomic,
          m.stitch_base_spread_bps,
          m.stitch_inventory_skew_bps,
          m.paused,
          m.version,
          m.updated_at,
        ]
      );
    }

    // Restore executions
    for (const ex of snapshot.tables.executions) {
      await engine.adminQuery(
        `INSERT INTO executions (id, idempotency_key, treasury_id, mandate_id, agent_id, rfq_id, claim_token, state, sell_token, buy_token, sell_symbol, buy_symbol, requested_sell_atomic, quoted_taker_pays_atomic, quoted_buy_amount_atomic, quoted_fee_atomic, settled_sell_atomic, settled_buy_atomic, settled_fee_atomic, gas_used_atomic, rate_ray, quote_expires_at, approval_tx_hash, swap_tx_hash, block_number, attribution_tag, attribution_verified, failure_reason, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30);`,
        [
          ex.id,
          ex.idempotency_key,
          ex.treasury_id,
          ex.mandate_id,
          ex.agent_id,
          ex.rfq_id,
          ex.claim_token,
          ex.state,
          ex.sell_token,
          ex.buy_token,
          ex.sell_symbol,
          ex.buy_symbol,
          ex.requested_sell_atomic,
          ex.quoted_taker_pays_atomic,
          ex.quoted_buy_amount_atomic,
          ex.quoted_fee_atomic,
          ex.settled_sell_atomic,
          ex.settled_buy_atomic,
          ex.settled_fee_atomic,
          ex.gas_used_atomic,
          ex.rate_ray,
          ex.quote_expires_at,
          ex.approval_tx_hash,
          ex.swap_tx_hash,
          ex.block_number,
          ex.attribution_tag,
          ex.attribution_verified,
          ex.failure_reason,
          ex.created_at,
          ex.updated_at,
        ]
      );
    }

    // Restore ledger_entries
    for (const l of snapshot.tables.ledger_entries) {
      await engine.adminQuery(
        `INSERT INTO ledger_entries (id, journal_id, execution_id, service_purchase_id, treasury_id, account_code, account_name, account_type, direction, asset_symbol, amount_atomic, decimals, tx_hash, block_number, memo, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);`,
        [
          l.id,
          l.journal_id,
          l.execution_id,
          l.service_purchase_id,
          l.treasury_id,
          l.account_code,
          l.account_name,
          l.account_type,
          l.direction,
          l.asset_symbol,
          l.amount_atomic,
          l.decimals,
          l.tx_hash,
          l.block_number,
          l.memo,
          l.created_at,
        ]
      );
    }

    // Restore service_purchases
    for (const s of snapshot.tables.service_purchases) {
      await engine.adminQuery(
        `INSERT INTO service_purchases (id, treasury_id, agent_id, execution_id, capability_id, provider_name, endpoint_url, payment_token_symbol, payment_token_address, price_usd, amount_atomic, status, payment_tx_hash, pay_to_address, erc8004_provider_agent_id, request_summary, response_summary, policy_reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19);`,
        [
          s.id,
          s.treasury_id,
          s.agent_id,
          s.execution_id,
          s.capability_id,
          s.provider_name,
          s.endpoint_url,
          s.payment_token_symbol,
          s.payment_token_address,
          s.price_usd,
          s.amount_atomic,
          s.status,
          s.payment_tx_hash,
          s.pay_to_address,
          s.erc8004_provider_agent_id,
          s.request_summary,
          s.response_summary,
          s.policy_reason,
          s.created_at,
        ]
      );
    }

    // Restore audit_events
    for (const ev of snapshot.tables.audit_events) {
      await engine.adminQuery(
        `INSERT INTO audit_events (id, treasury_id, agent_id, execution_id, category, severity, title, detail, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          ev.id,
          ev.treasury_id,
          ev.agent_id,
          ev.execution_id,
          ev.category,
          ev.severity,
          ev.title,
          ev.detail,
          ev.created_at,
        ]
      );
    }

    // Restore sessions
    for (const sess of snapshot.tables.sessions) {
      await engine.adminQuery(
        `INSERT INTO sessions (id, user_id, wallet_address, token_hash, created_at, last_active_at, expires_at, absolute_expires_at, revoked, revoked_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          sess.id,
          sess.user_id,
          sess.wallet_address,
          sess.token_hash,
          sess.created_at,
          sess.last_active_at,
          sess.expires_at,
          sess.absolute_expires_at,
          sess.revoked,
          sess.revoked_at,
          sess.ip_address,
          sess.user_agent,
        ]
      );
    }

    // Restore nonces
    for (const n of snapshot.tables.nonces) {
      await engine.adminQuery(
        `INSERT INTO nonces (nonce, wallet_address, expires_at, consumed, consumed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [n.nonce, n.wallet_address, n.expires_at, n.consumed, n.consumed_at, n.created_at]
      );
    }

    await engine.adminExec('COMMIT;');
  } catch (err) {
    await engine.adminExec('ROLLBACK;');
    throw err;
  }

  const health = await engine.checkHealth();

  return {
    success: true,
    restoredRecordCounts: health.tableCounts,
    checksumVerified: true,
    financialTotals: snapshot.financialTotals,
  };
}

