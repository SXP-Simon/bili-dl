import { GM_xmlhttpRequest, type GMXMLHttpRequestResponse, type GMXMLHttpRequestError } from '$';
import type {
  IExternalDownloader,
  ExternalDownloaderStatus,
  ExternalDownloadPayload,
} from './types';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error';

/**
 * Aria2 / Motrix JSON-RPC 外部下载器适配器 (支持 6800 / 16800 端口)
 */
export class Aria2RpcDownloader implements IExternalDownloader {
  public readonly id = 'aria2_rpc';
  public readonly name = 'Aria2 / Motrix RPC';
  public readonly shortName = 'Aria2';
  public readonly description = 'Aria2 / Motrix 远程 RPC 下载引擎';
  public readonly defaultPort = 6800;

  public async checkAvailability(options?: {
    timeoutMs?: number;
    port?: number;
  }): Promise<ExternalDownloaderStatus> {
    const port = options?.port || this.defaultPort;
    const timeout = options?.timeoutMs || 1500;
    const url = `http://127.0.0.1:${port}/jsonrpc`;

    const body = {
      jsonrpc: '2.0',
      id: 'ping',
      method: 'aria2.getVersion',
      params: [],
    };

    return new Promise<ExternalDownloaderStatus>((resolve) => {
      try {
        GM_xmlhttpRequest({
          method: 'POST',
          url,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(body),
          timeout,
          onload: (res: GMXMLHttpRequestResponse) => {
            if (res.status >= 200 && res.status < 400) {
              resolve({
                isAvailable: true,
                name: this.name,
                port,
                message: `Aria2 RPC 服务连接正常 (端口: ${port})`,
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
              message: `未检测到 Aria2 服务运行 (端口 ${port}${reason})`,
              lastChecked: Date.now(),
            });
          },
          ontimeout: () => {
            resolve({
              isAvailable: false,
              name: this.name,
              port,
              message: `Aria2 探测超时 (端口 ${port})`,
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

  public async sendDownload(
    payload: ExternalDownloadPayload,
    options?: { port?: number }
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    const port = options?.port || this.defaultPort;
    const url = `http://127.0.0.1:${port}/jsonrpc`;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0';

    let successCount = 0;
    for (const src of payload.sources) {
      const headerList = [
        'Referer: https://www.bilibili.com/',
        `User-Agent: ${userAgent}`,
      ];

      const rpcBody = {
        jsonrpc: '2.0',
        id: `bili_${Date.now()}`,
        method: 'aria2.addUri',
        params: [
          [src.url],
          {
            header: headerList,
            ...(src.filename ? { out: src.filename } : {}),
          },
        ],
      };

      try {
        await new Promise<void>((resolve, reject) => {
          GM_xmlhttpRequest({
            method: 'POST',
            url,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(rpcBody),
            timeout: 5000,
            onload: (res: GMXMLHttpRequestResponse) => {
              if (res.status >= 200 && res.status < 300) {
                successCount++;
                resolve();
              } else {
                reject(new Error(`HTTP ${res.status}`));
              }
            },
            onerror: (err: GMXMLHttpRequestError) => reject(new Error(err.error || 'Aria2 连接失败')),
            ontimeout: () => reject(new Error('Aria2 RPC 请求超时')),
          });
        });
      } catch (e) {
        logger.warn('Aria2RPC', `投递分轨失败: ${getErrorMessage(e)}`);
      }
    }

    if (successCount > 0) {
      return { success: true, message: `已成功投递 ${successCount}/${payload.sources.length} 个任务至 Aria2` };
    }
    return { success: false, message: '未能投递至 Aria2 RPC 客户端' };
  }
}

export const aria2RpcDownloader = new Aria2RpcDownloader();
