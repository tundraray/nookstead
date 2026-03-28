import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ReflectionService,
  type ReflectionInput,
} from '../reflection.service.js';
import {
  reflectionOutputSchema,
  type ReflectionOutput,
} from '../reflection.schema.js';

// Mock 'ai' generateObject
const mockGenerateObject = jest.fn();
jest.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

// Mock '@ai-sdk/openai' createOpenAI
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => jest.fn(() => 'mock-model')),
}));

const validOutput: ReflectionOutput = {
  summary: 'Good day at the farm.',
  mood: 'happy',
  moodIntensity: 7,
  moodRationale: 'Player was kind.',
  plan: 'Help the farmer tomorrow.',
};

const sampleInput: ReflectionInput = {
  botId: 'bot-001',
  botName: 'Maple',
  persona: {
    personality: 'Cheerful and hardworking',
    role: 'Farmhand',
    bio: 'A dedicated farmhand who loves the outdoors.',
    traits: ['cheerful', 'hardworking'],
    goals: ['help with the harvest'],
    interests: ['gardening', 'cooking'],
  },
  currentMood: 'neutral',
  currentMoodIntensity: 5,
  memories: [
    {
      id: 'mem-001',
      botId: 'bot-001',
      userId: 'user-001',
      type: 'interaction',
      content: 'Talked with the player about the weather.',
      importance: 5,
      dialogueSessionId: null,
      createdAt: new Date('2026-03-27T10:00:00Z'),
    },
  ],
};

describe('ReflectionService', () => {
  let service: ReflectionService;

  beforeEach(async () => {
    mockGenerateObject.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReflectionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return 'test-api-key';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ReflectionService>(ReflectionService);
  });

  // Test 1 -- AC1: generates structured reflection from memories
  it('should return structured ReflectionOutput when LLM succeeds', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        summary: 'Good day.',
        mood: 'happy',
        moodIntensity: 7,
        moodRationale: 'Player was kind.',
        plan: 'Help the farmer tomorrow.',
      },
    });

    const result = await service.generateReflection(sampleInput);

    expect(result).not.toBeNull();
    expect(result!.summary).toBe('Good day.');
    expect(result!.mood).toBe('happy');
    expect(result!.moodIntensity).toBe(7);
    expect(result!.moodRationale).toBe('Player was kind.');
    expect(result!.plan).toBe('Help the farmer tomorrow.');
  });

  // Test 2 -- AC2: generates idle reflection when memories array is empty
  it('should generate idle reflection when memories are empty', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
        summary: 'Quiet day.',
        mood: 'neutral',
        moodIntensity: 3,
        moodRationale: 'No interactions.',
        plan: 'Tend to my affairs.',
      },
    });

    const result = await service.generateReflection({
      ...sampleInput,
      memories: [],
    });

    expect(result).not.toBeNull();
    expect(result!.summary).toBeTruthy();

    // Verify that the prompt included 'No interactions today.' for empty memories
    const callArgs = mockGenerateObject.mock.calls[0][0];
    expect(callArgs.prompt).toContain('No interactions today.');
  });

  // Test 3 -- AC4: mood value is constrained to emotion vocabulary
  it('should reject invalid mood values via Zod schema', () => {
    expect(() =>
      reflectionOutputSchema.parse({ ...validOutput, mood: 'ecstatic' })
    ).toThrow();
  });

  // Test 4 -- AC5: mood intensity is integer 1-10
  it('should reject moodIntensity outside 1-10 range', () => {
    expect(() =>
      reflectionOutputSchema.parse({ ...validOutput, moodIntensity: 0 })
    ).toThrow();
    expect(() =>
      reflectionOutputSchema.parse({ ...validOutput, moodIntensity: 11 })
    ).toThrow();
    expect(() =>
      reflectionOutputSchema.parse({ ...validOutput, moodIntensity: 5.5 })
    ).toThrow();
  });

  // Test 5 -- AC6: plan is present and non-empty
  it('should include non-empty plan in reflection output', async () => {
    mockGenerateObject.mockResolvedValue({
      object: { ...validOutput, plan: 'Visit the market.' },
    });

    const result = await service.generateReflection(sampleInput);

    expect(result!.plan).toBeTruthy();
    expect(result!.plan.length).toBeGreaterThan(0);
  });

  // Test 6 -- AC15: returns null on LLM failure
  it('should return null and log error when LLM throws', async () => {
    mockGenerateObject.mockRejectedValue(new Error('API error'));

    const result = await service.generateReflection(sampleInput);

    expect(result).toBeNull();
  });

  // Test 7 -- AC15: returns null on LLM timeout
  it('should return null when LLM call times out (AbortController)', async () => {
    mockGenerateObject.mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Aborted')), 0)
        )
    );

    const result = await service.generateReflection(sampleInput);

    expect(result).toBeNull();
  });
});
