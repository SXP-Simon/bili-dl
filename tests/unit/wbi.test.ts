import { describe, it, expect } from 'vitest';
import { getMixinKey, signWbiQuery } from '../../src/utils/wbi';

describe('wbi utilities', () => {
  it('should correctly calculate mixinKey based on predetermined table', () => {
    // Standard test key concatenation
    const rawKey = '7cd084941338484a8271054f934b1dff' + '433f81e69cc542d19f6a62b143d45091';
    const mixinKey = getMixinKey(rawKey);
    expect(mixinKey).toHaveLength(32);
    expect(typeof mixinKey).toBe('string');
  });

  it('should sign query parameters with wts and w_rid', async () => {
    const query = await signWbiQuery({
      bvid: 'BV1xx411c7mD',
      cid: 123456,
    });

    expect(query).toContain('bvid=BV1xx411c7mD');
    expect(query).toContain('cid=123456');
    expect(query).toContain('wts=');
    expect(query).toContain('w_rid=');
  });

  it('should sanitize characters in query string', async () => {
    const query = await signWbiQuery({
      name: 'hello!world*()',
    });

    expect(query).not.toContain('!');
    expect(query).not.toContain('*');
    expect(query).not.toContain('(');
    expect(query).not.toContain(')');
  });
});
