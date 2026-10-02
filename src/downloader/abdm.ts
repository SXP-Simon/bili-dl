import { GM_xmlhttpRequest, type GMXMLHttpRequestResponse, type GMXMLHttpRequestError } from '$';
import type {
  IExternalDownloader,
  ExternalDownloaderStatus,
  ExternalDownloadPayload,
  DownloaderRuntimeOptions,
} from './types';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error';
import { getBilibiliCookieHeader } from '../utils/cookie';

/**
 * AB Download Manager (ABDM) 外部桌面下载器适配器
 * 基于本地 REST API 端口（默认 15151）实现与客户端/浏览器插件同源的持久化下载任务投递
 * 避免浏览器 Tab 切换/后台挂起导致的下载失败
 */
export class ABDownloadManager implements IExternalDownloader {
  public readonly id = 'abdm';
  public readonly name = 'AB Download Manager';
  public readonly shortName = 'ABDM';
  public readonly description = '现代化开源多线程下载管理器 (支持持久化离线后台下载)';
  public readonly defaultPort = 15151;

  public resolveConfig(settings: import('../utils/settings').DownloadSettings): DownloaderRuntimeOptions {
    const customPort = settings.downloadersConfig?.['abdm']?.port ?? settings.abdmPort;
    return {
      port: customPort || this.defaultPort,
    };
  }

  /**
   * 探测 ABDM 客户端是否在运行 (健康检查)
   */
  public async checkAvailability(options?: {
    timeoutMs?: number;
    port?: number;
  }): Promise<ExternalDownloaderStatus> {
    const port = options?.port || this.defaultPort;
    const timeout = options?.timeoutMs || 1500;
    const url = `http://127.0.0.1:${port}/queues`;

    return new Promise<ExternalDownloaderStatus>((resolve) => {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          timeout,
          onload: (res: GMXMLHttpRequestResponse) => {
            if (res.status >= 200 && res.status < 400) {
              resolve({
                isAvailable: true,
                name: this.name,
                port,
                message: `AB Download Manager 客户端已连接 (端口: ${port})`,
                lastChecked: Date.now(),
              });
            } else {
              resolve({
                isAvailable: false,
                name: this.name,
                port,
                message: `端口 ${port} 响应异常 (HTTP ${res.status})`,
                lastChecked: Date.now(),
              });
            }
          },
          onerror: (err?: GMXMLHttpRequestError) => {
            const reason = err?.error ? `: ${err.error}` : '';
            resolve({
              isAvailable: false,
              name: this.name,
              port,
              message: `未检测到客户端运行 (端口 ${port} 连接被拒${reason})`,
              lastChecked: Date.now(),
            });
          },
          ontimeout: () => {
            resolve({
              isAvailable: false,
              name: this.name,
              port,
              message: `探测超时 (端口 ${port} 无响应)`,
              lastChecked: Date.now(),
            });
          },
        });
      } catch (e) {
        resolve({
          isAvailable: false,
          name: this.name,
          port,
          message: `探测失败: ${getErrorMessage(e)}`,
          lastChecked: Date.now(),
        });
      }
    });
  }

  /**
   * 将音视频等媒体流发送至 ABDM 客户端
   * 采用 /start-headless-download 原生直达队列接口：
   * 1. 规避 /add 交互弹窗导致 headers 丢失 (引发 B 站 CDN 403 Forbidden) 的已知问题 (ABDM #649)
   * 2. 规避 /add 重新探测链接覆盖 suggestedName (ABDM #905)，确保保留用户视频标题与清晰度命名
   */
  public async sendDownload(
    payload: ExternalDownloadPayload,
    options?: { port?: number; dir?: string }
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    const port = options?.port || this.defaultPort;
    const headlessUrl = `http://127.0.0.1:${port}/start-headless-download`;
    const defaultPage = payload.downloadPage || (typeof location !== 'undefined' ? location.href : 'https://www.bilibili.com/');
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    const cookie = await getBilibiliCookieHeader();
    const standardReferer = 'https://www.bilibili.com/';

    const sources = payload.sources || [];
    if (sources.length === 0) {
      return { success: false, message: '没有有效的媒体下载链接可投递' };
    }

    logger.info(
      'ABDM',
      `正在向 AB Download Manager (127.0.0.1:${port}) 推送下载任务: ${payload.title} (共 ${sources.length} 个流)`
    );

    const postSingleSource = (src: import('./types').ExternalDownloadSource) => {
      const headers: Record<string, string> = {
        'Referer': standardReferer,
        'Origin': 'https://www.bilibili.com',
        'User-Agent': userAgent,
        ...(cookie ? { 'Cookie': cookie } : {}),
        ...src.headers,
      };

      const body = {
        downloadSource: {
          link: src.url,
          headers,
          downloadPage: src.downloadPage || defaultPage,
        },
        name: src.filename,
        folder: options?.dir || undefined,
        queueId: 0,
      };

      return new Promise<{ status: number; text: string }>((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: headlessUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          data: JSON.stringify(body),
          timeout: 8000,
          onload: (res: GMXMLHttpRequestResponse) => {
            if (res.status >= 200 && res.status < 300) {
              resolve({ status: res.status, text: res.responseText || '' });
            } else {
              reject(new Error(`HTTP ${res.status}: ${res.statusText || res.responseText || 'ABDM 拒绝接收'}`));
            }
          },
          onerror: (err: GMXMLHttpRequestError) => {
            reject(new Error(err?.error || `无法连接到 127.0.0.1:${port}`));
          },
          ontimeout: () => {
            reject(new Error(`端口 ${port} 请求超时`));
          },
        });
      });
    };

    try {
      await Promise.all(sources.map((s) => postSingleSource(s)));
      logger.success(
        'ABDM',
        `已成功投递至 AB Download Manager: ${payload.title} (共 ${sources.length} 个流任务直接进入队列)`
      );
      return {
        success: true,
        message: `成功推送到 AB Download Manager (共 ${sources.length} 个流任务)`,
      };
    } catch (err) {
      const msg = `投递失败: ${getErrorMessage(err)}`;
      logger.warn('ABDM', msg);
      return { success: false, message: msg };
    }
  }
}

export const abDownloadManager = new ABDownloadManager();
