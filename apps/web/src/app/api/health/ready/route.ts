import { NextResponse } from 'next/server';
import { moiDb } from '@moi/database';

export async function GET() {
  try {
    const state = moiDb.getState();
    if (!state || !state.treasury) {
      return NextResponse.json({ status: 'not_ready', reason: 'database_not_initialized' }, { status: 503 });
    }
    return NextResponse.json({ status: 'ready', timestamp: new Date().toISOString() }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ status: 'not_ready', error: err?.message }, { status: 503 });
  }
}

