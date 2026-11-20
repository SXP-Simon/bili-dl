// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GM_xmlhttpRequest, type GMXMLHttpRequestOptions } from '$';
import { gmFetch, fetchModelResource } from '../../src/ai/whisperFetch';
vi.mock('$', () => ({ GM_xmlhttpRequest: vi.fn() }));
const body = new Uint8Array([0, 97, 115, 109]).buffer;
function respond(options: GMXMLHttpRequestOptions, status = 200, responseHeaders = '') {
  options.onload?.({ status, statusText: '', responseHeaders, response: body });
}
beforeEach(() => vi.resetAllMocks());
describe('Whisper resource downloads', () => {
  it('preserves LF headers, request options and corrects actual WASM MIME', async () => {
    vi.mocked(GM_xmlhttpRequest).mockImplementation((options) => {
      respond(options, 200, 'content-type:application/octet-stream\ncontent-length:4');
      return { abort: vi.fn() };
    });
    const response = await gmFetch(new Request('https://cdn.jsdelivr.net/test.wasm', { headers: { 'X-Test': 'yes' } }));
    expect(response.headers.get('content-type')).toBe('application/wasm');
    expect(response.headers.get('content-length')).toBe('4');
    expect(await response.arrayBuffer()).toEqual(body);
    expect(vi.mocked(GM_xmlhttpRequest).mock.calls[0][0].headers).toEqual({ 'x-test': 'yes' });
  });
  it.each([204, 205, 304])('handles null-body HTTP %s without leaving a pending promise', async (status) => {
    vi.mocked(GM_xmlhttpRequest).mockImplementation((options) => { respond(options, status); return { abort: vi.fn() }; });
    expect((await gmFetch('https://hf-mirror.com/test')).body).toBeNull();
  });
  it('rejects invalid responses instead of throwing out of an async callback', async () => {
    vi.mocked(GM_xmlhttpRequest).mockImplementation((options) => { respond(options, 0); return { abort: vi.fn() }; });
    await expect(gmFetch('https://hf-mirror.com/test')).rejects.toThrow();
  });
  it('cancels the underlying request and never retries an abort', async () => {
    const abort = vi.fn(); const controller = new AbortController();
    vi.mocked(GM_xmlhttpRequest).mockReturnValue({ abort });
    const nativeFetch = vi.fn();
    const pending = fetchModelResource('https://hf-mirror.com/test', { signal: controller.signal }, nativeFetch);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort(); await rejected;
    expect(abort).toHaveBeenCalledOnce(); expect(nativeFetch).not.toHaveBeenCalled();
    expect(GM_xmlhttpRequest).toHaveBeenCalledOnce();
  });
  it('retries transient mirror errors at the official host', async () => {
    vi.mocked(GM_xmlhttpRequest).mockImplementation((options) => {
      respond(options, options.url.includes('hf-mirror.com') ? 503 : 200); return { abort: vi.fn() };
    });
    const response = await fetchModelResource('https://hf-mirror.com/onnx-community/whisper-tiny/resolve/main/config.json', undefined, vi.fn());
    expect(response.ok).toBe(true);
    expect(vi.mocked(GM_xmlhttpRequest).mock.calls.map(([options]) => new URL(options.url).hostname))
      .toEqual(['hf-mirror.com', 'huggingface.co']);
  });
  it('recovers when GM and native download both fail for the mirror', async () => {
    vi.mocked(GM_xmlhttpRequest).mockImplementation((options) => {
      if (options.url.includes('hf-mirror.com')) options.onerror?.({ error: 'blocked' });
      else respond(options);
      return { abort: vi.fn() };
    });
    const nativeFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect((await fetchModelResource('https://hf-mirror.com/model/config.json', undefined, nativeFetch)).ok).toBe(true);
    expect(nativeFetch).toHaveBeenCalledOnce();
  });
  it('preserves optional 404 responses for the model loader', async () => {
    vi.mocked(GM_xmlhttpRequest).mockImplementation((options) => { respond(options, 404); return { abort: vi.fn() }; });
    expect((await fetchModelResource('https://hf-mirror.com/model/optional.json', undefined, vi.fn())).status).toBe(404);
    expect(GM_xmlhttpRequest).toHaveBeenCalledOnce();
  });
  it('bounds a stalled native fallback before trying the alternate mirror', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(GM_xmlhttpRequest).mockImplementation((options) => {
        if (options.url.includes('hf-mirror.com')) options.onerror?.({ error: 'blocked' });
        else respond(options);
        return { abort: vi.fn() };
      });
      const nativeFetch = vi.fn((_resource: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')));
      }));
      const result = fetchModelResource('https://hf-mirror.com/model/config.json', undefined, nativeFetch);
      await vi.advanceTimersByTimeAsync(30001);
      expect((await result).ok).toBe(true);
      expect(nativeFetch).toHaveBeenCalledOnce();
    } finally { vi.useRealTimers(); }
  });

});
