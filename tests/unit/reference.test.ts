import { generateReference } from '../../src/shared/utils/reference';

describe('generateReference', () => {
  it('formats as TXN-<date>-<8 chars>', () => {
    expect(generateReference(new Date('2026-07-11T10:00:00Z'))).toMatch(/^TXN-20260711-[A-Z0-9]{8}$/);
  });

  it('never contains ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateReference()).not.toMatch(/[ILOU]/);
    }
  });

  it('produces unique values across many draws', () => {
    const draws = new Set(Array.from({ length: 1000 }, () => generateReference()));

    expect(draws.size).toBe(1000);
  });
});
