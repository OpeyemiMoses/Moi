export type DeploymentEnvironment = 'development' | 'staging' | 'production' | 'test';

export interface EnvValidationIssue {
  variable: string;
  severity: 'CRITICAL' | 'WARNING';
  message: string;
}

export interface EnvironmentValidationResult {
  valid: boolean;
  environment: DeploymentEnvironment;
  issues: EnvValidationIssue[];
  sanitizedConfig: {
    environment: DeploymentEnvironment;
    appUrl: string;
    siweDomain: string;
    siweUri: string;
    chainId: number;
    celoRpcUrl: string;
    hasDatabaseUrl: boolean;
    hasPostgres: boolean;
    hasRedis: boolean;
    hasSignerKey: boolean;
    hasHmacSecret: boolean;
    hasTextileKey: boolean;
    hasWebhookSecret: boolean;
    erc8004Registry: string;
    attributionTag?: string;
  };
}

/**
 * Validates deployment environment configurations according to deployment tier.
 * In 'production', strictly enforces presence of database, secure secrets, HTTPS URIs, and valid keys.
 */
export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env
): EnvironmentValidationResult {
  const issues: EnvValidationIssue[] = [];
  const rawEnv = (env.NODE_ENV || 'development').toLowerCase();
  const environment: DeploymentEnvironment =
    rawEnv === 'production'
      ? 'production'
      : rawEnv === 'staging'
        ? 'staging'
        : rawEnv === 'test'
          ? 'test'
          : 'development';

  const isProduction = environment === 'production';
  const isStaging = environment === 'staging';

  // 1. App URL & Domain
  const appUrl = env.APP_URL || (isProduction ? '' : 'http://localhost:3000');
  if (!appUrl) {
    issues.push({
      variable: 'APP_URL',
      severity: 'CRITICAL',
      message: 'APP_URL is required in all deployment tiers.',
    });
  } else if ((isProduction || isStaging) && !appUrl.startsWith('https://')) {
    issues.push({
      variable: 'APP_URL',
      severity: isProduction ? 'CRITICAL' : 'WARNING',
      message: `Production APP_URL must use HTTPS protocol. Got: ${appUrl}`,
    });
  }

  // 2. SIWE Configuration
  const siweDomain = env.SIWE_DOMAIN || (isProduction ? '' : 'localhost:3000');
  const siweUri = env.SIWE_URI || (isProduction ? '' : 'http://localhost:3000');

  if (!siweDomain) {
    issues.push({
      variable: 'SIWE_DOMAIN',
      severity: 'CRITICAL',
      message: 'SIWE_DOMAIN is required for EIP-4361 authentication validation.',
    });
  }

  if (!siweUri) {
    issues.push({
      variable: 'SIWE_URI',
      severity: 'CRITICAL',
      message: 'SIWE_URI is required for EIP-4361 authentication validation.',
    });
  } else if ((isProduction || isStaging) && !siweUri.startsWith('https://')) {
    issues.push({
      variable: 'SIWE_URI',
      severity: isProduction ? 'CRITICAL' : 'WARNING',
      message: `Production SIWE_URI must use HTTPS protocol. Got: ${siweUri}`,
    });
  }

  // 3. Database URL (PostgreSQL)
  const databaseUrl = env.DATABASE_URL;
  if (isProduction && !databaseUrl) {
    issues.push({
      variable: 'DATABASE_URL',
      severity: 'CRITICAL',
      message:
        'DATABASE_URL is required in production for PostgreSQL persistence and RLS isolation.',
    });
  }

  // 4. Celo RPC URL
  const celoRpcUrl = env.CELO_RPC_URL || 'https://forno.celo.org';
  if ((isProduction || isStaging) && !celoRpcUrl.startsWith('https://')) {
    issues.push({
      variable: 'CELO_RPC_URL',
      severity: 'CRITICAL',
      message: `Production CELO_RPC_URL must use secure HTTPS endpoint. Got: ${celoRpcUrl}`,
    });
  }

  // 5. Policy Attestation HMAC Secret
  const hmacSecret = env.INTERNAL_POLICY_HMAC_SECRET;
  if (isProduction && (!hmacSecret || hmacSecret === 'moi_internal_default_secret_key_change_in_production')) {
    issues.push({
      variable: 'INTERNAL_POLICY_HMAC_SECRET',
      severity: 'CRITICAL',
      message:
        'INTERNAL_POLICY_HMAC_SECRET must be set to a secure, unpredictable key in production. Default fallback keys are prohibited.',
    });
  }

  // 6. Signer Key (Fail-closed check)
  const signerSecret = env.AGENT_SIGNER_SECRET_REFERENCE;
  if (signerSecret && !/^0x[a-fA-F0-9]{64}$/.test(signerSecret)) {
    issues.push({
      variable: 'AGENT_SIGNER_SECRET_REFERENCE',
      severity: 'CRITICAL',
      message:
        'AGENT_SIGNER_SECRET_REFERENCE must be a valid 32-byte hexadecimal private key when configured.',
    });
  }

  // 7. Security: Verify NO private keys in NEXT_PUBLIC_ variables
  for (const key of Object.keys(env)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      const val = (env[key] || '').toLowerCase();
      if (
        key.includes('SECRET') ||
        key.includes('PRIVATE_KEY') ||
        key.includes('SIGNER') ||
        key.includes('HMAC') ||
        val.startsWith('0x') && val.length === 66
      ) {
        issues.push({
          variable: key,
          severity: 'CRITICAL',
          message: `CRITICAL LEAK: Private key or secret exposed in client-accessible ${key}!`,
        });
      }
    }
  }

  const hasCritical = issues.some((i) => i.severity === 'CRITICAL');

  return {
    valid: !hasCritical,
    environment,
    issues,
    sanitizedConfig: {
      environment,
      appUrl,
      siweDomain,
      siweUri,
      chainId: Number(env.CELO_CHAIN_ID || 42220),
      celoRpcUrl,
      hasDatabaseUrl: Boolean(databaseUrl),
      hasPostgres: Boolean(databaseUrl?.startsWith('postgresql://') || databaseUrl?.startsWith('postgres://')),
      hasRedis: Boolean(env.REDIS_URL),
      hasSignerKey: Boolean(signerSecret),
      hasHmacSecret: Boolean(hmacSecret && hmacSecret !== 'moi_internal_default_secret_key_change_in_production'),
      hasTextileKey: Boolean(env.TEXTILE_API_KEY),
      hasWebhookSecret: Boolean(env.TEXTILE_WEBHOOK_SECRET),
      erc8004Registry: env.ERC8004_REGISTRY_ADDRESS || '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      attributionTag: env.CELO_ATTRIBUTION_TAG,
    },
  };
}

