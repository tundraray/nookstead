import { NextRequest, NextResponse } from 'next/server';
import { getDb, listAllBots, createBotAdmin } from '@nookstead/db';
import { AVAILABLE_SKINS } from '@nookstead/shared';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  const params: { limit?: number; offset?: number } = {};

  if (limitParam !== null) {
    const limit = parseInt(limitParam, 10);
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'limit must be a positive integer' },
        { status: 400 }
      );
    }
    params.limit = limit;
  }

  if (offsetParam !== null) {
    const offset = parseInt(offsetParam, 10);
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'offset must be a non-negative integer' },
        { status: 400 }
      );
    }
    params.offset = offset;
  }

  const db = getDb();
  const bots = await listAllBots(
    db,
    Object.keys(params).length > 0 ? params : undefined
  );
  return NextResponse.json(bots);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, skin, mapId, personality, role, speechStyle, bio, age, traits, goals, fears, interests } = body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  if (name.trim().length > 64) {
    return NextResponse.json(
      { error: 'name must be at most 64 characters' },
      { status: 400 }
    );
  }

  if (!skin || typeof skin !== 'string') {
    return NextResponse.json(
      { error: 'skin is required' },
      { status: 400 }
    );
  }

  if (!AVAILABLE_SKINS.includes(skin as (typeof AVAILABLE_SKINS)[number])) {
    return NextResponse.json(
      {
        error: `skin must be one of: ${AVAILABLE_SKINS.join(', ')}`,
      },
      { status: 400 }
    );
  }

  if (!mapId || typeof mapId !== 'string') {
    return NextResponse.json(
      { error: 'mapId is required' },
      { status: 400 }
    );
  }

  if (role !== undefined && role !== null) {
    if (typeof role !== 'string') {
      return NextResponse.json(
        { error: 'role must be a string' },
        { status: 400 }
      );
    }
    if (role.length > 64) {
      return NextResponse.json(
        { error: 'role must be at most 64 characters' },
        { status: 400 }
      );
    }
  }

  const db = getDb();
  const bot = await createBotAdmin(db, {
    name: name.trim(),
    skin,
    mapId,
    personality: personality ?? undefined,
    role: role ?? undefined,
    speechStyle: speechStyle ?? undefined,
    bio: bio ?? undefined,
    age: age ?? undefined,
    traits: traits ?? undefined,
    goals: goals ?? undefined,
    fears: fears ?? undefined,
    interests: interests ?? undefined,
  });

  return NextResponse.json(bot, { status: 201 });
}
