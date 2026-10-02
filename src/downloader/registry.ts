import type { IExternalDownloader, DownloaderRuntimeOptions } from './types';
import { abDownloadManager } from './abdm';
import { aria2RpcDownloader } from './aria2Rpc';
import { getDownloadSettings, type DownloadSettings } from '../utils/settings';

/**
 * 外部下载器统一注册中心 (遵循开放封闭原则 OCP，易于平滑扩展 IDM、Motrix、FDM 等)
 */
export class ExternalDownloaderRegistry {
  private downloaders = new Map<string, IExternalDownloader>();

  constructor() {
    // 默认内置注册 AB Download Manager 与 Aria2 RPC
    this.register(abDownloadManager);
    this.register(aria2RpcDownloader);
  }

  /**
   * 注册新的外部下载器适配器
   */
  public register(downloader: IExternalDownloader): void {
    this.downloaders.set(downloader.id, downloader);
  }

  /**
   * 按 ID 获取下载器适配器
   */
  public get(id: string): IExternalDownloader | undefined {
    return this.downloaders.get(id);
  }

  /**
   * 获取所有已注册的外部下载器
   */
  public getAll(): IExternalDownloader[] {
    return Array.from(this.downloaders.values());
  }

  /**
   * 获取默认下载器 (AB Download Manager)
   */
  public getDefault(): IExternalDownloader {
    return abDownloadManager;
  }

  /**
   * 按 ID 获取下载器，若未找到则回退至默认下载器
   */
  public getActive(id?: string): IExternalDownloader {
    if (id) {
      const found = this.get(id);
      if (found) return found;
    }
    return this.getDefault();
  }

  /**
   * 解析任意指定下载器的配置端口
   */
  public getDownloaderPort(
    downloaderOrId: IExternalDownloader | string,
    settings?: DownloadSettings
  ): number {
    const s = settings || getDownloadSettings();
    const downloader = typeof downloaderOrId === 'string' ? this.getActive(downloaderOrId) : downloaderOrId;
    const cfg = downloader.resolveConfig ? downloader.resolveConfig(s) : { port: downloader.defaultPort };
    return cfg.port || downloader.defaultPort;
  }

  /**
   * 统一获取当前生效的下载器上下文与运行时状态 (解耦消费端对下载器 ID、端口等内部属性的硬编码)
   */
  public getActiveContext(settings?: DownloadSettings): {
    downloader: IExternalDownloader;
    config: DownloaderRuntimeOptions;
    port: number;
    isExternal: boolean;
  } {
    const resolvedSettings = settings || getDownloadSettings();
    const downloader = this.getActive(resolvedSettings.externalDownloaderId);
    const config = downloader.resolveConfig
      ? downloader.resolveConfig(resolvedSettings)
      : { port: downloader.defaultPort };
    const port = config.port || downloader.defaultPort;
    const isExternal =
      resolvedSettings.defaultDownloaderEngine === 'external' ||
      resolvedSettings.externalDownloaderEnabled === true;

    return {
      downloader,
      config,
      port,
      isExternal,
    };
  }
}

export const externalDownloaderRegistry = new ExternalDownloaderRegistry();
