import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GM_download } from '$';

vi.mock('../../src/api/http', () => ({
  requestChunkedBuffer: vi.fn().mockImplementation((_urls: string[], onProgress?: (l: number, t: number, s: string) => void) => {
    onProgress?.(1000, 1000, '5.0 MB/s');
    return Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer);
  }),
}));

vi.mock('../../src/media/muxer', () => ({
  muxMp4: vi.fn().mockImplementation((_v: ArrayBuffer, _a: ArrayBuffer, onProgress?: (pct: number) => void) => {
    onProgress?.(100);
    return Promise.resolve(new Blob(['mock-muxed-mp4'], { type: 'video/mp4' }));
  }),
}));

import { downloadAndMuxMp4, downloadAudio } from '../../src/media/downloader';
import { muxMp4 } from '../../src/media/muxer';
import type { VideoStreamItem, AudioStreamItem } from '../../src/types';

describe('Downloader Unit Tests', () => {
  const mockVideo: VideoStreamItem = {
    id: 80,
    qualityName: '1080P 高清',
    codecName: 'HEVC',
    codec: 'hev1.1.6.L150.90',
    sizeMB: '120.0',
    baseUrl: 'https://example.com/video.m4s',
    bandwidth: 2500000,
    width: 1920,
    height: 1080,
    frameRate: '30',
  };

  const mockAudio: AudioStreamItem = {
    id: 30280,
    name: '320Kbps 高品质音轨',
    qualityDesc: '320Kbps',
    codec: 'mp4a.40.2',
    sizeMB: '10.5',
    baseUrl: 'https://example.com/audio.m4s',
    bandwidth: 320000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mux audio and video and name file without suffix when audio is provided', async () => {
    const progressUpdates: unknown[] = [];
    const onProgress = vi.fn((state) => progressUpdates.push(state));

    await downloadAndMuxMp4('测试视频', mockVideo, mockAudio, onProgress, 'test-trace');

    expect(muxMp4).toHaveBeenCalledTimes(1);
    expect(GM_download).toHaveBeenCalledTimes(1);

    const callArgs = (GM_download as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.name).toMatch(/测试视频_1080P 高清_HEVC\.mp4$/);

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        progress: 100,
        message: '下载与混流完成，已保存到本地',
      })
    );
  });

  it('should save with "_仅画面(无声)" suffix and skip muxMp4 when audio is undefined', async () => {
    const progressUpdates: unknown[] = [];
    const onProgress = vi.fn((state) => progressUpdates.push(state));

    await downloadAndMuxMp4('测试视频', mockVideo, undefined, onProgress, 'test-trace');

    // Should NOT call muxMp4 because there is no audio to mux
    expect(muxMp4).not.toHaveBeenCalled();
    expect(GM_download).toHaveBeenCalledTimes(1);

    const callArgs = (GM_download as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.name).toMatch(/测试视频_1080P 高清_HEVC_仅画面\(无声\)\.mp4$/);

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        progress: 100,
        message: '纯画面视频下载完成，已保存到本地',
      })
    );
  });

  it('should download pure audio and save as .m4a', async () => {
    const progressUpdates: unknown[] = [];
    const onProgress = vi.fn((state) => progressUpdates.push(state));

    await downloadAudio('测试视频', mockAudio, onProgress, 'test-audio');

    expect(GM_download).toHaveBeenCalledTimes(1);
    const callArgs = (GM_download as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.name).toMatch(/测试视频_320Kbps 高品质音轨\.m4a$/);

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        progress: 100,
      })
    );
  });
});
