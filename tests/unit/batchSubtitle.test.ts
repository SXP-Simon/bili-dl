import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VideoPageItem, SeasonEpisodeItem } from '../../src/types';

// Mock dependencies
vi.mock('../../src/api/http', () => ({
  requestJson: vi.fn(),
}));

vi.mock('../../src/utils/wbi', () => ({
  signWbiQuery: vi.fn().mockResolvedValue('wbi_signed=1'),
}));

vi.mock('../../src/media/subtitle', () => ({
  convertSubtitleJsonToSrt: vi.fn().mockReturnValue('1\n00:00:01,000 --> 00:00:02,000\n测试字幕内容\n\n'),
}));

import { batchDownloadSubtitles, batchDownloadSeasonSubtitlesZip } from '../../src/media/batchSubtitle';
import { requestJson } from '../../src/api/http';

describe('Batch Subtitle Unit Tests', () => {
  const mockPages: VideoPageItem[] = [
    { cid: 101, page: 1, part: '第一集', duration: 120 },
    { cid: 102, page: 2, part: '第二集', duration: 180 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect subtitles across multiple pages and pack them into a ZIP blob', async () => {
    (requestJson as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/wbi/v2')) {
        return Promise.resolve({
          code: 0,
          data: {
            subtitle: {
              subtitles: [
                {
                  id: 1,
                  lan: 'zh-CN',
                  lan_doc: '中文',
                  subtitle_url: 'https://example.com/sub1.json',
                },
              ],
            },
          },
        });
      }
      if (url.includes('sub1.json')) {
        return Promise.resolve({
          body: [{ from: 1, to: 2, content: '测试字幕内容' }],
        });
      }
      return Promise.resolve({ code: 0 });
    });

    const progressLogs: string[] = [];
    const result = await batchDownloadSubtitles(
      'BV1test411c7mD',
      '测试教程',
      mockPages,
      (p) => progressLogs.push(p.message)
    );

    expect(result.foundCount).toBe(2);
    expect(result.zipBlob).toBeInstanceOf(Blob);
    expect(result.zipBlob.type).toBe('application/zip');
    expect(progressLogs.length).toBeGreaterThan(0);
  });

  it('should throw error when page list is empty', async () => {
    await expect(batchDownloadSubtitles('BV1test411c7mD', '标题', [])).rejects.toThrow(
      '当前视频未获取到有效分 P 列表'
    );
  });

  it('should batch download season subtitles with season naming convention', async () => {
    const mockSeasonEpisodes: SeasonEpisodeItem[] = [
      { id: 1, bvid: 'BV1season1', cid: 201, title: '合集第1话', pageIndex: 1 },
      { id: 2, bvid: 'BV1season2', cid: 202, title: '合集第2话', pageIndex: 2 },
    ];

    (requestJson as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/wbi/v2')) {
        return Promise.resolve({
          code: 0,
          data: {
            subtitle: {
              subtitles: [
                {
                  id: 99,
                  lan: 'zh-Hans',
                  lan_doc: '简体中文',
                  subtitle_url: 'https://example.com/season_sub.json',
                },
              ],
            },
          },
        });
      }
      if (url.includes('season_sub.json')) {
        return Promise.resolve({
          body: [{ from: 0, to: 3, content: '合集台词' }],
        });
      }
      return Promise.resolve({ code: 0 });
    });

    const result = await batchDownloadSeasonSubtitlesZip(
      '动画合集第一季',
      mockSeasonEpisodes
    );

    expect(result.foundCount).toBe(2);
    expect(result.zipBlob).toBeInstanceOf(Blob);
    expect(result.zipBlob.type).toBe('application/zip');
  });
});
