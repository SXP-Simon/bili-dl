import { GM_download } from '$';
import { requestChunkedBuffer } from '../api/http';
import { muxMp4 } from './muxer';
import type { VideoStreamItem, AudioStreamItem, DownloadProgress } from '../types';

/**
 * 触发本地文件保存
 */
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * 直接下载文件（支持 GM_download 防盗链快速静默下载）
 */
export function directDownload(url: string, filename: string): void {
  if (typeof GM_download !== 'undefined') {
    GM_download({
      url,
      name: filename,
      saveAs: false,
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
  onProgress: (state: DownloadProgress) => void
): Promise<void> {
  try {
    let videoLoaded = 0;
    let videoTotal = 1;
    let audioLoaded = 0;
    let audioTotal = 0;
    let currentSpeed = '';

    const updateCombinedProgress = () => {
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

    // 1. 双轨多连接并行拉取（Zero-Wait Parallelism）
    const videoPromise = requestChunkedBuffer(video.baseUrl, (loaded, total, speed) => {
      videoLoaded = loaded;
      videoTotal = total;
      if (speed) currentSpeed = speed;
      updateCombinedProgress();
    });

    const audioPromise = audio
      ? requestChunkedBuffer(audio.baseUrl, (loaded, total, speed) => {
          audioLoaded = loaded;
          audioTotal = total;
          if (speed) currentSpeed = speed;
          updateCombinedProgress();
        })
      : Promise.resolve(null);

    const [videoBuffer, audioBuffer] = await Promise.all([videoPromise, audioPromise]);

    // 2. 前端 mp4box 快速混流合成
    onProgress({
      status: 'muxing',
      progress: 92,
      message: '正在封装无损 MP4 容器 (Remuxing)',
    });

    let finalBlob: Blob;
    if (audioBuffer) {
      finalBlob = await muxMp4(videoBuffer, audioBuffer, (muxPct) => {
        onProgress({
          status: 'muxing',
          progress: 90 + Math.floor(muxPct * 0.09),
          message: `正在封装 MP4 容器: ${Math.floor(muxPct)}%`,
        });
      });
    } else {
      finalBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    }

    // 3. 保存文件
    const filename = `${title}_${video.qualityName}_${video.codecName}.mp4`;
    saveBlobAsFile(finalBlob, filename);

    onProgress({
      status: 'completed',
      progress: 100,
      message: '下载与混流完成，已保存到本地',
    });
  } catch (err: any) {
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
  onProgress: (state: DownloadProgress) => void
): Promise<void> {
  try {
    const isFlac = audio.codec?.toLowerCase().includes('flac') || audio.qualityDesc?.includes('FLAC');
    const ext = isFlac ? 'flac' : 'm4a';
    const mimeType = isFlac ? 'audio/flac' : 'audio/mp4';
    const filename = `${title}_${audio.name}.${ext}`;

    onProgress({
      status: 'downloading_audio',
      progress: 0,
      message: `正在建立多连接下载: ${audio.name}`,
    });

    const audioBuffer = await requestChunkedBuffer(audio.baseUrl, (loaded, total, speed) => {
      const pct = Math.min(99, Math.floor((loaded / total) * 100));
      onProgress({
        status: 'downloading_audio',
        progress: pct,
        speed,
        message: `多连接下载音频 (${audio.name}): ${pct}% ${speed ? `(${speed})` : ''}`,
      });
    });

    const blob = new Blob([audioBuffer], { type: mimeType });
    saveBlobAsFile(blob, filename);

    onProgress({
      status: 'completed',
      progress: 100,
      message: `音频下载完成，已保存为 .${ext} 文件`,
    });
  } catch (err: any) {
    onProgress({
      status: 'error',
      progress: 0,
      message: `音频下载失败: ${err.message}`,
    });
    throw err;
  }
}


