import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VideoPageItem, SeasonEpisodeItem, DownloadTask } from '../../src/types';

// Mock dependencies
vi.mock('../../src/api/bilibili', () => ({
  getVideoTitle: vi.fn().mockReturnValue('测试总标题'),
  fetchMediaPlayStreams: vi.fn(),
  fetchVideoPages: vi.fn().mockResolvedValue([{ cid: 2001, page: 1, part: '第1话' }]),
}));

vi.mock('../../src/media/downloader', () => ({
  downloadAudio: vi.fn().mockImplementation((_t, _a, onProgress) => {
    onProgress?.({ status: 'completed', progress: 100, message: '完成' });
    return Promise.resolve();
  }),
  downloadAndMuxMp4: vi.fn().mockImplementation((_t, _v, _a, onProgress) => {
    onProgress?.({ status: 'completed', progress: 100, message: '完成' });
    return Promise.resolve();
  }),
}));

import {
  batchDownloadAllLowestAudios,
  batchDownloadAllHighestVideos,
  batchDownloadSeasonHighestVideos,
  batchDownloadSeasonLowestAudios,
} from '../../src/media/batchDownloader';
import { fetchMediaPlayStreams } from '../../src/api/bilibili';
import { downloadAudio, downloadAndMuxMp4 } from '../../src/media/downloader';

describe('Batch Downloader Unit Tests', () => {
  const mockPages: VideoPageItem[] = [
    { cid: 1001, page: 1, part: '第一讲', duration: 120 },
    { cid: 1002, page: 2, part: '第二讲', duration: 180 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('batchDownloadAllLowestAudios', () => {
    it('should register all tasks as pending and download lowest bitrate audio', async () => {
      const addedTasks: DownloadTask[] = [];
      const updatedTasks: Record<string, Partial<DownloadTask>> = {};

      const onTaskAdd = (task: DownloadTask) => addedTasks.push(task);
      const onTaskUpdate = (id: string, partial: Partial<DownloadTask>) => {
        updatedTasks[id] = { ...updatedTasks[id], ...partial };
      };

      (fetchMediaPlayStreams as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        videos: [],
        audios: [
          { id: 30280, bandwidth: 320000, name: '320K', qualityDesc: '320K', codec: 'mp4a', sizeMB: '10', baseUrl: 'http://a320.m4s' },
          { id: 30216, bandwidth: 64000, name: '64K', qualityDesc: '64K', codec: 'mp4a', sizeMB: '2', baseUrl: 'http://a64.m4s' },
        ],
        duration: 120,
      });

      await batchDownloadAllLowestAudios('BV1test411c7mD', mockPages, onTaskAdd, onTaskUpdate);

      // Verify tasks initially registered
      expect(addedTasks).toHaveLength(2);
      expect(addedTasks[0]?.status).toBe('pending');
      expect(addedTasks[1]?.status).toBe('pending');

      // Verify downloadAudio was called with lowest audio stream (bandwidth 64000)
      expect(downloadAudio).toHaveBeenCalledTimes(2);
      const calledAudio = (downloadAudio as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(calledAudio.bandwidth).toBe(64000);
      expect(calledAudio.id).toBe(30216);

      // Verify tasks completed
      expect(updatedTasks['batch_audio_BV1test411c7mD_1001']?.status).toBe('completed');
      expect(updatedTasks['batch_audio_BV1test411c7mD_1002']?.status).toBe('completed');
    });

    it('should handle abort signal by cancelling pending tasks', async () => {
      const addedTasks: DownloadTask[] = [];
      const updatedTasks: Record<string, Partial<DownloadTask>> = {};

      const controller = new AbortController();
      controller.abort(); // already aborted

      await batchDownloadAllLowestAudios(
        'BV1test411c7mD',
        mockPages,
        (t) => addedTasks.push(t),
        (id, p) => { updatedTasks[id] = { ...updatedTasks[id], ...p }; },
        'test',
        controller.signal
      );

      expect(downloadAudio).not.toHaveBeenCalled();
      expect(updatedTasks['batch_audio_BV1test411c7mD_1001']?.status).toBe('cancelled');
      expect(updatedTasks['batch_audio_BV1test411c7mD_1002']?.status).toBe('cancelled');
    });
  });

  describe('batchDownloadAllHighestVideos', () => {
    it('should select highest quality video and mux with best audio', async () => {
      const addedTasks: DownloadTask[] = [];
      const updatedTasks: Record<string, Partial<DownloadTask>> = {};

      (fetchMediaPlayStreams as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        videos: [
          { id: 116, bandwidth: 5000000, qualityName: '1080P 60帧', codecName: 'AVC', width: 1920, height: 1080, frameRate: '60', baseUrl: 'http://v1080p60.m4s' },
          { id: 80, bandwidth: 2000000, qualityName: '1080P', codecName: 'AVC', width: 1920, height: 1080, frameRate: '30', baseUrl: 'http://v1080.m4s' },
        ],
        audios: [
          { id: 30280, bandwidth: 320000, name: '320K', qualityDesc: '320K', codec: 'mp4a', sizeMB: '10', baseUrl: 'http://a320.m4s' },
        ],
        duration: 120,
      });

      await batchDownloadAllHighestVideos(
        'BV1test411c7mD',
        [mockPages[0]!],
        (t) => addedTasks.push(t),
        (id, p) => { updatedTasks[id] = { ...updatedTasks[id], ...p }; }
      );

      expect(downloadAndMuxMp4).toHaveBeenCalledTimes(1);
      const [, calledVideo, calledAudio] = (downloadAndMuxMp4 as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      // Highest video bandwidth should be selected (5000000)
      expect(calledVideo.bandwidth).toBe(5000000);
      expect(calledVideo.qualityName).toBe('1080P 60帧');
      expect(calledAudio.bandwidth).toBe(320000);
    });
  });

  describe('Season Batch Downloads', () => {
    const mockSeasonEpisodes: SeasonEpisodeItem[] = [
      { id: 1, bvid: 'BV1season001', cid: 2001, title: '合集第1话', pageIndex: 1 },
      { id: 2, bvid: 'BV1season002', cid: 2002, title: '合集第2话', pageIndex: 2 },
    ];

    it('should format season video filename as [合集名]_第X集_[单集标题]', async () => {
      const addedTasks: DownloadTask[] = [];
      const updatedTasks: Record<string, Partial<DownloadTask>> = {};

      (fetchMediaPlayStreams as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        videos: [
          { id: 80, bandwidth: 2000000, qualityName: '1080P', codecName: 'AVC', width: 1920, height: 1080, frameRate: '30', baseUrl: 'http://v.m4s' },
        ],
        audios: [
          { id: 30280, bandwidth: 320000, name: '320K', qualityDesc: '320K', codec: 'mp4a', sizeMB: '5', baseUrl: 'http://a.m4s' },
        ],
        duration: 120,
      });

      await batchDownloadSeasonHighestVideos(
        '合集系列名称',
        [mockSeasonEpisodes[0]!],
        (t) => addedTasks.push(t),
        (id, p) => { updatedTasks[id] = { ...updatedTasks[id], ...p }; }
      );

      expect(downloadAndMuxMp4).toHaveBeenCalledTimes(1);
      const customTitle = (downloadAndMuxMp4 as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(customTitle).toBe('合集系列名称_第1集_合集第1话');
    });

    it('should batch download season lowest audios with season naming format', async () => {
      const addedTasks: DownloadTask[] = [];
      const updatedTasks: Record<string, Partial<DownloadTask>> = {};

      (fetchMediaPlayStreams as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        videos: [],
        audios: [
          { id: 30216, bandwidth: 64000, name: '64K', qualityDesc: '64K', codec: 'mp4a', sizeMB: '1', baseUrl: 'http://a64.m4s' },
        ],
        duration: 120,
      });

      await batchDownloadSeasonLowestAudios(
        '合集系列名称',
        [mockSeasonEpisodes[1]!],
        (t) => addedTasks.push(t),
        (id, p) => { updatedTasks[id] = { ...updatedTasks[id], ...p }; }
      );

      expect(downloadAudio).toHaveBeenCalledTimes(1);
      const customTitle = (downloadAudio as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(customTitle).toBe('合集系列名称_第2集_合集第2话');
    });

    it('should immediately dispatch to external downloader per episode without buffering full batch', async () => {
      const addedTasks: DownloadTask[] = [];
      const updatedTasks: Record<string, Partial<DownloadTask>> = {};

      const mockExternalDownloader = {
        id: 'abdm',
        name: 'AB Download Manager',
        defaultPort: 15151,
        checkAvailability: vi.fn(),
        sendDownload: vi.fn().mockResolvedValue({ success: true, message: 'Dispatched' }),
        resolveConfig: vi.fn(),
      };

      (fetchMediaPlayStreams as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        videos: [
          { id: 80, bandwidth: 2000000, qualityName: '1080P', codecName: 'AVC', width: 1920, height: 1080, frameRate: '30', baseUrl: 'http://v.m4s' },
        ],
        audios: [
          { id: 30280, bandwidth: 320000, name: '320K', qualityDesc: '320K', codec: 'mp4a', sizeMB: '5', baseUrl: 'http://a.m4s' },
        ],
        duration: 120,
      });

      await batchDownloadSeasonHighestVideos(
        '合集系列名称',
        [mockSeasonEpisodes[0]!],
        (t) => addedTasks.push(t),
        (id, p) => { updatedTasks[id] = { ...updatedTasks[id], ...p }; },
        '合集最高画质',
        undefined,
        { externalDownloader: mockExternalDownloader as unknown as import('../../src/downloader').IExternalDownloader, externalPort: 15151 }
      );

      // Verify that sendDownload was called immediately on the external downloader
      expect(mockExternalDownloader.sendDownload).toHaveBeenCalledTimes(1);
      const payload = mockExternalDownloader.sendDownload.mock.calls[0][0];
      expect(payload.title).toBe('合集系列名称_第1集_合集第1话');
      expect(payload.sources).toHaveLength(2); // video + audio
      // Task should be marked as completed
      expect(updatedTasks['season_video_BV1season001']?.status).toBe('completed');
    });
  });
});
