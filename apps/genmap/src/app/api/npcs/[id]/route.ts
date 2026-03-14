import { NextRequest, NextResponse } from 'next/server';
import { getDb, getBotById, updateBot, deleteBot } from '@nookstead/db';
import { AVAILABLE_SKINS } from '@nookstead/shared';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const bot = await getBotById(db, id);

  if (!bot) {
    return NextResponse.json({ error: 'NPC not found' }, { status: 404 });
  }

  return NextResponse.json(bot);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const bot = await getBotById(db, id);

  if (!bot) {
    return NextResponse.json({ error: 'NPC not found' }, { status: 404 });
  }

  const body = await request.json();
  const { name, skin, mapId, personality, role, speechStyle, bio, age, traits, goals, fears, interests } = body;

  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'name cannot be empty' },
        { status: 400 }
      );
    }
    if (name.trim().length > 64) {
      return NextResponse.json(
        { error: 'name must be at most 64 characters' },
        { status: 400 }
      );
    }
    updates.name = name.trim();
  }

  if (skin !== undefined) {
    if (
      typeof skin !== 'string' ||
      !AVAILABLE_SKINS.includes(skin as (typeof AVAILABLE_SKINS)[number])
    ) {
      return NextResponse.json(
        {
          error: `skin must be one of: ${AVAILABLE_SKINS.join(', ')}`,
        },
        { status: 400 }
      );
    }
    updates.skin = skin;
  }

  if (mapId !== undefined) {
    if (typeof mapId !== 'string' || mapId.trim() === '') {
      return NextResponse.json(
        { error: 'mapId must be a non-empty string' },
        { status: 400 }
      );
    }
    updates.mapId = mapId;
  }

  if (role !== undefined) {
    if (role !== null && typeof role !== 'string') {
      return NextResponse.json(
        { error: 'role must be a string or null' },
        { status: 400 }
      );
    }
    if (typeof role === 'string' && role.length > 64) {
      return NextResponse.json(
        { error: 'role must be at most 64 characters' },
        { status: 400 }
      );
    }
    updates.role = role;
  }

  if (personality !== undefined) updates.personality = personality;
  if (speechStyle !== undefined) updates.speechStyle = speechStyle;
  if (bio !== undefined) updates.bio = bio;
  if (age !== undefined) {
    if (age !== null && (typeof age !== 'number' || age < 18 || age > 70)) {
      return NextResponse.json(
        { error: 'age must be a number between 18 and 70, or null' },
        { status: 400 }
      );
    }
    updates.age = age;
  }
  if (traits !== undefined) updates.traits = traits;
  if (goals !== undefined) updates.goals = goals;
  if (fears !== undefined) updates.fears = fears;
  if (interests !== undefined) updates.interests = interests;

  const updated = await updateBot(db, id, updates);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const bot = await getBotById(db, id);

  if (!bot) {
    return NextResponse.json({ error: 'NPC not found' }, { status: 404 });
  }

  await deleteBot(db, id);
  return new NextResponse(null, { status: 204 });
}
