/**
 * Vitest mock for the virtual module '$' provided by vite-plugin-monkey
 */

type RequestHandler = (options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  responseType?: string;
  onload?: (res: { status: number; statusText: string; responseHeaders: string; response: unknown }) => void;
  onerror?: (err: { error: string }) => void;
}) => void;

let customRequestHandler: RequestHandler | null = null;

export const setMockRequestHandler = (handler: RequestHandler | null) => {
  customRequestHandler = handler;
};

export const GM_xmlhttpRequest = (options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  responseType?: string;
  onload?: (res: { status: number; statusText: string; responseHeaders: string; response: unknown }) => void;
  onerror?: (err: { error: string }) => void;
}) => {
  setTimeout(() => {
    if (customRequestHandler) {
      customRequestHandler(options);
    } else if (options.onerror) {
      options.onerror({ error: 'Mock network request not handled' });
    }
  }, 0);

  return {
    abort: () => {},
  };
};

import { vi } from 'vitest';

export const GM_download = vi.fn((_options: { url: string; name: string }) => {
  return {
    abort: () => {},
  };
});

const store = new Map<string, unknown>();

export const GM_setValue = (name: string, value: unknown): void => {
  store.set(name, value);
};

export const GM_getValue = <T>(name: string, defaultValue?: T): T => {
  if (store.has(name)) {
    return store.get(name) as T;
  }
  return defaultValue as T;
};

export const GM_setClipboard = vi.fn((_data: string, _info?: unknown): void => {});
