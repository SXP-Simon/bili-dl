/**
 * 外部独立持久化下载器接口与类型定义 (开闭原则 OCP 设计)
 */

export interface ExternalDownloadSource {
  url: string;
  filename?: string;
  headers?: Record<string, string>;
  downloadPage?: string;
  type?: 'video' | 'audio' | 'subtitle' | 'generic';
  qualityDesc?: string;
}

export interface ExternalDownloadPayload {
  title: string;
  sources: ExternalDownloadSource[];
  downloadPage?: string;
  bvid?: string;
  cid?: number;
}

export interface ExternalDownloaderStatus {
  isAvailable: boolean;
  name: string;
  version?: string;
  message: string;
  port?: number;
  lastChecked: number;
}

export interface IExternalDownloader {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultPort: number;

  /**
   * 探测该外部下载器是否可用 (客户端是否在本地运行、监听端口是否通畅)
   */
  checkAvailability(options?: { timeoutMs?: number; port?: number }): Promise<ExternalDownloaderStatus>;

  /**
   * 发送持久化下载任务至外部下载器
   */
  sendDownload(
    payload: ExternalDownloadPayload,
    options?: { port?: number }
  ): Promise<{ success: boolean; message: string; details?: unknown }>;
}
