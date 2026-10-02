/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '$' {
  export interface GMXMLHttpRequestProgress {
    lengthComputable: boolean;
    loaded: number;
    total: number;
  }

  export interface GMXMLHttpRequestResponse {
    status: number;
    statusText: string;
    responseHeaders: string;
    response: unknown;
    responseText?: string;
  }

  export interface GMXMLHttpRequestError {
    error?: string;
    status?: number;
    statusText?: string;
  }

  export interface GMXMLHttpRequestOptions {
    method: 'GET' | 'POST' | 'HEAD' | string;
    url: string;
    headers?: Record<string, string>;
    timeout?: number;
    data?: string | FormData | Blob | ArrayBufferView;
    responseType?: 'text' | 'arraybuffer' | 'blob' | 'json' | 'document';
    onprogress?: (event: GMXMLHttpRequestProgress) => void;
    onload?: (response: GMXMLHttpRequestResponse) => void;
    onerror?: (error: GMXMLHttpRequestError) => void;
    ontimeout?: () => void;
  }

  export interface GMDownloadOptions {
    url: string;
    name: string;
    saveAs?: boolean;
    headers?: Record<string, string>;
    timeout?: number;
    onload?: () => void;
    onerror?: (error: { error: string; details?: unknown }) => void;
    onprogress?: (progress: { loaded: number; totalPosition: number; total: number }) => void;
    ontimeout?: () => void;
  }

  export interface GMXMLHttpRequestHandle {
    abort: () => void;
  }

  export function GM_xmlhttpRequest(options: GMXMLHttpRequestOptions): GMXMLHttpRequestHandle;
  export function GM_download(options: GMDownloadOptions): { abort: () => void };
  export function GM_setValue(name: string, value: unknown): void;
  export function GM_getValue<T>(name: string, defaultValue?: T): T;
  export function GM_setClipboard(data: string, info?: string | { type?: string; minetype?: string }): void;
}
