import { NextRequest, NextResponse } from 'next/server';
import { getDb, getFramesByFilename } from '@nookstead/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  if (!filename || filename.trim() === '') {
    return NextResponse.json(
      { error: 'filename query parameter is required' },
      { status: 400 }
    );
  }

  const db = getDb();
  const frames = await getFramesByFilename(db, filename.trim());
  return NextResponse.json(frames);
}
