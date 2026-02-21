import { NextRequest, NextResponse } from 'next/server';
import { getDb, listTemplates, createTemplate } from '@nookstead/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mapType = searchParams.get('mapType') ?? undefined;
    const isPublished = searchParams.get('isPublished');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const db = getDb();
    const templates = await listTemplates(db, {
      mapType,
      isPublished: isPublished !== null ? isPublished === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Failed to list templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, mapType, baseWidth, baseHeight, parameters, constraints, grid, layers, zones } =
      body as Record<string, unknown>;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!mapType || typeof mapType !== 'string') {
      return NextResponse.json(
        { error: 'mapType is required' },
        { status: 400 }
      );
    }
    if (!baseWidth || typeof baseWidth !== 'number') {
      return NextResponse.json(
        { error: 'baseWidth is required' },
        { status: 400 }
      );
    }
    if (!baseHeight || typeof baseHeight !== 'number') {
      return NextResponse.json(
        { error: 'baseHeight is required' },
        { status: 400 }
      );
    }
    if (!grid) {
      return NextResponse.json({ error: 'grid is required' }, { status: 400 });
    }
    if (!layers) {
      return NextResponse.json(
        { error: 'layers is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const template = await createTemplate(db, {
      name,
      description: (description as string) ?? undefined,
      mapType,
      baseWidth,
      baseHeight,
      parameters: parameters ?? undefined,
      constraints: constraints ?? undefined,
      grid,
      layers,
      zones: zones ?? undefined,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
