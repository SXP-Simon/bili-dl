import { GM_xmlhttpRequest } from '$';

export interface RequestProgressCallback {
  (loaded: number, total: number, speed?: string): void;
}

/**
 * 统一网络请求模块，自动注入 B 站防盗链 Referer 头
 */
export async function requestBuffer(
  url: string,
  onProgress?: RequestProgressCallback
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    let lastLoaded = 0;
    let lastTime = Date.now();

    GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': navigator.userAgent,
      },
      onprogress: (event: any) => {
        if (onProgress && event.lengthComputable) {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          let speedStr = '';
          if (timeDiff >= 0.5) {
            const bytesDiff = event.loaded - lastLoaded;
            const speedKB = (bytesDiff / 1024 / timeDiff).toFixed(1);
            speedStr = `${speedKB} KB/s`;
            lastLoaded = event.loaded;
            lastTime = now;
          }
          onProgress(event.loaded, event.total, speedStr);
        }
      },
      onload: (response: any) => {
        if (response.status >= 200 && response.status < 300) {
          resolve(response.response as ArrayBuffer);
        } else {
          reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
        }
      },
      onerror: (err: any) => {
        reject(new Error(err.error || 'Network error'));
      },
    });
  });
}

/**
 * 获取 JSON 接口数据
 */
export async function requestJson<T = any>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'json',
      headers: {
        'Referer': 'https://www.bilibili.com/',
      },
      onload: (res: any) => {
        if (res.status >= 200 && res.status < 300) {
          const data = typeof res.response === 'string' ? JSON.parse(res.response) : res.response;
          resolve(data as T);
        } else {
          reject(new Error(`HTTP ${res.status}: ${res.statusText}`));
        }
      },
      onerror: (err: any) => reject(new Error(err.error || 'Request JSON error')),
    });
  });
}
