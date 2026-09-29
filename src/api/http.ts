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
          if (timeDiff >= 0.4) {
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
 * 探测媒体资源总字节大小（通过轻量 Range 探测）
 */
async function probeContentLength(url: string): Promise<number> {
  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': navigator.userAgent,
        'Range': 'bytes=0-0',
      },
      onload: (res: any) => {
        const headers = res.responseHeaders || '';
        const contentRange = headers.match(/content-range:\s*bytes\s+\d+-\d+\/(\d+)/i);
        if (contentRange && contentRange[1]) {
          const total = parseInt(contentRange[1], 10);
          if (total > 0) {
            resolve(total);
            return;
          }
        }
        const len = headers.match(/content-length:\s*(\d+)/i);
        if (len && len[1]) {
          const total = parseInt(len[1], 10);
          if (total > 0) {
            resolve(total);
            return;
          }
        }
        resolve(0);
      },
      onerror: () => resolve(0),
    });
  });
}

/**
 * 单分片下载 Promise
 */
function fetchChunk(
  url: string,
  start: number,
  end: number,
  onChunkProgress: (loaded: number) => void
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': navigator.userAgent,
        'Range': `bytes=${start}-${end}`,
      },
      onprogress: (event: any) => {
        onChunkProgress(event.loaded || 0);
      },
      onload: (response: any) => {
        if (response.status >= 200 && response.status < 300) {
          const u8 = new Uint8Array(response.response as ArrayBuffer);
          onChunkProgress(u8.length);
          resolve(u8);
        } else {
          reject(new Error(`Chunk ${start}-${end} failed: HTTP ${response.status}`));
        }
      },
      onerror: (err: any) => {
        reject(new Error(err.error || `Chunk ${start}-${end} network error`));
      },
    });
  });
}

/**
 * 分块多连接高速并发下载器（支持 4~6 线程 Range 并发，突破 CDN 单连接限速）
 */
export async function requestChunkedBuffer(
  url: string,
  onProgress?: RequestProgressCallback,
  concurrency = 5
): Promise<ArrayBuffer> {
  // 1. 探测资源总大小
  const totalBytes = await probeContentLength(url);

  // 如果未能探测到大小或文件较小（< 3MB），使用标准单流下载
  if (!totalBytes || totalBytes < 3 * 1024 * 1024) {
    return requestBuffer(url, onProgress);
  }

  // 2. 切分分片（按 4~6 个并发连接均分）
  const chunkCount = Math.min(concurrency, Math.max(2, Math.ceil(totalBytes / (6 * 1024 * 1024))));
  const chunkSize = Math.ceil(totalBytes / chunkCount);
  const chunks: Array<{ start: number; end: number; index: number }> = [];

  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(totalBytes - 1, (i + 1) * chunkSize - 1);
    chunks.push({ start, end, index: i });
  }

  const loadedPerChunk = Array.from({ length: chunkCount }, () => 0);
  const finalBuffer = new Uint8Array(totalBytes);

  let lastLoaded = 0;
  let lastTime = Date.now();

  const updateProgress = () => {
    if (!onProgress) return;
    const currentLoaded = loadedPerChunk.reduce((acc, curr) => acc + curr, 0);
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000;
    let speedStr = '';
    if (timeDiff >= 0.4) {
      const bytesDiff = currentLoaded - lastLoaded;
      const speedMB = (bytesDiff / 1024 / 1024 / timeDiff).toFixed(1);
      if (parseFloat(speedMB) >= 1) {
        speedStr = `${speedMB} MB/s`;
      } else {
        const speedKB = (bytesDiff / 1024 / timeDiff).toFixed(0);
        speedStr = `${speedKB} KB/s`;
      }
      lastLoaded = currentLoaded;
      lastTime = now;
    }
    onProgress(currentLoaded, totalBytes, speedStr);
  };

  // 3. 并发执行各分片下载
  await Promise.all(
    chunks.map(async (chunk) => {
      const u8 = await fetchChunk(url, chunk.start, chunk.end, (loaded) => {
        loadedPerChunk[chunk.index] = loaded;
        updateProgress();
      });
      finalBuffer.set(u8, chunk.start);
      loadedPerChunk[chunk.index] = u8.length;
      updateProgress();
    })
  );

  return finalBuffer.buffer as ArrayBuffer;
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

