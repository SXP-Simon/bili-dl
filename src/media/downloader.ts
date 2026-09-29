import { GM_download } from '$';
import { requestBuffer } from '../api/http';
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
 * 全流程下载视频 + 音频，并在前端纯 JS 自动无损混流为 MP4 保存
 */
export async function downloadAndMuxMp4(
  title: string,
  video: VideoStreamItem,
  audio: AudioStreamItem | undefined,
  onProgress: (state: DownloadProgress) => void
): Promise<void> {
  try {
    onProgress({
      status: 'downloading_video',
      progress: 0,
      message: `正在下载视频轨 (${video.qualityName} ${video.codecName})`,
    });

    // 1. 下载视频轨
    const videoBuffer = await requestBuffer(video.baseUrl, (loaded, total, speed) => {
      const pct = Math.floor((loaded / total) * 50);
      onProgress({
        status: 'downloading_video',
        progress: pct,
        speed,
        message: `正在下载视频轨: ${pct * 2}% ${speed ? `(${speed})` : ''}`,
      });
    });

    let audioBuffer: ArrayBuffer | null = null;

    // 2. 下载音频轨
    if (audio) {
      onProgress({
        status: 'downloading_audio',
        progress: 50,
        message: `正在下载音频轨 (${audio.name})`,
      });

      audioBuffer = await requestBuffer(audio.baseUrl, (loaded, total, speed) => {
        const pct = 50 + Math.floor((loaded / total) * 40);
        onProgress({
          status: 'downloading_audio',
          progress: pct,
          speed,
          message: `正在下载音频轨: ${(pct - 50) * 2.5}% ${speed ? `(${speed})` : ''}`,
        });
      });
    }

    // 3. 前端 mp4box 混流合成
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
          progress: 90 + Math.floor(muxPct * 0.08),
          message: '正在封装 MP4 容器',
        });
      });
    } else {
      finalBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    }

    // 4. 保存文件
    const filename = `${title}_${video.qualityName}_${video.codecName}.mp4`;
    saveBlobAsFile(finalBlob, filename);

    onProgress({
      status: 'completed',
      progress: 100,
      message: '下载与合成完成，已保存到本地',
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
