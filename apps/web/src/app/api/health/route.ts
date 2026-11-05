import { NextResponse } from 'next/server';
import { validateEnvironment } from '@moi/shared-types';
import { moiDb } from '@moi/database';
import { CeloChainService, verifySignerProductionReadiness } from '@moi/wallet-signer';

export async function GET() {
  const envValidation = validateEnvironment();
  const chainService = new CeloChainService();
  const signerReadiness = verifySignerProductionReadiness();

  let dbHealthy = false;
  let dbTables: Record<string, number> = {};

  try {
    const state = moiDb.getState();
    dbHealthy = Boolean(state && state.treasury && state.mandates);
    dbTables = {
      users: state.registeredUsers?.length || 1,
      treasuries: state.treasuries?.length || 1,
      mandates: state.mandates?.length || 0,
      executions: state.executions?.length || 0,
      ledgerEntries: state.ledgerEntries?.length || 0,
      auditEvents: state.auditEvents?.length || 0,
    };
  } catch {
    dbHealthy = false;
  }

  const overallStatus =
    dbHealthy && (envValidation.valid || envValidation.environment !== 'production')
      ? 'healthy'
      : 'degraded';

  const responsePayload = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: envValidation.environment,
    checks: {
      api: {
        status: 'pass',
        version: '1.0.0',
      },
      database: {
        status: dbHealthy ? 'pass' : 'fail',
        persistenceTopology: 'hybrid_postgresql_rls_pglite',
        tableCounts: dbTables,
      },
      signer: {
        status: signerReadiness.ready ? 'ready_live' : 'observation_only',
        configured: chainService.isSignerConfigured(),
        agentWallet: chainService.getAgentWalletAddress(),
      },
      environment: {
        status: envValidation.valid ? 'pass' : 'warn',
        criticalIssuesCount: envValidation.issues.filter((i) => i.severity === 'CRITICAL').length,
        warningIssuesCount: envValidation.issues.filter((i) => i.severity === 'WARNING').length,
      },
      externalIntegrations: {
        celoRpc: envValidation.sanitizedConfig.celoRpcUrl,
        erc8004Registry: envValidation.sanitizedConfig.erc8004Registry,
        attributionConfigured: Boolean(envValidation.sanitizedConfig.attributionTag),
      },
    },
  };

  return NextResponse.json(responsePayload, {
    status: overallStatus === 'healthy' ? 200 : 503,
  });
}

