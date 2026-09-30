import { GM_download } from '$';
import { requestChunkedBuffer } from '../api/http';
import { muxMp4 } from './muxer';
import { logger } from '../utils/logger';
import {
  getDownloadSettings,
  getOrRestoreDirectoryHandle,
  resolveDownloadRelativePath,
} from '../utils/settings';
import type { VideoStreamItem, AudioStreamItem, DownloadProgress } from '../types';

function fallbackAnchorDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * 触发本地文件保存 (支持 File System Access API 本地磁盘直连、GM_download 自定义子目录与另存为对话框)
 */
export async function saveBlobAsFile(blob: Blob, filename: string, videoTitle?: string): Promise<void> {
  const settings = getDownloadSettings();
  const dirHandle = await getOrRestoreDirectoryHandle(true);

  // 1. 如果用户启用了 File System Access API 本地磁盘直连，直接写入目标本地目录
  if (settings.useLocalDirHandle && dirHandle) {
    try {
      let targetDir = dirHandle;
      const sub = settings.subfolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
      if (sub) {
        for (const segment of sub.split(/[/\\]+/)) {
          if (segment) {
            targetDir = await targetDir.getDirectoryHandle(segment, { create: true });
          }
        }
      }
      if (settings.autoTitleFolder && videoTitle) {
        const cleanTitle = videoTitle.split('_P')[0].replace(/[\\/:*?"<>|]/g, '_').trim();
        if (cleanTitle) {
          targetDir = await targetDir.getDirectoryHandle(cleanTitle, { create: true });
        }
      }

      const fileHandle = await targetDir.getFileHandle(filename, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(blob);
      await writable.close();
      logger.info('Downloader', `文件已直接写入本地磁盘: ${dirHandle.name}/${filename}`);
      return;
    } catch (fsErr: any) {
      logger.warn('Downloader', '本地目录直接写入失败，降级到下载器保存', { error: fsErr?.message });
    }
  }

  // 2. 使用 GM_download（支持传递子目录路径与 saveAs 另存为对话框）
  const relativePath = resolveDownloadRelativePath(filename, videoTitle);
  const blobUrl = URL.createObjectURL(blob);

  if (typeof GM_download !== 'undefined') {
    try {
      GM_download({
        url: blobUrl,
        name: relativePath,
        saveAs: settings.alwaysAskSaveAs,
        headers: {
          'Referer': 'https://www.bilibili.com/',
        },
        onload: () => {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        },
        onerror: () => {
          fallbackAnchorDownload(blobUrl, filename);
        },
      });
      return;
    } catch {}
  }

  // 3. 原生 <a> 标签兜底下载
  fallbackAnchorDownload(blobUrl, filename);
}

/**
 * 直接下载文件（支持 GM_download 防盗链快速静默下载与自定义子路径）
 */
export function directDownload(url: string, filename: string, videoTitle?: string): void {
  const settings = getDownloadSettings();
  const relativePath = resolveDownloadRelativePath(filename, videoTitle);

  if (typeof GM_download !== 'undefined') {
    GM_download({
      url,
      name: relativePath,
      saveAs: settings.alwaysAskSaveAs,
      headers: {
        'Referer': 'https://www.bilibili.com/',
      },
      onerror: () => window.open(url, '_blank'),
    });
  } else {
    window.open(url, '_blank');
  }
}

/**
 * 全流程下载视频 + 音频（双轨多连接并发加速），并在前端纯 JS 自动无损混流为 MP4 保存
 */
export async function downloadAndMuxMp4(
  title: string,
  video: VideoStreamItem,
  audio: AudioStreamItem | undefined,
  onProgress: (state: DownloadProgress) => void,
  traceId?: string,
  signal?: AbortSignal
): Promise<void> {
  const finalTraceId = traceId || `${video.qualityName.replace(/\s+/g, '')}-${video.codecName}`;
  const startTime = Date.now();
  logger.info(
    'Downloader',
    `开始下载任务: ${title}`,
    {
      video: `${video.qualityName} (${video.codecName})`,
      audio: audio?.name || '无',
      estimatedSize: `${video.sizeMB} MB`,
    },
    finalTraceId
  );

  try {
    let videoLoaded = 0;
    let videoTotal = 1;
    let audioLoaded = 0;
    let audioTotal = 0;
    let currentSpeed = '';

    const updateCombinedProgress = () => {
      if (signal?.aborted) return;
      const totalLoaded = videoLoaded + audioLoaded;
      const totalBytes = videoTotal + (audioTotal || 0);
      const pct = Math.min(90, Math.floor((totalLoaded / totalBytes) * 90));
      onProgress({
        status: 'downloading_video',
        progress: pct,
        speed: currentSpeed,
        message: `高速下载中: ${pct}% ${currentSpeed ? `(${currentSpeed})` : ''}`,
      });
    };

    onProgress({
      status: 'downloading_video',
      progress: 0,
      message: `正在建立多连接下载: ${video.qualityName} (${video.codecName})`,
    });

    // 1. 双轨多连接并行拉取（带备用 CDN 故障转移与 AbortSignal）
    const videoUrls = [video.baseUrl, ...(video.backupUrl || [])].filter(Boolean);
    const videoPromise = requestChunkedBuffer(
      videoUrls,
      (loaded, total, speed) => {
        videoLoaded = loaded;
        videoTotal = total;
        if (speed !== undefined) currentSpeed = speed;
        updateCombinedProgress();
      },
      3,
      finalTraceId,
      '视频轨',
      signal
    );

    const audioUrls = audio ? [audio.baseUrl, ...(audio.backupUrl || [])].filter(Boolean) : [];
    const audioPromise = audioUrls.length > 0
      ? requestChunkedBuffer(
          audioUrls,
          (loaded, total, speed) => {
            audioLoaded = loaded;
            audioTotal = total;
            if (speed !== undefined) currentSpeed = speed;
            updateCombinedProgress();
          },
          2,
          finalTraceId,
          '音频轨',
          signal
        )
      : Promise.resolve(null);

    const [videoBuffer, audioBuffer] = await Promise.all([videoPromise, audioPromise]);

    if (signal?.aborted) {
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    const downloadTime = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.success('Downloader', `双轨媒体流拉取完毕，耗时 ${downloadTime}s，进入 MP4 混流封装`, null, finalTraceId);

    // 2. 前端 mp4box 快速混流合成
    onProgress({
      status: 'muxing',
      progress: 92,
      message: '正在封装无损 MP4 容器 (Remuxing)',
    });

    let finalBlob: Blob;
    if (audioBuffer) {
      finalBlob = await muxMp4(
        videoBuffer,
        audioBuffer,
        (muxPct) => {
          if (signal?.aborted) return;
          onProgress({
            status: 'muxing',
            progress: 90 + Math.floor(muxPct * 0.09),
            message: `正在封装 MP4 容器: ${Math.floor(muxPct)}%`,
          });
        },
        finalTraceId
      );
    } else {
      finalBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    }

    if (signal?.aborted) {
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    // 3. 保存文件
    const filename = `${title}_${video.qualityName}_${video.codecName}.mp4`;
    saveBlobAsFile(finalBlob, filename);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.success('Downloader', `文件保存成功: ${filename} (总耗时 ${totalTime}s)`, null, finalTraceId);

    onProgress({
      status: 'completed',
      progress: 100,
      message: '下载与混流完成，已保存到本地',
    });
  } catch (err: any) {
    if (signal?.aborted || err?.name === 'AbortError') {
      logger.warn('Downloader', `下载任务已由用户手动取消: ${title}`, null, finalTraceId);
      onProgress({
        status: 'cancelled',
        progress: 0,
        message: '下载任务已手动取消',
      });
      return;
    }
    logger.error('Downloader', `下载失败: ${err.message}`, err, finalTraceId);
    onProgress({
      status: 'error',
      progress: 0,
      message: `下载失败: ${err.message}`,
    });
    throw err;
  }
}

/**
 * 全流程下载独立音频轨（分块多连接并发加速），支持格式自动适配 (.m4a / .flac)
 */
export async function downloadAudio(
  title: string,
  audio: AudioStreamItem,
  onProgress: (state: DownloadProgress) => void,
  traceId?: string,
  signal?: AbortSignal
): Promise<void> {
  const finalTraceId = traceId || `音频-${audio.name.replace(/\s+/g, '')}`;
  const startTime = Date.now();
  const isFlac = audio.codec?.toLowerCase().includes('flac') || audio.qualityDesc?.includes('FLAC');
  const ext = isFlac ? 'flac' : 'm4a';
  const mimeType = isFlac ? 'audio/flac' : 'audio/mp4';
  const filename = `${title}_${audio.name}.${ext}`;
  const audioUrls = [audio.baseUrl, ...(audio.backupUrl || [])].filter(Boolean);

  logger.info('Downloader', `开始下载音频轨: ${filename}`, null, finalTraceId);

  try {
    onProgress({
      status: 'downloading_audio',
      progress: 0,
      message: `正在建立多连接下载: ${audio.name}`,
    });

    const audioBuffer = await requestChunkedBuffer(
      audioUrls,
      (loaded, total, speed) => {
        if (signal?.aborted) return;
        const pct = Math.min(99, Math.floor((loaded / total) * 100));
        onProgress({
          status: 'downloading_audio',
          progress: pct,
          speed,
          message: `多连接下载音频 (${audio.name}): ${pct}% ${speed ? `(${speed})` : ''}`,
        });
      },
      2,
      finalTraceId,
      '独立音频轨',
      signal
    );

    if (signal?.aborted) {
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    const blob = new Blob([audioBuffer], { type: mimeType });
    saveBlobAsFile(blob, filename);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.success('Downloader', `音频保存成功: ${filename} (耗时 ${totalTime}s)`, null, finalTraceId);

    onProgress({
      status: 'completed',
      progress: 100,
      message: `音频下载完成，已保存为 .${ext} 文件`,
    });
  } catch (err: any) {
    if (signal?.aborted || err?.name === 'AbortError') {
      logger.warn('Downloader', `音频任务已由用户手动取消: ${filename}`, null, finalTraceId);
      onProgress({
        status: 'cancelled',
        progress: 0,
        message: '音频任务已手动取消',
      });
      return;
    }
    logger.error('Downloader', `音频下载失败: ${err.message}`, err, finalTraceId);
    onProgress({
      status: 'error',
      progress: 0,
      message: `音频下载失败: ${err.message}`,
    });
    throw err;
  }
}


