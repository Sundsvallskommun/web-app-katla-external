import { describe, expect, it } from 'vitest';

import { sanitizePersonNumber } from '@/utils/sanitizePersonNumber';

import {
  mockCoordinationNumber,
  mockFutureDatePersonNumber,
  mockImpossibleDatePersonNumber,
  mockPersonNumber,
  mockPersonNumberBadCheckDigit,
  mockPersonNumberHyphenated,
  mockPersonNumberShort,
} from './helpers/mock-data';

describe('sanitizePersonNumber', () => {
  it('keeps a twelve-digit person number', () => {
    expect(sanitizePersonNumber(mockPersonNumber)).toBe(mockPersonNumber);
  });

  it('strips the separator', () => {
    expect(sanitizePersonNumber(mockPersonNumberHyphenated)).toBe(mockPersonNumber);
  });

  it('expands a ten-digit person number to the most recent century that is already past', () => {
    expect(sanitizePersonNumber(mockPersonNumberShort)).toBe(mockPersonNumber);
  });

  // Skatteverket writes '+' instead of '-' once a person has turned 100. Without it a ten-digit
  // number cannot say which century it means.
  it("reads '+' as one century further back", () => {
    expect(sanitizePersonNumber(mockPersonNumberShort.replace('-', '+'))).toBe(`18${mockPersonNumber.slice(2)}`);
  });

  it('accepts a coordination number, whose day carries a +60 offset', () => {
    expect(sanitizePersonNumber(mockCoordinationNumber)).toBe(mockCoordinationNumber);
  });

  it('rejects a wrong check digit', () => {
    expect(sanitizePersonNumber(mockPersonNumberBadCheckDigit)).toBeUndefined();
    expect(sanitizePersonNumber(mockPersonNumberBadCheckDigit.slice(2))).toBeUndefined();
  });

  it('rejects a birth date that has not happened yet', () => {
    expect(sanitizePersonNumber(mockFutureDatePersonNumber)).toBeUndefined();
  });

  it('rejects a birth date that does not exist', () => {
    expect(sanitizePersonNumber(mockImpossibleDatePersonNumber)).toBeUndefined();
  });

  // A ten-digit number is expanded, never reinterpreted into a different day.
  it('rejects a ten-digit number whose day does not exist in either century', () => {
    expect(sanitizePersonNumber(mockImpossibleDatePersonNumber.slice(2))).toBeUndefined();
  });

  it('rejects digits that are neither ten nor twelve long', () => {
    expect(sanitizePersonNumber(mockPersonNumber.slice(0, 8))).toBeUndefined();
    expect(sanitizePersonNumber(`${mockPersonNumber}0`)).toBeUndefined();
  });

  it('rejects a missing identifier', () => {
    expect(sanitizePersonNumber(undefined)).toBeUndefined();
    expect(sanitizePersonNumber('')).toBeUndefined();
  });
});
