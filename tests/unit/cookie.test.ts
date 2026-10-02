import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBilibiliCookieHeader } from '../../src/utils/cookie';

describe('Cookie Utility Unit Tests', () => {
  const originalDocumentCookie = document.cookie;

  beforeEach(() => {
    // Reset global GM_cookie
    delete (globalThis as unknown as { GM_cookie?: unknown }).GM_cookie;
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    delete (globalThis as unknown as { GM_cookie?: unknown }).GM_cookie;
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: originalDocumentCookie,
    });
  });

  it('should use GM_cookie.list when available to retrieve cookies including SESSDATA', async () => {
    (globalThis as unknown as { GM_cookie: unknown }).GM_cookie = {
      list: vi.fn((_details, callback) => {
        callback([
          { name: 'SESSDATA', value: 'secret_sessdata_token' },
          { name: 'bili_jct', value: 'csrf_token_123' },
        ]);
      }),
    };

    const cookieHeader = await getBilibiliCookieHeader();
    expect(cookieHeader).toBe('SESSDATA=secret_sessdata_token; bili_jct=csrf_token_123');
  });

  it('should fallback to document.cookie when GM_cookie is undefined', async () => {
    document.cookie = 'buvid3=mock_buvid_3';
    const cookieHeader = await getBilibiliCookieHeader();
    expect(cookieHeader).toBe('buvid3=mock_buvid_3');
  });

  it('should fallback to document.cookie when GM_cookie returns error or empty list', async () => {
    document.cookie = 'fallback_cookie=true';
    (globalThis as unknown as { GM_cookie: unknown }).GM_cookie = {
      list: vi.fn((_details, callback) => {
        callback([], 'Permission denied');
      }),
    };

    const cookieHeader = await getBilibiliCookieHeader();
    expect(cookieHeader).toBe('fallback_cookie=true');
  });
});
