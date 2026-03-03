import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb, getDialogueHistoryByUser } from '@nookstead/db';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const botId = searchParams.get('botId');

  if (!botId) {
    return NextResponse.json(
      { error: 'Missing botId parameter' },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const history = await getDialogueHistoryByUser(
      db,
      botId,
      session.user.id,
      10
    );
    return NextResponse.json({ sessions: history });
  } catch (err) {
    console.error('[DialogueHistoryAPI] Failed to load history:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
