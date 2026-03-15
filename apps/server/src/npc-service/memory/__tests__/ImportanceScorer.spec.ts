import { describe, it, expect } from '@jest/globals';
import { scoreImportance, type ImportanceScorerConfig } from '../ImportanceScorer.js';

const defaultConfig: ImportanceScorerConfig = {
  firstMeeting: 7,
  normalDialogue: 4,
  emotionalDialogue: 6,
  giftReceived: 7,
  questRelated: 8,
};

describe('scoreImportance', () => {
  it('returns firstMeeting importance when isFirstMeeting is true', () => {
    const result = scoreImportance(defaultConfig, { isFirstMeeting: true });
    expect(result).toBe(7);
  });

  it('returns normalDialogue importance when isFirstMeeting is false', () => {
    const result = scoreImportance(defaultConfig, { isFirstMeeting: false });
    expect(result).toBe(4);
  });

  it('respects custom config values', () => {
    const customConfig: ImportanceScorerConfig = {
      ...defaultConfig,
      firstMeeting: 9,
      normalDialogue: 2,
    };
    expect(scoreImportance(customConfig, { isFirstMeeting: true })).toBe(9);
    expect(scoreImportance(customConfig, { isFirstMeeting: false })).toBe(2);
  });

  it('returns giftImportance when hasGift=true and giftImportance is defined', () => {
    const result = scoreImportance(defaultConfig, {
      isFirstMeeting: false,
      hasGift: true,
      giftImportance: 7,
    });
    expect(result).toBe(7);
  });

  it('returns giftImportance=4 for a lower-value gift', () => {
    const result = scoreImportance(defaultConfig, {
      isFirstMeeting: false,
      hasGift: true,
      giftImportance: 4,
    });
    expect(result).toBe(4);
  });

  it('falls through to normal logic when hasGift=false', () => {
    const result = scoreImportance(defaultConfig, {
      isFirstMeeting: false,
      hasGift: false,
      giftImportance: 7,
    });
    expect(result).toBe(4);
  });

  it('falls through to normal logic when giftImportance is undefined', () => {
    const result = scoreImportance(defaultConfig, {
      isFirstMeeting: false,
      hasGift: true,
    });
    expect(result).toBe(4);
  });
});
