import { NextRequest, NextResponse } from 'next/server';
import {
  getDb,
  getBotById,
  getAdminDialogueSessions,
  getDialogueSessionMessages,
} from '@nookstead/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const sessionId = searchParams.get('sessionId');

  if (sessionId) {
    const db = getDb();
    const messages = await getDialogueSessionMessages(db, sessionId);
    return NextResponse.json(messages);
  }

  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const paginationParams: { limit?: number; offset?: number } = {};

  if (limitParam !== null) {
    const limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'limit must be a positive integer' },
        { status: 400 }
      );
    }
    paginationParams.limit = limit;
  }

  if (offsetParam !== null) {
    const offset = parseInt(offsetParam, 10);
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'offset must be a non-negative integer' },
        { status: 400 }
      );
    }
    paginationParams.offset = offset;
  }

  const db = getDb();

  const bot = await getBotById(db, id);
  if (!bot) {
    return NextResponse.json({ error: 'NPC not found' }, { status: 404 });
  }

  const sessions = await getAdminDialogueSessions(
    db,
    id,
    Object.keys(paginationParams).length > 0 ? paginationParams : undefined
  );
  return NextResponse.json(sessions);
}
