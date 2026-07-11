import { hashRequestBody } from '../../src/shared/utils/request-hash';

describe('hashRequestBody', () => {
  it('is stable across key ordering', () => {
    const a = hashRequestBody({ amount: 100, narration: 'rent', meta: { b: 1, a: 2 } });
    const b = hashRequestBody({ meta: { a: 2, b: 1 }, narration: 'rent', amount: 100 });

    expect(a).toBe(b);
  });

  it('changes when any value changes', () => {
    expect(hashRequestBody({ amount: 100 })).not.toBe(hashRequestBody({ amount: 101 }));
  });

  it('distinguishes empty body shapes', () => {
    expect(hashRequestBody(undefined)).toBe(hashRequestBody(undefined));
    expect(hashRequestBody({})).not.toBe(hashRequestBody(undefined));
  });

  it('canonicalises nested arrays without reordering them', () => {
    expect(hashRequestBody({ items: [1, 2] })).not.toBe(hashRequestBody({ items: [2, 1] }));
  });
});
