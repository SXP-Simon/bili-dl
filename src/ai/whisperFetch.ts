import { GM_xmlhttpRequest } from '$';
import { isAbortError } from '../utils/error';

/** Fetch public model assets through the userscript manager, preserving Fetch semantics. */
export function gmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method || request?.method || 'GET';
  const signal = init?.signal ?? request?.signal;
  if (signal?.aborted) return Promise.reject(new DOMException('Resource download aborted', 'AbortError'));
  const headers: Record<string, string> = {};
  new Headers(init?.headers || request?.headers).forEach((value, key) => { headers[key] = value; });
  return new Promise((resolve, reject) => {
    let finished = false;
    let handle: { abort: () => void } | undefined;
    const cleanup = () => { signal?.removeEventListener('abort', abort); };
    const fail = (error: unknown) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
    };
    const abort = () => {
      fail(new DOMException('Resource download aborted', 'AbortError'));
      handle?.abort();
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      handle = GM_xmlhttpRequest({
        method: method as 'GET' | 'HEAD', url, headers, responseType: 'arraybuffer', timeout: 120000,
        onload: (response) => {
          if (finished) return;
          try {
            const responseHeaders = new Headers();
            for (const line of (response.responseHeaders || '').split(/\r?\n/)) {
              const colon = line.indexOf(':');
              if (colon > 0) responseHeaders.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
            }
            const body = response.response as ArrayBuffer;
            // GM managers/CDNs can omit or misreport MIME. Only mark actual WASM
            // bytes as application/wasm, so streaming compilation works correctly.
            if (new URL(url).pathname.endsWith('.wasm') && body?.byteLength >= 4 &&
                new Uint8Array(body, 0, 4).every((byte, index) => byte === [0, 97, 115, 109][index])) {
              responseHeaders.set('Content-Type', 'application/wasm');
            }
            const result = new Response(method === 'HEAD' || [204, 205, 304].includes(response.status) ? null : body, {
              status: response.status, statusText: response.statusText, headers: responseHeaders,
            });
            Object.defineProperty(result, 'url', { value: response.finalUrl || url });
            finished = true;
            cleanup();
            resolve(result);
          } catch (error) { fail(error); }
        },
        onerror: () => fail(new Error(`资源下载失败: ${url}`)),
        ontimeout: () => fail(new Error(`资源下载超时: ${url}`)),
        onabort: () => fail(new DOMException('Resource download aborted', 'AbortError')),
      });
      if (signal?.aborted && !finished) abort();
    } catch (error) { fail(error); }
  });
}

/** Retry transient public Hub failures against its mirror, without persisting failed responses. */
export async function fetchModelResource(
  input: RequestInfo | URL, init: RequestInit | undefined, nativeFetch: typeof fetch
): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
  const method = init?.method || request?.method || 'GET';
  const hosts = ['huggingface.co', 'hf-mirror.com'];
  const alternate = hosts.includes(url.hostname) && ['GET', 'HEAD'].includes(method.toUpperCase()) &&
    !new Headers(init?.headers || request?.headers).has('authorization');
  const urls = [url.href];
  if (alternate) {
    const other = new URL(url);
    other.hostname = hosts.find((host) => host !== url.hostname)!;
    urls.push(other.href);
  }
  let lastError: unknown;
  for (const [index, target] of urls.entries()) {
    const resource = request ? new Request(target, request) : target;
    try {
      let response: Response;
      try { response = await gmFetch(resource, init); }
      catch (error) {
        if (isAbortError(error)) throw error;
        const controller = new AbortController();
        const signal = init?.signal ?? request?.signal;
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(abort, 30000);
        try {
          response = await nativeFetch(resource, { ...init, signal: controller.signal });
        } catch (nativeError) {
          if (controller.signal.aborted && !signal?.aborted) throw new Error(`资源下载超时: ${target}`);
          throw nativeError;
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
        }
      }
      if (index < urls.length - 1 && (response.status >= 500 || [403, 408, 429].includes(response.status))) {
        lastError = new Error(`资源下载失败: HTTP ${response.status} ${target}`);
        continue;
      }
      return response;
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
