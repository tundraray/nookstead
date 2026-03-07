import { NextRequest, NextResponse } from 'next/server';
import { generateNpcCharacter } from '@nookstead/ai';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { concept, name } = body;

  if (!concept || typeof concept !== 'string' || concept.trim() === '') {
    return NextResponse.json(
      { error: 'concept is required (e.g., "friendly blacksmith")' },
      { status: 400 }
    );
  }

  try {
    const character = await generateNpcCharacter(
      apiKey,
      name || 'Unknown',
      concept.trim()
    );
    return NextResponse.json(character);
  } catch (error) {
    console.error('[generate-character] failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate character' },
      { status: 500 }
    );
  }
}
