import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDistinctValues } from '@nookstead/db';
import {
  GAME_OBJECT_CATEGORIES,
  GAME_OBJECT_TYPES,
  isGameObjectCategory,
} from '@nookstead/shared';

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
  const dbValues = await getDistinctValues(db, field);

  let predefined: readonly string[];

  if (field === 'category') {
    predefined = GAME_OBJECT_CATEGORIES;
  } else {
    // For objectType, optionally scope to a specific category
    const category = searchParams.get('category');
    if (category && isGameObjectCategory(category)) {
      predefined = GAME_OBJECT_TYPES[category];
    } else {
      // No valid category context: return all known types
      predefined = Object.values(GAME_OBJECT_TYPES).flat();
    }
  }

  // Merge: predefined first (definition order), then DB-only values (sorted)
  const predefinedSet = new Set(predefined);
  const dbOnly = dbValues.filter((v) => !predefinedSet.has(v)).sort();
  const merged = [...predefined, ...dbOnly];

  return NextResponse.json(merged);
}
