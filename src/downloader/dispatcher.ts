/**
 * 外部下载任务调度分发器与流媒体源装配器 (抽象解耦样板代码)
 */

import type { IExternalDownloader, ExternalDownloadSource, ExternalDownloadPayload, DownloaderRuntimeOptions } from './types';
import type { VideoStreamItem, AudioStreamItem, DownloadTask } from '../types';
import { getPrioritizedCdnUrls } from '../utils/cdn';
import { getDownloadSettings, type DownloadSettings } from '../utils/settings';

export interface BuildMediaSourcesParams {
  video?: VideoStreamItem | null;
  audio?: AudioStreamItem | null;
  title: string;
  settings?: DownloadSettings;
  downloadPage?: string;
}

/**
 * 统一根据 CDN 优先级体系装配媒体流的 ExternalDownloadSource 数组
 */
export function buildMediaDownloadSources(params: BuildMediaSourcesParams): ExternalDownloadSource[] {
  const { video, audio, title, settings, downloadPage } = params;
  const currentSettings = settings || getDownloadSettings();
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
  const sources: ExternalDownloadSource[] = [];

  const pageUrl = downloadPage || (typeof location !== 'undefined' ? location.href : 'https://www.bilibili.com/');
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0';
  const cookie = typeof document !== 'undefined' && document.cookie ? document.cookie : '';
  const baseHeaders: Record<string, string> = {
    'Referer': 'https://www.bilibili.com/',
    'Origin': 'https://www.bilibili.com',
    'User-Agent': userAgent,
    ...(cookie ? { 'Cookie': cookie } : {}),
  };

  if (video) {
    const videoUrls = getPrioritizedCdnUrls(video.baseUrl, video.backupUrl, currentSettings);
    sources.push({
      url: videoUrls[0] || video.baseUrl,
      urls: videoUrls,
      filename: `${safeTitle}_${video.qualityName}_${video.codecName}.m4s`,
      type: 'video',
      qualityDesc: video.qualityName,
      downloadPage: pageUrl,
      headers: { ...baseHeaders },
    });
  }

  if (audio) {
    const audioUrls = getPrioritizedCdnUrls(audio.baseUrl, audio.backupUrl, currentSettings);
    const ext = video ? 'm4s' : 'm4a';
    sources.push({
      url: audioUrls[0] || audio.baseUrl,
      urls: audioUrls,
      filename: `${safeTitle}_${audio.name}.${ext}`,
      type: 'audio',
      qualityDesc: audio.name || audio.qualityDesc,
      downloadPage: pageUrl,
      headers: { ...baseHeaders },
    });
  }

  return sources;
}

export interface DispatchTaskParams {
  downloader: IExternalDownloader;
  payload: ExternalDownloadPayload;
  options?: DownloaderRuntimeOptions;
  taskId: string;
  onTaskUpdate: (id: string, partial: Partial<DownloadTask>) => void;
  taskType?: 'video' | 'audio';
  delayMs?: number;
}

/**
 * 统一执行外部下载器任务投递、生命周期进度上报与异常捕获
 */
export async function dispatchExternalDownloadTask(params: DispatchTaskParams): Promise<boolean> {
  const {
    downloader,
    payload,
    options,
    taskId,
    onTaskUpdate,
    taskType = 'video',
    delayMs = 150,
  } = params;

  onTaskUpdate(taskId, {
    status: taskType === 'video' ? 'downloading_video' : 'downloading_audio',
    progress: 50,
    message: `正在推送到 ${downloader.name}...`,
  });

  const res = await downloader.sendDownload(payload, options);

  if (res.success) {
    onTaskUpdate(taskId, {
      status: 'completed',
      progress: 100,
      message: `已推送到 ${downloader.name}`,
    });
  } else {
    onTaskUpdate(taskId, {
      status: 'error',
      message: `推送到 ${downloader.name} 失败: ${res.message}`,
    });
  }

  if (delayMs > 0) {
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return res.success;
}

export interface ExternalBatchEntry {
  taskId: string;
  sources: ExternalDownloadSource[];
  title?: string;
  taskType?: 'video' | 'audio' | 'batch_video' | 'batch_audio';
}

/**
 * 累积全量剧集/分 P 媒体流后，向外部下载器发送单次合并投递请求
 * 解决每集触发独立弹窗导致桌面端频繁弹出新建窗口的糟糕体验
 */
export async function dispatchConsolidatedExternalBatch(params: {
  downloader: IExternalDownloader;
  batchTitle: string;
  entries: ExternalBatchEntry[];
  options?: DownloaderRuntimeOptions;
  downloadPage?: string;
  bvid?: string;
  onTaskUpdate: (id: string, partial: Partial<DownloadTask>) => void;
}): Promise<boolean> {
  const { downloader, batchTitle, entries, options, downloadPage, bvid, onTaskUpdate } = params;
  if (entries.length === 0) return true;

  const allSources = entries.flatMap((e) => e.sources);
  if (allSources.length === 0) return true;

  for (const entry of entries) {
    const status = entry.taskType === 'audio' || entry.taskType === 'batch_audio'
      ? 'downloading_audio'
      : 'downloading_video';
    onTaskUpdate(entry.taskId, {
      status,
      progress: 80,
      message: `正在合并投递至 ${downloader.name}...`,
    });
  }

  const res = await downloader.sendDownload(
    {
      title: batchTitle,
      sources: allSources,
      downloadPage: downloadPage || (typeof location !== 'undefined' ? location.href : undefined),
      bvid,
    },
    options
  );

  for (const entry of entries) {
    if (res.success) {
      onTaskUpdate(entry.taskId, {
        status: 'completed',
        progress: 100,
        message: `已批量推送到 ${downloader.name}`,
      });
    } else {
      onTaskUpdate(entry.taskId, {
        status: 'error',
        message: `推送失败: ${res.message}`,
      });
    }
  }

  return res.success;
}

