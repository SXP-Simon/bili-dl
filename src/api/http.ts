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
  onProgress?: RequestProgressCallback,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  if (signal?.aborted) {
    throw new DOMException('Download aborted by user', 'AbortError');
  }

  return new Promise((resolve, reject) => {
    let lastLoaded = 0;
    let lastTime = Date.now();
    let hasFinished = false;

    const req = GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': navigator.userAgent,
      },
      onprogress: (event: any) => {
        if (!hasFinished && onProgress && event.lengthComputable) {
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
        hasFinished = true;
        if (response.status >= 200 && response.status < 300) {
          resolve(response.response as ArrayBuffer);
        } else {
          reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
        }
      },
      onerror: (err: any) => {
        hasFinished = true;
        reject(new Error(err.error || 'Network error'));
      },
    });

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          if (!hasFinished) {
            hasFinished = true;
            try {
              (req as any)?.abort?.();
            } catch {}
            reject(new DOMException('Download aborted by user', 'AbortError'));
          }
        },
        { once: true }
      );
    }
  });
}

/**
 * 识别 B 站 CDN 节点提供商与主机名
 */
export function getCdnNodeLabel(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (host.includes('mirrorcos') || host.includes('upcdnbd')) return `腾讯云 COS (${host})`;
    if (host.includes('mirrorali')) return `阿里云 OSS (${host})`;
    if (host.includes('mirrorhw')) return `华为云 OBS (${host})`;
    if (host.includes('mirror08c') || host.includes('mirror08h')) return `金山云/BGP (${host})`;
    if (host.includes('upcdnws')) return `网宿 CDN (${host})`;
    if (host.includes('upcdntx')) return `腾讯直连 (${host})`;
    if (host.includes('akamai')) return `Akamai 海外 (${host})`;
    if (host.includes('fastly')) return `Fastly 海外 (${host})`;
    return host;
  } catch {
    return '未知节点';
  }
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
 * 全局并发连接数调度器（限制全页面最大同时活跃 Range 连接，防止多任务并发打爆 B 站单 IP 阈值）
 */
class GlobalConcurrencyLimiter {
  private maxConcurrent = 4; // B 站 CDN 单 IP 最优安全并发连接数
  private activeCount = 0;
  private queue: Array<() => void> = [];

  public async acquire(): Promise<() => void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.activeCount--;
          this.next();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.activeCount++;
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.activeCount--;
            this.next();
          }
        });
      });
    });
  }

  private next() {
    if (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const nextFn = this.queue.shift();
      nextFn?.();
    }
  }
}

const globalLimiter = new GlobalConcurrencyLimiter();

/**
 * 单分片下载 Promise（带全局并发控制、多 CDN 节点轮转、防雷鸣抖动重试与主动取消机制）
 */
async function fetchChunkWithRetry(
  urls: string[],
  start: number,
  end: number,
  onChunkProgress: (loaded: number) => void,
  retries = Math.max(3, urls.length),
  traceId?: string,
  streamLabel?: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  let lastError: any = null;
  const streamPrefix = streamLabel ? `[${streamLabel}] ` : '';

  const chunkSize = end - start + 1;

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    const targetUrl = urls[(attempt - 1) % urls.length];
    const currentNodeLabel = getCdnNodeLabel(targetUrl);

    // 申请全局并发配额槽位（排队保证不超出 IP 阈值）
    const release = await globalLimiter.acquire();

    if (signal?.aborted) {
      release();
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    try {
      const result = await new Promise<Uint8Array>((resolve, reject) => {
        let hasFinished = false;
        let lastActivityTime = Date.now();
        let stallCheckInterval: ReturnType<typeof setInterval> | null = null;

        // 计算自适应最大超时（以保底 30KB/s 速率计算，最少 90s，最多 300s）
        const dynamicTimeout = Math.min(300000, Math.max(90000, Math.ceil(chunkSize / (30 * 1024)) * 1000));

        const cleanup = () => {
          if (stallCheckInterval) {
            clearInterval(stallCheckInterval);
            stallCheckInterval = null;
          }
        };

        const req = GM_xmlhttpRequest({
          method: 'GET',
          url: targetUrl,
          responseType: 'arraybuffer',
          timeout: dynamicTimeout,
          headers: {
            'Referer': 'https://www.bilibili.com/',
            'User-Agent': navigator.userAgent,
            'Range': `bytes=${start}-${end}`,
          },
          onprogress: (event: any) => {
            if (!hasFinished) {
              lastActivityTime = Date.now();
              onChunkProgress(event.loaded || 0);
            }
          },
          onload: (response: any) => {
            if (hasFinished) return;
            hasFinished = true;
            cleanup();
            if (response.status >= 200 && response.status < 300) {
              const u8 = new Uint8Array(response.response as ArrayBuffer);
              onChunkProgress(u8.length);
              resolve(u8);
            } else {
              reject(new Error(`HTTP ${response.status} on chunk ${start}-${end}`));
            }
          },
          ontimeout: () => {
            if (hasFinished) return;
            hasFinished = true;
            cleanup();
            reject(new Error(`分片 ${start}-${end} 传输耗时超出保护阈值 (${(dynamicTimeout / 1000).toFixed(0)}s)`));
          },
          onerror: (err: any) => {
            if (hasFinished) return;
            hasFinished = true;
            cleanup();
            reject(new Error(err.error || `分片 ${start}-${end} 网络中断`));
          },
        });

        // 绑定外部取消中断信号
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              if (!hasFinished) {
                hasFinished = true;
                cleanup();
                try {
                  (req as any)?.abort?.();
                } catch {}
                reject(new DOMException('Download aborted by user', 'AbortError'));
              }
            },
            { once: true }
          );
        }

        // 动态数据传输停滞看门狗：每 2 秒检测一次。
        // 只要持续有数据流动 (onprogress 触发) 绝不会误杀；仅当超过 20 秒完全没有任何新数据到达时，才判定为网络假死/断流并进行重试
        stallCheckInterval = setInterval(() => {
          if (hasFinished) {
            cleanup();
            return;
          }
          const idleTime = Date.now() - lastActivityTime;
          if (idleTime >= 20000) {
            hasFinished = true;
            cleanup();
            try {
              (req as any)?.abort?.();
            } catch {}
            reject(new Error(`分片 ${start}-${end} 数据传输停滞卡死 (20s 无新数据响应)`));
          }
        }, 2000);
      });

      release();
      return result;
    } catch (err: any) {
      release();
      if (signal?.aborted || (err as any)?.name === 'AbortError') {
        throw new DOMException('Download aborted by user', 'AbortError');
      }
      lastError = err;
      const nextTargetUrl = urls[attempt % urls.length];
      const nextNodeLabel = getCdnNodeLabel(nextTargetUrl);
      logger.warn(
        'Range',
        `${streamPrefix}分片 [${start}-${end}] 在节点【${currentNodeLabel}】第 ${attempt}/${retries} 次尝试失败，正在无缝切换至备用节点【${nextNodeLabel}】: ${err.message}`,
        null,
        traceId
      );
      if (attempt < retries) {
        // 加入 300ms~800ms 随机退避抖动，防止重试群体风暴 (Thundering Herd)
        const jitter = Math.floor(Math.random() * 500) + 300;
        await new Promise((r) => setTimeout(r, jitter * attempt));
      }
    }
  }

  throw lastError || new Error(`Chunk ${start}-${end} download failed after ${retries} attempts`);
}

/**
 * 分块多连接高速并发下载器（支持 3~4 线程 Range 并发，多 CDN 自动故障转移与主动 Abort 取消）
 */
export async function requestChunkedBuffer(
  urls: string | string[],
  onProgress?: RequestProgressCallback,
  concurrency = 3,
  traceId?: string,
  streamLabel?: string,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const urlList = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  if (urlList.length === 0) throw new Error('No valid URL provided');
  if (signal?.aborted) {
    throw new DOMException('Download aborted by user', 'AbortError');
  }

  const streamPrefix = streamLabel ? `[${streamLabel}] ` : '';

  // 1. 探测资源总大小
  const totalBytes = await probeContentLength(urlList);

  if (signal?.aborted) {
    throw new DOMException('Download aborted by user', 'AbortError');
  }

  // 如果未能探测到大小或文件较小（< 3MB），使用标准单流下载
  if (!totalBytes || totalBytes < 3 * 1024 * 1024) {
    logger.info('Network', `${streamPrefix}文件较小或不支持 Range 探测，使用标准流下载`, { totalBytes }, traceId);
    return requestBuffer(urlList[0], onProgress, signal);
  }

  // 2. 切分分片（按 3~4 个并发连接均分，避免单 IP 过载被 B 站 CDN 丢包）
  const chunkCount = Math.min(concurrency, Math.max(2, Math.ceil(totalBytes / (8 * 1024 * 1024))));
  const chunkSize = Math.ceil(totalBytes / chunkCount);
  const chunks: Array<{ start: number; end: number; index: number }> = [];

  const cdnLabels = urlList.map(getCdnNodeLabel).join(', ');
  logger.info(
    'Range',
    `${streamPrefix}启动多分片并发加速: ${(totalBytes / 1024 / 1024).toFixed(1)} MB (${chunkCount} 线程并发，高可用节点池已就绪: [${cdnLabels}])`,
    null,
    traceId
  );

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
        const u8 = await fetchChunkWithRetry(
          urlList,
          chunk.start,
          chunk.end,
          (loaded) => {
            loadedPerChunk[chunk.index] = loaded;
            lastDataTime = Date.now();
          },
          Math.max(3, urlList.length),
          traceId,
          streamLabel,
          signal
        );
        finalBuffer.set(u8, chunk.start);
        loadedPerChunk[chunk.index] = u8.length;
        lastDataTime = Date.now();
      })
    );

    clearInterval(timer);
    if (onProgress) {
      onProgress(totalBytes, totalBytes, '');
    }
    logger.success('Range', `${streamPrefix}分片数据传输完毕: ${(totalBytes / 1024 / 1024).toFixed(1)} MB 全部就绪`, null, traceId);
    return finalBuffer.buffer as ArrayBuffer;
  } catch (err: any) {
    clearInterval(timer);
    if (signal?.aborted || (err as any)?.name === 'AbortError') {
      logger.warn('Range', `${streamPrefix}分片下载已主动取消并释放连接`, null, traceId);
      throw new DOMException('Download aborted by user', 'AbortError');
    }
    logger.error('Range', `${streamPrefix}多连接分片下载失败: ${err.message}`, err, traceId);
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

