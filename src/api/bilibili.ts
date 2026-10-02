import { requestJson } from './http';
import { logger } from '../utils/logger';
import { signWbiQuery } from '../utils/wbi';
import { getErrorMessage } from '../utils/error';
import {
  BiliPageListResponseSchema,
  BiliAiSummaryResponseSchema,
  BiliSeasonArchivesResponseSchema,
  BiliPlayUrlResponseSchema,
  BiliPlayerResponseSchema,
  type BiliDashData,
  type BiliDashVideoItem,
  type BiliDashAudioItem,
  type BiliSubtitleItem,
} from '../types/schemas';
import type {
  MediaResourceData,
  VideoStreamItem,
  AudioStreamItem,
  VideoPageItem,
  SubtitleItem,
  UgcSeasonData,
  SeasonEpisodeItem,
} from '../types';

interface InitialStateEpisode {
  id?: number;
  aid?: number;
  bvid: string;
  cid?: number;
  title: string;
  arc?: { pic?: string; duration?: number };
}

interface InitialStateUgcSeason {
  id?: number | string;
  mid?: number | string;
  title?: string;
  cover?: string;
  sections?: Array<{
    episodes?: InitialStateEpisode[];
  }>;
}

interface WindowWithBiliGlobals extends Window {
  __INITIAL_STATE__?: {
    bvid?: string;
    videoData?: {
      bvid?: string;
      pic?: string;
      owner?: { mid?: number | string };
      ugc_season?: InitialStateUgcSeason;
    };
    epInfo?: { bvid?: string };
  };
  __playinfo__?: {
    data?: {
      dash?: BiliDashData;
      duration?: number;
    };
  };
}

const QUALITY_MAP: Record<number, string> = {
  127: '8K 超高清',
  126: '杜比视界',
  125: 'HDR 真彩',
  120: '4K 超清',
  116: '1080P 60帧',
  112: '1080P 高码率',
  80: '1080P 高清',
  74: '720P 60帧',
  64: '720P 高清',
  32: '480P 清晰',
  16: '360P 流畅',
};

function getBiliWindow(): WindowWithBiliGlobals {
  const globalWin = globalThis as unknown as { unsafeWindow?: WindowWithBiliGlobals };
  if (globalWin.unsafeWindow) {
    return globalWin.unsafeWindow;
  }
  return window as unknown as WindowWithBiliGlobals;
}

export function getBvidFromUrl(): string | null {
  const match = location.pathname.match(/(BV[a-zA-Z0-9]+)/i);
  if (match && match[1]) return match[1];
  const queryBvid = new URLSearchParams(location.search).get('bvid');
  if (queryBvid) return queryBvid;
  const win = getBiliWindow();
  if (win.__INITIAL_STATE__?.videoData?.bvid) {
    return win.__INITIAL_STATE__.videoData.bvid;
  }
  if (win.__INITIAL_STATE__?.bvid) {
    return win.__INITIAL_STATE__.bvid;
  }
  if (win.__INITIAL_STATE__?.epInfo?.bvid) {
    return win.__INITIAL_STATE__.epInfo.bvid;
  }
  return null;
}

export function getEpisodeIdFromUrl(): string | null {
  const match = location.pathname.match(/\/bangumi\/play\/(ep\d+|ss\d+)/);
  return match && match[1] ? match[1] : null;
}

export function getVideoTitle(): string {
  let title = document.title.replace('_哔哩哔哩_bilibili', '').replace('_哔哩哔哩 (゜-゜)つロ 干杯~-bilibili', '').trim();
  const el = document.querySelector('.video-title') || document.querySelector('.tit');
  if (el && (el as HTMLElement).innerText) {
    title = (el as HTMLElement).innerText.trim();
  }
  return title.replace(/[\\/:*?"<>|]/g, '_');
}

export function getVideoCover(): string {
  const meta = document.querySelector('meta[property="og:image"]');
  if (meta) {
    const content = meta.getAttribute('content');
    if (content) return content.split('@')[0] || '';
  }
  const win = getBiliWindow();
  if (win.__INITIAL_STATE__?.videoData?.pic) {
    return win.__INITIAL_STATE__.videoData.pic;
  }
  return '';
}

export async function fetchVideoPages(bvid: string): Promise<VideoPageItem[]> {
  try {
    const res = await requestJson<unknown>(
      `https://api.bilibili.com/x/player/pagelist?bvid=${bvid}`
    );
    const parsed = BiliPageListResponseSchema.safeParse(res);
    if (parsed.success && parsed.data.code === 0 && Array.isArray(parsed.data.data)) {
      return parsed.data.data.map((p) => ({
        cid: p.cid,
        page: p.page,
        part: p.part || '',
        duration: p.duration || 0,
      }));
    }
    if (res && typeof res === 'object' && Array.isArray((res as { data?: unknown[] }).data)) {
      return (res as { data: VideoPageItem[] }).data;
    }
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    logger.warn('API', `获取分 P 列表失败: ${msg}`);
  }
  return [];
}

export async function fetchAiSummary(bvid: string, cid: number): Promise<string | undefined> {
  try {
    const res = await requestJson<unknown>(
      `https://api.bilibili.com/x/web-interface/view/conclusion/get?bvid=${bvid}&cid=${cid}`
    );
    const parsed = BiliAiSummaryResponseSchema.safeParse(res);
    if (parsed.success && parsed.data.code === 0 && parsed.data.data?.model_result?.summary) {
      const modelResult = parsed.data.data.model_result;
      let md = `### 视频 AI 提炼总结\n\n${modelResult.summary}\n\n`;
      if (modelResult.outline && modelResult.outline.length > 0) {
        md += `#### 章节大纲\n`;
        modelResult.outline.forEach((item) => {
          const parts = item.part_outline?.map((p) => p.content).filter(Boolean).join('; ') || '';
          md += `- **${item.title}** (${item.timestamp}): ${parts}\n`;
        });
      }
      return md;
    }
  } catch {}
  return undefined;
}

/**
 * 智能探测与获取合集 (Season / Series) 数据
 * 具有多层高健壮性防线，不受 BewlyBewly 等前端插件修改 DOM 的影响：
 * 1. window.__INITIAL_STATE__.videoData.ugc_season（页面直出全局变量，防线级别最高）
 * 2. 页面中合集跳转链接 (href 匹配 /collectiondetail?sid= 或 /lists/{sid}?type=season)
 * 3. 当前 URL 匹配 (若直接处于 space 列表页)
 * 4. DOM 泛选择器兜底 (.video-pod__list)
 */
export async function fetchUgcSeasonData(_currentBvid?: string): Promise<UgcSeasonData | undefined> {
  const win = getBiliWindow();
  let seasonId: number | null = null;
  let mid: number | null = null;
  const initialUgcSeason = win.__INITIAL_STATE__?.videoData?.ugc_season;

  // 1. 从 __INITIAL_STATE__ 中提取
  if (initialUgcSeason?.id) {
    seasonId = Number(initialUgcSeason.id);
    mid = Number(initialUgcSeason.mid || win.__INITIAL_STATE__?.videoData?.owner?.mid);
  }

  // 2. 从页面 DOM 链接提取 (即使 class 被 BewlyBewly 等插件修改，通过 href 关键路径即可精准抓取)
  if (!seasonId) {
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="lists/"], a[href*="collectiondetail"]'));
    for (const a of links) {
      const href = a.href || '';
      const listMatch = href.match(/space\.bilibili\.com\/(\d+)\/lists\/(\d+)/);
      if (listMatch && listMatch[1] && listMatch[2]) {
        mid = Number(listMatch[1]);
        seasonId = Number(listMatch[2]);
        break;
      }
      const sidMatch = href.match(/sid=(\d+)/);
      if (sidMatch && sidMatch[1]) {
        seasonId = Number(sidMatch[1]);
        const midMatch = href.match(/mid=(\d+)/);
        if (midMatch && midMatch[1]) mid = Number(midMatch[1]);
        break;
      }
    }
  }

  // 3. 从当前 URL 提取
  if (!seasonId) {
    const listMatch = location.href.match(/space\.bilibili\.com\/(\d+)\/lists\/(\d+)/);
    if (listMatch && listMatch[1] && listMatch[2]) {
      mid = Number(listMatch[1]);
      seasonId = Number(listMatch[2]);
    }
  }

  // 4. 若成功获得了 seasonId 与 mid，调用 B 站官方合集接口（一次性拉取全部集数，突破 DOM 虚拟列表限制）
  if (seasonId && mid) {
    try {
      const url = `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${seasonId}&page_num=1&page_size=100`;
      const rawRes = await requestJson<unknown>(url);
      const parsed = BiliSeasonArchivesResponseSchema.safeParse(rawRes);
      if (parsed.success && parsed.data.code === 0 && parsed.data.data) {
        const archives = parsed.data.data.archives || [];
        const meta = parsed.data.data.meta;
        const episodes: SeasonEpisodeItem[] = archives.map((item, idx) => ({
          id: item.aid || idx + 1,
          bvid: item.bvid,
          cid: item.cid ?? undefined,
          title: item.title || '',
          cover: item.pic ?? undefined,
          duration: item.duration ?? undefined,
          pageIndex: idx + 1,
        }));

        logger.info('API', `成功通过官方接口解析合集: ${meta?.name || '合集'} (共 ${episodes.length} 集)`);
        return {
          id: seasonId,
          mid,
          title: meta?.name || initialUgcSeason?.title || '合集视频',
          cover: meta?.cover || initialUgcSeason?.cover,
          epCount: meta?.total || episodes.length,
          episodes,
        };
      }
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      logger.warn('API', `合集 API 请求失败: ${msg}，尝试使用首屏数据兜底`);
    }
  }

  // 5. 若 API 失败或无法获取 mid，但 initialUgcSeason 中已有 sections[0].episodes，直接解析
  const firstSection = initialUgcSeason?.sections?.[0];
  if (firstSection?.episodes && firstSection.episodes.length > 0) {
    const eps = firstSection.episodes;
    const episodes: SeasonEpisodeItem[] = eps.map((item, idx) => ({
      id: item.id || idx + 1,
      bvid: item.bvid,
      cid: item.cid,
      title: item.title,
      cover: item.arc?.pic,
      duration: item.arc?.duration,
      pageIndex: idx + 1,
    }));
    return {
      id: Number(initialUgcSeason?.id || 0),
      mid: Number(initialUgcSeason?.mid || 0),
      title: initialUgcSeason?.title || '合集视频',
      cover: initialUgcSeason?.cover,
      epCount: episodes.length,
      episodes,
    };
  }

  // 6. 最终 DOM 兜底：从右侧 .video-pod__list 中提取当前合集
  const podItems = Array.from(document.querySelectorAll('.video-pod__list .video-pod__item[data-key^="BV"]'));
  if (podItems.length > 0) {
    const episodes: SeasonEpisodeItem[] = podItems.map((item, idx) => {
      const bvid = item.getAttribute('data-key') || '';
      const titleEl = item.querySelector('.title-txt') || item.querySelector('.title');
      const title = (titleEl as HTMLElement)?.innerText?.trim() || `第 ${idx + 1} 集`;
      return {
        id: idx + 1,
        bvid,
        title,
        pageIndex: idx + 1,
      };
    });

    const headerTitle = document.querySelector('.video-pod__header .title-txt')?.textContent?.trim();
    return {
      id: seasonId || 0,
      mid: mid || 0,
      title: headerTitle || '合集列表',
      epCount: episodes.length,
      episodes,
    };
  }

  return undefined;
}

/**
 * 高性能轻量级音视频播放流解析器 (专用于多分 P / 合集等批量流式投递)
 * 仅请求 /x/player/playurl 单一必要接口，剔除字幕、AI 大纲、合集元数据等无关并发开销
 */
export async function fetchMediaPlayStreams(
  cid: number,
  bvid: string
): Promise<{ videos: VideoStreamItem[]; audios: AudioStreamItem[]; duration: number } | null> {
  let dashData: BiliDashData | undefined;
  let totalDuration = 0;

  try {
    const api = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=120&fnval=4048&fourk=1&otype=json`;
    const res = await requestJson<unknown>(api);
    const parsed = BiliPlayUrlResponseSchema.safeParse(res);
    if (parsed.success) {
      const playUrlData = parsed.data.data || parsed.data.result;
      dashData = (playUrlData?.dash as BiliDashData | undefined) || undefined;
      totalDuration = Number(playUrlData?.duration || playUrlData?.dash?.duration || 0);
    } else if (res && typeof res === 'object') {
      const rawRes = res as {
        data?: { dash?: BiliDashData; duration?: number };
        result?: { dash?: BiliDashData; duration?: number };
      };
      const playUrlData = rawRes.data || rawRes.result;
      if (playUrlData?.dash) {
        dashData = playUrlData.dash;
        totalDuration = Number(playUrlData.duration || playUrlData.dash.duration || 0);
      }
    }
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    logger.warn('API', `[${bvid}/${cid}] 请求 DASH 播放流失败: ${msg}`);
  }

  // DOM 兜底
  if (!dashData) {
    const win = getBiliWindow();
    if (win.__playinfo__?.data?.dash) {
      dashData = win.__playinfo__.data.dash;
      totalDuration = Number(win.__playinfo__.data.duration || dashData?.duration || 0);
    } else {
      for (const script of Array.from(document.scripts)) {
        const text = script.textContent || '';
        if (text.includes('window.__playinfo__=')) {
          const match = text.match(/window\.__playinfo__\s*=\s*(\{.*?\});/);
          if (match && match[1]) {
            try {
              const parsed = JSON.parse(match[1]) as { data?: { dash?: BiliDashData; duration?: number } };
              dashData = parsed?.data?.dash;
              totalDuration = Number(parsed?.data?.duration || dashData?.duration || 0);
              break;
            } catch {}
          }
        }
      }
    }
  }

  if (!dashData) return null;

  const duration = totalDuration || Number(dashData?.duration || 0);

  // 解析视频流
  const rawVideos: BiliDashVideoItem[] = (dashData?.video as BiliDashVideoItem[]) || [];
  const videos: VideoStreamItem[] = [];
  const seenVideoIds = new Set<string>();

  for (const v of rawVideos) {
    if (!v) continue;
    const codec = (v.codecs || '').toLowerCase();
    const codecName: 'AVC' | 'HEVC' | 'AV1' = codec.includes('avc') ? 'AVC' : codec.includes('hev') ? 'HEVC' : 'AV1';
    const numId = Number(v.id);
    const key = `${numId}_${codecName}`;
    if (seenVideoIds.has(key)) continue;
    seenVideoIds.add(key);

    const bandwidth = Number(v.bandwidth || 0);
    const sizeMB = duration ? (((bandwidth) * duration) / 8 / 1024 / 1024).toFixed(1) : '0';
    const primaryUrl = v.baseUrl || v.base_url || '';
    const backupUrl = (v.backupUrl || v.backup_url || undefined) ?? undefined;

    videos.push({
      id: numId,
      qualityName: QUALITY_MAP[numId] || `${numId}P`,
      codecName,
      codec: v.codecs || '',
      bandwidth,
      sizeMB,
      baseUrl: primaryUrl,
      backupUrl,
      width: Number(v.width || 0),
      height: Number(v.height || 0),
      frameRate: String(v.frameRate || v.frame_rate || ''),
    });
  }

  // 解析音频流
  const rawAudios: BiliDashAudioItem[] = [
    ...(dashData?.dolby?.audio || []),
    ...(dashData?.flac?.audio ? [dashData.flac.audio] : []),
    ...(dashData?.audio || []),
  ].filter(Boolean) as BiliDashAudioItem[];
  const audios: AudioStreamItem[] = [];

  rawAudios.forEach((a, index) => {
    if (!a) return;
    const numId = Number(a.id);
    let name = `音频轨 ${index + 1}`;
    let qualityDesc = '标准音质';
    if (numId === 30280) {
      name = '320K 极高音质';
      qualityDesc = '320Kbps';
    } else if (numId === 30232) {
      name = '132K 高音质';
      qualityDesc = '132Kbps';
    } else if (numId === 30216) {
      name = '64K 基础音质';
      qualityDesc = '64Kbps';
    } else if (a.codecs?.toLowerCase().includes('flac')) {
      name = 'Hi-Res 无损音频';
      qualityDesc = 'FLAC 无损';
    } else if (numId === 30250) {
      name = '杜比全景声';
      qualityDesc = 'Dolby Atmos';
    }

    const bandwidth = Number(a.bandwidth || 0);
    const sizeMB = duration ? (((bandwidth) * duration) / 8 / 1024 / 1024).toFixed(1) : '0';
    audios.push({
      id: numId,
      name,
      qualityDesc,
      codec: a.codecs || 'mp4a.40.2',
      bandwidth,
      sizeMB,
      baseUrl: a.baseUrl || a.base_url || '',
      backupUrl: (a.backupUrl || a.backup_url || undefined) ?? undefined,
    });
  });

  return { videos, audios, duration };
}

export async function fetchCurrentMediaData(targetCid?: number, customBvid?: string): Promise<MediaResourceData | null> {
  const bvid = customBvid || getBvidFromUrl();
  if (!bvid) return null;

  const pages = await fetchVideoPages(bvid);
  const currentP = new URLSearchParams(location.search).get('p');
  const pageIndex = currentP ? parseInt(currentP, 10) - 1 : 0;
  const cid = targetCid || pages[pageIndex]?.cid || pages[0]?.cid;

  if (!cid) return null;

  const baseTitle = getVideoTitle();
  const cover = getVideoCover();

  // 若存在多分 P 剧集，精准拼接分 P 标题与序号，防止多 P 下载时文件名相同产生冲突
  let title = baseTitle;
  const currentPage = pages.find((p) => p.cid === cid) || pages[pageIndex] || pages[0];
  if (pages.length > 1 && currentPage) {
    const partSuffix = currentPage.part
      ? `_P${currentPage.page}_${currentPage.part.replace(/[\\/:*?"<>|]/g, '_').trim()}`
      : `_P${currentPage.page}`;
    title = `${baseTitle}${partSuffix}`;
  }

  // 1. 请求 DASH 音视频流
  const streams = await fetchMediaPlayStreams(cid, bvid);
  const videos = streams?.videos || [];
  const audios = streams?.audios || [];
  const duration = streams?.duration || 0;

  // 2. 获取官方双语字幕 (采用 WBI 签名请求 /x/player/wbi/v2)
  const subtitles: SubtitleItem[] = [];
  try {
    const signedQuery = await signWbiQuery({ bvid, cid });
    const rawSubRes = await requestJson<unknown>(`https://api.bilibili.com/x/player/wbi/v2?${signedQuery}`);
    const parsed = BiliPlayerResponseSchema.safeParse(rawSubRes);
    const rawList: BiliSubtitleItem[] =
      parsed.success
        ? parsed.data.data?.subtitle?.subtitles || parsed.data.data?.subtitle?.list || []
        : [];

    for (const sub of rawList) {
      const subUrl = sub.subtitle_url || sub.url;
      if (subUrl) {
        subtitles.push({
          id: Number(sub.id) || Number(sub.id_str) || Math.random(),
          lan: sub.lan || sub.lang || 'zh-CN',
          lan_doc: sub.lan_doc || sub.lang_doc || sub.lan || '官方字幕',
          subtitle_url: subUrl,
        });
      }
    }
  } catch (wbiErr: unknown) {
    const msg = getErrorMessage(wbiErr);
    logger.warn('API', 'WBI 播放器信息请求失败，尝试降级请求', { error: msg });
  }

  // 若 WBI 未能获取且 subtitles 仍为空，尝试旧版 player/v2 兼容
  if (subtitles.length === 0) {
    try {
      const fallbackRes = await requestJson<unknown>(`https://api.bilibili.com/x/player/v2?bvid=${bvid}&cid=${cid}`);
      const parsedFallback = BiliPlayerResponseSchema.safeParse(fallbackRes);
      const fallbackList: BiliSubtitleItem[] =
        parsedFallback.success
          ? parsedFallback.data.data?.subtitle?.subtitles || parsedFallback.data.data?.subtitle?.list || []
          : [];

      for (const sub of fallbackList) {
        const subUrl = sub.subtitle_url || sub.url;
        if (subUrl) {
          subtitles.push({
            id: Number(sub.id) || Number(sub.id_str) || Math.random(),
            lan: sub.lan || sub.lang || 'zh-CN',
            lan_doc: sub.lan_doc || sub.lang_doc || sub.lan || '官方字幕',
            subtitle_url: subUrl,
          });
        }
      }
    } catch {}
  }

  // 6. AI 总结
  const aiSummary = await fetchAiSummary(bvid, cid);

  // 7. 智能探测合集/系列 (Season/Series)
  const ugcSeason = await fetchUgcSeasonData(bvid);

  logger.success('API', `成功解析媒体资源: ${title}`, {
    bvid,
    cid,
    videos: videos.length,
    audios: audios.length,
    subtitles: subtitles.length,
    duration: `${duration}s`,
    hasSeason: Boolean(ugcSeason),
  });

  return {
    bvid,
    cid,
    title,
    cover,
    duration,
    videos,
    audios,
    subtitles,
    pages,
    aiSummaryMarkdown: aiSummary,
    ugcSeason,
  };
}
