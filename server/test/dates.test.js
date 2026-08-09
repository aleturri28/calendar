import { describe, it, expect } from 'vitest';
import {
  romeDate, shiftDate, isValidDate, isUploadOpen, isLate,
} from '../src/lib/dates.js';

describe('romeDate', () => {
  it('formats an instant as a Rome calendar date', () => {
    expect(romeDate(new Date('2026-08-09T10:00:00Z'))).toBe('2026-08-09');
  });

  it('rolls over at Rome midnight, not UTC midnight', () => {
    // 22:30 UTC in estate = 00:30 del giorno dopo a Roma (CEST, +2)
    expect(romeDate(new Date('2026-08-09T22:30:00Z'))).toBe('2026-08-10');
  });

  it('handles winter offset (+1)', () => {
    expect(romeDate(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('shiftDate', () => {
  it('moves backwards across a month boundary', () => {
    expect(shiftDate('2026-09-03', -7)).toBe('2026-08-27');
  });

  it('moves forwards across a year boundary', () => {
    expect(shiftDate('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('is unaffected by the DST switch', () => {
    // ultima domenica di ottobre 2026: 25 ottobre
    expect(shiftDate('2026-10-24', 2)).toBe('2026-10-26');
  });
});

describe('isValidDate', () => {
  it('accepts a well-formed date', () => {
    expect(isValidDate('2026-08-09')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidDate('2026-8-9')).toBe(false);
    expect(isValidDate('nope')).toBe(false);
    expect(isValidDate('2026-02-30')).toBe(false);
  });
});

describe('isUploadOpen', () => {
  const now = new Date('2026-09-10T09:00:00Z'); // a Roma: 2026-09-10

  it('accepts today', () => {
    expect(isUploadOpen('2026-09-10', now)).toBe(true);
  });

  it('accepts the oldest day still in the window', () => {
    expect(isUploadOpen('2026-09-03', now)).toBe(true);
  });

  it('rejects the day just outside the window', () => {
    expect(isUploadOpen('2026-09-02', now)).toBe(false);
  });

  it('rejects the future', () => {
    expect(isUploadOpen('2026-09-11', now)).toBe(false);
  });

  it('rejects dates before the calendar start', () => {
    expect(isUploadOpen('2026-08-08', new Date('2026-08-09T09:00:00Z'))).toBe(false);
  });
});

describe('isLate', () => {
  it('is false when uploaded on the same Rome day', () => {
    expect(isLate('2026-08-09', new Date('2026-08-09T21:00:00Z'))).toBe(false);
  });

  it('is true when uploaded after Rome midnight', () => {
    expect(isLate('2026-08-09', new Date('2026-08-09T22:30:00Z'))).toBe(true);
  });

  it('is false when nothing was uploaded', () => {
    expect(isLate('2026-08-09', null)).toBe(false);
  });
});
