import type { IExternalDownloader } from './types';
import { abDownloadManager } from './abdm';
import { aria2RpcDownloader } from './aria2Rpc';

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
}

export const externalDownloaderRegistry = new ExternalDownloaderRegistry();
