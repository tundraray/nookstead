import { NextRequest, NextResponse } from 'next/server';
import { getDb, getGlobalConfig, updateGlobalConfig } from '@nookstead/db';

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    const config = await getGlobalConfig(db);
    return NextResponse.json(config);
  } catch (err) {
    console.error('[memory-config] GET failed:', err);
    return NextResponse.json(
      { error: 'Failed to load memory config' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const db = getDb();
    const body = await req.json();
    const config = await updateGlobalConfig(db, body);
    return NextResponse.json(config);
  } catch (err) {
    console.error('[memory-config] PATCH failed:', err);
    return NextResponse.json(
      { error: 'Failed to update memory config' },
      { status: 500 }
    );
  }
}
