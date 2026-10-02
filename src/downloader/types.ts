import type { DownloadSettings } from '../utils/settings';

export interface DownloaderRuntimeOptions {
  port?: number;
  secret?: string;
  [key: string]: unknown;
}

export interface ExternalDownloadSource {
  url: string;
  urls?: string[]; // 排序后的多镜像备选源列表 (Aria2 等支持多源分流下载)
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
  readonly shortName?: string;
  readonly description: string;
  readonly defaultPort: number;

  /**
   * 从用户配置中解析该下载器的运行时配置（端口、密钥等）
   */
  resolveConfig?(settings: DownloadSettings): DownloaderRuntimeOptions;

  /**
   * 探测该外部下载器是否可用 (客户端是否在本地运行、监听端口是否通畅)
   */
  checkAvailability(options?: DownloaderRuntimeOptions & { timeoutMs?: number }): Promise<ExternalDownloaderStatus>;

  /**
   * 发送持久化下载任务至外部下载器
   */
  sendDownload(
    payload: ExternalDownloadPayload,
    options?: DownloaderRuntimeOptions
  ): Promise<{ success: boolean; message: string; details?: unknown }>;
}
