import { NextResponse } from 'next/server';
import { getDb, listAllMapsLite } from '@nookstead/db';

export async function GET() {
  const db = getDb();
  const maps = await listAllMapsLite(db);
  return NextResponse.json(maps);
}
