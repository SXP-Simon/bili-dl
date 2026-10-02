import { describe, it, expect, vi } from 'vitest';
import {
  externalDownloaderRegistry,
  abDownloadManager,
  ABDownloadManager,
  buildMediaDownloadSources,
  dispatchExternalDownloadTask,
  type IExternalDownloader,
} from '../../src/downloader';
import type { DownloadSettings } from '../../src/utils/settings';
import type { VideoStreamItem, AudioStreamItem } from '../../src/types';
import { GM_xmlhttpRequest } from '$';

vi.mock('$', () => ({
  GM_xmlhttpRequest: vi.fn(),
  GM_getValue: vi.fn(),
  GM_setValue: vi.fn(),
}));

describe('External Downloader Architecture Unit Tests (OCP)', () => {
  it('should have registered built-in downloaders in registry', () => {
    const all = externalDownloaderRegistry.getAll();
    expect(all.length).toBeGreaterThanOrEqual(2);

    const abdm = externalDownloaderRegistry.get('abdm');
    expect(abdm).toBeDefined();
    expect(abdm?.name).toBe('AB Download Manager');
    expect(abdm?.defaultPort).toBe(15151);

    const aria2 = externalDownloaderRegistry.get('aria2_rpc');
    expect(aria2).toBeDefined();
    expect(aria2?.defaultPort).toBe(6800);
  });

  it('should support registering new custom downloaders without modifying core (OCP)', () => {
    const customDownloader = {
      id: 'motrix_custom',
      name: 'Motrix Custom',
      description: 'Custom Motrix App',
      defaultPort: 16800,
      checkAvailability: vi.fn().mockResolvedValue({
        isAvailable: true,
        name: 'Motrix Custom',
        message: 'OK',
        lastChecked: Date.now(),
      }),
      sendDownload: vi.fn().mockResolvedValue({ success: true, message: 'Done' }),
    };

    externalDownloaderRegistry.register(customDownloader);
    expect(externalDownloaderRegistry.get('motrix_custom')).toBe(customDownloader);
  });

  describe('ABDownloadManager checkAvailability', () => {
    it('should report available when ABDM server responds with HTTP 200', async () => {
      vi.mocked(GM_xmlhttpRequest).mockImplementation((opts) => {
        setTimeout(() => {
          opts.onload?.({
            status: 200,
            statusText: 'OK',
            responseText: '[]',
            responseHeaders: '',
            response: '[]',
          });
        }, 10);
        return { abort: vi.fn() };
      });

      const manager = new ABDownloadManager();
      const status = await manager.checkAvailability({ port: 15151 });

      expect(status.isAvailable).toBe(true);
      expect(status.name).toBe('AB Download Manager');
      expect(status.port).toBe(15151);
      expect(status.message).toContain('已连接');
    });

    it('should report offline when ABDM server connection errors', async () => {
      vi.mocked(GM_xmlhttpRequest).mockImplementation((opts) => {
        setTimeout(() => {
          opts.onerror?.({
            error: 'Connection refused',
          });
        }, 10);
        return { abort: vi.fn() };
      });

      const manager = new ABDownloadManager();
      const status = await manager.checkAvailability({ port: 15151 });

      expect(status.isAvailable).toBe(false);
      expect(status.message).toContain('未检测到客户端运行');
    });
  });

  describe('ABDownloadManager sendDownload', () => {
    it('should format payload matching ABDM REST-API.yml schema', async () => {
      let capturedPayload: unknown = null;
      let capturedUrl = '';

      vi.mocked(GM_xmlhttpRequest).mockImplementation((opts) => {
        capturedUrl = opts.url;
        capturedPayload = JSON.parse(opts.data as string);
        setTimeout(() => {
          opts.onload?.({
            status: 200,
            statusText: 'OK',
            responseText: '{"status":"ok"}',
            responseHeaders: '',
            response: '{"status":"ok"}',
          });
        }, 10);
        return { abort: vi.fn() };
      });

      const result = await abDownloadManager.sendDownload({
        title: '测试视频',
        sources: [
          {
            url: 'https://cn-upcdn.bilivideo.com/video.m4s',
            filename: 'test_video.m4s',
            type: 'video',
          },
          {
            url: 'https://cn-upcdn.bilivideo.com/audio.m4s',
            filename: 'test_audio.m4s',
            type: 'audio',
          },
        ],
        downloadPage: 'https://www.bilibili.com/video/BV1test',
      });

      expect(result.success).toBe(true);
      expect(capturedUrl).toBe('http://127.0.0.1:15151/add');
      expect(Array.isArray(capturedPayload)).toBe(true);
      const items = capturedPayload as Array<{ link: string; headers: Record<string, string>; downloadPage: string }>;
      expect(items).toHaveLength(2);
      expect(items[0].link).toBe('https://cn-upcdn.bilivideo.com/video.m4s');
      expect(items[0].headers.Referer).toBe('https://www.bilibili.com/');
      expect(items[0].downloadPage).toBe('https://www.bilibili.com/video/BV1test');
      expect(items[1].link).toBe('https://cn-upcdn.bilivideo.com/audio.m4s');
    });
  });

  describe('Registry getActiveContext and getDownloaderPort', () => {
    it('should resolve port and context dynamically without hardcoded branching', () => {
      const customSettings = {
        externalDownloaderId: 'aria2_rpc' as const,
        aria2Port: 6812,
        aria2Secret: 'my-token',
        externalDownloaderEnabled: true,
      };

      const ctx = externalDownloaderRegistry.getActiveContext(customSettings as unknown as DownloadSettings);
      expect(ctx.downloader.id).toBe('aria2_rpc');
      expect(ctx.port).toBe(6812);
      expect(ctx.config.secret).toBe('my-token');
      expect(ctx.isExternal).toBe(true);

      const resolvedPort = externalDownloaderRegistry.getDownloaderPort('aria2_rpc', customSettings as unknown as DownloadSettings);
      expect(resolvedPort).toBe(6812);
    });
  });

  describe('buildMediaDownloadSources and dispatchExternalDownloadTask', () => {
    it('should prioritize CDN URLs according to cdnPriorityOrder settings', () => {
      const sources = buildMediaDownloadSources({
        video: {
          baseUrl: 'https://cn-upcdn.bilivideo.com/v.m4s',
          backupUrl: ['https://xy123x.mcdn.bilivideo.cn/v.m4s'],
          qualityName: '1080P',
          codecName: 'HEVC',
        } as unknown as VideoStreamItem,
        audio: {
          baseUrl: 'https://cn-upcdn.bilivideo.com/a.m4s',
          backupUrl: ['https://xy123x.mcdn.bilivideo.cn/a.m4s'],
          name: '高品质音轨',
        } as unknown as AudioStreamItem,
        title: '测试视频',
        settings: { cdnPriorityOrder: ['pcdn', 'bili'] } as unknown as DownloadSettings,
      });

      expect(sources).toHaveLength(2);
      // Because mcdn is prioritized first, video url should be the mcdn URL
      expect(sources[0].url).toContain('mcdn.bilivideo.cn');
      expect(sources[0].urls?.[0]).toContain('mcdn.bilivideo.cn');
      expect(sources[0].urls?.[1]).toContain('cn-upcdn.bilivideo.com');

      // Audio url should also prioritize mcdn
      expect(sources[1].url).toContain('mcdn.bilivideo.cn');
    });

    it('should dispatch download task and update task status via dispatchExternalDownloadTask', async () => {
      const mockDownloader = {
        id: 'mock_dl',
        name: 'Mock DL',
        defaultPort: 9999,
        checkAvailability: vi.fn(),
        sendDownload: vi.fn().mockResolvedValue({ success: true, message: 'Dispatched successfully' }),
        resolveConfig: vi.fn().mockReturnValue({ port: 9999 }),
      };

      const onTaskUpdate = vi.fn();
      await dispatchExternalDownloadTask({
        downloader: mockDownloader as unknown as IExternalDownloader,
        payload: {
          title: '测试推送',
          sources: [{ url: 'https://test.com/v.m4s', filename: 'v.mp4', type: 'video' }],
        },
        taskId: 'test-task-1',
        taskType: 'video',
        onTaskUpdate,
        delayMs: 0,
      });

      expect(mockDownloader.sendDownload).toHaveBeenCalledTimes(1);
      expect(onTaskUpdate).toHaveBeenCalledWith('test-task-1', expect.objectContaining({
        status: 'completed',
        progress: 100,
      }));
    });
  });
});

