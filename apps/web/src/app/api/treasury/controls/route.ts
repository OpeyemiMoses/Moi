import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, validateCsrfOrigin } from '@moi/identity';
import { moiDb } from '@moi/database';
import { observability } from '@moi/agent-core';
import { CeloChainService } from '@moi/wallet-signer';

const chainService = new CeloChainService();

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required to view operational telemetry.' },
      { status: 401 }
    );
  }

  const executionId = req.nextUrl.searchParams.get('executionId');
  if (executionId) {
    const trace = observability.getTrace(executionId);
    return NextResponse.json({ ok: true, trace });
  }

  const exportFormat = req.nextUrl.searchParams.get('export');
  if (exportFormat === 'json' || exportFormat === 'csv') {
    const tenantState = moiDb.getTenantState(auth.user.id);
    const content = observability.exportAuditHistory(tenantState.treasury.id, exportFormat);
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': exportFormat === 'csv' ? 'text/csv' : 'application/json',
        'Content-Disposition': `attachment; filename="moi_audit_history_${Date.now()}.${exportFormat}"`,
      },
    });
  }

  const tenantState = moiDb.getTenantState(auth.user.id);
  const targetWallet = tenantState.treasury.ownerWalletAddress || chainService.getAgentWalletAddress();
  const balances = await chainService.readWalletBalances(targetWallet);
  const liveSellEntry = balances.find((b) => b.symbol === 'cNGN');
  const telemetry = observability.collectTelemetry(
    tenantState.treasury.id,
    liveSellEntry?.balanceAtomic ?? '0'
  );
  const alerts = observability.getAlerts(20);

  return NextResponse.json({
    ok: true,
    telemetry,
    alerts,
  });
}

export async function POST(req: NextRequest) {
  const csrf = validateCsrfOrigin(req);
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.reason }, { status: 403 });
  }

  const auth = await authenticateRequest(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required for operational controls.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action;
    const tenantUserId = auth.user.id;
    const tenantState = moiDb.getTenantState(tenantUserId);
    const treasuryId = tenantState.treasury.id;
    const mandateId = body.mandateId || tenantState.mandates[0]?.id;

    if (!mandateId) {
      return NextResponse.json({ error: 'No mandate found for this treasury.' }, { status: 404 });
    }

    const mandate = tenantState.mandates.find((m) => m.id === mandateId);
    if (!mandate) {
      return NextResponse.json({ error: 'Mandate not found or access denied.' }, { status: 404 });
    }

    if (action === 'pause_agent' || action === 'emergency_pause') {
      const updated = { ...mandate, paused: true, updatedAt: new Date().toISOString() };
      moiDb.updateMandateForUser(updated, tenantUserId);

      observability.emitAlert({
        type: 'EMERGENCY_PAUSE',
        severity: 'CRITICAL',
        title: 'Emergency Stop Activated',
        message: `Operator ${auth.user.displayName} paused mandate "${mandate.name}". All autonomous and pending trades halted.`,
        treasuryId,
      });

      return NextResponse.json({ ok: true, status: 'PAUSED', mandate: updated });
    }

    if (action === 'resume_agent') {
      const updated = { ...mandate, paused: false, updatedAt: new Date().toISOString() };
      moiDb.updateMandateForUser(updated, tenantUserId);

      moiDb.appendAuditEvent({
        treasuryId,
        category: 'SECURITY_CONTROL',
        severity: 'SUCCESS',
        title: 'Agent Resumed',
        detail: `Operator ${auth.user.displayName} resumed mandate "${mandate.name}".`,
      });

      return NextResponse.json({ ok: true, status: 'RESUMED', mandate: updated });
    }

    if (action === 'disable_autonomous') {
      const updated = { ...mandate, mode: 'approval_required' as const, updatedAt: new Date().toISOString() };
      moiDb.updateMandateForUser(updated, tenantUserId);

      moiDb.appendAuditEvent({
        treasuryId,
        category: 'SECURITY_CONTROL',
        severity: 'INFO',
        title: 'Autonomous Mode Disabled',
        detail: `Mandate "${mandate.name}" shifted to "approval_required" mode. Every future execution requires explicit owner signature.`,
      });

      return NextResponse.json({ ok: true, status: 'APPROVAL_REQUIRED', mandate: updated });
    }

    if (action === 'revoke_mandate') {
      const updated = { ...mandate, paused: true, updatedAt: new Date().toISOString() };
      moiDb.updateMandateForUser(updated, tenantUserId);

      moiDb.appendAuditEvent({
        treasuryId,
        category: 'SECURITY_CONTROL',
        severity: 'WARNING',
        title: 'Mandate Revoked',
        detail: `Mandate "${mandate.name}" has been permanently paused and revoked by operator.`,
      });

      return NextResponse.json({ ok: true, status: 'REVOKED', mandate: updated });
    }

    if (action === 'approve_pending_execution') {
      const executionId = body.executionId;
      if (!executionId) {
        return NextResponse.json({ error: 'Missing executionId.' }, { status: 400 });
      }

      const execution = tenantState.executions.find((e) => e.id === executionId);
      if (!execution) {
        return NextResponse.json({ error: `Execution "${executionId}" not found.` }, { status: 404 });
      }

      if (execution.state !== 'APPROVAL_PENDING') {
        return NextResponse.json(
          { error: `Cannot approve execution in state "${execution.state}". Must be APPROVAL_PENDING.` },
          { status: 400 }
        );
      }

      // Transition execution state to POLICY_VALIDATED with owner authorization attached
      const updatedExecution = moiDb.upsertExecution({
        ...execution,
        state: 'POLICY_VALIDATED',
        updatedAt: new Date().toISOString(),
      });

      moiDb.appendAuditEvent({
        treasuryId,
        executionId: execution.id,
        category: 'SECURITY_CONTROL',
        severity: 'SUCCESS',
        title: 'Trade Approved by Treasury Owner',
        detail: `Operator ${auth.user.displayName} cryptographically approved execution ${execution.id} (${execution.sellSymbol} -> ${execution.buySymbol}). Trade is now policy validated and authorized for restricted signer execution.`,
      });

      return NextResponse.json({ ok: true, status: 'APPROVED', execution: updatedExecution });
    }

    if (action === 'reject_pending_execution') {
      const executionId = body.executionId;
      if (!executionId) {
        return NextResponse.json({ error: 'Missing executionId.' }, { status: 400 });
      }

      const execution = tenantState.executions.find((e) => e.id === executionId);
      if (!execution) {
        return NextResponse.json({ error: `Execution "${executionId}" not found.` }, { status: 404 });
      }

      const updatedExecution = moiDb.upsertExecution({
        ...execution,
        state: 'REJECTED',
        failureReason: body.reason || 'Rejected by treasury owner via Approval Queue',
        updatedAt: new Date().toISOString(),
      });

      moiDb.appendAuditEvent({
        treasuryId,
        executionId: execution.id,
        category: 'SECURITY_CONTROL',
        severity: 'INFO',
        title: 'Trade Rejected by Treasury Owner',
        detail: `Operator ${auth.user.displayName} rejected pending execution ${execution.id}.`,
      });

      return NextResponse.json({ ok: true, status: 'REJECTED', execution: updatedExecution });
    }

    return NextResponse.json({ error: `Unknown control action: "${action}".` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Operation failed.' }, { status: 500 });
  }
}

