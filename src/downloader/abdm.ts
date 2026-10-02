import { GM_xmlhttpRequest, type GMXMLHttpRequestResponse, type GMXMLHttpRequestError } from '$';
import type {
  IExternalDownloader,
  ExternalDownloaderStatus,
  ExternalDownloadPayload,
  DownloaderRuntimeOptions,
} from './types';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error';

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
   * 将音视频等媒体流发送至 ABDM 客户端 /add 接口
   */
  public async sendDownload(
    payload: ExternalDownloadPayload,
    options?: { port?: number }
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    const port = options?.port || this.defaultPort;
    const targetUrl = `http://127.0.0.1:${port}/add`;
    const defaultPage = payload.downloadPage || (typeof location !== 'undefined' ? location.href : 'https://www.bilibili.com/');
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0';

    // 格式化符合 ABDM REST-API.yml 的请求体 (数组形式)
    const requestBody = payload.sources.map((src) => ({
      link: src.url,
      headers: {
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': userAgent,
        ...src.headers,
      },
      downloadPage: src.downloadPage || defaultPage,
    }));

    if (requestBody.length === 0) {
      return { success: false, message: '没有有效的媒体下载链接可投递' };
    }

    logger.info(
      'ABDM',
      `正在向 AB Download Manager (127.0.0.1:${port}) 推送下载任务: ${payload.title} (共 ${requestBody.length} 个流)`
    );

    return new Promise((resolve) => {
      try {
        GM_xmlhttpRequest({
          method: 'POST',
          url: targetUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          data: JSON.stringify(requestBody),
          timeout: 5000,
          onload: (res: GMXMLHttpRequestResponse) => {
            if (res.status >= 200 && res.status < 300) {
              logger.success(
                'ABDM',
                `已成功投递至 AB Download Manager: ${payload.title} (共 ${requestBody.length} 个流任务进入桌面队列)`
              );
              resolve({
                success: true,
                message: `成功推送到 AB Download Manager (共 ${requestBody.length} 个流任务)`,
                details: res.responseText,
              });
            } else {
              const errMsg = `ABDM 服务端拒绝 (HTTP ${res.status}): ${res.statusText || res.responseText || '未知错误'}`;
              logger.warn('ABDM', errMsg);
              resolve({ success: false, message: errMsg });
            }
          },
          onerror: (err: GMXMLHttpRequestError) => {
            const msg = `网络请求失败: ${err.error || '无法连接到 127.0.0.1:' + port}`;
            logger.warn('ABDM', msg);
            resolve({ success: false, message: msg });
          },
          ontimeout: () => {
            const msg = `推送超时: AB Download Manager (127.0.0.1:${port}) 未在 5s 内确认`;
            logger.warn('ABDM', msg);
            resolve({ success: false, message: msg });
          },
        });
      } catch (err) {
        const msg = `投递异常: ${getErrorMessage(err)}`;
        logger.error('ABDM', msg);
        resolve({ success: false, message: msg });
      }
    });
  }
}

export const abDownloadManager = new ABDownloadManager();
