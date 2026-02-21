import { NextRequest, NextResponse } from 'next/server';
import { getDb, getFenceTypeByKey } from '@nookstead/db';
import { resolveFrameMapping } from '../../resolve-frames';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const db = getDb();
  const fenceType = await getFenceTypeByKey(db, key);

  if (!fenceType) {
    return NextResponse.json(
      { error: 'Fence type not found' },
      { status: 404 }
    );
  }

  const frameMapping = await resolveFrameMapping(
    db,
    fenceType.frameMapping as Record<string, string>
  );

  const gateFrameMapping = fenceType.gateFrameMapping
    ? await resolveFrameMapping(
        db,
        fenceType.gateFrameMapping as Record<string, string>
      )
    : null;

  return NextResponse.json({
    ...fenceType,
    frameMapping,
    gateFrameMapping,
  });
}
