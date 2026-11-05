import path from 'node:path';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  UserProfileRecord,
  TreasuryRecord,
  AgentProfileRecord,
  SessionRecord,
  NonceRecord,
} from './index';
import {
  TreasuryMandate,
  ExecutionRecord,
  LedgerEntryRecord,
  ServicePurchaseRecord,
  AuditEventRecord,
  FirstTradeAuthorizationRecord,
  AttestationConsumptionRecord,
  WebhookEventRecord,
} from '@moi/shared-types';

export interface PostgresConfig {
  dataDir?: string;
  inMemory?: boolean;
}

export class MoiPostgresEngine {
  private db: PGlite | null = null;
  private dataDir: string;
  private isInitialized = false;
  private txMutex: Promise<any> = Promise.resolve();

  constructor(config?: PostgresConfig) {
    if (config?.inMemory) {
      this.dataDir = 'memory://';
    } else {
      this.dataDir = config?.dataDir || path.resolve(process.cwd(), 'data/postgres');
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) return;

    if (this.dataDir !== 'memory://' && !fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.db = new PGlite(this.dataDir);

    // 1. Provision DDL Tables with relational integrity & atomic precision
    await this.db.exec(`
      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        wallet_address TEXT UNIQUE NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'treasurer',
        company TEXT,
        avatar_initials TEXT DEFAULT 'TO',
        notify_on_policy_reject BOOLEAN DEFAULT TRUE,
        notify_on_swap_settled BOOLEAN DEFAULT TRUE,
        notify_on_x402_purchase BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Treasuries Table
      CREATE TABLE IF NOT EXISTS treasuries (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        owner_wallet_address TEXT NOT NULL,
        agent_wallet_address TEXT NOT NULL,
        chain_id INT DEFAULT 42220,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Autonomous Agents Table
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        treasury_id TEXT NOT NULL REFERENCES treasuries(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        description TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        erc8004_agent_id INT,
        erc8004_registry TEXT DEFAULT '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        active BOOLEAN DEFAULT TRUE,
        mandate_id TEXT NOT NULL,
        last_cycle_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Treasury Mandates Table
      CREATE TABLE IF NOT EXISTS mandates (
        id TEXT PRIMARY KEY,
        treasury_id TEXT NOT NULL REFERENCES treasuries(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        name TEXT NOT NULL,
        natural_language_intent TEXT,
        mode TEXT NOT NULL,
        execution_strategy TEXT NOT NULL,
        chain_id INT DEFAULT 42220,
        sell_token TEXT NOT NULL,
        buy_token TEXT NOT NULL,
        minimum_reserve_atomic TEXT NOT NULL,
        max_trade_atomic TEXT NOT NULL,
        daily_sell_cap_atomic TEXT NOT NULL,
        min_buy_amount_atomic TEXT,
        max_slippage_bps INT DEFAULT 100,
        max_protocol_fee_bps INT DEFAULT 25,
        max_daily_loss_atomic TEXT,
        allowed_targets TEXT[] DEFAULT '{}',
        service_spend_per_call_atomic TEXT DEFAULT '50000',
        service_daily_cap_atomic TEXT DEFAULT '500000',
        stitch_base_spread_bps INT DEFAULT 18,
        stitch_inventory_skew_bps INT DEFAULT 12,
        paused BOOLEAN DEFAULT FALSE,
        version INT DEFAULT 1,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Executions Table with Unique Idempotency Key
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE NOT NULL,
        treasury_id TEXT NOT NULL REFERENCES treasuries(id) ON DELETE CASCADE,
        mandate_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        rfq_id TEXT,
        claim_token TEXT,
        state TEXT NOT NULL,
        sell_token TEXT,
        buy_token TEXT,
        sell_symbol TEXT,
        buy_symbol TEXT,
        requested_sell_atomic TEXT NOT NULL,
        quoted_taker_pays_atomic TEXT,
        quoted_buy_amount_atomic TEXT,
        quoted_fee_atomic TEXT,
        settled_sell_atomic TEXT,
        settled_buy_atomic TEXT,
        settled_fee_atomic TEXT,
        gas_used_atomic TEXT,
        rate_ray TEXT,
        quote_expires_at TIMESTAMPTZ,
        approval_tx_hash TEXT,
        swap_tx_hash TEXT,
        block_number TEXT,
        attribution_tag TEXT,
        attribution_verified BOOLEAN,
        failure_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Double-Entry Ledger Entries Table
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        journal_id TEXT NOT NULL,
        execution_id TEXT REFERENCES executions(id) ON DELETE SET NULL,
        service_purchase_id TEXT,
        treasury_id TEXT NOT NULL REFERENCES treasuries(id) ON DELETE CASCADE,
        account_code TEXT NOT NULL,
        account_name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        asset_symbol TEXT NOT NULL,
        amount_atomic TEXT NOT NULL,
        decimals INT NOT NULL,
        tx_hash TEXT,
        block_number TEXT,
        memo TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Service Purchases (x402) Table
      CREATE TABLE IF NOT EXISTS service_purchases (
        id TEXT PRIMARY KEY,
        treasury_id TEXT NOT NULL REFERENCES treasuries(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        execution_id TEXT REFERENCES executions(id) ON DELETE SET NULL,
        capability_id TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        endpoint_url TEXT NOT NULL,
        payment_token_symbol TEXT NOT NULL,
        payment_token_address TEXT NOT NULL,
        price_usd TEXT NOT NULL,
        amount_atomic TEXT NOT NULL,
        status TEXT NOT NULL,
        payment_tx_hash TEXT,
        pay_to_address TEXT NOT NULL,
        erc8004_provider_agent_id INT,
        request_summary TEXT NOT NULL,
        response_summary TEXT NOT NULL,
        policy_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Immutable Audit Events Table
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        treasury_id TEXT NOT NULL REFERENCES treasuries(id) ON DELETE CASCADE,
        agent_id TEXT,
        execution_id TEXT,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Server-Side Session Records Table
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wallet_address TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_active_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        absolute_expires_at TIMESTAMPTZ NOT NULL,
        revoked BOOLEAN DEFAULT FALSE,
        revoked_at TIMESTAMPTZ,
        ip_address TEXT,
        user_agent TEXT
      );

      -- Cryptographic SIWE Nonce Table
      CREATE TABLE IF NOT EXISTS nonces (
        nonce TEXT PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed BOOLEAN DEFAULT FALSE,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- First-Trade Authorizations Table (Mandatory Owner Authorization Gate)
      CREATE TABLE IF NOT EXISTS first_trade_authorizations (
        id TEXT PRIMARY KEY,
        treasury_id TEXT NOT NULL REFERENCES treasuries(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        chain_id INT NOT NULL DEFAULT 42220,
        sell_token TEXT NOT NULL,
        buy_token TEXT NOT NULL,
        amount_in_atomic TEXT NOT NULL,
        min_buy_amount_atomic TEXT NOT NULL,
        destination_contract TEXT NOT NULL,
        calldata_hash TEXT NOT NULL,
        max_slippage_bps INT NOT NULL,
        max_fee_atomic TEXT NOT NULL,
        quote_id TEXT NOT NULL,
        quote_expires_at TIMESTAMPTZ NOT NULL,
        approval_signature TEXT NOT NULL,
        approved_by_user_id TEXT NOT NULL,
        approved_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed BOOLEAN DEFAULT FALSE,
        consumed_at TIMESTAMPTZ
      );

      -- Policy Attestation Consumptions Table (Single-use HMAC Attestation Consumption)
      CREATE TABLE IF NOT EXISTS attestation_consumptions (
        nonce TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        consumed_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
      );

      -- Webhook Events Deduplication Table (Persistent Idempotency)
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_event_id TEXT NOT NULL,
        rfq_id TEXT,
        event_type TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
        processing_status TEXT NOT NULL,
        received_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        failure_reason TEXT,
        CONSTRAINT uq_webhook_provider_event UNIQUE (provider, provider_event_id)
      );

      -- Relational Indexes for Optimal Query Performance
      CREATE INDEX IF NOT EXISTS idx_treasuries_owner ON treasuries(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_agents_treasury ON agents(treasury_id);
      CREATE INDEX IF NOT EXISTS idx_mandates_treasury ON mandates(treasury_id);
      CREATE INDEX IF NOT EXISTS idx_executions_treasury ON executions(treasury_id);
      CREATE INDEX IF NOT EXISTS idx_executions_idempotency ON executions(idempotency_key);
      CREATE INDEX IF NOT EXISTS idx_ledger_treasury ON ledger_entries(treasury_id);
      CREATE INDEX IF NOT EXISTS idx_service_purchases_treasury ON service_purchases(treasury_id);
      CREATE INDEX IF NOT EXISTS idx_audit_events_treasury ON audit_events(treasury_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_nonces_wallet ON nonces(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_first_trade_treasury ON first_trade_authorizations(treasury_id);
      CREATE INDEX IF NOT EXISTS idx_first_trade_execution ON first_trade_authorizations(execution_id);
      CREATE INDEX IF NOT EXISTS idx_attestation_nonce ON attestation_consumptions(nonce);
      CREATE INDEX IF NOT EXISTS idx_attestation_execution ON attestation_consumptions(execution_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_provider_event ON webhook_events(provider, provider_event_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_rfq ON webhook_events(rfq_id);
    `);

    // 2. Setup Dedicated Application Role (moi_app) & RLS Policies
    await this.setupApplicationRoleAndRLS();

    this.isInitialized = true;
  }

  private async setupApplicationRoleAndRLS(): Promise<void> {
    if (!this.db) return;

    await this.db.exec(`
      -- Create application role if it doesn't already exist
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'moi_app') THEN
          CREATE ROLE moi_app NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN;
        END IF;
      END
      $$;

      -- Grant operational permissions to moi_app on all application tables
      GRANT ALL ON users, treasuries, agents, mandates, executions, ledger_entries, service_purchases, audit_events, sessions, nonces, first_trade_authorizations, attestation_consumptions, webhook_events TO moi_app;

      -- Enable and Force Row-Level Security on all tenant-sensitive tables
      ALTER TABLE treasuries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE treasuries FORCE ROW LEVEL SECURITY;

      ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agents FORCE ROW LEVEL SECURITY;

      ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;
      ALTER TABLE mandates FORCE ROW LEVEL SECURITY;

      ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE executions FORCE ROW LEVEL SECURITY;

      ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;

      ALTER TABLE service_purchases ENABLE ROW LEVEL SECURITY;
      ALTER TABLE service_purchases FORCE ROW LEVEL SECURITY;

      ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

      ALTER TABLE first_trade_authorizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE first_trade_authorizations FORCE ROW LEVEL SECURITY;

      -- Drop existing policies if any to ensure clean re-creation
      DROP POLICY IF EXISTS tenant_isolation_treasuries ON treasuries;
      DROP POLICY IF EXISTS tenant_isolation_agents ON agents;
      DROP POLICY IF EXISTS tenant_isolation_mandates ON mandates;
      DROP POLICY IF EXISTS tenant_isolation_executions ON executions;
      DROP POLICY IF EXISTS tenant_isolation_ledger ON ledger_entries;
      DROP POLICY IF EXISTS tenant_isolation_services ON service_purchases;
      DROP POLICY IF EXISTS tenant_isolation_audit ON audit_events;
      DROP POLICY IF EXISTS tenant_isolation_first_trade ON first_trade_authorizations;

      -- Treasury Policy: Scoped by owner_user_id
      CREATE POLICY tenant_isolation_treasuries ON treasuries
        FOR ALL
        TO moi_app
        USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), ''))
        WITH CHECK (owner_user_id = NULLIF(current_setting('app.current_user_id', true), ''));

      -- Agent Policy: Scoped through parent treasury ownership
      CREATE POLICY tenant_isolation_agents ON agents
        FOR ALL
        TO moi_app
        USING (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ))
        WITH CHECK (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ));

      -- Mandate Policy: Scoped through parent treasury ownership
      CREATE POLICY tenant_isolation_mandates ON mandates
        FOR ALL
        TO moi_app
        USING (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ))
        WITH CHECK (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ));

      -- Execution Policy: Scoped through parent treasury ownership
      CREATE POLICY tenant_isolation_executions ON executions
        FOR ALL
        TO moi_app
        USING (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ))
        WITH CHECK (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ));

      -- Ledger Policy: Scoped through parent treasury ownership
      CREATE POLICY tenant_isolation_ledger ON ledger_entries
        FOR ALL
        TO moi_app
        USING (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ))
        WITH CHECK (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ));

      -- Service Purchases Policy: Scoped through parent treasury ownership
      CREATE POLICY tenant_isolation_services ON service_purchases
        FOR ALL
        TO moi_app
        USING (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ))
        WITH CHECK (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ));

      -- Audit Events Policy: Scoped through parent treasury ownership
      CREATE POLICY tenant_isolation_audit ON audit_events
        FOR ALL
        TO moi_app
        USING (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ))
        WITH CHECK (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ));

      -- First-Trade Authorization Policy: Scoped through parent treasury ownership
      CREATE POLICY tenant_isolation_first_trade ON first_trade_authorizations
        FOR ALL
        TO moi_app
        USING (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ))
        WITH CHECK (treasury_id IN (
          SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
        ));
    `);
  }

  /**
   * Executes a callback within a scoped database transaction enforcing Row-Level Security
   * under the non-superuser application role 'moi_app'.
   * SET LOCAL ensures that tenant context never leaks across pooled connections or subsequent queries.
   */
  async withTenantContext<T>(
    userId: string,
    operation: (db: PGlite) => Promise<T>
  ): Promise<T> {
    const runInTx = async () => {
      if (!this.db) await this.initialize();
      const db = this.db!;

      await db.exec('BEGIN;');
      try {
        await db.exec("SET LOCAL ROLE moi_app;");
        // Escape userId safely
        const escapedUserId = userId.replace(/'/g, "''");
        await db.exec(`SET LOCAL app.current_user_id = '${escapedUserId}';`);

        const result = await operation(db);
        await db.exec('COMMIT;');
        return result;
      } catch (err) {
        await db.exec('ROLLBACK;');
        throw err;
      }
    };

    // Serialize transactions over the connection pool to prevent statement interleaving
    const nextPromise = this.txMutex.then(runInTx, runInTx);
    this.txMutex = nextPromise.catch(() => {});
    return nextPromise;
  }

  /**
   * Executes a callback within a serialized database transaction
   */
  async withTx<T>(operation: (db: PGlite) => Promise<T>): Promise<T> {
    const runInTx = async () => {
      if (!this.db) await this.initialize();
      const db = this.db!;
      await db.exec('BEGIN;');
      try {
        const result = await operation(db);
        await db.exec('COMMIT;');
        return result;
      } catch (err) {
        await db.exec('ROLLBACK;');
        throw err;
      }
    };

    const nextPromise = this.txMutex.then(runInTx, runInTx);
    this.txMutex = nextPromise.catch(() => {});
    return nextPromise;
  }

  /**
   * Executes an administrative query directly as database owner (bypasses RLS for system operations)
   */
  async adminQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) await this.initialize();
    const res = await this.db!.query(sql, params);
    return res.rows as T[];
  }

  /**
   * Executes an administrative command directly as database owner
   */
  async adminExec(sql: string): Promise<void> {
    if (!this.db) await this.initialize();
    await this.db!.exec(sql);
  }

  // =========================================================================
  // ATOMIC CONCURRENCY & FINANCIAL OPERATIONS
  // =========================================================================

  /**
   * Atomically consumes a SIWE nonce.
   * Guarantees that even under concurrent simultaneous calls, only ONE caller consumes the nonce.
   */
  async atomicConsumeNonce(
    nonce: string,
    walletAddress: string
  ): Promise<{ consumed: boolean; nonceRecord?: NonceRecord }> {
    if (!this.db) await this.initialize();
    const normalizedWallet = walletAddress.toLowerCase();

    const res = await this.db!.query<any>(
      `UPDATE nonces
       SET consumed = TRUE, consumed_at = NOW()
       WHERE nonce = $1 
         AND LOWER(wallet_address) = LOWER($2) 
         AND consumed = FALSE 
         AND expires_at > NOW()
       RETURNING nonce, wallet_address, expires_at, consumed, consumed_at, created_at;`,
      [nonce, normalizedWallet]
    );

    if (res.rows.length === 0) {
      return { consumed: false };
    }

    const row = res.rows[0];
    return {
      consumed: true,
      nonceRecord: {
        nonce: row.nonce,
        walletAddress: row.wallet_address as `0x${string}` | undefined,
        expiresAt: new Date(row.expires_at).getTime(),
        consumed: row.consumed,
        createdAt: new Date(row.created_at).getTime(),
      },
    };
  }

  /**
   * Concurrency-Safe Mandate Spending Reservation:
   * Uses row-level lock (FOR UPDATE) to serialize concurrent requests on the same mandate,
   * calculating the exact daily cumulative spend and preventing double-spend race conditions.
   */
  async acquireMandateCapacityAndReserve(
    mandateId: string,
    requestedSellAtomic: string,
    userId: string,
    executionToReserve?: { id: string; idempotencyKey: string }
  ): Promise<{
    authorized: boolean;
    reason?: string;
    mandate?: TreasuryMandate;
    currentDailySoldAtomic: string;
    projectedTotalDailySoldAtomic: string;
  }> {
    return this.withTenantContext(userId, async (db) => {
      // 1. Lock mandate row for update to serialize competing concurrent cycles
      const mandateRes = await db.query<any>(
        `SELECT * FROM mandates WHERE id = $1 FOR UPDATE;`,
        [mandateId]
      );

      if (mandateRes.rows.length === 0) {
        return {
          authorized: false,
          reason: `Mandate "${mandateId}" not found or unauthorized for tenant.`,
          currentDailySoldAtomic: '0',
          projectedTotalDailySoldAtomic: requestedSellAtomic,
        };
      }

      const mRow = mandateRes.rows[0];
      if (mRow.paused) {
        return {
          authorized: false,
          reason: `Mandate "${mRow.name}" is currently paused.`,
          currentDailySoldAtomic: '0',
          projectedTotalDailySoldAtomic: requestedSellAtomic,
        };
      }

      // Check max single trade limit
      const maxTrade = BigInt(mRow.max_trade_atomic);
      const reqSell = BigInt(requestedSellAtomic);
      if (reqSell > maxTrade) {
        return {
          authorized: false,
          reason: `Requested sell amount (${reqSell}) exceeds max trade limit (${maxTrade}).`,
          currentDailySoldAtomic: '0',
          projectedTotalDailySoldAtomic: requestedSellAtomic,
        };
      }

      // 2. Compute current 24-hour settled + submitted spending for this mandate
      const dailyRes = await db.query<any>(
        `SELECT COALESCE(SUM(CAST(requested_sell_atomic AS NUMERIC)), 0) AS total_sold
         FROM executions
         WHERE mandate_id = $1
           AND state IN ('SUBMITTED', 'RECONCILED', 'QUOTED')
           AND created_at >= NOW() - INTERVAL '24 hours';`,
        [mandateId]
      );

      const currentDailySold = BigInt(Math.floor(Number(dailyRes.rows[0]?.total_sold || 0)));
      const dailyCap = BigInt(mRow.daily_sell_cap_atomic);
      const projected = currentDailySold + reqSell;

      if (projected > dailyCap) {
        return {
          authorized: false,
          reason: `Projected 24h volume (${projected}) exceeds mandate daily sell cap (${dailyCap}).`,
          currentDailySoldAtomic: currentDailySold.toString(),
          projectedTotalDailySoldAtomic: projected.toString(),
        };
      }

      // 3. Atomically record the reservation in executions table if requested
      if (executionToReserve) {
        await db.query(
          `INSERT INTO executions (
            id, idempotency_key, treasury_id, mandate_id, agent_id, state, requested_sell_atomic
          ) VALUES ($1, $2, $3, $4, $5, 'QUOTED', $6);`,
          [
            executionToReserve.id,
            executionToReserve.idempotencyKey,
            mRow.treasury_id,
            mandateId,
            mRow.agent_id,
            requestedSellAtomic,
          ]
        );
      }

      // Increment optimistic version on mandate to track concurrency progression
      await db.query(
        `UPDATE mandates SET version = version + 1, updated_at = NOW() WHERE id = $1;`,
        [mandateId]
      );

      const mappedMandate: TreasuryMandate = {
        id: mRow.id,
        treasuryId: mRow.treasury_id,
        agentId: mRow.agent_id,
        name: mRow.name,
        naturalLanguageIntent: mRow.natural_language_intent,
        mode: mRow.mode,
        executionStrategy: mRow.execution_strategy,
        chainId: mRow.chain_id,
        sellToken: mRow.sell_token,
        buyToken: mRow.buy_token,
        minimumReserveAtomic: mRow.minimum_reserve_atomic,
        maxTradeAtomic: mRow.max_trade_atomic,
        dailySellCapAtomic: mRow.daily_sell_cap_atomic,
        minBuyAmountAtomic: mRow.min_buy_amount_atomic,
        maxSlippageBps: mRow.max_slippage_bps,
        maxProtocolFeeBps: mRow.max_protocol_fee_bps,
        maxDailyLossAtomic: mRow.max_daily_loss_atomic,
        allowedTargets: mRow.allowed_targets || [],
        serviceSpendPerCallAtomic: mRow.service_spend_per_call_atomic,
        serviceDailyCapAtomic: mRow.service_daily_cap_atomic,
        stitchBaseSpreadBps: mRow.stitch_base_spread_bps,
        stitchInventorySkewBps: mRow.stitch_inventory_skew_bps,
        paused: mRow.paused,
        updatedAt: new Date(mRow.updated_at).toISOString(),
      };

      return {
        authorized: true,
        mandate: mappedMandate,
        currentDailySoldAtomic: currentDailySold.toString(),
        projectedTotalDailySoldAtomic: projected.toString(),
      };
    });
  }

  /**
   * Atomic Transactional Execution & Double-Entry Ledger Posting:
   * Inserts execution with unique idempotency key and posts related double-entry ledger journals.
   * If any step fails, the entire transaction rolls back cleanly.
   */
  async recordExecutionAndLedgerAtomic(
    execution: ExecutionRecord,
    ledgerEntries: LedgerEntryRecord[],
    userId?: string
  ): Promise<{ ok: boolean; execution: ExecutionRecord; ledgerEntries: LedgerEntryRecord[] }> {
    if (!this.db) await this.initialize();

    const runner = async (db: PGlite) => {
      // 1. Insert or update execution with unique idempotency key
      await db.query(
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
        ON CONFLICT (idempotency_key) DO UPDATE SET
          state = EXCLUDED.state,
          settled_sell_atomic = EXCLUDED.settled_sell_atomic,
          settled_buy_atomic = EXCLUDED.settled_buy_atomic,
          settled_fee_atomic = EXCLUDED.settled_fee_atomic,
          approval_tx_hash = EXCLUDED.approval_tx_hash,
          swap_tx_hash = EXCLUDED.swap_tx_hash,
          block_number = EXCLUDED.block_number,
          failure_reason = EXCLUDED.failure_reason,
          updated_at = NOW();`,
        [
          execution.id,
          execution.idempotencyKey,
          execution.treasuryId,
          execution.mandateId,
          execution.agentId,
          execution.rfqId || null,
          execution.claimToken || null,
          execution.state,
          execution.sellToken,
          execution.buyToken,
          execution.sellSymbol,
          execution.buySymbol,
          execution.requestedSellAtomic,
          execution.quotedTakerPaysAtomic || null,
          execution.quotedBuyAmountAtomic || null,
          execution.quotedFeeAtomic || null,
          execution.settledSellAtomic || null,
          execution.settledBuyAtomic || null,
          execution.settledFeeAtomic || null,
          execution.gasUsedAtomic || null,
          execution.rateRay || null,
          execution.quoteExpiresAt ? new Date(execution.quoteExpiresAt) : null,
          execution.approvalTxHash || null,
          execution.swapTxHash || null,
          execution.blockNumber || null,
          execution.attributionTag || null,
          execution.attributionVerified !== undefined ? execution.attributionVerified : null,
          execution.failureReason || null,
          new Date(execution.createdAt),
          new Date(execution.updatedAt),
        ]
      );

      // 2. Post corresponding double-entry ledger entries
      for (const entry of ledgerEntries) {
        await db.query(
          `INSERT INTO ledger_entries (
            id, journal_id, execution_id, service_purchase_id, treasury_id,
            account_code, account_name, account_type, direction, asset_symbol,
            amount_atomic, decimals, tx_hash, block_number, memo, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO NOTHING;`,
          [
            entry.id,
            entry.journalId,
            entry.executionId || null,
            entry.servicePurchaseId || null,
            entry.treasuryId,
            entry.accountCode,
            entry.accountName,
            entry.accountType,
            entry.direction,
            entry.assetSymbol,
            entry.amountAtomic,
            entry.decimals,
            entry.txHash || null,
            entry.blockNumber || null,
            entry.memo,
            new Date(entry.createdAt),
          ]
        );
      }

      return { ok: true, execution, ledgerEntries };
    };

    if (userId) {
      return this.withTenantContext(userId, runner);
    } else {
      await this.db!.exec('BEGIN;');
      try {
        const res = await runner(this.db!);
        await this.db!.exec('COMMIT;');
        return res;
      } catch (err) {
        await this.db!.exec('ROLLBACK;');
        throw err;
      }
    }
  }

  // =========================================================================
  // MILESTONE 2.5: SETTLEMENT INTEGRITY, FIRST-TRADE & ATTESTATION METHODS
  // =========================================================================

  /**
   * Retrieves count of settled executions for a given treasury from trusted DB state
   */
  async getSettledExecutionsCount(treasuryId: string): Promise<number> {
    if (!this.db) await this.initialize();
    const res = await this.db!.query<any>(
      `SELECT COUNT(*) as cnt FROM executions WHERE treasury_id = $1 AND state IN ('SETTLED', 'RECONCILED', 'CONFIRMED');`,
      [treasuryId]
    );
    return Number(res.rows[0]?.cnt || 0);
  }

  /**
   * Persists an explicit first-trade owner authorization record
   */
  async storeFirstTradeAuthorization(auth: FirstTradeAuthorizationRecord): Promise<void> {
    if (!this.db) await this.initialize();
    await this.withTx(async (db) => {
      await db.query(
        `INSERT INTO first_trade_authorizations (
          id, treasury_id, agent_id, execution_id, chain_id,
          sell_token, buy_token, amount_in_atomic, min_buy_amount_atomic,
          destination_contract, calldata_hash, max_slippage_bps, max_fee_atomic,
          quote_id, quote_expires_at, approval_signature, approved_by_user_id,
          approved_at, expires_at, consumed, consumed_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, $21
        );`,
        [
          auth.id,
          auth.treasuryId,
          auth.agentId,
          auth.executionId,
          auth.chainId,
          auth.sellToken.toLowerCase(),
          auth.buyToken.toLowerCase(),
          auth.amountInAtomic,
          auth.minBuyAmountAtomic,
          auth.destinationContract.toLowerCase(),
          auth.calldataHash,
          auth.maxSlippageBps,
          auth.maxFeeAtomic,
          auth.quoteId,
          auth.quoteExpiresAt,
          auth.approvalSignature,
          auth.approvedByUserId,
          auth.approvedAt || new Date().toISOString(),
          auth.expiresAt,
          auth.consumed || false,
          auth.consumedAt || null,
        ]
      );
    });
  }

  /**
   * Retrieves a first-trade authorization record by execution ID
   */
  async getFirstTradeAuthorization(executionId: string): Promise<FirstTradeAuthorizationRecord | null> {
    if (!this.db) await this.initialize();
    const res = await this.db!.query<any>(
      `SELECT * FROM first_trade_authorizations WHERE execution_id = $1 LIMIT 1;`,
      [executionId]
    );
    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      treasuryId: r.treasury_id,
      agentId: r.agent_id,
      executionId: r.execution_id,
      chainId: r.chain_id,
      sellToken: r.sell_token,
      buyToken: r.buy_token,
      amountInAtomic: r.amount_in_atomic,
      minBuyAmountAtomic: r.min_buy_amount_atomic,
      destinationContract: r.destination_contract,
      calldataHash: r.calldata_hash,
      maxSlippageBps: r.max_slippage_bps,
      maxFeeAtomic: r.max_fee_atomic,
      quoteId: r.quote_id,
      quoteExpiresAt: new Date(r.quote_expires_at).toISOString(),
      approvalSignature: r.approval_signature,
      approvedByUserId: r.approved_by_user_id,
      approvedAt: new Date(r.approved_at).toISOString(),
      expiresAt: new Date(r.expires_at).toISOString(),
      consumed: Boolean(r.consumed),
      consumedAt: r.consumed_at ? new Date(r.consumed_at).toISOString() : undefined,
    };
  }

  /**
   * Atomically consumes a first-trade authorization matching exact execution ID and calldata hash
   */
  async atomicConsumeFirstTradeAuthorization(
    executionId: string,
    expectedCalldataHash: string
  ): Promise<{ consumed: boolean; reason?: string }> {
    if (!this.db) await this.initialize();
    return this.withTx(async (db) => {
      const res = await db.query<any>(
        `SELECT * FROM first_trade_authorizations WHERE execution_id = $1 FOR UPDATE;`,
        [executionId]
      );
      if (!res.rows || res.rows.length === 0) {
        return { consumed: false, reason: `No first-trade authorization registered for execution "${executionId}".` };
      }
      const auth = res.rows[0];
      if (auth.consumed) {
        return { consumed: false, reason: `First-trade authorization for execution "${executionId}" has already been consumed.` };
      }
      if (new Date(auth.expires_at).getTime() < Date.now()) {
        return { consumed: false, reason: `First-trade authorization for execution "${executionId}" has expired.` };
      }
      if (auth.calldata_hash.toLowerCase() !== expectedCalldataHash.toLowerCase()) {
        return {
          consumed: false,
          reason: `Calldata hash mismatch: authorization authorized "${auth.calldata_hash}", transaction calldata is "${expectedCalldataHash}".`,
        };
      }
      const updateRes = await db.query<any>(
        `UPDATE first_trade_authorizations
         SET consumed = TRUE, consumed_at = NOW()
         WHERE execution_id = $1 AND consumed = FALSE
         RETURNING id;`,
        [executionId]
      );
      if (updateRes.rows.length === 0) {
        return { consumed: false, reason: `Concurrent consumption of first-trade authorization detected.` };
      }
      return { consumed: true };
    });
  }

  /**
   * Atomically consumes a policy attestation nonce, preventing replay attacks
   */
  async atomicConsumeAttestation(
    nonce: string,
    executionId: string,
    payloadHash: string,
    expiresAt: Date
  ): Promise<{ consumed: boolean; reason?: string }> {
    if (!this.db) await this.initialize();
    if (expiresAt.getTime() < Date.now()) {
      return { consumed: false, reason: `Policy attestation nonce "${nonce}" has expired.` };
    }
    return this.withTx(async (db) => {
      const checkRes = await db.query<any>(
        `SELECT nonce FROM attestation_consumptions WHERE nonce = $1;`,
        [nonce]
      );
      if (checkRes.rows.length > 0) {
        return {
          consumed: false,
          reason: `Policy attestation nonce "${nonce}" has already been consumed (replay prevention).`,
        };
      }

      await db.query(
        `INSERT INTO attestation_consumptions (nonce, execution_id, payload_hash, consumed_at, expires_at)
         VALUES ($1, $2, $3, NOW(), $4);`,
        [nonce, executionId, payloadHash, expiresAt.toISOString()]
      );

      return { consumed: true };
    });
  }

  /**
   * Atomically registers a webhook event, enforcing deduplication on (provider, provider_event_id)
   */
  async recordWebhookEventAtomic(
    event: WebhookEventRecord
  ): Promise<{ accepted: boolean; duplicate: boolean; record?: WebhookEventRecord }> {
    if (!this.db) await this.initialize();
    return this.withTx(async (db) => {
      const existing = await db.query<any>(
        `SELECT * FROM webhook_events WHERE provider = $1 AND provider_event_id = $2;`,
        [event.provider, event.providerEventId]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        return {
          accepted: false,
          duplicate: true,
          record: {
            id: row.id,
            provider: row.provider,
            providerEventId: row.provider_event_id,
            rfqId: row.rfq_id,
            eventType: row.event_type,
            payloadHash: row.payload_hash,
            signatureVerified: Boolean(row.signature_verified),
            processingStatus: row.processing_status,
            receivedAt: new Date(row.received_at).toISOString(),
            processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : undefined,
            failureReason: row.failure_reason,
          },
        };
      }

      await db.query(
        `INSERT INTO webhook_events (
          id, provider, provider_event_id, rfq_id, event_type, payload_hash,
          signature_verified, processing_status, received_at, processed_at, failure_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10);`,
        [
          event.id,
          event.provider,
          event.providerEventId,
          event.rfqId || null,
          event.eventType,
          event.payloadHash,
          event.signatureVerified,
          event.processingStatus,
          event.processedAt || null,
          event.failureReason || null,
        ]
      );

      return { accepted: true, duplicate: false, record: event };
    });
  }

  /**
   * Updates webhook processing status atomically
   */
  async updateWebhookEventStatus(
    id: string,
    status: 'PROCESSED' | 'FAILED',
    failureReason?: string
  ): Promise<void> {
    if (!this.db) await this.initialize();
    await this.withTx(async (db) => {
      await db.query(
        `UPDATE webhook_events SET processing_status = $1, processed_at = NOW(), failure_reason = $2 WHERE id = $3;`,
        [status, failureReason || null, id]
      );
    });
  }

  // =========================================================================
  // RECOVERY & HEALTH UTILITIES
  // =========================================================================

  /**
   * Recovers incomplete executions stuck in QUOTED or SUBMITTED past expiration
   */
  async recoverIncompleteExecutions(timeoutMinutes: number = 30): Promise<{
    recoveredCount: number;
    expiredExecutions: string[];
  }> {
    if (!this.db) await this.initialize();

    const res = await this.db!.query<any>(
      `UPDATE executions
       SET state = 'EXPIRED',
           failure_reason = 'Execution expired or interrupted during settlement without confirmation.',
           updated_at = NOW()
       WHERE state IN ('QUOTED', 'SUBMITTED')
         AND created_at < NOW() - ($1 || ' minutes')::INTERVAL
       RETURNING id;`,
      [timeoutMinutes]
    );

    return {
      recoveredCount: res.rows.length,
      expiredExecutions: res.rows.map((r) => r.id),
    };
  }

  /**
   * Health Check: Verifies PostgreSQL engine status, table counts, and RLS enforcement
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    tableCounts: Record<string, number>;
    rlsActive: boolean;
  }> {
    if (!this.db) await this.initialize();

    try {
      const verRes = await this.db!.query<{ version: string }>('SELECT version();');
      const version = verRes.rows[0]?.version || 'PostgreSQL';

      const counts: Record<string, number> = {};
      const tables = [
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
        'first_trade_authorizations',
        'attestation_consumptions',
        'webhook_events',
      ];

      for (const t of tables) {
        const r = await this.db!.query<any>(`SELECT COUNT(*) as cnt FROM ${t};`);
        counts[t] = Number(r.rows[0]?.cnt || 0);
      }

      // Verify RLS status on core tables
      const rlsRes = await this.db!.query<any>(
        `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'treasuries';`
      );
      const rlsActive = Boolean(rlsRes.rows[0]?.rowsecurity);

      return {
        status: 'healthy',
        version,
        tableCounts: counts,
        rlsActive,
      };
    } catch {
      return {
        status: 'unhealthy',
        version: 'Unknown',
        tableCounts: {},
        rlsActive: false,
      };
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

export const moiPostgres = new MoiPostgresEngine();
