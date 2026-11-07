import { NextRequest, NextResponse } from 'next/server';
import { moiDb } from '@moi/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing invoice id.' }, { status: 400 });
    }

    const invoice = moiDb.getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      invoice,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch invoice.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'mark_paid';

    if (action === 'mark_paid') {
      const paidTxHash = body.paidTxHash as `0x${string}` | undefined;
      const res = moiDb.markInvoicePaidForUser(id, paidTxHash);
      if (!res.ok) {
        return NextResponse.json({ error: res.error || 'Failed to mark invoice paid.' }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        invoice: res.invoice,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update invoice.' },
      { status: 500 }
    );
  }
}

