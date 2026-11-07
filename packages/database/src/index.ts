import fs from 'node:fs';
import path from 'node:path';
import {
  AssetSymbol,
  AuditEventRecord,
  CELO_VERIFIED_ASSETS,
  ExecutionRecord,
  LedgerEntryRecord,
  ServicePurchaseRecord,
  TEXTILE_CONTRACTS,
  TreasuryMandate,
  FirstTradeAuthorizationRecord,
  AttestationConsumptionRecord,
  WebhookEventRecord,
} from '@moi/shared-types';

export type { TreasuryMandate };

export interface AgentProfileRecord {
  id: string;
  treasuryId: string;
  name: string;
  role: 'treasury_rebalancer' | 'stitch_filler' | 'x402_reconciler';
  description: string;
  walletAddress: `0x${string}`;
  erc8004AgentId?: number;
  erc8004Registry: `0x${string}`;
  active: boolean;
  mandateId: string;
  lastCycleAt?: string;
  createdAt: string;
}

export interface UserProfileRecord {
  id: string;
  displayName: string;
  email: string;
  organization: string;
  roleTitle: string;
  primaryRegion: string;
  preferredBaseSymbol: 'cNGN' | 'wARS' | 'wBRL' | 'wCOP' | 'USAT' | 'USDT';
  walletAddress: `0x${string}` | null;
  walletConnected: boolean;
  siweVerified: boolean;
  siweSignaturePreview?: string;
  avatarInitials: string;
  notifyOnPolicyReject: boolean;
  notifyOnSwapSettled: boolean;
  notifyOnX402Purchase: boolean;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  walletAddress: `0x${string}`;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  revoked: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface NonceRecord {
  nonce: string;
  walletAddress?: `0x${string}`;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
  clientIp?: string;
}

export interface TreasuryRecord {
  id: string;
  name: string;
  ownerUserId: string;
  ownerWalletAddress: `0x${string}` | null;
  agentWalletAddress: `0x${string}`;
  chainId: 42220;
  createdAt: string;
  updatedAt?: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  creatorWallet: `0x${string}`;
  userId: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: `0x${string}`;
  amount: string;
  tokenSymbol: AssetSymbol;
  memo: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  creatorSignature: string; // Cryptographic $0 / 0-gas signature proof from creator wallet
  signatureScheme: 'EIP-712' | 'personal_sign';
  paymentUri: string;
  dueDate?: string;
  paidAt?: string;
  paidTxHash?: `0x${string}`;
  createdAt: string;
}

export interface MoiDatabaseState {
  userProfile: UserProfileRecord;
  registeredUsers?: UserProfileRecord[];
  treasury: TreasuryRecord;
  treasuries?: TreasuryRecord[];
  agents: AgentProfileRecord[];
  mandates: TreasuryMandate[];
  executions: ExecutionRecord[];
  ledgerEntries: LedgerEntryRecord[];
  servicePurchases: ServicePurchaseRecord[];
  auditEvents: AuditEventRecord[];
  executionLocks: Record<string, { lockedAt: number; executionId: string }>;
  sessions?: SessionRecord[];
  nonces?: NonceRecord[];
  firstTradeAuthorizations?: FirstTradeAuthorizationRecord[];
  attestationConsumptions?: AttestationConsumptionRecord[];
  webhookEvents?: WebhookEventRecord[];
  invoices?: InvoiceRecord[];
}

function findWorkspaceRoot(startDir: string): string {
  let curr = startDir;
  while (curr !== path.dirname(curr)) {
    if (
      fs.existsSync(path.join(curr, 'pnpm-workspace.yaml')) ||
      (fs.existsSync(path.join(curr, 'package.json')) &&
        fs.existsSync(path.join(curr, 'packages')))
    ) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return startDir;
}

const ROOT_DIR = findWorkspaceRoot(process.cwd());
const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const STORE_PATH =
  process.env.MOI_STORE_PATH ||
  (process.env.NODE_ENV === 'test' || process.env.VITEST
    ? path.join(DATA_DIR, 'moi-store.test.json')
    : path.join(DATA_DIR, 'moi-store.json'));

export function createInitialState(): MoiDatabaseState {
  const now = new Date().toISOString();
  const agentWallet =
    (process.env.AGENT_WALLET_ADDRESS as `0x${string}`) ||
    '0x7a9d56e55Aa0C069118F47aF2ebe675cf0fc1fF6';
  const ownerWallet = null;
  const erc8004Id = process.env.ERC8004_AGENT_ID
    ? Number(process.env.ERC8004_AGENT_ID)
    : undefined;

  const defaultMandates: TreasuryMandate[] = [
    {
      id: 'mandate_cngn_usdt',
      treasuryId: 'treasury_main',
      agentId: 'agent_fx_treasury',
      name: 'Nigeria Operating Treasury · cNGN → USD₮',
      naturalLanguageIntent:
        'Preserve a minimum operating reserve of 50,000 cNGN. Convert excess cNGN into USD₮ up to 25,000 cNGN per trade and 100,000 cNGN per day when Textile FX quotes within 100 bps slippage.',
      mode: 'approval_required',
      executionStrategy: 'hybrid',
      chainId: 42220,
      sellToken: CELO_VERIFIED_ASSETS.cNGN.address,
      buyToken: CELO_VERIFIED_ASSETS.USDT.address,
      minimumReserveAtomic: '50000000000', // 50,000 cNGN (6 decimals)
      maxTradeAtomic: '25000000000', // 25,000 cNGN (6 decimals)
      dailySellCapAtomic: '100000000000', // 100,000 cNGN (6 decimals)
      minBuyAmountAtomic: '1000000', // 1.00 USD₮ minimum output floor
      maxSlippageBps: 100,
      maxProtocolFeeBps: 25,
      maxDailyLossAtomic: '5000000000',
      allowedTargets: [
        TEXTILE_CONTRACTS.LimitOrderReactor,
        TEXTILE_CONTRACTS.Permit2,
      ],
      serviceSpendPerCallAtomic: '50000', // 0.05 USD
      serviceDailyCapAtomic: '500000', // 0.50 USD
      stitchBaseSpreadBps: 15,
      stitchInventorySkewBps: 12,
      paused: false,
      updatedAt: now,
    },
    {
      id: 'mandate_wars_usdt',
      treasuryId: 'treasury_main',
      agentId: 'agent_stitch_filler',
      name: 'LatAm Ripio Corridor · wARS ↔ USD₮ (Stitch + RFQ)',
      naturalLanguageIntent:
        'Preserve 100,000 wARS reserve for local Argentine payroll. Quote passive liquidity on Textile Stitch with ±18 bps spread and 15 bps inventory skew, or rebalance excess up to 50,000 wARS per trade.',
      mode: 'autonomous',
      executionStrategy: 'passive_stitch_filler',
      chainId: 42220,
      sellToken: CELO_VERIFIED_ASSETS.wARS.address,
      buyToken: CELO_VERIFIED_ASSETS.USDT.address,
      minimumReserveAtomic: '100000000000000000000000', // 100,000 wARS (18 decimals)
      maxTradeAtomic: '50000000000000000000000', // 50,000 wARS (18 decimals)
      dailySellCapAtomic: '250000000000000000000000', // 250,000 wARS (18 decimals)
      minBuyAmountAtomic: '1000000',
      maxSlippageBps: 100,
      maxProtocolFeeBps: 25,
      allowedTargets: [
        TEXTILE_CONTRACTS.LimitOrderReactor,
        TEXTILE_CONTRACTS.Permit2,
      ],
      serviceSpendPerCallAtomic: '50000',
      serviceDailyCapAtomic: '500000',
      stitchBaseSpreadBps: 18,
      stitchInventorySkewBps: 15,
      paused: false,
      updatedAt: now,
    },
    {
      id: 'mandate_wbrl_usdt',
      treasuryId: 'treasury_main',
      agentId: 'agent_x402_research',
      name: 'Brazil Merchant Corridor · wBRL → USD₮ & x402 Audit',
      naturalLanguageIntent:
        'Preserve 1,000 wBRL reserve. Convert excess wBRL up to 500 wBRL per trade and verify every settled receipt via Chainstack & Cencori over x402.',
      mode: 'approval_required',
      executionStrategy: 'taker_rfq',
      chainId: 42220,
      sellToken: CELO_VERIFIED_ASSETS.wBRL.address,
      buyToken: CELO_VERIFIED_ASSETS.USDT.address,
      minimumReserveAtomic: '1000000000000000000000', // 1,000 wBRL (18 decimals)
      maxTradeAtomic: '500000000000000000000', // 500 wBRL (18 decimals)
      dailySellCapAtomic: '2500000000000000000000', // 2,500 wBRL (18 decimals)
      minBuyAmountAtomic: '1000000',
      maxSlippageBps: 100,
      maxProtocolFeeBps: 25,
      allowedTargets: [
        TEXTILE_CONTRACTS.LimitOrderReactor,
        TEXTILE_CONTRACTS.Permit2,
      ],
      serviceSpendPerCallAtomic: '50000',
      serviceDailyCapAtomic: '500000',
      stitchBaseSpreadBps: 16,
      stitchInventorySkewBps: 10,
      paused: false,
      updatedAt: now,
    },
    {
      id: 'mandate_celo_usdt',
      treasuryId: 'treasury_main',
      agentId: 'agent_fx_treasury',
      name: 'Celo Native Treasury · CELO ↔ USD₮',
      naturalLanguageIntent:
        'Maintain reserve of 10 CELO for gas. Convert excess CELO into USD₮ on Uniswap v3 / Textile to de-risk treasury holdings.',
      mode: 'autonomous',
      executionStrategy: 'taker_rfq',
      chainId: 42220,
      sellToken: CELO_VERIFIED_ASSETS.CELO.address,
      buyToken: CELO_VERIFIED_ASSETS.USDT.address,
      minimumReserveAtomic: '10000000000000000000', // 10 CELO (18 decimals)
      maxTradeAtomic: '50000000000000000000', // 50 CELO
      dailySellCapAtomic: '200000000000000000000', // 200 CELO
      minBuyAmountAtomic: '500000', // 0.50 USDT
      maxSlippageBps: 100,
      maxProtocolFeeBps: 25,
      allowedTargets: [
        TEXTILE_CONTRACTS.LimitOrderReactor,
        TEXTILE_CONTRACTS.Permit2,
        '0x5615CDAb10dc425a742d643d949a7F474C01abc4',
      ],
      serviceSpendPerCallAtomic: '50000',
      serviceDailyCapAtomic: '500000',
      stitchBaseSpreadBps: 20,
      stitchInventorySkewBps: 15,
      paused: false,
      updatedAt: now,
    },
    {
      id: 'mandate_wcop_usdt',
      treasuryId: 'treasury_main',
      agentId: 'agent_stitch_filler',
      name: 'Colombia Corridor · wCOP ↔ USD₮ (Ripio)',
      naturalLanguageIntent:
        'Preserve 500,000 wCOP reserve for local operations. Convert excess wCOP into USD₮ at guaranteed zero-slippage rates.',
      mode: 'autonomous',
      executionStrategy: 'taker_rfq',
      chainId: 42220,
      sellToken: CELO_VERIFIED_ASSETS.wCOP.address,
      buyToken: CELO_VERIFIED_ASSETS.USDT.address,
      minimumReserveAtomic: '500000000000000000000000', // 500,000 wCOP (18 decimals)
      maxTradeAtomic: '250000000000000000000000', // 250,000 wCOP
      dailySellCapAtomic: '1000000000000000000000000', // 1,000,000 wCOP
      minBuyAmountAtomic: '1000000',
      maxSlippageBps: 100,
      maxProtocolFeeBps: 25,
      allowedTargets: [
        TEXTILE_CONTRACTS.LimitOrderReactor,
        TEXTILE_CONTRACTS.Permit2,
      ],
      serviceSpendPerCallAtomic: '50000',
      serviceDailyCapAtomic: '500000',
      stitchBaseSpreadBps: 18,
      stitchInventorySkewBps: 12,
      paused: false,
      updatedAt: now,
    },
    {
      id: 'mandate_wmxn_usdt',
      treasuryId: 'treasury_main',
      agentId: 'agent_stitch_filler',
      name: 'Mexico Corridor · wMXN ↔ USD₮ (Ripio)',
      naturalLanguageIntent:
        'Preserve 2,000 wMXN reserve. Convert excess wMXN into USD₮ with automated policy enforcement.',
      mode: 'autonomous',
      executionStrategy: 'taker_rfq',
      chainId: 42220,
      sellToken: CELO_VERIFIED_ASSETS.wMXN.address,
      buyToken: CELO_VERIFIED_ASSETS.USDT.address,
      minimumReserveAtomic: '2000000000000000000000', // 2,000 wMXN (18 decimals)
      maxTradeAtomic: '1000000000000000000000', // 1,000 wMXN
      dailySellCapAtomic: '5000000000000000000000', // 5,000 wMXN
      minBuyAmountAtomic: '1000000',
      maxSlippageBps: 100,
      maxProtocolFeeBps: 25,
      allowedTargets: [
        TEXTILE_CONTRACTS.LimitOrderReactor,
        TEXTILE_CONTRACTS.Permit2,
      ],
      serviceSpendPerCallAtomic: '50000',
      serviceDailyCapAtomic: '500000',
      stitchBaseSpreadBps: 18,
      stitchInventorySkewBps: 12,
      paused: false,
      updatedAt: now,
    },
  ];

  const defaultAgents: AgentProfileRecord[] = [
    {
      id: 'agent_fx_treasury',
      treasuryId: 'treasury_main',
      name: 'Trading & Treasury Agent',
      role: 'treasury_rebalancer',
      description:
        'Executes deterministic FX conversions across cNGN, wARS & wBRL → USD₮ on Textile FX v2 within mandate limits.',
      walletAddress: agentWallet,
      erc8004AgentId: erc8004Id,
      erc8004Registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      active: true,
      mandateId: 'mandate_cngn_usdt',
      createdAt: now,
    },
    {
      id: 'agent_stitch_filler',
      treasuryId: 'treasury_main',
      name: 'Yield & Stitch Quoting Agent',
      role: 'stitch_filler',
      description:
        'Publishes adaptive Avellaneda-Stoikov inventory-skewed FX quotes to Textile Stitch so the treasury earns maker spread.',
      walletAddress: agentWallet,
      erc8004AgentId: erc8004Id,
      erc8004Registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      active: true,
      mandateId: 'mandate_wars_usdt',
      createdAt: now,
    },
    {
      id: 'agent_x402_research',
      treasuryId: 'treasury_main',
      name: 'Research & x402 Reconciliation Agent',
      role: 'x402_reconciler',
      description:
        'Purchases external Celo RPC verification (Chainstack) & corridor intelligence (TikHub / Cencori) over buy/x402.',
      walletAddress: agentWallet,
      erc8004AgentId: erc8004Id,
      erc8004Registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      active: true,
      mandateId: 'mandate_wbrl_usdt',
      createdAt: now,
    },
  ];

  return {
    userProfile: {
      id: 'usr_owner_1',
      displayName: 'Treasury Operator',
      email: 'treasury@company.co',
      organization: 'MOI Global Treasury',
      roleTitle: 'Treasury Manager',
      primaryRegion: 'Nigeria & LatAm Corridors',
      preferredBaseSymbol: 'cNGN',
      walletAddress: null,
      walletConnected: false,
      siweVerified: false,
      avatarInitials: 'TO',
      notifyOnPolicyReject: true,
      notifyOnSwapSettled: true,
      notifyOnX402Purchase: true,
      updatedAt: now,
    },
    registeredUsers: [
      {
        id: 'usr_owner_1',
        displayName: 'Treasury Operator',
        email: 'treasury@company.co',
        organization: 'MOI Global Treasury',
        roleTitle: 'Treasury Manager',
        primaryRegion: 'Nigeria & LatAm Corridors',
        preferredBaseSymbol: 'cNGN',
        walletAddress: null,
        walletConnected: false,
        siweVerified: false,
        avatarInitials: 'TO',
        notifyOnPolicyReject: true,
        notifyOnSwapSettled: true,
        notifyOnX402Purchase: true,
        updatedAt: now,
      },
    ],
    treasury: {
      id: 'treasury_main',
      name: 'MOI Primary Celo Mainnet Treasury',
      ownerUserId: 'usr_owner_1',
      ownerWalletAddress: ownerWallet,
      agentWalletAddress: agentWallet,
      chainId: 42220,
      createdAt: now,
      updatedAt: now,
    },
    treasuries: [
      {
        id: 'treasury_main',
        name: 'MOI Primary Celo Mainnet Treasury',
        ownerUserId: 'usr_owner_1',
        ownerWalletAddress: ownerWallet,
        agentWalletAddress: agentWallet,
        chainId: 42220,
        createdAt: now,
        updatedAt: now,
      },
    ],
    agents: defaultAgents,
    mandates: defaultMandates,
    executions: [],
    ledgerEntries: [],
    servicePurchases: [],
    auditEvents: [
      {
        id: `audit_init_${Date.now()}`,
        treasuryId: 'treasury_main',
        agentId: 'agent_fx_treasury',
        category: 'SECURITY_CONTROL',
        severity: 'INFO',
        title: 'MOI Deterministic Treasury OS Initialized',
        detail:
          'Configured Celo Mainnet (42220) LimitOrderReactor (0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3), ERC-8004 Registry (0x8004A169FB4a3325136EB29fA0ceB6D2e539a432), and ERC-8021 calldata attribution.',
        createdAt: now,
      },
    ],
    executionLocks: {},
    sessions: [],
    nonces: [],
    firstTradeAuthorizations: [],
    attestationConsumptions: [],
    webhookEvents: [],
    invoices: [],
  };
}

export class MoiDatabase {
  private state: MoiDatabaseState;

  constructor() {
    this.state = this.load();
  }

  private load(): MoiDatabaseState {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as MoiDatabaseState;
        if (!parsed.treasuries || parsed.treasuries.length === 0) {
          parsed.treasuries = [parsed.treasury];
        }
        if (!parsed.sessions) {
          parsed.sessions = [];
        }
        if (!parsed.nonces) {
          parsed.nonces = [];
        }
        if (!parsed.firstTradeAuthorizations) {
          parsed.firstTradeAuthorizations = [];
        }
        if (!parsed.attestationConsumptions) {
          parsed.attestationConsumptions = [];
        }
        if (!parsed.webhookEvents) {
          parsed.webhookEvents = [];
        }
        if (!parsed.invoices) {
          parsed.invoices = [];
        }
        return parsed;
      }
    } catch {
      // Fall through to initialize fresh store
    }
    const initial = createInitialState();
    this.save(initial);
    return initial;
  }

  private save(nextState: MoiDatabaseState = this.state): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${STORE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(nextState, null, 2), 'utf-8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch {
      // Ignore write errors in read-only environments
    }
  }

  resetToInitialState(): MoiDatabaseState {
    const initial = createInitialState();
    this.state = initial;
    this.save(initial);
    return initial;
  }

  getState(): MoiDatabaseState {
    this.state = this.load();
    if (!this.state.userProfile) {
      const now = new Date().toISOString();
      this.state.userProfile = {
        id: 'usr_owner_1',
        displayName: 'Treasury Operator',
        email: '',
        organization: 'MOI Global Treasury',
        roleTitle: 'Treasury Manager',
        primaryRegion: 'Nigeria & LatAm Corridors',
        preferredBaseSymbol: 'cNGN',
        walletAddress: null,
        walletConnected: false,
        siweVerified: false,
        avatarInitials: 'TO',
        notifyOnPolicyReject: true,
        notifyOnSwapSettled: true,
        notifyOnX402Purchase: true,
        updatedAt: now,
      };
    }
    return this.state;
  }

  updateUserProfile(
    patch: Partial<UserProfileRecord>
  ): MoiDatabaseState {
    this.state = this.getState();
    // Security: never allow arbitrary client payload to override cryptographic siweVerified state
    const { siweVerified: _ignoredSiwe, ...sanitizedPatch } = patch;
    const merged: UserProfileRecord = {
      ...this.state.userProfile,
      ...sanitizedPatch,
      updatedAt: new Date().toISOString(),
    };
    const parts = (merged.displayName || 'Treasury Operator').trim().split(/\s+/);
    merged.avatarInitials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : (merged.displayName.slice(0, 2) || 'TO').toUpperCase();

    if (merged.walletAddress && /^0x[a-fA-F0-9]{40}$/.test(merged.walletAddress)) {
      this.state.treasury.ownerWalletAddress = merged.walletAddress;
      for (const t of this.state.treasuries || []) {
        if (t.id === this.state.treasury.id) {
          t.ownerWalletAddress = merged.walletAddress;
        }
      }
      merged.walletConnected = true;
    }
    if (merged.organization) {
      this.state.treasury.name = `${merged.organization} · Celo Treasury`;
    }
    this.state.userProfile = merged;

    if (!this.state.registeredUsers) {
      this.state.registeredUsers = [merged];
    } else {
      const idx = this.state.registeredUsers.findIndex(
        (u) =>
          (merged.email && u.email && u.email.toLowerCase() === merged.email.toLowerCase()) ||
          (merged.walletAddress && u.walletAddress && u.walletAddress.toLowerCase() === merged.walletAddress.toLowerCase())
      );
      if (idx >= 0) {
        this.state.registeredUsers[idx] = { ...this.state.registeredUsers[idx], ...merged };
      } else {
        this.state.registeredUsers.push(merged);
      }
    }

    this.appendAuditEvent({
      treasuryId: this.state.treasury.id,
      category: 'SECURITY_CONTROL',
      severity: 'SUCCESS',
      title: 'Operator Profile & Wallet Updated',
      detail: `Operator "${merged.displayName}" (${merged.email || 'no-email'}) connected wallet ${merged.walletAddress || 'pending'} for ${merged.organization}.`,
    });
    this.save();
    return this.state;
  }

  findAccount(query: { email?: string; walletAddress?: string }): UserProfileRecord | null {
    const state = this.getState();
    const users = state.registeredUsers && state.registeredUsers.length > 0 ? state.registeredUsers : [state.userProfile];
    const emailNorm = query.email?.trim().toLowerCase();
    const walletNorm = query.walletAddress?.trim().toLowerCase();

    return (
      users.find((u) => {
        if (emailNorm && u.email && u.email.trim().toLowerCase() === emailNorm) {
          return true;
        }
        if (walletNorm && u.walletAddress && u.walletAddress.trim().toLowerCase() === walletNorm) {
          return true;
        }
        return false;
      }) || null
    );
  }

  signInUser(query: {
    email?: string;
    walletAddress?: string;
    siweSignaturePreview?: string;
  }): { ok: boolean; userProfile?: UserProfileRecord; error?: string } {
    this.state = this.getState();
    const account = this.findAccount(query);
    if (!account) {
      return {
        ok: false,
        error: 'No registered account found. Please sign up to create your treasury profile.',
      };
    }
    const targetWallet = (query.walletAddress as `0x${string}`) || account.walletAddress;
    const updatedUser: UserProfileRecord = {
      ...account,
      walletAddress: targetWallet,
      walletConnected: Boolean(targetWallet),
      // Preserve existing verified state only if already verified; never set true from untrusted sign_in
      siweVerified: Boolean(account.siweVerified),
      siweSignaturePreview: query.siweSignaturePreview || account.siweSignaturePreview,
      updatedAt: new Date().toISOString(),
    };
    this.state.userProfile = updatedUser;
    if (targetWallet) {
      this.state.treasury.ownerWalletAddress = targetWallet;
    }
    if (updatedUser.organization) {
      this.state.treasury.name = `${updatedUser.organization} · Celo Treasury`;
    }
    if (!this.state.registeredUsers) {
      this.state.registeredUsers = [updatedUser];
    } else {
      const idx = this.state.registeredUsers.findIndex(
        (u) =>
          u.id === updatedUser.id ||
          (updatedUser.email && u.email && u.email.toLowerCase() === updatedUser.email.toLowerCase())
      );
      if (idx >= 0) {
        this.state.registeredUsers[idx] = updatedUser;
      } else {
        this.state.registeredUsers.push(updatedUser);
      }
    }
    this.appendAuditEvent({
      treasuryId: this.state.treasury.id,
      category: 'SECURITY_CONTROL',
      severity: 'SUCCESS',
      title: 'Operator Signed In',
      detail: `Operator "${updatedUser.displayName}" (${updatedUser.email}) authenticated with wallet ${updatedUser.walletAddress}.`,
    });
    this.save();
    return { ok: true, userProfile: updatedUser };
  }

  signUpUser(profile: Partial<UserProfileRecord>): {
    ok: boolean;
    userProfile: UserProfileRecord;
  } {
    this.state = this.getState();
    const now = new Date().toISOString();
    const id = `usr_${Date.now()}`;
    const parts = (profile.displayName || 'Treasury Operator').trim().split(/\s+/);
    const avatarInitials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : (profile.displayName?.slice(0, 2) || 'TO').toUpperCase();

    const targetWallet = (profile.walletAddress as `0x${string}`) || null;
    const newUser: UserProfileRecord = {
      id,
      displayName: profile.displayName?.trim() || 'Treasury Operator',
      email: profile.email?.trim() || '',
      organization: profile.organization?.trim() || 'MOI Global Treasury',
      roleTitle: profile.roleTitle?.trim() || 'Treasury Manager',
      primaryRegion: profile.primaryRegion?.trim() || 'Nigeria & LatAm Corridors',
      preferredBaseSymbol: profile.preferredBaseSymbol || 'cNGN',
      walletAddress: targetWallet,
      walletConnected: Boolean(targetWallet),
      // Invariant: New profiles must be explicitly verified via cryptographic SIWE verification
      siweVerified: false,
      siweSignaturePreview: profile.siweSignaturePreview,
      avatarInitials,
      notifyOnPolicyReject: true,
      notifyOnSwapSettled: true,
      notifyOnX402Purchase: true,
      updatedAt: now,
    };

    this.state.userProfile = newUser;
    if (!this.state.registeredUsers) {
      this.state.registeredUsers = [newUser];
    } else {
      const idx = this.state.registeredUsers.findIndex(
        (u) => u.email && newUser.email && u.email.toLowerCase() === newUser.email.toLowerCase()
      );
      if (idx >= 0) {
        this.state.registeredUsers[idx] = newUser;
      } else {
        this.state.registeredUsers.push(newUser);
      }
    }
    if (newUser.walletAddress) {
      this.state.treasury.ownerWalletAddress = newUser.walletAddress;
    }
    if (newUser.organization) {
      this.state.treasury.name = `${newUser.organization} · Celo Treasury`;
    }
    this.appendAuditEvent({
      treasuryId: this.state.treasury.id,
      category: 'SECURITY_CONTROL',
      severity: 'SUCCESS',
      title: 'New Operator Account Created',
      detail: `Operator account created for "${newUser.displayName}" (${newUser.email}) with wallet ${newUser.walletAddress || 'pending'}.`,
    });
    this.save();
    return { ok: true, userProfile: newUser };
  }

  authenticateVerifiedWallet(
    walletAddress: `0x${string}`,
    extraProfile?: Partial<UserProfileRecord>
  ): UserProfileRecord {
    this.state = this.getState();
    const normalized = walletAddress.toLowerCase() as `0x${string}`;
    const account = this.findAccount({ walletAddress: normalized });

    let updatedUser: UserProfileRecord;
    if (account) {
      updatedUser = {
        ...account,
        ...extraProfile,
        walletAddress: walletAddress,
        walletConnected: true,
        siweVerified: true,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const now = new Date().toISOString();
      const id = `usr_${Date.now()}`;
      const displayName = extraProfile?.displayName || 'Treasury Operator';
      const parts = displayName.trim().split(/\s+/);
      const avatarInitials =
        parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : (displayName.slice(0, 2) || 'TO').toUpperCase();

      updatedUser = {
        id,
        displayName,
        email: extraProfile?.email || '',
        organization: extraProfile?.organization || 'MOI Global Treasury',
        roleTitle: extraProfile?.roleTitle || 'Treasury Manager',
        primaryRegion: extraProfile?.primaryRegion || 'Nigeria & LatAm Corridors',
        preferredBaseSymbol: extraProfile?.preferredBaseSymbol || 'cNGN',
        walletAddress: walletAddress,
        walletConnected: true,
        siweVerified: true,
        avatarInitials,
        notifyOnPolicyReject: true,
        notifyOnSwapSettled: true,
        notifyOnX402Purchase: true,
        updatedAt: now,
      };
    }

    this.state.userProfile = updatedUser;
    this.state.treasury.ownerWalletAddress = walletAddress;
    if (updatedUser.organization) {
      this.state.treasury.name = `${updatedUser.organization} · Celo Treasury`;
    }

    if (!this.state.registeredUsers) {
      this.state.registeredUsers = [updatedUser];
    } else {
      const idx = this.state.registeredUsers.findIndex(
        (u) =>
          u.id === updatedUser.id ||
          (u.walletAddress && u.walletAddress.toLowerCase() === normalized) ||
          (updatedUser.email && u.email && u.email.toLowerCase() === updatedUser.email.toLowerCase())
      );
      if (idx >= 0) {
        this.state.registeredUsers[idx] = updatedUser;
      } else {
        this.state.registeredUsers.push(updatedUser);
      }
    }

    this.appendAuditEvent({
      treasuryId: this.state.treasury.id,
      category: 'SECURITY_CONTROL',
      severity: 'SUCCESS',
      title: 'Operator Authenticated via SIWE Verification',
      detail: `Operator wallet ${walletAddress} cryptographically authenticated via server-verified EIP-4361 signature.`,
    });

    this.save();
    return updatedUser;
  }

  getOrCreateUser(
    walletAddress: string,
    extraProfile?: Partial<UserProfileRecord>
  ): UserProfileRecord {
    return this.authenticateVerifiedWallet(
      walletAddress as `0x${string}`,
      extraProfile
    );
  }

  deauthenticateWallet(): UserProfileRecord {
    return this.resetProfileOnDisconnect();
  }

  resetProfileOnDisconnect(): UserProfileRecord {
    this.state = this.getState();
    const defaultProfile: UserProfileRecord = {
      id: 'usr_default',
      displayName: 'Operator',
      email: '',
      organization: 'MOI Global Treasury',
      roleTitle: 'Treasury Manager',
      primaryRegion: 'Nigeria & LatAm Corridors',
      preferredBaseSymbol: 'cNGN',
      walletAddress: null,
      walletConnected: false,
      siweVerified: false,
      avatarInitials: 'OP',
      notifyOnPolicyReject: true,
      notifyOnSwapSettled: true,
      notifyOnX402Purchase: true,
      updatedAt: new Date().toISOString(),
    };
    this.state.userProfile = defaultProfile;
    this.state.treasury.ownerWalletAddress = null;
    for (const t of this.state.treasuries || []) {
      if (t.id === this.state.treasury.id) {
        t.ownerWalletAddress = null;
      }
    }
    this.appendAuditEvent({
      treasuryId: this.state.treasury.id,
      category: 'SECURITY_CONTROL',
      severity: 'INFO',
      title: 'Operator Disconnected',
      detail: 'Wallet disconnected. Operator profile and active session reset.',
    });
    this.save();
    return defaultProfile;
  }

  updateOwnerWallet(address: `0x${string}`): MoiDatabaseState {
    this.state = this.load();
    this.state.treasury.ownerWalletAddress = address;
    this.appendAuditEvent({
      treasuryId: this.state.treasury.id,
      category: 'SECURITY_CONTROL',
      severity: 'SUCCESS',
      title: 'Treasury Owner Wallet Authenticated',
      detail: `Connected Celo Mainnet owner wallet ${address}.`,
    });
    this.save();
    return this.state;
  }

  updateMandate(mandate: TreasuryMandate): TreasuryMandate {
    this.state = this.load();
    const idx = this.state.mandates.findIndex((m) => m.id === mandate.id);
    const updated = { ...mandate, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      this.state.mandates[idx] = updated;
    } else {
      this.state.mandates.push(updated);
    }
    this.appendAuditEvent({
      treasuryId: updated.treasuryId,
      agentId: updated.agentId,
      category: 'SECURITY_CONTROL',
      severity: updated.paused ? 'WARNING' : 'INFO',
      title: updated.paused
        ? `Mandate Paused: ${updated.name}`
        : `Mandate Policy Updated: ${updated.name}`,
      detail: `Mode=${updated.mode}, Strategy=${updated.executionStrategy}, MinReserve=${updated.minimumReserveAtomic}, MaxTrade=${updated.maxTradeAtomic}, DailyCap=${updated.dailySellCapAtomic}, Paused=${updated.paused}.`,
    });
    this.save();
    return updated;
  }

  toggleEmergencyPauseAll(paused: boolean): MoiDatabaseState {
    this.state = this.load();
    for (const m of this.state.mandates) {
      m.paused = paused;
      m.updatedAt = new Date().toISOString();
    }
    for (const a of this.state.agents) {
      a.active = !paused;
    }
    this.appendAuditEvent({
      treasuryId: this.state.treasury.id,
      category: 'SECURITY_CONTROL',
      severity: paused ? 'CRITICAL' : 'SUCCESS',
      title: paused
        ? 'EMERGENCY STOP ACTIVATED — All Autonomous Execution Halted'
        : 'Emergency Stop Cleared — Mandates Resumed',
      detail: paused
        ? 'User triggered global emergency stop. All signing & new RFQ requests are blocked immediately; in-flight settlement reconciliation remains active.'
        : 'User lifted emergency stop across treasury mandates.',
    });
    this.save();
    return this.state;
  }

  toggleAgentActive(agentId: string, active: boolean): AgentProfileRecord | undefined {
    this.state = this.load();
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.active = active;
      const mandate = this.state.mandates.find((m) => m.id === agent.mandateId);
      if (mandate) {
        mandate.paused = !active;
        mandate.updatedAt = new Date().toISOString();
      }
      this.appendAuditEvent({
        treasuryId: agent.treasuryId,
        agentId: agent.id,
        category: 'SECURITY_CONTROL',
        severity: active ? 'SUCCESS' : 'WARNING',
        title: `${agent.name} ${active ? 'Enabled' : 'Paused'}`,
        detail: `Agent status toggled to ${active ? 'Active' : 'Paused'}.`,
      });
      this.save();
    }
    return agent;
  }

  updateAgentIdentity(
    agentId: string,
    erc8004AgentId: number,
    erc8004Registry: `0x${string}`
  ): boolean {
    this.state = this.load();
    const agent =
      this.state.agents.find((a) => a.id === agentId) || this.state.agents[0];
    if (agent) {
      agent.erc8004AgentId = erc8004AgentId;
      agent.erc8004Registry = erc8004Registry;
      this.save();
      return true;
    }
    return false;
  }

  acquireExecutionLock(mandateId: string, executionId: string): boolean {
    this.state = this.load();
    const existing = this.state.executionLocks[mandateId];
    const now = Date.now();
    // Auto-expire stale locks older than 90 seconds
    if (existing && now - existing.lockedAt < 90_000) {
      return false;
    }
    this.state.executionLocks[mandateId] = { lockedAt: now, executionId };
    this.save();
    return true;
  }

  releaseExecutionLock(mandateId: string): void {
    this.state = this.load();
    delete this.state.executionLocks[mandateId];
    this.save();
  }

  isMandateLocked(mandateId: string): boolean {
    this.state = this.load();
    const existing = this.state.executionLocks[mandateId];
    return Boolean(existing && Date.now() - existing.lockedAt < 90_000);
  }

  getDailySoldAtomic(mandateId: string): string {
    this.state = this.load();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let sum = 0n;
    for (const ex of this.state.executions) {
      if (
        ex.mandateId === mandateId &&
        (ex.state === 'SUBMITTED' ||
          ex.state === 'CONFIRMED' ||
          ex.state === 'RECONCILED') &&
        Date.parse(ex.createdAt) >= cutoff
      ) {
        sum += BigInt(
          ex.settledSellAtomic ||
            ex.quotedTakerPaysAtomic ||
            ex.requestedSellAtomic ||
            '0'
        );
      }
    }
    return sum.toString();
  }

  getDailyServiceSpendAtomic(treasuryId: string): string {
    this.state = this.load();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let sum = 0n;
    for (const sp of this.state.servicePurchases) {
      if (
        sp.treasuryId === treasuryId &&
        (sp.status === 'PAID_AND_VERIFIED' || sp.status === 'AUTHORIZED') &&
        Date.parse(sp.createdAt) >= cutoff
      ) {
        sum += BigInt(sp.amountAtomic);
      }
    }
    return sum.toString();
  }

  upsertExecution(execution: ExecutionRecord): ExecutionRecord {
    this.state = this.load();
    const idx = this.state.executions.findIndex(
      (e) =>
        e.id === execution.id || e.idempotencyKey === execution.idempotencyKey
    );
    const updated = { ...execution, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      this.state.executions[idx] = updated;
    } else {
      this.state.executions.unshift(updated);
    }
    this.save();
    return updated;
  }

  recordLedgerEntries(entries: LedgerEntryRecord[]): void {
    this.state = this.load();
    this.state.ledgerEntries.unshift(...entries);
    this.save();
  }

  recordServicePurchase(purchase: ServicePurchaseRecord): void {
    this.state = this.load();
    this.state.servicePurchases.unshift(purchase);
    this.save();
  }

  appendAuditEvent(
    event: Omit<AuditEventRecord, 'id' | 'createdAt'>
  ): AuditEventRecord {
    const full: AuditEventRecord = {
      ...event,
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.state.auditEvents.unshift(full);
    if (this.state.auditEvents.length > 250) {
      this.state.auditEvents.length = 250;
    }
    this.save();
    return full;
  }

  // =========================================================================
  // MULTI-TENANT ISOLATION & SCOPING (Milestone 1.2)
  // =========================================================================

  getUserById(userId: string): UserProfileRecord | null {
    this.state = this.load();
    const users =
      this.state.registeredUsers && this.state.registeredUsers.length > 0
        ? this.state.registeredUsers
        : [this.state.userProfile];
    return (
      users.find((u) => u.id === userId) ||
      (this.state.userProfile?.id === userId ? this.state.userProfile : null)
    );
  }

  getUserByWallet(walletAddress: string): UserProfileRecord | null {
    this.state = this.load();
    const norm = walletAddress.toLowerCase();
    const users =
      this.state.registeredUsers && this.state.registeredUsers.length > 0
        ? this.state.registeredUsers
        : [this.state.userProfile];
    return (
      users.find((u) => u.walletAddress && u.walletAddress.toLowerCase() === norm) ||
      (this.state.userProfile?.walletAddress &&
      this.state.userProfile.walletAddress.toLowerCase() === norm
        ? this.state.userProfile
        : null)
    );
  }

  getOrCreateUserTreasury(
    userId: string,
    defaultWallet?: `0x${string}`
  ): TreasuryRecord {
    this.state = this.load();
    if (!this.state.treasuries) {
      this.state.treasuries = [this.state.treasury];
    }

    let treasury = this.state.treasuries.find((t) => t.ownerUserId === userId);
    if (!treasury) {
      const user = this.getUserById(userId) || this.state.userProfile;
      const wallet =
        defaultWallet ||
        (user?.walletAddress as `0x${string}`) ||
        '0x7a9d56e55Aa0C069118F47aF2ebe675cf0fc1fF6';
      const now = new Date().toISOString();
      const treasuryId = `treasury_${userId}`;
      const agentWallet =
        (process.env.AGENT_WALLET_ADDRESS as `0x${string}`) ||
        '0x7a9d56e55Aa0C069118F47aF2ebe675cf0fc1fF6';

      treasury = {
        id: treasuryId,
        name: user.organization
          ? `${user.organization} · Celo Treasury`
          : `${user.displayName}'s Celo Treasury`,
        ownerUserId: userId,
        ownerWalletAddress: wallet,
        agentWalletAddress: agentWallet,
        chainId: 42220,
        createdAt: now,
        updatedAt: now,
      };
      this.state.treasuries.push(treasury);

      // Create isolated default mandate for this new tenant
      const tenantMandate: TreasuryMandate = {
        id: `mandate_${userId}_cngn_usdt`,
        treasuryId: treasury.id,
        agentId: `agent_${userId}_fx`,
        name: `${user.displayName || 'Operator'} · cNGN → USD₮ Mandate`,
        naturalLanguageIntent:
          'Preserve 50,000 cNGN reserve and convert excess into USD₮ up to 25,000 cNGN per trade.',
        mode: 'approval_required',
        executionStrategy: 'hybrid',
        chainId: 42220,
        sellToken: CELO_VERIFIED_ASSETS.cNGN.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        minimumReserveAtomic: '50000000000',
        maxTradeAtomic: '25000000000',
        dailySellCapAtomic: '100000000000',
        minBuyAmountAtomic: '1000000',
        maxSlippageBps: 100,
        maxProtocolFeeBps: 25,
        allowedTargets: [
          TEXTILE_CONTRACTS.LimitOrderReactor,
          TEXTILE_CONTRACTS.Permit2,
        ],
        serviceSpendPerCallAtomic: '50000',
        serviceDailyCapAtomic: '500000',
        stitchBaseSpreadBps: 18,
        stitchInventorySkewBps: 12,
        paused: false,
        updatedAt: now,
      };
      this.state.mandates.push(tenantMandate);

      // LatAm wARS Mandate
      this.state.mandates.push({
        id: `mandate_${userId}_wars_usdt`,
        treasuryId: treasury.id,
        agentId: `agent_${userId}_fx`,
        name: `${user.displayName || 'Operator'} · wARS ↔ USD₮ Mandate`,
        naturalLanguageIntent: 'Preserve 100,000 wARS and convert excess to USD₮.',
        mode: 'autonomous',
        executionStrategy: 'passive_stitch_filler',
        chainId: 42220,
        sellToken: CELO_VERIFIED_ASSETS.wARS.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        minimumReserveAtomic: '100000000000000000000000',
        maxTradeAtomic: '50000000000000000000000',
        dailySellCapAtomic: '250000000000000000000000',
        minBuyAmountAtomic: '1000000',
        maxSlippageBps: 100,
        maxProtocolFeeBps: 25,
        allowedTargets: [TEXTILE_CONTRACTS.LimitOrderReactor, TEXTILE_CONTRACTS.Permit2],
        serviceSpendPerCallAtomic: '50000',
        serviceDailyCapAtomic: '500000',
        stitchBaseSpreadBps: 18,
        stitchInventorySkewBps: 15,
        paused: false,
        updatedAt: now,
      });

      // LatAm wBRL Mandate
      this.state.mandates.push({
        id: `mandate_${userId}_wbrl_usdt`,
        treasuryId: treasury.id,
        agentId: `agent_${userId}_fx`,
        name: `${user.displayName || 'Operator'} · wBRL ↔ USD₮ Mandate`,
        naturalLanguageIntent: 'Preserve 1,000 wBRL and convert excess to USD₮.',
        mode: 'approval_required',
        executionStrategy: 'taker_rfq',
        chainId: 42220,
        sellToken: CELO_VERIFIED_ASSETS.wBRL.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        minimumReserveAtomic: '1000000000000000000000',
        maxTradeAtomic: '500000000000000000000',
        dailySellCapAtomic: '2500000000000000000000',
        minBuyAmountAtomic: '1000000',
        maxSlippageBps: 100,
        maxProtocolFeeBps: 25,
        allowedTargets: [TEXTILE_CONTRACTS.LimitOrderReactor, TEXTILE_CONTRACTS.Permit2],
        serviceSpendPerCallAtomic: '50000',
        serviceDailyCapAtomic: '500000',
        stitchBaseSpreadBps: 16,
        stitchInventorySkewBps: 10,
        paused: false,
        updatedAt: now,
      });

      // Celo Native CELO Mandate
      this.state.mandates.push({
        id: `mandate_${userId}_celo_usdt`,
        treasuryId: treasury.id,
        agentId: `agent_${userId}_fx`,
        name: `${user.displayName || 'Operator'} · CELO ↔ USD₮ Mandate`,
        naturalLanguageIntent: 'Preserve 10 CELO and convert excess to USD₮.',
        mode: 'autonomous',
        executionStrategy: 'taker_rfq',
        chainId: 42220,
        sellToken: CELO_VERIFIED_ASSETS.CELO.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        minimumReserveAtomic: '10000000000000000000',
        maxTradeAtomic: '50000000000000000000',
        dailySellCapAtomic: '200000000000000000000',
        minBuyAmountAtomic: '500000',
        maxSlippageBps: 100,
        maxProtocolFeeBps: 25,
        allowedTargets: [
          TEXTILE_CONTRACTS.LimitOrderReactor,
          TEXTILE_CONTRACTS.Permit2,
          '0x5615CDAb10dc425a742d643d949a7F474C01abc4',
        ],
        serviceSpendPerCallAtomic: '50000',
        serviceDailyCapAtomic: '500000',
        stitchBaseSpreadBps: 20,
        stitchInventorySkewBps: 15,
        paused: false,
        updatedAt: now,
      });

      // Create isolated default agent for this tenant
      const tenantAgent: AgentProfileRecord = {
        id: `agent_${userId}_fx`,
        treasuryId: treasury.id,
        name: 'Trading & Treasury Agent',
        role: 'treasury_rebalancer',
        description:
          'Tenant trading agent executing deterministic FX conversions within mandate limits.',
        walletAddress: agentWallet,
        erc8004Registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        active: true,
        mandateId: tenantMandate.id,
        createdAt: now,
      };
      this.state.agents.push(tenantAgent);

      this.appendAuditEvent({
        treasuryId: treasury.id,
        category: 'SECURITY_CONTROL',
        severity: 'SUCCESS',
        title: 'Tenant Treasury Scoped & Provisioned',
        detail: `Dedicated multi-tenant treasury provisioned for user ${userId} (${wallet}).`,
      });

      this.save();
    }
    return treasury;
  }

  ensureCorridorMandatesForTreasury(treasuryId: string, userId: string): TreasuryMandate[] {
    const existing = this.state.mandates.filter((m) => m.treasuryId === treasuryId);
    const existingSellTokens = new Set(existing.map((m) => `${m.sellToken.toLowerCase()}_${m.buyToken.toLowerCase()}`));

    const corePairs = [
      {
        idSuffix: 'celo_usdt',
        name: 'Celo Native Treasury · CELO ↔ USD₮',
        sellToken: CELO_VERIFIED_ASSETS.CELO.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        intent: 'Maintain reserve of 10 CELO for gas. Convert excess CELO into USD₮ on Uniswap v3 / Textile.',
        minReserve: '10000000000000000000',
        maxTrade: '50000000000000000000',
        dailyCap: '200000000000000000000',
        mode: 'autonomous' as const,
        strategy: 'taker_rfq' as const,
      },
      {
        idSuffix: 'cngn_usdt',
        name: 'Nigeria Operating Treasury · cNGN ↔ USD₮',
        sellToken: CELO_VERIFIED_ASSETS.cNGN.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        intent: 'Preserve 50,000 cNGN reserve and convert excess into USD₮.',
        minReserve: '50000000000',
        maxTrade: '25000000000',
        dailyCap: '100000000000',
        mode: 'approval_required' as const,
        strategy: 'hybrid' as const,
      },
      {
        idSuffix: 'wars_usdt',
        name: 'LatAm Ripio Corridor · wARS ↔ USD₮',
        sellToken: CELO_VERIFIED_ASSETS.wARS.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        intent: 'Preserve 100,000 wARS and convert excess into USD₮ via Ripio rail.',
        minReserve: '100000000000000000000000',
        maxTrade: '50000000000000000000000',
        dailyCap: '250000000000000000000000',
        mode: 'autonomous' as const,
        strategy: 'passive_stitch_filler' as const,
      },
      {
        idSuffix: 'wbrl_usdt',
        name: 'Brazil Merchant Corridor · wBRL ↔ USD₮',
        sellToken: CELO_VERIFIED_ASSETS.wBRL.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        intent: 'Preserve 1,000 wBRL and convert excess into USD₮ via Ripio rail.',
        minReserve: '1000000000000000000000',
        maxTrade: '500000000000000000000',
        dailyCap: '2500000000000000000000',
        mode: 'approval_required' as const,
        strategy: 'taker_rfq' as const,
      },
      {
        idSuffix: 'wcop_usdt',
        name: 'Colombia Corridor · wCOP ↔ USD₮',
        sellToken: CELO_VERIFIED_ASSETS.wCOP.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        intent: 'Preserve 500,000 wCOP reserve and convert excess into USD₮ via Ripio rail.',
        minReserve: '500000000000000000000000',
        maxTrade: '250000000000000000000000',
        dailyCap: '1000000000000000000000000',
        mode: 'autonomous' as const,
        strategy: 'taker_rfq' as const,
      },
      {
        idSuffix: 'wmxn_usdt',
        name: 'Mexico Corridor · wMXN ↔ USD₮',
        sellToken: CELO_VERIFIED_ASSETS.wMXN.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        intent: 'Preserve 2,000 wMXN reserve and convert excess into USD₮ via Ripio rail.',
        minReserve: '2000000000000000000000',
        maxTrade: '1000000000000000000000',
        dailyCap: '5000000000000000000000',
        mode: 'autonomous' as const,
        strategy: 'taker_rfq' as const,
      },
      {
        idSuffix: 'usdc_usdt',
        name: 'Global Stable Interchange · USDC ↔ USD₮',
        sellToken: CELO_VERIFIED_ASSETS.USDC.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        intent: 'Exchange USDC for USD₮ at parity with minimal slippage.',
        minReserve: '10000000',
        maxTrade: '1000000000',
        dailyCap: '5000000000',
        mode: 'autonomous' as const,
        strategy: 'taker_rfq' as const,
      },
    ];

    let hasAdded = false;
    const now = new Date().toISOString();

    for (const p of corePairs) {
      const pairKey = `${p.sellToken.toLowerCase()}_${p.buyToken.toLowerCase()}`;
      if (!existingSellTokens.has(pairKey)) {
        const newM: TreasuryMandate = {
          id: `mandate_${treasuryId}_${p.idSuffix}`,
          treasuryId: treasuryId,
          agentId: `agent_${userId}_fx`,
          name: p.name,
          naturalLanguageIntent: p.intent,
          mode: p.mode,
          executionStrategy: p.strategy,
          chainId: 42220,
          sellToken: p.sellToken,
          buyToken: p.buyToken,
          minimumReserveAtomic: p.minReserve,
          maxTradeAtomic: p.maxTrade,
          dailySellCapAtomic: p.dailyCap,
          minBuyAmountAtomic: '500000',
          maxSlippageBps: 100,
          maxProtocolFeeBps: 25,
          allowedTargets: [
            TEXTILE_CONTRACTS.LimitOrderReactor,
            TEXTILE_CONTRACTS.Permit2,
            '0x5615CDAb10dc425a742d643d949a7F474C01abc4',
          ],
          serviceSpendPerCallAtomic: '50000',
          serviceDailyCapAtomic: '500000',
          stitchBaseSpreadBps: 18,
          stitchInventorySkewBps: 12,
          paused: false,
          updatedAt: now,
        };
        this.state.mandates.push(newM);
        existing.push(newM);
        hasAdded = true;
      }
    }

    if (hasAdded) {
      this.save();
    }

    return existing;
  }

  getTenantState(userId: string) {
    this.state = this.load();
    const user = this.getUserById(userId) || this.state.userProfile;
    const treasury = this.getOrCreateUserTreasury(
      userId,
      user?.walletAddress as `0x${string}`
    );

    const userMandates = this.ensureCorridorMandatesForTreasury(treasury.id, userId);

    return {
      userProfile: user,
      treasury,
      agents: this.state.agents.filter((a) => a.treasuryId === treasury.id),
      mandates: userMandates,
      executions: this.state.executions.filter(
        (e) => e.treasuryId === treasury.id
      ),
      ledgerEntries: this.state.ledgerEntries.filter(
        (l) => l.treasuryId === treasury.id
      ),
      servicePurchases: this.state.servicePurchases.filter(
        (s) => s.treasuryId === treasury.id
      ),
      auditEvents: this.state.auditEvents.filter(
        (ev) => ev.treasuryId === treasury.id
      ),
      invoices: (this.state.invoices || []).filter(
        (inv) =>
          inv.userId === userId ||
          (user?.walletAddress &&
            inv.creatorWallet &&
            inv.creatorWallet.toLowerCase() === user.walletAddress.toLowerCase())
      ),
    };
  }

  updateMandateForUser(
    mandate: TreasuryMandate,
    userId: string
  ): { ok: boolean; mandate?: TreasuryMandate; error?: string } {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);

    // IDOR Check: If mandate already exists, it must belong to user's treasury
    const existingIdx = this.state.mandates.findIndex((m) => m.id === mandate.id);
    if (existingIdx >= 0) {
      const existing = this.state.mandates[existingIdx];
      if (existing.treasuryId !== userTreasury.id) {
        return {
          ok: false,
          error: 'Forbidden: Access to another tenant mandate is denied.',
        };
      }
    }

    const updatedMandate: TreasuryMandate = {
      ...mandate,
      treasuryId: userTreasury.id, // Enforce tenant treasury ID
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      this.state.mandates[existingIdx] = updatedMandate;
    } else {
      this.state.mandates.push(updatedMandate);
    }

    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      agentId: updatedMandate.agentId,
      category: 'SECURITY_CONTROL',
      severity: updatedMandate.paused ? 'WARNING' : 'INFO',
      title: updatedMandate.paused
        ? 'Mandate Emergency Paused'
        : 'Mandate Configuration Updated',
      detail: `Mandate "${updatedMandate.name}" updated by tenant user ${userId}.`,
    });

    this.save();
    return { ok: true, mandate: updatedMandate };
  }

  toggleAgentForUser(
    agentId: string,
    active: boolean,
    userId: string
  ): { ok: boolean; agent?: AgentProfileRecord; error?: string } {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);

    const agent = this.state.agents.find((a) => a.id === agentId);
    if (!agent) {
      return { ok: false, error: 'Agent not found.' };
    }

    // IDOR Check: Ensure agent belongs to tenant
    if (agent.treasuryId !== userTreasury.id) {
      return {
        ok: false,
        error: 'Forbidden: Cannot access an agent belonging to another tenant.',
      };
    }

    agent.active = active;
    const mandate = this.state.mandates.find((m) => m.id === agent.mandateId);
    if (mandate && mandate.treasuryId === userTreasury.id) {
      mandate.paused = !active;
      mandate.updatedAt = new Date().toISOString();
    }

    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      agentId: agent.id,
      category: 'SECURITY_CONTROL',
      severity: active ? 'SUCCESS' : 'WARNING',
      title: `${agent.name} ${active ? 'Enabled' : 'Paused'}`,
      detail: `Agent status toggled to ${active ? 'Active' : 'Paused'} by tenant user ${userId}.`,
    });

    this.save();
    return { ok: true, agent };
  }

  deleteAgentForUser(
    agentId: string,
    userId: string
  ): { ok: boolean; error?: string } {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);

    const agentIdx = this.state.agents.findIndex((a) => a.id === agentId);
    if (agentIdx === -1) {
      return { ok: false, error: 'Agent not found.' };
    }

    const agent = this.state.agents[agentIdx];
    if (agent.treasuryId !== userTreasury.id) {
      return {
        ok: false,
        error: 'Forbidden: Cannot delete an agent belonging to another tenant.',
      };
    }

    // Remove associated mandate if any
    if (agent.mandateId) {
      this.state.mandates = this.state.mandates.filter(
        (m) => m.id !== agent.mandateId
      );
    }

    // Remove agent
    this.state.agents.splice(agentIdx, 1);

    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      agentId: agent.id,
      category: 'SECURITY_CONTROL',
      severity: 'WARNING',
      title: `Agent Deleted: ${agent.name}`,
      detail: `Agent and associated mandate deleted by tenant user ${userId}.`,
    });

    this.save();
    return { ok: true };
  }

  createAgentForUser(
    input: {
      name: string;
      role: 'treasury_rebalancer' | 'stitch_filler' | 'x402_reconciler';
      description: string;
      mode: 'autonomous' | 'approval_required' | 'monitor';
      sellToken: `0x${string}`;
      buyToken: `0x${string}`;
      minimumReserveAtomic: string;
      maxTradeAtomic: string;
      dailySellCapAtomic: string;
      maxSlippageBps: number;
      naturalLanguageIntent?: string;
    },
    userId: string
  ): { ok: boolean; agent?: AgentProfileRecord; mandate?: TreasuryMandate; error?: string } {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);
    const now = new Date().toISOString();
    const randomHex = Math.random().toString(16).substring(2, 8);
    const mandateId = `mandate_${Date.now()}_${randomHex}`;
    const agentId = `agent_${Date.now()}_${randomHex}`;

    const newMandate: TreasuryMandate = {
      id: mandateId,
      treasuryId: userTreasury.id,
      agentId: agentId,
      name: `${input.name} Mandate`,
      mode: input.mode || 'autonomous',
      executionStrategy: 'taker_rfq',
      chainId: 42220,
      sellToken: input.sellToken,
      buyToken: input.buyToken,
      minimumReserveAtomic: input.minimumReserveAtomic || '0',
      maxTradeAtomic: input.maxTradeAtomic || '10000000000',
      dailySellCapAtomic: input.dailySellCapAtomic || '50000000000',
      maxSlippageBps: input.maxSlippageBps || 50,
      maxProtocolFeeBps: 25,
      allowedTargets: [
        '0xa9AA5e845c48b26118D6d40C8885f69F65B235b3',
        input.sellToken,
        input.buyToken,
      ],
      serviceSpendPerCallAtomic: '50000',
      serviceDailyCapAtomic: '500000',
      stitchBaseSpreadBps: 18,
      stitchInventorySkewBps: 12,
      paused: false,
      naturalLanguageIntent: input.naturalLanguageIntent,
      updatedAt: now,
    };

    const newAgent: AgentProfileRecord = {
      id: agentId,
      treasuryId: userTreasury.id,
      name: input.name,
      role: input.role || 'treasury_rebalancer',
      description: input.description || 'Custom autonomous agent on Celo Mainnet.',
      walletAddress: userTreasury.agentWalletAddress,
      erc8004AgentId: Math.floor(1000 + Math.random() * 9000),
      erc8004Registry: '0x8004A169FB45bb754045cD8Ec3e4598d93eDa432',
      active: true,
      mandateId: mandateId,
      createdAt: now,
      lastCycleAt: now,
    };

    this.state.mandates.push(newMandate);
    this.state.agents.push(newAgent);

    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      agentId: newAgent.id,
      category: 'SECURITY_CONTROL',
      severity: 'SUCCESS',
      title: `Agent Issued: ${newAgent.name}`,
      detail: `New agent "${newAgent.name}" issued under mode ${newMandate.mode} with mandate ${newMandate.id}.`,
    });

    this.save();
    return { ok: true, agent: newAgent, mandate: newMandate };
  }

  recordTransferExecutionForUser(
    input: {
      tokenSymbol: AssetSymbol;
      tokenAddress: `0x${string}`;
      recipient: `0x${string}`;
      amountAtomic: string;
      decimals: number;
      txHash: `0x${string}`;
      blockNumber?: string;
      gasUsed?: string;
    },
    userId: string
  ): ExecutionRecord {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);
    const now = new Date().toISOString();
    const executionId = `exec_transfer_${Date.now()}`;
    const journalId = `jour_transfer_${Date.now()}`;

    const execution: ExecutionRecord = {
      id: executionId,
      idempotencyKey: `idem_transfer_${Date.now()}`,
      treasuryId: userTreasury.id,
      mandateId: this.state.mandates.find((m) => m.treasuryId === userTreasury.id)?.id || 'mandate_default',
      agentId: this.state.agents.find((a) => a.treasuryId === userTreasury.id)?.id || 'agent_default',
      state: 'CONFIRMED',
      sellToken: input.tokenAddress,
      buyToken: input.tokenAddress,
      sellSymbol: input.tokenSymbol,
      buySymbol: input.tokenSymbol,
      requestedSellAtomic: input.amountAtomic,
      quotedTakerPaysAtomic: input.amountAtomic,
      quotedBuyAmountAtomic: input.amountAtomic,
      settledSellAtomic: input.amountAtomic,
      settledBuyAtomic: input.amountAtomic,
      swapTxHash: input.txHash,
      blockNumber: input.blockNumber,
      gasUsedAtomic: input.gasUsed,
      createdAt: now,
      updatedAt: now,
    };

    this.state.executions.unshift(execution);

    // Balanced double-entry pair: DEBIT clearing recipient, CREDIT treasury asset
    const debitEntry: LedgerEntryRecord = {
      id: `ledg_dr_${Date.now()}`,
      journalId,
      executionId: execution.id,
      treasuryId: userTreasury.id,
      accountCode: `TRANSFER_OUT_${input.tokenSymbol}`,
      accountName: `Outbound Transfer to ${input.recipient.substring(0, 8)}...`,
      accountType: 'CLEARING',
      direction: 'DEBIT',
      assetSymbol: input.tokenSymbol,
      amountAtomic: input.amountAtomic,
      decimals: input.decimals,
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      memo: `Outbound transfer of ${input.amountAtomic} atomic units to ${input.recipient}`,
      createdAt: now,
    };

    const creditEntry: LedgerEntryRecord = {
      id: `ledg_cr_${Date.now()}`,
      journalId,
      executionId: execution.id,
      treasuryId: userTreasury.id,
      accountCode: `TREASURY_${input.tokenSymbol}`,
      accountName: `${input.tokenSymbol} Treasury Vault`,
      accountType: 'ASSET',
      direction: 'CREDIT',
      assetSymbol: input.tokenSymbol,
      amountAtomic: input.amountAtomic,
      decimals: input.decimals,
      txHash: input.txHash,
      blockNumber: input.blockNumber,
      memo: `Treasury balance reduction for outbound transfer`,
      createdAt: now,
    };

    this.state.ledgerEntries.unshift(debitEntry, creditEntry);

    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      executionId: execution.id,
      category: 'ONCHAIN_TX',
      severity: 'SUCCESS',
      title: `Transfer Sent: ${input.amountAtomic} atomic ${input.tokenSymbol}`,
      detail: `Sent transfer to ${input.recipient} on Celo Mainnet. Tx: ${input.txHash}`,
    });

    this.save();
    return execution;
  }

  recordRampTransactionForUser(
    input: {
      direction: 'onramp' | 'offramp';
      tokenSymbol: AssetSymbol;
      tokenAddress: `0x${string}`;
      amountAtomic: string;
      decimals: number;
      amountWhole: string;
      bankName: string;
      accountNumber?: string;
      beneficiary?: string;
      txHash: `0x${string}`;
    },
    userId: string
  ): ExecutionRecord {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);
    const now = new Date().toISOString();
    const executionId = `exec_ramp_${Date.now()}`;
    const journalId = `jour_ramp_${Date.now()}`;

    const isDeposit = input.direction === 'onramp';

    const execution: ExecutionRecord = {
      id: executionId,
      idempotencyKey: `idem_ramp_${Date.now()}`,
      treasuryId: userTreasury.id,
      mandateId:
        this.state.mandates.find((m) => m.treasuryId === userTreasury.id)?.id ||
        'mandate_default',
      agentId:
        this.state.agents.find((a) => a.treasuryId === userTreasury.id)?.id ||
        'agent_default',
      state: 'CONFIRMED',
      sellToken: input.tokenAddress,
      buyToken: input.tokenAddress,
      sellSymbol: input.tokenSymbol,
      buySymbol: input.tokenSymbol,
      requestedSellAtomic: input.amountAtomic,
      quotedTakerPaysAtomic: input.amountAtomic,
      quotedBuyAmountAtomic: input.amountAtomic,
      settledSellAtomic: input.amountAtomic,
      settledBuyAtomic: input.amountAtomic,
      swapTxHash: input.txHash,
      createdAt: now,
      updatedAt: now,
    };

    this.state.executions.unshift(execution);

    const entry1: LedgerEntryRecord = {
      id: `ledg_${isDeposit ? 'dr' : 'cr'}_${Date.now()}_1`,
      journalId,
      executionId: execution.id,
      treasuryId: userTreasury.id,
      accountCode: `TREASURY_${input.tokenSymbol}`,
      accountName: `${input.tokenSymbol} Treasury Vault`,
      accountType: 'ASSET',
      direction: isDeposit ? 'DEBIT' : 'CREDIT',
      assetSymbol: input.tokenSymbol,
      amountAtomic: input.amountAtomic,
      decimals: input.decimals,
      txHash: input.txHash,
      memo: isDeposit
        ? `Fiat On-Ramp Deposit: +${input.amountWhole} ${input.tokenSymbol} minted via ${input.bankName}`
        : `Fiat Off-Ramp Withdrawal: -${input.amountWhole} ${input.tokenSymbol} redeemed to ${input.bankName} (${input.accountNumber})`,
      createdAt: now,
    };

    const entry2: LedgerEntryRecord = {
      id: `ledg_${isDeposit ? 'cr' : 'dr'}_${Date.now()}_2`,
      journalId,
      executionId: execution.id,
      treasuryId: userTreasury.id,
      accountCode: `FIAT_RAMP_${input.tokenSymbol}`,
      accountName: `Fiat Bridge Clearing (${input.bankName})`,
      accountType: 'CLEARING',
      direction: isDeposit ? 'CREDIT' : 'DEBIT',
      assetSymbol: input.tokenSymbol,
      amountAtomic: input.amountAtomic,
      decimals: input.decimals,
      txHash: input.txHash,
      memo: isDeposit
        ? `Incoming bank settlement reference verified by ${input.bankName}`
        : `Outgoing NIP instant bank payout to ${input.beneficiary || 'Beneficiary'} (${input.accountNumber})`,
      createdAt: now,
    };

    this.state.ledgerEntries.unshift(entry1, entry2);

    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      executionId: execution.id,
      category: 'ONCHAIN_TX',
      severity: 'SUCCESS',
      title: isDeposit
        ? `Fiat On-Ramp Completed: +${input.amountWhole} ${input.tokenSymbol}`
        : `Fiat Off-Ramp Completed: -${input.amountWhole} ${input.tokenSymbol} Payout`,
      detail: isDeposit
        ? `Received ${input.amountWhole} NGN via ${input.bankName} wire; 1:1 ${input.tokenSymbol} credited to Celo Treasury.`
        : `Dispatched ${input.amountWhole} NGN to ${input.bankName} Acct #${input.accountNumber} (${input.beneficiary || 'Operator'}). TxHash: ${input.txHash}`,
    });

    this.save();
    return execution;
  }

  exportAuditBundleForUser(userId: string) {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);
    return {
      exportedAt: new Date().toISOString(),
      treasury: userTreasury,
      executions: this.state.executions.filter(
        (e) => e.treasuryId === userTreasury.id
      ),
      ledgerEntries: this.state.ledgerEntries.filter(
        (l) => l.treasuryId === userTreasury.id
      ),
      servicePurchases: this.state.servicePurchases.filter(
        (s) => s.treasuryId === userTreasury.id
      ),
      auditEvents: this.state.auditEvents.filter(
        (ev) => ev.treasuryId === userTreasury.id
      ),
    };
  }

  emergencyPauseForUser(paused: boolean, userId: string): void {
    this.state = this.load();
    const userTreasury = this.getOrCreateUserTreasury(userId);
    const now = new Date().toISOString();
    for (const m of this.state.mandates) {
      if (m.treasuryId === userTreasury.id) {
        m.paused = paused;
        m.updatedAt = now;
      }
    }
    for (const a of this.state.agents) {
      if (a.treasuryId === userTreasury.id) {
        a.active = !paused;
      }
    }
    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      category: 'SECURITY_CONTROL',
      severity: paused ? 'CRITICAL' : 'SUCCESS',
      title: paused
        ? 'Emergency Stop Activated'
        : 'Emergency Stop Resumed',
      detail: `Tenant user ${userId} ${paused ? 'paused' : 'resumed'} all autonomous mandates.`,
    });
    this.save();
  }

  updateProfileForTenant(
    patch: Partial<UserProfileRecord>,
    userId: string
  ): UserProfileRecord {
    this.state = this.load();
    const { siweVerified: _ignored, ...sanitizedPatch } = patch;
    let target = this.getUserById(userId);
    if (!target) {
      target = { ...this.state.userProfile, id: userId };
    }
    const updated: UserProfileRecord = {
      ...target,
      ...sanitizedPatch,
      updatedAt: new Date().toISOString(),
    };
    if (updated.displayName) {
      const parts = updated.displayName.trim().split(/\s+/);
      updated.avatarInitials =
        parts.length >= 2
          ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
          : (updated.displayName.slice(0, 2) || 'TO').toUpperCase();
    }

    if (!this.state.registeredUsers) {
      this.state.registeredUsers = [updated];
    } else {
      const idx = this.state.registeredUsers.findIndex((u) => u.id === userId);
      if (idx >= 0) {
        this.state.registeredUsers[idx] = updated;
      } else {
        this.state.registeredUsers.push(updated);
      }
    }
    if (this.state.userProfile?.id === userId) {
      this.state.userProfile = updated;
    }
    this.save();
    return updated;
  }

  // =========================================================================
  // PERSISTENT SESSIONS & NONCES STORAGE (Milestone 1.2)
  // =========================================================================

  createSessionRecord(params: {
    userId: string;
    walletAddress: `0x${string}`;
    tokenHash: string;
    ipAddress?: string;
    userAgent?: string;
    ttlMs?: number;
  }): SessionRecord {
    this.state = this.load();
    if (!this.state.sessions) {
      this.state.sessions = [];
    }

    const now = Date.now();
    const ttlMs = params.ttlMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    const sessionId = `sess_${now}_${Math.random().toString(36).slice(2, 9)}`;

    // Session Rotation: Invalidate any previous session for this wallet/user to prevent fixation
    for (const s of this.state.sessions) {
      if (s.walletAddress.toLowerCase() === params.walletAddress.toLowerCase()) {
        s.revoked = true;
      }
    }

    const session: SessionRecord = {
      id: sessionId,
      tokenHash: params.tokenHash,
      userId: params.userId,
      walletAddress: params.walletAddress,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      lastActivityAt: new Date(now).toISOString(),
      revoked: false,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    };

    this.state.sessions.unshift(session);
    if (this.state.sessions.length > 500) {
      this.state.sessions.length = 500;
    }

    this.save();
    return session;
  }

  getSessionByTokenHash(
    tokenHash: string
  ): {
    status: 'valid' | 'expired' | 'revoked' | 'not_found';
    session: SessionRecord | null;
    user: UserProfileRecord | null;
  } {
    this.state = this.load();
    if (!this.state.sessions || this.state.sessions.length === 0) {
      return { status: 'not_found', session: null, user: null };
    }

    const session = this.state.sessions.find((s) => s.tokenHash === tokenHash);
    if (!session) {
      return { status: 'not_found', session: null, user: null };
    }
    if (session.revoked) {
      return { status: 'revoked', session: null, user: null };
    }

    const now = Date.now();
    const expiresAt = Date.parse(session.expiresAt);
    if (now >= expiresAt) {
      session.revoked = true;
      this.save();
      return { status: 'expired', session: null, user: null };
    }

    // Idle timeout check: 2 hours
    const lastActivity = Date.parse(session.lastActivityAt);
    const idleTimeoutMs = 2 * 60 * 60 * 1000;
    if (now - lastActivity >= idleTimeoutMs) {
      session.revoked = true;
      this.save();
      return { status: 'expired', session: null, user: null };
    }

    // Slide idle window
    session.lastActivityAt = new Date(now).toISOString();
    this.save();

    const user = this.getUserById(session.userId) || this.state.userProfile;
    return { status: 'valid', session, user };
  }

  revokeSession(sessionIdOrHash: string): boolean {
    this.state = this.load();
    if (!this.state.sessions) return false;

    const session = this.state.sessions.find(
      (s) => s.id === sessionIdOrHash || s.tokenHash === sessionIdOrHash
    );
    if (!session) return false;

    session.revoked = true;
    this.save();
    return true;
  }

  revokeAllSessionsForUser(userId: string): number {
    this.state = this.load();
    if (!this.state.sessions) return 0;

    let count = 0;
    for (const s of this.state.sessions) {
      if (s.userId === userId && !s.revoked) {
        s.revoked = true;
        count++;
      }
    }
    if (count > 0) {
      this.save();
    }
    return count;
  }

  saveNonce(record: NonceRecord): void {
    this.state = this.load();
    if (!this.state.nonces) {
      this.state.nonces = [];
    }
    this.state.nonces = this.state.nonces.filter((n) => n.nonce !== record.nonce);
    this.state.nonces.unshift(record);
    if (this.state.nonces.length > 300) {
      this.state.nonces.length = 300;
    }
    this.save();
  }

  consumeNonce(
    nonce: string,
    claimedAddress: string
  ): { ok: boolean; reason?: string } {
    this.state = this.load();
    if (!this.state.nonces) {
      return { ok: false, reason: 'Nonce store empty or not initialized' };
    }

    const record = this.state.nonces.find((n) => n.nonce === nonce);
    if (!record) {
      return { ok: false, reason: 'Nonce not found or unissued by server' };
    }

    if (record.consumed) {
      return {
        ok: false,
        reason: 'Nonce has already been consumed (replay attempt detected)',
      };
    }

    const now = Date.now();
    if (now > record.expiresAt) {
      return { ok: false, reason: 'Authentication challenge has expired' };
    }

    if (
      record.walletAddress &&
      record.walletAddress.toLowerCase() !== claimedAddress.toLowerCase()
    ) {
      return {
        ok: false,
        reason: `Nonce was issued for ${record.walletAddress}, not ${claimedAddress}`,
      };
    }

    record.consumed = true;
    this.save();
    return { ok: true };
  }

  // =========================================================================
  // MILESTONE 2.5: SETTLEMENT INTEGRITY, FIRST-TRADE & ATTESTATION METHODS
  // =========================================================================

  getSettledExecutionsCount(treasuryId: string): number {
    this.state = this.load();
    return this.state.executions.filter(
      (e) =>
        e.treasuryId === treasuryId &&
        (e.state === 'SETTLED' ||
          e.state === 'RECONCILED' ||
          e.state === 'CONFIRMED')
    ).length;
  }

  storeFirstTradeAuthorization(auth: FirstTradeAuthorizationRecord): void {
    this.state = this.load();
    if (!this.state.firstTradeAuthorizations) {
      this.state.firstTradeAuthorizations = [];
    }
    this.state.firstTradeAuthorizations = this.state.firstTradeAuthorizations.filter(
      (a) => a.executionId !== auth.executionId
    );
    this.state.firstTradeAuthorizations.push(auth);
    this.save();
  }

  getFirstTradeAuthorization(executionId: string): FirstTradeAuthorizationRecord | null {
    this.state = this.load();
    if (!this.state.firstTradeAuthorizations) return null;
    return this.state.firstTradeAuthorizations.find((a) => a.executionId === executionId) || null;
  }

  atomicConsumeFirstTradeAuthorization(
    executionId: string,
    expectedCalldataHash: string
  ): { consumed: boolean; reason?: string } {
    this.state = this.load();
    if (!this.state.firstTradeAuthorizations) {
      return { consumed: false, reason: `No first-trade authorization registered for execution "${executionId}".` };
    }
    const auth = this.state.firstTradeAuthorizations.find((a) => a.executionId === executionId);
    if (!auth) {
      return { consumed: false, reason: `No first-trade authorization registered for execution "${executionId}".` };
    }
    if (auth.consumed) {
      return { consumed: false, reason: `First-trade authorization for execution "${executionId}" has already been consumed.` };
    }
    if (new Date(auth.expiresAt).getTime() < Date.now()) {
      return { consumed: false, reason: `First-trade authorization for execution "${executionId}" has expired.` };
    }
    if (auth.calldataHash.toLowerCase() !== expectedCalldataHash.toLowerCase()) {
      return {
        consumed: false,
        reason: `Calldata hash mismatch: authorization authorized "${auth.calldataHash}", transaction calldata is "${expectedCalldataHash}".`,
      };
    }
    auth.consumed = true;
    auth.consumedAt = new Date().toISOString();
    this.save();
    return { consumed: true };
  }

  atomicConsumeAttestation(
    nonce: string,
    executionId: string,
    payloadHash: string,
    expiresAt: Date
  ): { consumed: boolean; reason?: string } {
    if (expiresAt.getTime() < Date.now()) {
      return { consumed: false, reason: `Policy attestation nonce "${nonce}" has expired.` };
    }
    this.state = this.load();
    if (!this.state.attestationConsumptions) {
      this.state.attestationConsumptions = [];
    }
    const existing = this.state.attestationConsumptions.find((c) => c.nonce === nonce);
    if (existing) {
      return {
        consumed: false,
        reason: `Policy attestation nonce "${nonce}" has already been consumed (replay prevention).`,
      };
    }
    this.state.attestationConsumptions.push({
      nonce,
      executionId,
      payloadHash,
      consumedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    this.save();
    return { consumed: true };
  }

  recordWebhookEventAtomic(
    event: WebhookEventRecord
  ): { accepted: boolean; duplicate: boolean; record?: WebhookEventRecord } {
    this.state = this.load();
    if (!this.state.webhookEvents) {
      this.state.webhookEvents = [];
    }
    const existing = this.state.webhookEvents.find(
      (e) => e.provider === event.provider && e.providerEventId === event.providerEventId
    );
    if (existing) {
      return { accepted: false, duplicate: true, record: existing };
    }
    this.state.webhookEvents.push(event);
    this.save();
    return { accepted: true, duplicate: false, record: event };
  }

  updateWebhookEventStatus(
    id: string,
    status: 'PROCESSED' | 'FAILED',
    failureReason?: string
  ): void {
    this.state = this.load();
    if (!this.state.webhookEvents) return;
    const item = this.state.webhookEvents.find((e) => e.id === id);
    if (item) {
      item.processingStatus = status;
      item.processedAt = new Date().toISOString();
      if (failureReason) item.failureReason = failureReason;
      this.save();
    }
  }

  getInvoicesForUser(userId: string): InvoiceRecord[] {
    this.state = this.load();
    const user = this.getUserById(userId) || this.state.userProfile;
    const userWallet = user?.walletAddress?.toLowerCase();
    return (this.state.invoices || []).filter(
      (inv) =>
        inv.userId === userId ||
        (userWallet && inv.creatorWallet && inv.creatorWallet.toLowerCase() === userWallet)
    );
  }

  createInvoiceForUser(
    input: {
      invoiceNumber?: string;
      creatorWallet: `0x${string}`;
      clientName: string;
      clientEmail?: string;
      clientAddress?: `0x${string}`;
      amount: string;
      tokenSymbol: AssetSymbol;
      memo: string;
      creatorSignature: string;
      signatureScheme?: 'EIP-712' | 'personal_sign';
      paymentUri?: string;
      dueDate?: string;
    },
    userId: string
  ): InvoiceRecord {
    const userTreasury = this.getOrCreateUserTreasury(userId, input.creatorWallet);
    this.state = this.load();
    if (!this.state.invoices) {
      this.state.invoices = [];
    }

    const now = new Date().toISOString();
    const id = `inv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const invoiceNumber =
      input.invoiceNumber ||
      `INV-${new Date().getFullYear()}-${String(this.state.invoices.length + 1).padStart(3, '0')}`;
    const paymentUri =
      input.paymentUri ||
      `celo:${input.creatorWallet}?amount=${input.amount}&token=${input.tokenSymbol}&memo=${encodeURIComponent(invoiceNumber)}`;

    const newInvoice: InvoiceRecord = {
      id,
      invoiceNumber,
      creatorWallet: input.creatorWallet,
      userId,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      clientAddress: input.clientAddress,
      amount: input.amount,
      tokenSymbol: input.tokenSymbol,
      memo: input.memo,
      status: 'PENDING',
      creatorSignature: input.creatorSignature,
      signatureScheme: input.signatureScheme || 'EIP-712',
      paymentUri,
      dueDate: input.dueDate,
      createdAt: now,
    };

    this.state.invoices.unshift(newInvoice);

    this.appendAuditEvent({
      treasuryId: userTreasury.id,
      category: 'POLICY_DECISION',
      severity: 'INFO',
      title: `Cryptographic Invoice Issued: ${invoiceNumber}`,
      detail: `Created by ${input.creatorWallet} for ${input.clientName} (${input.amount} ${input.tokenSymbol}). Signed with $0 gas signature: ${input.creatorSignature.slice(0, 16)}...`,
    });

    this.save();
    return newInvoice;
  }

  markInvoicePaidForUser(
    invoiceId: string,
    paidTxHash?: `0x${string}`
  ): { ok: boolean; invoice?: InvoiceRecord; error?: string } {
    this.state = this.load();
    if (!this.state.invoices) return { ok: false, error: 'No invoices found.' };
    const inv = this.state.invoices.find((i) => i.id === invoiceId);
    if (!inv) return { ok: false, error: 'Invoice not found.' };

    inv.status = 'PAID';
    inv.paidAt = new Date().toISOString();
    if (paidTxHash) inv.paidTxHash = paidTxHash;

    this.save();
    return { ok: true, invoice: inv };
  }
}

export const moiDb = new MoiDatabase();

export * from './postgres-engine';
export * from './migration';
export * from './backup-recovery';

