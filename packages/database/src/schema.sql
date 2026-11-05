-- =============================================================================
-- MOI (Autonomous Treasury Operating System)
-- Relational Schema, Application Roles & Row-Level Security (RLS) Policies
-- PostgreSQL 16+ Compatible
-- =============================================================================

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

-- =============================================================================
-- Dedicated Application Role (moi_app) & Row-Level Security (RLS)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'moi_app') THEN
    CREATE ROLE moi_app NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN;
  END IF;
END
$$;

GRANT ALL ON users, treasuries, agents, mandates, executions, ledger_entries, service_purchases, audit_events, sessions, nonces, first_trade_authorizations, attestation_consumptions, webhook_events TO moi_app;

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

DROP POLICY IF EXISTS tenant_isolation_treasuries ON treasuries;
DROP POLICY IF EXISTS tenant_isolation_agents ON agents;
DROP POLICY IF EXISTS tenant_isolation_mandates ON mandates;
DROP POLICY IF EXISTS tenant_isolation_executions ON executions;
DROP POLICY IF EXISTS tenant_isolation_ledger ON ledger_entries;
DROP POLICY IF EXISTS tenant_isolation_services ON service_purchases;
DROP POLICY IF EXISTS tenant_isolation_audit ON audit_events;
DROP POLICY IF EXISTS tenant_isolation_first_trade ON first_trade_authorizations;

CREATE POLICY tenant_isolation_treasuries ON treasuries
  FOR ALL
  TO moi_app
  USING (owner_user_id = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK (owner_user_id = NULLIF(current_setting('app.current_user_id', true), ''));

CREATE POLICY tenant_isolation_agents ON agents
  FOR ALL
  TO moi_app
  USING (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

CREATE POLICY tenant_isolation_mandates ON mandates
  FOR ALL
  TO moi_app
  USING (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

CREATE POLICY tenant_isolation_executions ON executions
  FOR ALL
  TO moi_app
  USING (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

CREATE POLICY tenant_isolation_ledger ON ledger_entries
  FOR ALL
  TO moi_app
  USING (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

CREATE POLICY tenant_isolation_services ON service_purchases
  FOR ALL
  TO moi_app
  USING (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

CREATE POLICY tenant_isolation_audit ON audit_events
  FOR ALL
  TO moi_app
  USING (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

CREATE POLICY tenant_isolation_first_trade ON first_trade_authorizations
  FOR ALL
  TO moi_app
  USING (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (treasury_id IN (
    SELECT id FROM treasuries WHERE owner_user_id = NULLIF(current_setting('app.current_user_id', true), '')
  ));

