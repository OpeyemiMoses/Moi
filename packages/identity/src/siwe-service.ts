import { randomBytes } from 'node:crypto';
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  verifyMessage,
  type Hex,
} from 'viem';
import { celo } from 'viem/chains';
import {
  createSiweMessage,
  generateSiweNonce,
  parseSiweMessage,
  validateSiweMessage,
  verifySiweMessage,
} from 'viem/siwe';
import { CELO_MAINNET_CHAIN_ID } from '@moi/shared-types';
import { moiDb, SessionRecord } from '@moi/database';
import { generateSessionToken, hashSessionToken } from './session-service';

export interface StoredNonceRecord {
  nonce: string;
  walletAddress?: `0x${string}`;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
  clientIp?: string;
}

export interface SiweChallengeOutcome {
  nonce: string;
  message: string;
  domain: string;
  uri: string;
  chainId: number;
  issuedAt: string;
  expirationTime: string;
  address: `0x${string}`;
}

export interface SiweVerificationOutcome {
  valid: boolean;
  walletAddress?: `0x${string}`;
  error?: string;
  nonceUsed?: string;
  rawSessionToken?: string;
  sessionRecord?: SessionRecord;
}

export interface AuthenticatedSession {
  walletAddress: `0x${string}`;
  authenticatedAt: string;
  expiresAt: string;
  nonceUsed: string;
}

export class SiweAuthenticationService {
  private nonces = new Map<string, StoredNonceRecord>();
  private sessions = new Map<string, AuthenticatedSession>();
  private rateLimits = new Map<string, number[]>();

  private getDomain(): string {
    if (process.env.SIWE_DOMAIN) {
      return process.env.SIWE_DOMAIN;
    }
    if (process.env.APP_URL) {
      try {
        return new URL(process.env.APP_URL).host;
      } catch {
        // Fallback
      }
    }
    return 'localhost:3000';
  }

  private getUri(): string {
    if (process.env.SIWE_URI) {
      return process.env.SIWE_URI;
    }
    return process.env.APP_URL || 'http://localhost:3000';
  }

  private getChainId(): number {
    return Number(process.env.SIWE_CHAIN_ID || CELO_MAINNET_CHAIN_ID);
  }

  private getNonceTtlMs(): number {
    const sec = Number(process.env.SIWE_NONCE_TTL_SECONDS || 300); // 5 minutes default
    return sec * 1000;
  }

  private getRateLimitWindowMs(): number {
    const sec = Number(process.env.SIWE_RATE_LIMIT_WINDOW_SECONDS || 60);
    return sec * 1000;
  }

  private getRateLimitMaxRequests(): number {
    return Number(process.env.SIWE_RATE_LIMIT_MAX_REQUESTS || 30);
  }

  /**
   * Check and enforce sliding-window rate limit
   */
  checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowMs = this.getRateLimitWindowMs();
    const maxRequests = this.getRateLimitMaxRequests();

    const history = this.rateLimits.get(identifier) || [];
    const validHistory = history.filter((ts) => now - ts < windowMs);

    if (validHistory.length >= maxRequests) {
      this.rateLimits.set(identifier, validHistory);
      return { allowed: false, remaining: 0 };
    }

    validHistory.push(now);
    this.rateLimits.set(identifier, validHistory);
    return { allowed: true, remaining: maxRequests - validHistory.length };
  }

  /**
   * Cleanup expired nonces to avoid unbounded memory growth
   */
  private purgeExpiredNonces(): void {
    const now = Date.now();
    for (const [nonce, record] of this.nonces.entries()) {
      // Purge nonces older than their expiry + 10 minutes buffer
      if (now > record.expiresAt + 600_000) {
        this.nonces.delete(nonce);
      }
    }
  }

  /**
   * Generates a cryptographically secure, server-controlled SIWE challenge
   */
  generateChallenge(params: {
    walletAddress: string;
    clientIp?: string;
  }): { ok: boolean; challenge?: SiweChallengeOutcome; error?: string } {
    const { walletAddress, clientIp } = params;

    // Rate limit check
    const rateLimitId = clientIp || walletAddress;
    const rateCheck = this.checkRateLimit(rateLimitId);
    if (!rateCheck.allowed) {
      return {
        ok: false,
        error: 'Too many authentication requests. Please wait a minute and retry.',
      };
    }

    // Validate EVM wallet address
    if (!walletAddress || !isAddress(walletAddress, { strict: false })) {
      return {
        ok: false,
        error: `Invalid EVM wallet address: "${walletAddress}". Must be 42-character hex format.`,
      };
    }

    const normalizedAddress = getAddress(walletAddress);
    const domain = this.getDomain();
    const uri = this.getUri();
    const chainId = this.getChainId();

    // Generate secure random nonce (EIP-4361 requires at least 8 alphanumeric chars)
    const nonce = generateSiweNonce();
    const now = Date.now();
    const ttlMs = this.getNonceTtlMs();
    const issuedAt = new Date(now).toISOString();
    const expirationTime = new Date(now + ttlMs).toISOString();

    // Store nonce record server-side (both in-memory and persistent database store)
    const nonceRecord = {
      nonce,
      walletAddress: normalizedAddress,
      createdAt: now,
      expiresAt: now + ttlMs,
      consumed: false,
      clientIp,
    };
    this.nonces.set(nonce, nonceRecord);
    moiDb.saveNonce(nonceRecord);

    this.purgeExpiredNonces();

    // Construct standard EIP-4361 message
    const message = createSiweMessage({
      address: normalizedAddress,
      chainId,
      domain,
      uri,
      nonce,
      version: '1',
      issuedAt: new Date(now),
      expirationTime: new Date(now + ttlMs),
      statement: 'Sign in to MOI Autonomous Treasury Operating System.',
    });

    return {
      ok: true,
      challenge: {
        nonce,
        message,
        domain,
        uri,
        chainId,
        issuedAt,
        expirationTime,
        address: normalizedAddress,
      },
    };
  }

  /**
   * Atomically consume a nonce. Rejects if unknown, already consumed, expired, or address mismatched.
   */
  consumeNonce(
    nonce: string,
    claimedAddress: string
  ): { ok: boolean; reason?: string } {
    if (!nonce || typeof nonce !== 'string') {
      return { ok: false, reason: 'Missing or malformed nonce' };
    }

    // 1. Consume from persistent database store (multi-process & multi-instance safe)
    const dbOutcome = moiDb.consumeNonce(nonce, claimedAddress);
    if (!dbOutcome.ok) {
      return dbOutcome;
    }

    // 2. Also mark in-memory record if present
    const record = this.nonces.get(nonce);
    if (record) {
      record.consumed = true;
    }

    return { ok: true };
  }

  /**
   * Independently verifies the SIWE message, nonce validity, and cryptographic signature
   */
  async verifyAuthentication(params: {
    message: string;
    signature: string;
    clientIp?: string;
  }): Promise<SiweVerificationOutcome> {
    const { message, signature, clientIp } = params;

    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'SIWE message string is required.' };
    }

    if (!signature || typeof signature !== 'string') {
      return { valid: false, error: 'Cryptographic signature is required.' };
    }

    // Rate limiting check
    if (clientIp) {
      const rateCheck = this.checkRateLimit(`verify:${clientIp}`);
      if (!rateCheck.allowed) {
        return {
          valid: false,
          error: 'Rate limit exceeded on signature verification. Please wait.',
        };
      }
    }

    // 1. Parse SIWE message using viem's EIP-4361 parser
    let parsed: ReturnType<typeof parseSiweMessage>;
    try {
      parsed = parseSiweMessage(message);
    } catch (err: any) {
      return {
        valid: false,
        error: `Malformed SIWE message format: ${err?.message || 'Parse error'}`,
      };
    }

    if (!parsed || !parsed.address || !parsed.nonce) {
      return {
        valid: false,
        error: 'Incomplete SIWE message: address and nonce are required.',
      };
    }

    // 2. Validate Address format
    if (!isAddress(parsed.address, { strict: false })) {
      return {
        valid: false,
        error: `Invalid address in SIWE message: ${parsed.address}`,
      };
    }
    const claimedAddress = getAddress(parsed.address);

    // 3. Validate Domain against trusted server configuration
    const expectedDomain = this.getDomain();
    if (parsed.domain !== expectedDomain) {
      return {
        valid: false,
        error: `Domain mismatch: message specifies "${parsed.domain}", expected "${expectedDomain}".`,
      };
    }

    // 4. Validate URI against trusted server configuration
    const expectedUri = this.getUri();
    if (parsed.uri !== expectedUri) {
      return {
        valid: false,
        error: `URI mismatch: message specifies "${parsed.uri}", expected "${expectedUri}".`,
      };
    }

    // 5. Validate Chain ID against Celo Mainnet (42220)
    const expectedChainId = this.getChainId();
    if (parsed.chainId !== expectedChainId) {
      return {
        valid: false,
        error: `Chain ID mismatch: message specifies ${parsed.chainId}, expected Celo Mainnet (${expectedChainId}).`,
      };
    }

    // 6. Validate Timestamps (IssuedAt, ExpirationTime, NotBefore)
    const now = Date.now();
    if (parsed.expirationTime && !Number.isNaN(parsed.expirationTime.getTime())) {
      if (now >= parsed.expirationTime.getTime()) {
        return {
          valid: false,
          error: `SIWE message expired at ${parsed.expirationTime.toISOString()}.`,
        };
      }
    }

    if (parsed.notBefore && !Number.isNaN(parsed.notBefore.getTime())) {
      if (now < parsed.notBefore.getTime()) {
        return {
          valid: false,
          error: `SIWE message is not yet valid (notBefore: ${parsed.notBefore.toISOString()}).`,
        };
      }
    }

    // Reject message issued in the distant future (> 60s clock skew)
    if (parsed.issuedAt && !Number.isNaN(parsed.issuedAt.getTime())) {
      if (parsed.issuedAt.getTime() > now + 60_000) {
        return {
          valid: false,
          error: 'SIWE message issuedAt is in the future beyond acceptable clock skew.',
        };
      }
    }

    // 7. Atomic Nonce Consumption & Replay Verification
    const nonceResult = this.consumeNonce(parsed.nonce, claimedAddress);
    if (!nonceResult.ok) {
      return {
        valid: false,
        error: `Nonce verification failed: ${nonceResult.reason}`,
      };
    }

    // 8. Cryptographic Signature Verification
    let signatureValid = false;
    try {
      // Primary: EOA signature verification via standard viem verifyMessage
      signatureValid = await verifyMessage({
        address: claimedAddress,
        message,
        signature: signature as Hex,
      });
    } catch {
      signatureValid = false;
    }

    // Secondary: If EOA verification failed, attempt ERC-1271 contract wallet verification via RPC
    if (!signatureValid) {
      try {
        const rpcUrl = process.env.CELO_RPC_URL || 'https://forno.celo.org';
        const client = createPublicClient({
          chain: celo,
          transport: http(rpcUrl),
        });
        signatureValid = await verifySiweMessage(client, {
          message,
          signature: signature as Hex,
          domain: expectedDomain,
          nonce: parsed.nonce,
        });
      } catch {
        // Contract verification also failed or RPC unreachable
        signatureValid = false;
      }
    }

    if (!signatureValid) {
      return {
        valid: false,
        error: 'Cryptographic signature is invalid for the claimed wallet address.',
      };
    }

    // 9. Register authenticated session in persistent database store (survives restarts)
    const rawSessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawSessionToken);

    // Look up or establish user profile
    const userProfile = moiDb.authenticateVerifiedWallet(claimedAddress);

    const sessionRecord = moiDb.createSessionRecord({
      userId: userProfile.id,
      walletAddress: claimedAddress,
      tokenHash,
      ipAddress: clientIp,
    });

    const sessionInfo: AuthenticatedSession = {
      walletAddress: claimedAddress,
      authenticatedAt: sessionRecord.createdAt,
      expiresAt: sessionRecord.expiresAt,
      nonceUsed: parsed.nonce,
    };
    this.sessions.set(claimedAddress.toLowerCase(), sessionInfo);

    return {
      valid: true,
      walletAddress: claimedAddress,
      nonceUsed: parsed.nonce,
      rawSessionToken,
      sessionRecord,
    };
  }

  /**
   * Check if a wallet address has an active, valid server-authenticated session
   */
  isSessionActive(walletAddress: string): boolean {
    if (!walletAddress) return false;
    const memSession = this.sessions.get(walletAddress.toLowerCase());
    if (memSession && Date.now() < Date.parse(memSession.expiresAt)) {
      return true;
    }
    // Check persistent database store
    const dbState = moiDb.getState();
    const hasActiveDb = dbState.sessions?.some(
      (s) =>
        s.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
        !s.revoked &&
        Date.now() < Date.parse(s.expiresAt)
    );
    return Boolean(hasActiveDb);
  }

  /**
   * Retrieve active session record for a wallet
   */
  getSession(walletAddress: string): AuthenticatedSession | null {
    if (!walletAddress) return null;
    const session = this.sessions.get(walletAddress.toLowerCase());
    if (session) {
      if (Date.now() >= Date.parse(session.expiresAt)) {
        this.sessions.delete(walletAddress.toLowerCase());
        return null;
      }
      return session;
    }
    // Check persistent database store
    const dbState = moiDb.getState();
    const dbSession = dbState.sessions?.find(
      (s) =>
        s.walletAddress.toLowerCase() === walletAddress.toLowerCase() &&
        !s.revoked &&
        Date.now() < Date.parse(s.expiresAt)
    );
    if (!dbSession) return null;

    const retrieved: AuthenticatedSession = {
      walletAddress: dbSession.walletAddress,
      authenticatedAt: dbSession.createdAt,
      expiresAt: dbSession.expiresAt,
      nonceUsed: 'persisted_session',
    };
    this.sessions.set(walletAddress.toLowerCase(), retrieved);
    return retrieved;
  }

  /**
   * Invalidate/revoke session for a wallet across all instances
   */
  revokeSession(walletAddress: string): boolean {
    if (!walletAddress) return false;
    const user = moiDb.getUserByWallet(walletAddress);
    if (user) {
      moiDb.revokeAllSessionsForUser(user.id);
    }
    return this.sessions.delete(walletAddress.toLowerCase());
  }

  /**
   * Clear all nonces and sessions (used for test isolation)
   */
  resetForTesting(): void {
    this.nonces.clear();
    this.sessions.clear();
    this.rateLimits.clear();
    const state = moiDb.getState();
    if (state.sessions) state.sessions = [];
    if (state.nonces) state.nonces = [];
  }
}

const globalForSiwe = globalThis as unknown as {
  __moiSiweService?: SiweAuthenticationService;
};

export const siweService =
  globalForSiwe.__moiSiweService ?? new SiweAuthenticationService();

globalForSiwe.__moiSiweService = siweService;

