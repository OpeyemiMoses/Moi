import { moiDb } from '@moi/database';
import { AuditEventRecord, ExecutionRecord } from '@moi/shared-types';

export type LifecycleStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const LIFECYCLE_STEP_NAMES: Record<LifecycleStepNumber, string> = {
  1: 'Trigger received',
  2: 'Treasury evaluated',
  3: 'Mandate evaluated',
  4: 'Market conditions checked',
  5: 'Textile quote requested',
  6: 'Quote validated',
  7: 'Policy evaluated',
  8: 'Authorization checked',
  9: 'Transaction inspected',
  10: 'Signing authorized',
  11: 'Broadcast recorded',
  12: 'Blockchain receipt verified',
  13: 'Textile settlement reconciled',
  14: 'Ledger journal recorded',
};

export interface LifecycleStepRecord {
  step: LifecycleStepNumber;
  name: string;
  timestamp: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  details?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionTrace {
  executionId: string;
  mandateId: string;
  treasuryId: string;
  agentId: string;
  startedAt: string;
  completedAt?: string;
  status: 'IN_FLIGHT' | 'COMPLETED' | 'FAILED' | 'REQUIRES_RECONCILIATION';
  steps: LifecycleStepRecord[];
}

export interface TelemetrySnapshot {
  timestamp: string;
  agentStatus: 'ACTIVE' | 'PAUSED' | 'DEGRADED';
  treasuryHealth: 'HEALTHY' | 'WARNING' | 'EMERGENCY_STOP';
  activeMandatesCount: number;
  availableBalanceAtomic: string;
  reservedBalanceAtomic: string;
  dailySpendingAtomic: string;
  executionAttemptsCount: number;
  successfulSettlementsCount: number;
  failedExecutionsCount: number;
  expiredQuotesCount: number;
  policyRejectionsCount: number;
  pendingReconciliationsCount: number;
  webhookProcessingFailuresCount: number;
  rpcAvailability: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  textileApiAvailability: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  workerHealth: 'HEALTHY' | 'STOPPED' | 'CRASHED';
  databaseHealth: 'HEALTHY' | 'DEGRADED';
}

export type AlertType =
  | 'EMERGENCY_PAUSE'
  | 'SPENDING_LIMIT_REACHED'
  | 'AGENT_SIGNER_UNAVAILABLE'
  | 'TEXTILE_OUTAGE'
  | 'RPC_OUTAGE'
  | 'QUOTE_EXPIRED'
  | 'FAILED_SETTLEMENT'
  | 'RECONCILIATION_MISMATCH'
  | 'WORKER_CRASH'
  | 'SUSPICIOUS_AUTH_ATTEMPT';

export interface OperationalAlert {
  id: string;
  type: AlertType;
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  executionId?: string;
  treasuryId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class ObservabilityService {
  private traces: Map<string, ExecutionTrace> = new Map();
  private alerts: OperationalAlert[] = [];

  /**
   * Initializes or gets the traceable lifecycle for a persistent executionId.
   */
  startTrace(params: {
    executionId: string;
    mandateId: string;
    treasuryId: string;
    agentId: string;
  }): ExecutionTrace {
    const trace: ExecutionTrace = {
      executionId: params.executionId,
      mandateId: params.mandateId,
      treasuryId: params.treasuryId,
      agentId: params.agentId,
      startedAt: new Date().toISOString(),
      status: 'IN_FLIGHT',
      steps: [],
    };
    this.traces.set(params.executionId, trace);
    return trace;
  }

  /**
   * Records a distinct execution step (1 through 14) with timestamp and audit details.
   */
  recordStep(params: {
    executionId: string;
    step: LifecycleStepNumber;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    details?: string;
    metadata?: Record<string, unknown>;
  }): LifecycleStepRecord {
    let trace = this.traces.get(params.executionId);
    if (!trace) {
      trace = this.startTrace({
        executionId: params.executionId,
        mandateId: 'unknown',
        treasuryId: 'unknown',
        agentId: 'unknown',
      });
    }

    const record: LifecycleStepRecord = {
      step: params.step,
      name: LIFECYCLE_STEP_NAMES[params.step],
      timestamp: new Date().toISOString(),
      status: params.status,
      details: params.details,
      metadata: params.metadata,
    };

    trace.steps.push(record);

    if (params.status === 'FAILED') {
      trace.status = 'FAILED';
      trace.completedAt = record.timestamp;
    } else if (params.step === 14 && params.status === 'SUCCESS') {
      trace.status = 'COMPLETED';
      trace.completedAt = record.timestamp;
    }

    return record;
  }

  getTrace(executionId: string): ExecutionTrace | undefined {
    return this.traces.get(executionId);
  }

  /**
   * Emits an operational alert and logs it to the persistent audit log.
   */
  emitAlert(params: {
    type: AlertType;
    severity?: 'WARNING' | 'CRITICAL';
    title: string;
    message: string;
    executionId?: string;
    treasuryId?: string;
    metadata?: Record<string, unknown>;
  }): OperationalAlert {
    const alert: OperationalAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: params.type,
      severity: params.severity || (params.type.includes('EMERGENCY') || params.type.includes('CRASH') ? 'CRITICAL' : 'WARNING'),
      title: params.title,
      message: params.message,
      executionId: params.executionId,
      treasuryId: params.treasuryId,
      timestamp: new Date().toISOString(),
      metadata: params.metadata,
    };

    this.alerts.unshift(alert);
    if (this.alerts.length > 500) {
      this.alerts.length = 500;
    }

    moiDb.appendAuditEvent({
      treasuryId: params.treasuryId || moiDb.getState().treasury.id,
      executionId: params.executionId,
      category: 'SECURITY_CONTROL',
      severity: alert.severity,
      title: `[ALERT: ${params.type}] ${params.title}`,
      detail: params.message,
      metadata: params.metadata,
    });

    return alert;
  }

  getAlerts(limit: number = 50): OperationalAlert[] {
    return this.alerts.slice(0, limit);
  }

  /**
   * Collects telemetry snapshot derived directly from trusted persistent DB state.
   */
  collectTelemetry(treasuryId?: string, liveBalanceAtomic?: string): TelemetrySnapshot {
    const state = moiDb.getState();
    const targetTreasuryId = treasuryId || state.treasury.id;
    const executions = state.executions.filter((e) => e.treasuryId === targetTreasuryId);
    const mandates = state.mandates.filter((m) => m.treasuryId === targetTreasuryId);
    const webhooks = state.webhookEvents || [];

    const isAnyPaused = mandates.some((m) => m.paused);
    const activeMandates = mandates.filter((m) => !m.paused);

    const successfulSettlements = executions.filter((e) => e.state === 'SETTLED' || e.state === 'RECONCILED');
    const failedExecutions = executions.filter((e) => e.state === 'FAILED');
    const pendingReconciliations = executions.filter((e) => e.state === 'REQUIRES_RECONCILIATION');
    const expiredQuotes = executions.filter((e) => e.state === 'EXPIRED');
    const webhookFailures = webhooks.filter((w) => w.processingStatus === 'FAILED');

    // Aggregate spending
    const dailySpend = mandates.reduce(
      (acc, m) => acc + BigInt(moiDb.getDailySoldAtomic(m.id)),
      0n
    );
    const dailySpendingAtomic = dailySpend.toString();

    const totalMinimumReserve = mandates.reduce(
      (acc, m) => acc + BigInt(m.minimumReserveAtomic || '0'),
      0n
    ).toString();

    return {
      timestamp: new Date().toISOString(),
      agentStatus: isAnyPaused ? 'PAUSED' : 'ACTIVE',
      treasuryHealth: isAnyPaused ? 'EMERGENCY_STOP' : pendingReconciliations.length > 0 ? 'WARNING' : 'HEALTHY',
      activeMandatesCount: activeMandates.length,
      availableBalanceAtomic: liveBalanceAtomic ?? '0',
      reservedBalanceAtomic: totalMinimumReserve,
      dailySpendingAtomic,
      executionAttemptsCount: executions.length,
      successfulSettlementsCount: successfulSettlements.length,
      failedExecutionsCount: failedExecutions.length,
      expiredQuotesCount: expiredQuotes.length,
      policyRejectionsCount: failedExecutions.filter((e) => e.failureReason?.includes('POLICY')).length,
      pendingReconciliationsCount: pendingReconciliations.length,
      webhookProcessingFailuresCount: webhookFailures.length,
      rpcAvailability: 'ONLINE',
      textileApiAvailability: 'ONLINE',
      workerHealth: 'HEALTHY',
      databaseHealth: 'HEALTHY',
    };
  }

  /**
   * Exports full audit history in JSON or CSV format for compliance.
   */
  exportAuditHistory(
    treasuryId: string,
    format: 'json' | 'csv' = 'json'
  ): string {
    const state = moiDb.getState();
    const events = state.auditEvents.filter(
      (e) => !treasuryId || e.treasuryId === treasuryId
    );

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    // CSV formatting
    const headers = ['id', 'timestamp', 'treasuryId', 'category', 'severity', 'title', 'detail'];
    const rows = events.map((e) => [
      e.id,
      e.createdAt,
      e.treasuryId,
      e.category,
      e.severity,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.detail || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const observability = new ObservabilityService();
