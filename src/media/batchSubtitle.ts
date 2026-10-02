/**
 * 多分 P 剧集及合集 (Season) 全量字幕一键批量探测、格式转换与 ZIP 文件夹打包下载模块
 */

import { requestJson } from '../api/http';
import { signWbiQuery } from '../utils/wbi';
import { createZipArchive, type ZipFileInput } from '../utils/zip';
import { saveBlobAsFile } from './downloader';
import { logger } from '../utils/logger';
import { fetchVideoPages } from '../api/bilibili';
import { convertSubtitleJsonToSrt } from './subtitle';
import { BiliPlayerResponseSchema, type BiliSubtitleItem } from '../types/schemas';
import { getErrorMessage } from '../utils/error';
import type { VideoPageItem, SeasonEpisodeItem } from '../types';

export interface BatchSubtitleProgress {
  current: number;
  total: number;
  found: number;
  message: string;
}

/**
 * 一键探测所有分 P 视频存在的字幕，并按命名规范打包到以视频标题为文件夹的 ZIP 压缩包中下载
 */
export async function batchDownloadSubtitles(
  bvid: string,
  videoTitle: string,
  pages: VideoPageItem[],
  onProgress?: (progress: BatchSubtitleProgress) => void,
  traceId?: string,
  signal?: AbortSignal
): Promise<{ zipBlob: Blob; foundCount: number }> {
  if (!pages || pages.length === 0) {
    throw new Error('当前视频未获取到有效分 P 列表');
  }

  const cleanTitle = videoTitle.replace(/[\\/:*?"<>|]/g, '_').trim();
  const folderName = `${cleanTitle}_全集字幕`;
  const total = pages.length;
  let processedCount = 0;
  let foundCount = 0;

  const zipFiles: ZipFileInput[] = [];

  logger.info(
    'BatchSubtitle',
    `开始批量检索分 P 字幕 (共 ${total} 集)...`,
    { bvid, total },
    traceId
  );

  onProgress?.({
    current: 0,
    total,
    found: 0,
    message: `正在探测分 P 字幕 (0/${total})...`,
  });

  // 限制同时并发检索数，避免频繁触发 B 站风控 WBI 限制
  const BATCH_SIZE = 3;

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;

    const batch = pages.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (page) => {
        if (signal?.aborted) return;
        const pageLabel = `P${String(page.page).padStart(2, '0')}`;
        const partTitle = page.part ? page.part.replace(/[\\/:*?"<>|]/g, '_').trim() : `第${page.page}集`;

        try {
          const signedQuery = await signWbiQuery({ bvid, cid: page.cid });
          const rawSubRes = await requestJson<unknown>(`https://api.bilibili.com/x/player/wbi/v2?${signedQuery}`);
          const parsed = BiliPlayerResponseSchema.safeParse(rawSubRes);
          const rawSubList: BiliSubtitleItem[] =
            parsed.success
              ? parsed.data.data?.subtitle?.subtitles || parsed.data.data?.subtitle?.list || []
              : [];

          if (rawSubList.length > 0) {
            const targetSub =
              rawSubList.find((s) => (s.lan || s.lang || '').includes('zh')) ||
              rawSubList[0];

            if (targetSub?.subtitle_url || targetSub?.url) {
              const subUrl = targetSub.subtitle_url || targetSub.url || '';
              const finalSubUrl = subUrl.startsWith('//') ? `https:${subUrl}` : subUrl;
              const subJson = await requestJson<unknown>(finalSubUrl);
              const srtText = convertSubtitleJsonToSrt(subJson);

              if (srtText.trim()) {
                const lanDoc = targetSub.lan_doc || targetSub.lang_doc || targetSub.lan || '中文';
                const srtFileName = `${folderName}/${pageLabel}_${partTitle}-${lanDoc}字幕.srt`;

                zipFiles.push({
                  name: srtFileName,
                  data: srtText,
                });
                foundCount++;
                logger.info(
                  'BatchSubtitle',
                  `[${pageLabel}] 成功提取字幕: ${partTitle} (${lanDoc})`,
                  null,
                  traceId
                );
              }
            }
          }
        } catch (err: unknown) {
          const msg = getErrorMessage(err);
          logger.warn(
            'BatchSubtitle',
            `[${pageLabel}] 字幕探测未获取到内容: ${msg}`,
            null,
            traceId
          );
        } finally {
          processedCount++;
          onProgress?.({
            current: processedCount,
            total,
            found: foundCount,
            message: `正在探测字幕: ${processedCount}/${total} 集 (已获取 ${foundCount} 集)...`,
          });
        }
      })
    );
  }

  if (signal?.aborted) {
    throw new DOMException('Download aborted by user', 'AbortError');
  }

  if (zipFiles.length === 0) {
    throw new Error('检索完成，该视频所有分 P 均未发现任何官方/外挂字幕');
  }

  onProgress?.({
    current: total,
    total,
    found: foundCount,
    message: `正在打包 ${zipFiles.length} 份字幕至 ZIP 压缩包...`,
  });

  logger.info('BatchSubtitle', `打包生成 ZIP 压缩包: 共 ${zipFiles.length} 个文件`, null, traceId);
  const zipBlob = createZipArchive(zipFiles);

  const zipFileName = `${cleanTitle}_全集字幕.zip`;
  await saveBlobAsFile(zipBlob, zipFileName, videoTitle);

  logger.success(
    'BatchSubtitle',
    `批量字幕导出成功: 共打包 ${zipFiles.length} 个字幕文件 (${(zipBlob.size / 1024).toFixed(1)} KB)`,
    null,
    traceId
  );

  return { zipBlob, foundCount };
}

/**
 * 合集 (Season / Series) 全量字幕一键批量探测、格式转换与 ZIP 文件夹打包下载
 */
export async function batchDownloadSeasonSubtitles(
  seasonTitle: string,
  episodes: SeasonEpisodeItem[],
  onProgress?: (progress: BatchSubtitleProgress) => void,
  traceId?: string,
  signal?: AbortSignal
): Promise<{ zipBlob: Blob; foundCount: number }> {
  if (!episodes || episodes.length === 0) {
    throw new Error('合集列表为空');
  }

  const cleanTitle = seasonTitle.replace(/[\\/:*?"<>|]/g, '_').trim();
  const folderName = `${cleanTitle}_合集字幕`;
  const total = episodes.length;
  let processedCount = 0;
  let foundCount = 0;

  const zipFiles: ZipFileInput[] = [];

  logger.info(
    'BatchSubtitle',
    `开始批量检索合集字幕 (共 ${total} 集)...`,
    { seasonTitle, total },
    traceId
  );

  onProgress?.({
    current: 0,
    total,
    found: 0,
    message: `正在探测合集字幕 (0/${total})...`,
  });

  const CONCURRENCY = 3;

  for (let i = 0; i < episodes.length; i += CONCURRENCY) {
    if (signal?.aborted) break;

    const batch = episodes.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (ep) => {
        if (signal?.aborted) return;
        const pageLabel = `第${String(ep.pageIndex).padStart(2, '0')}集`;
        const epTitle = ep.title.replace(/[\\/:*?"<>|]/g, '_').trim();

        try {
          let targetCid = ep.cid;
          if (!targetCid) {
            const pages = await fetchVideoPages(ep.bvid);
            targetCid = pages[0]?.cid;
          }

          if (targetCid) {
            const signedQuery = await signWbiQuery({ bvid: ep.bvid, cid: targetCid });
            const rawSubRes = await requestJson<unknown>(`https://api.bilibili.com/x/player/wbi/v2?${signedQuery}`);
            const parsed = BiliPlayerResponseSchema.safeParse(rawSubRes);
            const rawSubList: BiliSubtitleItem[] =
              parsed.success
                ? parsed.data.data?.subtitle?.subtitles || parsed.data.data?.subtitle?.list || []
                : [];

            if (rawSubList.length > 0) {
              const targetSub =
                rawSubList.find((s) => (s.lan || s.lang || '').includes('zh')) ||
                rawSubList[0];

              if (targetSub?.subtitle_url || targetSub?.url) {
                const subUrl = targetSub.subtitle_url || targetSub.url || '';
                const finalSubUrl = subUrl.startsWith('//') ? `https:${subUrl}` : subUrl;
                const subJson = await requestJson<unknown>(finalSubUrl);
                const srtText = convertSubtitleJsonToSrt(subJson);

                if (srtText.trim()) {
                  const lanDoc = targetSub.lan_doc || targetSub.lang_doc || targetSub.lan || '中文';
                  const srtFileName = `${folderName}/${pageLabel}_${epTitle}-${lanDoc}字幕.srt`;

                  zipFiles.push({
                    name: srtFileName,
                    data: srtText,
                  });
                  foundCount++;
                  logger.info(
                    'BatchSubtitle',
                    `[${pageLabel}] 成功提取字幕: ${epTitle} (${lanDoc})`,
                    null,
                    traceId
                  );
                }
              }
            }
          }
        } catch (err: unknown) {
          const msg = getErrorMessage(err);
          logger.warn(
            'BatchSubtitle',
            `[${pageLabel}] 字幕探测未获取到内容: ${msg}`,
            null,
            traceId
          );
        } finally {
          processedCount++;
          onProgress?.({
            current: processedCount,
            total,
            found: foundCount,
            message: `正在探测字幕: ${processedCount}/${total} 集 (已获取 ${foundCount} 集)...`,
          });
        }
      })
    );
  }

  if (signal?.aborted) {
    throw new DOMException('Download aborted by user', 'AbortError');
  }

  if (zipFiles.length === 0) {
    throw new Error('检索完成，该合集所有剧集均未发现任何字幕');
  }

  onProgress?.({
    current: total,
    total,
    found: foundCount,
    message: `正在打包 ${zipFiles.length} 份字幕至 ZIP 压缩包...`,
  });

  logger.info('BatchSubtitle', `打包生成合集 ZIP 压缩包: 共 ${zipFiles.length} 个文件`, null, traceId);
  const zipBlob = createZipArchive(zipFiles);

  const zipFileName = `${cleanTitle}_全套字幕.zip`;
  await saveBlobAsFile(zipBlob, zipFileName, seasonTitle);

  logger.success(
    'BatchSubtitle',
    `合集字幕导出成功: 共打包 ${zipFiles.length} 个字幕文件 (${(zipBlob.size / 1024).toFixed(1)} KB)`,
    null,
    traceId
  );

  return { zipBlob, foundCount };
}

export const batchDetectAndDownloadSubtitles = batchDownloadSubtitles;
export const batchDownloadSeasonSubtitlesZip = batchDownloadSeasonSubtitles;
