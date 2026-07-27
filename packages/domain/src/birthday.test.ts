import { describe, expect, it } from 'vitest';
import { nextBirthday, turningAge } from './birthday';

describe('turningAge', () => {
  it('is the occurrence year minus the birth year', () => {
    expect(turningAge(1990, new Date(2024, 7, 1))).toBe(34);
  });

  it('is null when the birth year is unknown', () => {
    expect(turningAge(null, new Date(2024, 7, 1))).toBeNull();
  });
});

describe('nextBirthday', () => {
  it('returns this year when the day is still ahead', () => {
    expect(nextBirthday(12, 24, new Date(2024, 0, 1))).toEqual(new Date(2024, 11, 24));
  });

  it('treats today as the upcoming birthday', () => {
    expect(nextBirthday(6, 15, new Date(2024, 5, 15))).toEqual(new Date(2024, 5, 15));
  });

  it('rolls to next year once the day has passed', () => {
    expect(nextBirthday(1, 1, new Date(2024, 5, 1))).toEqual(new Date(2025, 0, 1));
  });
});
