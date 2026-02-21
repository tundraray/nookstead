import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDistinctValues } from '@nookstead/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const field = searchParams.get('field');

  if (field !== 'category' && field !== 'objectType') {
    return NextResponse.json(
      { error: 'field must be "category" or "objectType"' },
      { status: 400 }
    );
  }

  const db = getDb();
  const values = await getDistinctValues(db, field);
  return NextResponse.json(values);
}
