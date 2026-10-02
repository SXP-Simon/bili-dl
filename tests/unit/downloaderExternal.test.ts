import { describe, it, expect, vi } from 'vitest';
import {
  externalDownloaderRegistry,
  abDownloadManager,
  ABDownloadManager,
} from '../../src/downloader';
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
});
