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

  // 1. 预先向全局任务队列注册所有分 P 任务（全部置为 pending 排队中，防止悬浮球频繁跳闪“全部完成”）
  for (const page of pages) {
    const taskId = `batch_audio_${bvid}_${page.cid}`;
    const taskTitle = `P${page.page}: ${page.part || `第${page.page}集`} (最低音质)`;
    onTaskAdd({
      id: taskId,
      type: 'audio',
      title: taskTitle,
      status: 'pending',
      progress: 0,
      message: '排队等待下载...',
      timestamp: Date.now(),
    });
  }

  // 2. 依次调度执行各分 P 的解析与下载
  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const taskId = `batch_audio_${bvid}_${page.cid}`;

    if (signal?.aborted) {
      // 若用户中止，将后续未开始的排队任务批量标记为取消
      for (let j = idx; j < pages.length; j++) {
        onTaskUpdate(`batch_audio_${bvid}_${pages[j].cid}`, {
          status: 'cancelled',
          message: '已取消下载',
        });
      }
      break;
    }

    const pageTitle = pages.length > 1
      ? `${mainTitle}_P${page.page}_${page.part ? page.part.replace(/[\\/:*?"<>|]/g, '_').trim() : `第${page.page}集`}`
      : mainTitle;

    try {
      onTaskUpdate(taskId, {
        status: 'downloading_audio',
        progress: 0,
        message: `正在解析 P${page.page} 音频流...`,
      });

      const mediaData = await fetchCurrentMediaData(page.cid);
      if (!mediaData || mediaData.audios.length === 0) {
        logger.warn('BatchDownload', `[P${page.page}] 未获取到可用音频轨，跳过`, null, traceId);
        onTaskUpdate(taskId, {
          status: 'error',
          message: '未获取到可用音频流',
        });
        continue;
      }

      // 选取带宽最低的音频轨 (64K 基础音质)
      const lowestAudio = [...mediaData.audios].sort((a, b) => a.bandwidth - b.bandwidth)[0] || mediaData.audios[mediaData.audios.length - 1];

      onTaskUpdate(taskId, {
        status: 'downloading_audio',
        progress: 0,
        message: `准备下载 P${page.page} 音频 (${lowestAudio.name})...`,
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
        // 标记后续任务为取消
        for (let j = idx + 1; j < pages.length; j++) {
          onTaskUpdate(`batch_audio_${bvid}_${pages[j].cid}`, {
            status: 'cancelled',
            message: '已取消下载',
          });
        }
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

  // 1. 预先向全局任务队列注册所有分 P 任务（全部置为 pending 排队中）
  for (const page of pages) {
    const taskId = `batch_video_${bvid}_${page.cid}`;
    const taskTitle = `P${page.page}: ${page.part || `第${page.page}集`} (最高画质)`;
    onTaskAdd({
      id: taskId,
      type: 'video',
      title: taskTitle,
      status: 'pending',
      progress: 0,
      message: '排队等待合成...',
      timestamp: Date.now(),
    });
  }

  // 2. 依次调度执行各分 P 的视频/音频双轨下载与无损混流
  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const taskId = `batch_video_${bvid}_${page.cid}`;

    if (signal?.aborted) {
      for (let j = idx; j < pages.length; j++) {
        onTaskUpdate(`batch_video_${bvid}_${pages[j].cid}`, {
          status: 'cancelled',
          message: '已取消下载',
        });
      }
      break;
    }

    const pageTitle = pages.length > 1
      ? `${mainTitle}_P${page.page}_${page.part ? page.part.replace(/[\\/:*?"<>|]/g, '_').trim() : `第${page.page}集`}`
      : mainTitle;

    try {
      onTaskUpdate(taskId, {
        status: 'downloading_video',
        progress: 0,
        message: `正在解析 P${page.page} 视频/音频流...`,
      });

      const mediaData = await fetchCurrentMediaData(page.cid);
      if (!mediaData || mediaData.videos.length === 0) {
        logger.warn('BatchDownload', `[P${page.page}] 未获取到可用视频流，跳过`, null, traceId);
        onTaskUpdate(taskId, {
          status: 'error',
          message: '未获取到可用视频流',
        });
        continue;
      }

      // 选取最高清晰度视频流与高保真音频流
      const highestVideo = mediaData.videos[0];
      const bestAudio = mediaData.audios[0];
      const taskTitle = `P${page.page}: ${page.part || `第${page.page}集`} (${highestVideo.qualityName})`;

      onTaskUpdate(taskId, {
        title: taskTitle,
        status: 'downloading_video',
        progress: 0,
        message: `准备下载并合成 P${page.page} (${highestVideo.qualityName})...`,
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
        for (let j = idx + 1; j < pages.length; j++) {
          onTaskUpdate(`batch_video_${bvid}_${pages[j].cid}`, {
            status: 'cancelled',
            message: '已取消下载',
          });
        }
        break;
      } else {
        onTaskUpdate(taskId, { status: 'error', message: `下载失败: ${err.message}` });
      }
    }
  }
}
