import { GM_xmlhttpRequest } from '$';
import { logger } from '../utils/logger';

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
 * 探测媒体资源总字节大小（通过轻量 Range 探测，支持多 CDN 备用节点）
 */
async function probeContentLength(urls: string[]): Promise<number> {
  for (const url of urls) {
    const size = await new Promise<number>((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 8000,
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
            if (total > 0) return resolve(total);
          }
          const len = headers.match(/content-length:\s*(\d+)/i);
          if (len && len[1]) {
            const total = parseInt(len[1], 10);
            if (total > 0) return resolve(total);
          }
          resolve(0);
        },
        onerror: () => resolve(0),
        ontimeout: () => resolve(0),
      });
    });
    if (size > 0) return size;
  }
  return 0;
}

/**
 * 单分片下载 Promise（带多 CDN 节点轮转与自动重试机制）
 */
async function fetchChunkWithRetry(
  urls: string[],
  start: number,
  end: number,
  onChunkProgress: (loaded: number) => void,
  retries = 3
): Promise<Uint8Array> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const targetUrl = urls[(attempt - 1) % urls.length];
    try {
      const result = await new Promise<Uint8Array>((resolve, reject) => {
        let hasFinished = false;

        const req = GM_xmlhttpRequest({
          method: 'GET',
          url: targetUrl,
          responseType: 'arraybuffer',
          timeout: 15000,
          headers: {
            'Referer': 'https://www.bilibili.com/',
            'User-Agent': navigator.userAgent,
            'Range': `bytes=${start}-${end}`,
          },
          onprogress: (event: any) => {
            if (!hasFinished) {
              onChunkProgress(event.loaded || 0);
            }
          },
          onload: (response: any) => {
            hasFinished = true;
            if (response.status >= 200 && response.status < 300) {
              const u8 = new Uint8Array(response.response as ArrayBuffer);
              onChunkProgress(u8.length);
              resolve(u8);
            } else {
              reject(new Error(`HTTP ${response.status} on chunk ${start}-${end}`));
            }
          },
          ontimeout: () => {
            hasFinished = true;
            reject(new Error(`Chunk ${start}-${end} timeout (15s)`));
          },
          onerror: (err: any) => {
            hasFinished = true;
            reject(new Error(err.error || `Chunk ${start}-${end} network error`));
          },
        });

        // 兜底看门狗
        setTimeout(() => {
          if (!hasFinished) {
            try {
              (req as any)?.abort?.();
            } catch {}
            reject(new Error(`Chunk ${start}-${end} watchdog timeout`));
          }
        }, 18000);
      });

      return result;
    } catch (err: any) {
      lastError = err;
      logger.warn('Range', `分片 [${start}-${end}] 第 ${attempt}/${retries} 次尝试失败，正在切换备用节点: ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }

  throw lastError || new Error(`Chunk ${start}-${end} download failed after ${retries} attempts`);
}

/**
 * 分块多连接高速并发下载器（支持 3~4 线程 Range 并发，多 CDN 自动故障转移）
 */
export async function requestChunkedBuffer(
  urls: string | string[],
  onProgress?: RequestProgressCallback,
  concurrency = 3
): Promise<ArrayBuffer> {
  const urlList = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (urlList.length === 0) throw new Error('No valid URL provided');

  // 1. 探测资源总大小
  const totalBytes = await probeContentLength(urlList);

  // 如果未能探测到大小或文件较小（< 3MB），使用标准单流下载
  if (!totalBytes || totalBytes < 3 * 1024 * 1024) {
    logger.info('Network', '文件较小或不支持 Range 探测，使用标准流下载', { totalBytes });
    return requestBuffer(urlList[0], onProgress);
  }

  // 2. 切分分片（按 3~4 个并发连接均分，避免单 IP 过载被 B 站 CDN 丢包）
  const chunkCount = Math.min(concurrency, Math.max(2, Math.ceil(totalBytes / (8 * 1024 * 1024))));
  const chunkSize = Math.ceil(totalBytes / chunkCount);
  const chunks: Array<{ start: number; end: number; index: number }> = [];

  logger.info('Range', `启动多分片并发加速: ${(totalBytes / 1024 / 1024).toFixed(1)} MB (${chunkCount} 线程并发，${urlList.length} 个 CDN 节点备用)`);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(totalBytes - 1, (i + 1) * chunkSize - 1);
    chunks.push({ start, end, index: i });
  }

  const loadedPerChunk = Array.from({ length: chunkCount }, () => 0);
  const finalBuffer = new Uint8Array(totalBytes);

  let lastLoaded = 0;
  let lastTime = Date.now();
  let lastDataTime = Date.now();
  let smoothedSpeed = 0;

  // 主动定时心跳刷新（确保网络卡顿/无数据时网速归零，拒绝假死死锁）
  const timer = setInterval(() => {
    if (!onProgress) return;
    const currentLoaded = loadedPerChunk.reduce((acc, curr) => acc + curr, 0);
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000;

    if (timeDiff >= 0.3) {
      const bytesDiff = Math.max(0, currentLoaded - lastLoaded);
      const instantSpeed = bytesDiff / timeDiff;

      if (bytesDiff > 0) {
        lastDataTime = now;
      }

      // 指数移动平均 (EMA) 平滑网速
      smoothedSpeed = smoothedSpeed === 0 ? instantSpeed : 0.65 * smoothedSpeed + 0.35 * instantSpeed;

      let speedStr = '';
      const idleTime = now - lastDataTime;

      if (idleTime > 3000) {
        speedStr = '0 KB/s';
        smoothedSpeed = 0;
      } else if (smoothedSpeed > 1024 * 1024) {
        speedStr = `${(smoothedSpeed / 1024 / 1024).toFixed(1)} MB/s`;
      } else if (smoothedSpeed > 0) {
        speedStr = `${(smoothedSpeed / 1024).toFixed(0)} KB/s`;
      }

      onProgress(currentLoaded, totalBytes, speedStr);
      lastLoaded = currentLoaded;
      lastTime = now;
    }
  }, 300);

  try {
    // 3. 并发执行各分片下载
    await Promise.all(
      chunks.map(async (chunk) => {
        const u8 = await fetchChunkWithRetry(urlList, chunk.start, chunk.end, (loaded) => {
          loadedPerChunk[chunk.index] = loaded;
          lastDataTime = Date.now();
        });
        finalBuffer.set(u8, chunk.start);
        loadedPerChunk[chunk.index] = u8.length;
        lastDataTime = Date.now();
      })
    );

    clearInterval(timer);
    if (onProgress) {
      onProgress(totalBytes, totalBytes, '');
    }
    logger.success('Range', `分片数据传输完毕: ${(totalBytes / 1024 / 1024).toFixed(1)} MB 全部就绪`);
    return finalBuffer.buffer as ArrayBuffer;
  } catch (err: any) {
    clearInterval(timer);
    logger.error('Range', `多连接分片下载失败: ${err.message}`, err);
    throw err;
  }
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

