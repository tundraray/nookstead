import { NextRequest, NextResponse } from 'next/server';
import { getDb, searchFrameFilenames, listDistinctFilenames } from '@nookstead/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  const db = getDb();

  if (!query || query.trim() === '') {
    const filenames = await listDistinctFilenames(db);
    return NextResponse.json(filenames);
  }

  const filenames = await searchFrameFilenames(db, query.trim());
  return NextResponse.json(filenames);
}
