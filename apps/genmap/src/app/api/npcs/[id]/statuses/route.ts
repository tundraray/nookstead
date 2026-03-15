import { NextRequest, NextResponse } from 'next/server';
import { getDb, listActiveStatusesForBot } from '@nookstead/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const statuses = await listActiveStatusesForBot(db, id);
  return NextResponse.json(statuses);
}
