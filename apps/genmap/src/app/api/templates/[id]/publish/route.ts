import { NextRequest, NextResponse } from 'next/server';
import { getDb, publishTemplate } from '@nookstead/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const published = await publishTemplate(db, id);

    if (!published) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(published);
  } catch (error) {
    console.error('Failed to publish template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
