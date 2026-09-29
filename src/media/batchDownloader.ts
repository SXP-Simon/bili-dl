/**
 * 多分 P 批量音视频自动化下载与流媒体混流调度器
 */

import { fetchCurrentMediaData, getVideoTitle } from '../api/bilibili';
import { downloadAudio, downloadAndMuxMp4 } from './downloader';
import { logger } from '../utils/logger';
import type { VideoPageItem, DownloadTask } from '../types';

/**
 * 批量下载全集最低质量音频轨 (极速提取音频/省流播客)
 */
export async function batchDownloadAllLowestAudios(
  bvid: string,
  pages: VideoPageItem[],
  onTaskAdd: (task: DownloadTask) => void,
  onTaskUpdate: (id: string, partial: Partial<DownloadTask>) => void,
  traceId = '全集最低音质',
  signal?: AbortSignal
): Promise<void> {
  const mainTitle = getVideoTitle();
  const total = pages.length;
  logger.info('BatchDownload', `开始批量下载全集最低质量音频: 共 ${total} 集`, { bvid }, traceId);

  for (const page of pages) {
    if (signal?.aborted) break;

    const pageTitle = pages.length > 1
      ? `${mainTitle}_P${page.page}_${page.part ? page.part.replace(/[\\/:*?"<>|]/g, '_').trim() : `第${page.page}集`}`
      : mainTitle;
    const taskId = `batch_audio_${bvid}_${page.cid}`;
    const taskTitle = `P${page.page}: ${page.part || `第${page.page}集`} (最低音质)`;

    try {
      const mediaData = await fetchCurrentMediaData(page.cid);
      if (!mediaData || mediaData.audios.length === 0) {
        logger.warn('BatchDownload', `[P${page.page}] 未获取到可用音频轨，跳过`, null, traceId);
        continue;
      }

      // 选取带宽最低的音频轨 (64K 基础音质)
      const lowestAudio = [...mediaData.audios].sort((a, b) => a.bandwidth - b.bandwidth)[0] || mediaData.audios[mediaData.audios.length - 1];

      onTaskAdd({
        id: taskId,
        type: 'audio',
        title: taskTitle,
        status: 'downloading_audio',
        progress: 0,
        message: `准备下载 P${page.page} 音频 (${lowestAudio.name})...`,
        timestamp: Date.now(),
      });

      await downloadAudio(
        pageTitle,
        lowestAudio,
        (prog) => {
          onTaskUpdate(taskId, {
            status: prog.status,
            progress: prog.progress,
            speed: prog.speed,
            message: prog.message,
          });
        },
        `P${page.page}-最低音频`,
        signal
      );
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        onTaskUpdate(taskId, { status: 'cancelled', message: '已取消下载' });
        break;
      } else {
        onTaskUpdate(taskId, { status: 'error', message: `下载失败: ${err.message}` });
      }
    }
  }
}

/**
 * 批量下载全集最高质量视频 (双轨并发并无损封装为含音频的 MP4)
 */
export async function batchDownloadAllHighestVideos(
  bvid: string,
  pages: VideoPageItem[],
  onTaskAdd: (task: DownloadTask) => void,
  onTaskUpdate: (id: string, partial: Partial<DownloadTask>) => void,
  traceId = '全集最高画质',
  signal?: AbortSignal
): Promise<void> {
  const mainTitle = getVideoTitle();
  const total = pages.length;
  logger.info('BatchDownload', `开始批量下载全集最高质量视频 (含音频封装): 共 ${total} 集`, { bvid }, traceId);

  for (const page of pages) {
    if (signal?.aborted) break;

    const pageTitle = pages.length > 1
      ? `${mainTitle}_P${page.page}_${page.part ? page.part.replace(/[\\/:*?"<>|]/g, '_').trim() : `第${page.page}集`}`
      : mainTitle;
    const taskId = `batch_video_${bvid}_${page.cid}`;

    try {
      const mediaData = await fetchCurrentMediaData(page.cid);
      if (!mediaData || mediaData.videos.length === 0) {
        logger.warn('BatchDownload', `[P${page.page}] 未获取到可用视频流，跳过`, null, traceId);
        continue;
      }

      // 选取最高清晰度视频流与高保真音频流
      const highestVideo = mediaData.videos[0];
      const bestAudio = mediaData.audios[0];
      const taskTitle = `P${page.page}: ${page.part || `第${page.page}集`} (${highestVideo.qualityName})`;

      onTaskAdd({
        id: taskId,
        type: 'video',
        title: taskTitle,
        status: 'downloading_video',
        progress: 0,
        message: `准备下载并合成 P${page.page} (${highestVideo.qualityName})...`,
        timestamp: Date.now(),
      });

      await downloadAndMuxMp4(
        pageTitle,
        highestVideo,
        bestAudio,
        (prog) => {
          onTaskUpdate(taskId, {
            status: prog.status,
            progress: prog.progress,
            speed: prog.speed,
            message: prog.message,
          });
        },
        `P${page.page}-${highestVideo.codecName}`,
        signal
      );
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') {
        onTaskUpdate(taskId, { status: 'cancelled', message: '已取消下载' });
        break;
      } else {
        onTaskUpdate(taskId, { status: 'error', message: `下载失败: ${err.message}` });
      }
    }
  }
}
