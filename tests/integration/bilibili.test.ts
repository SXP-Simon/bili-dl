import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchVideoPages, fetchAiSummary, fetchCurrentMediaData } from '../../src/api/bilibili';
import { setMockRequestHandler } from '../mocks/gm';

describe('Bilibili API integration tests', () => {
  beforeEach(() => {
    // Reset window location mock
    window.location.href = 'https://www.bilibili.com/video/BV1xx411c7mD';
    window.location.pathname = '/video/BV1xx411c7mD';
    window.location.search = '';
    document.title = '测试集成视频_哔哩哔哩_bilibili';
  });

  afterEach(() => {
    setMockRequestHandler(null);
  });

  it('fetchVideoPages should request and parse pagelist with Zod', async () => {
    setMockRequestHandler((options) => {
      if (options.url?.includes('x/player/pagelist')) {
        options.onload?.({
          status: 200,
          statusText: 'OK',
          responseHeaders: '',
          response: {
            code: 0,
            message: '0',
            data: [
              { cid: 1001, page: 1, part: '第一集：入门', duration: 120 },
              { cid: 1002, page: 2, part: '第二集：进阶', duration: 180 },
            ],
          },
        });
      }
    });

    const pages = await fetchVideoPages('BV1xx411c7mD');
    expect(pages).toHaveLength(2);
    expect(pages[0]?.cid).toBe(1001);
    expect(pages[0]?.part).toBe('第一集：入门');
    expect(pages[1]?.page).toBe(2);
  });

  it('fetchAiSummary should parse outline and generate markdown', async () => {
    setMockRequestHandler((options) => {
      if (options.url?.includes('x/web-interface/view/conclusion/get')) {
        options.onload?.({
          status: 200,
          statusText: 'OK',
          responseHeaders: '',
          response: {
            code: 0,
            data: {
              model_result: {
                summary: '本视频深入介绍了现代化前端工程化实践。',
                outline: [
                  {
                    title: '引言与背景',
                    timestamp: 15,
                    part_outline: [{ content: '背景介绍' }, { content: '痛点分析' }],
                  },
                ],
              },
            },
          },
        });
      }
    });

    const summary = await fetchAiSummary('BV1xx411c7mD', 1001);
    expect(summary).toBeDefined();
    expect(summary).toContain('### 视频 AI 提炼总结');
    expect(summary).toContain('现代化前端工程化实践');
    expect(summary).toContain('引言与背景');
    expect(summary).toContain('背景介绍; 痛点分析');
  });

  it('fetchCurrentMediaData should parse playurl DASH video and audio streams', async () => {
    setMockRequestHandler((options) => {
      if (options.url?.includes('x/player/pagelist')) {
        options.onload?.({
          status: 200,
          statusText: 'OK',
          responseHeaders: '',
          response: {
            code: 0,
            data: [{ cid: 8888, page: 1, part: '正片', duration: 60 }],
          },
        });
      } else if (options.url?.includes('x/player/playurl')) {
        options.onload?.({
          status: 200,
          statusText: 'OK',
          responseHeaders: '',
          response: {
            code: 0,
            data: {
              duration: 60,
              dash: {
                duration: 60,
                video: [
                  {
                    id: 80,
                    codecs: 'avc1.640032',
                    bandwidth: 1200000,
                    baseUrl: 'https://cn-upcdn.bilivideo.com/v80.m4s',
                    width: 1920,
                    height: 1080,
                    frameRate: '30',
                  },
                ],
                audio: [
                  {
                    id: 30280,
                    codecs: 'mp4a.40.2',
                    bandwidth: 320000,
                    baseUrl: 'https://cn-upcdn.bilivideo.com/a30280.m4s',
                  },
                ],
              },
            },
          },
        });
      } else {
        options.onerror?.({ error: 'Not mocked' });
      }
    });

    const media = await fetchCurrentMediaData(8888, 'BV1xx411c7mD');
    expect(media).not.toBeNull();
    expect(media?.bvid).toBe('BV1xx411c7mD');
    expect(media?.cid).toBe(8888);
    expect(media?.videos).toHaveLength(1);
    expect(media?.videos[0]?.qualityName).toBe('1080P 高清');
    expect(media?.videos[0]?.codecName).toBe('AVC');
    expect(media?.audios).toHaveLength(1);
    expect(media?.audios[0]?.name).toBe('320K 极高音质');
  });

  it('fetchCurrentMediaData should handle realistic Bilibili DASH response containing null dolby, flac, and backup_urls', async () => {
    setMockRequestHandler((options) => {
      if (options.url?.includes('x/player/pagelist')) {
        options.onload?.({
          status: 200,
          statusText: 'OK',
          responseHeaders: '',
          response: {
            code: 0,
            message: '0',
            data: [{ cid: 9999, page: 1, part: 'Realistic Video', duration: 120 }],
          },
        });
      } else if (options.url?.includes('x/player/playurl')) {
        options.onload?.({
          status: 200,
          statusText: 'OK',
          responseHeaders: '',
          response: {
            code: 0,
            message: '0',
            ttl: 1,
            data: {
              from: 'local',
              result: 'suee',
              message: '',
              quality: 80,
              format: 'mp4720',
              timelength: 120000,
              dash: {
                duration: 120,
                minBufferTime: 1.5,
                video: [
                  {
                    id: 80,
                    baseUrl: 'https://cn-bj1.bilivideo.com/v80.m4s',
                    base_url: 'https://cn-bj1.bilivideo.com/v80.m4s',
                    backupUrl: null,
                    backup_url: null,
                    bandwidth: 1500000,
                    codecs: 'avc1.640028',
                    width: 1920,
                    height: 1080,
                    frameRate: '30',
                    frame_rate: '30',
                  },
                ],
                audio: [
                  {
                    id: 30280,
                    baseUrl: 'https://cn-bj1.bilivideo.com/a30280.m4s',
                    base_url: 'https://cn-bj1.bilivideo.com/a30280.m4s',
                    backupUrl: null,
                    backup_url: null,
                    bandwidth: 320000,
                    codecs: 'mp4a.40.2',
                  },
                ],
                dolby: null,
                flac: null,
              },
            },
          },
        });
      } else {
        options.onerror?.({ error: 'Not mocked' });
      }
    });

    const media = await fetchCurrentMediaData(9999, 'BV1iv4y1K7fu');
    expect(media).not.toBeNull();
    expect(media?.videos).toHaveLength(1);
    expect(media?.videos[0]?.id).toBe(80);
    expect(media?.videos[0]?.qualityName).toBe('1080P 高清');
    expect(media?.audios).toHaveLength(1);
    expect(media?.audios[0]?.id).toBe(30280);
  });

  it('fetchUgcSeasonData should parse UGC season metadata and archives', async () => {
    // Inject __INITIAL_STATE__
    const win = window as unknown as {
      __INITIAL_STATE__?: {
        videoData?: {
          ugc_season?: {
            id: number;
            mid: number;
            title: string;
            cover: string;
          };
        };
      };
    };

    win.__INITIAL_STATE__ = {
      videoData: {
        ugc_season: {
          id: 5555,
          mid: 123456,
          title: 'TypeScript 核心进阶课程',
          cover: 'https://i0.hdslb.com/bfs/season_cover.jpg',
        },
      },
    };

    setMockRequestHandler((options) => {
      if (options.url?.includes('seasons_archives_list')) {
        options.onload?.({
          status: 200,
          statusText: 'OK',
          responseHeaders: '',
          response: {
            code: 0,
            data: {
              meta: {
                name: 'TypeScript 核心进阶课程',
                total: 2,
                cover: 'https://i0.hdslb.com/bfs/season_cover.jpg',
              },
              archives: [
                { aid: 101, bvid: 'BV1ts001', cid: 9001, title: '第1章 类型体操', duration: 300, pic: 'https://i0.hdslb.com/p1.jpg' },
                { aid: 102, bvid: 'BV1ts002', cid: 9002, title: '第2章 泛型深度剖析', duration: 400, pic: 'https://i0.hdslb.com/p2.jpg' },
              ],
            },
          },
        });
      }
    });

    const { fetchUgcSeasonData } = await import('../../src/api/bilibili');
    const season = await fetchUgcSeasonData('BV1ts001');

    expect(season).toBeDefined();
    expect(season?.id).toBe(5555);
    expect(season?.title).toBe('TypeScript 核心进阶课程');
    expect(season?.episodes).toHaveLength(2);
    expect(season?.episodes[0]?.bvid).toBe('BV1ts001');
    expect(season?.episodes[1]?.title).toBe('第2章 泛型深度剖析');
  });
});

