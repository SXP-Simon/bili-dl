/**
 * 多分 P 剧集全量字幕一键批量探测、格式转换与 ZIP 文件夹打包下载模块
 */

import { requestJson } from '../api/http';
import { signWbiQuery } from '../utils/wbi';
import { createZipArchive, type ZipFileInput } from '../utils/zip';
import { saveBlobAsFile } from './downloader';
import { logger } from '../utils/logger';
import type { VideoPageItem } from '../types';

export interface BatchSubtitleProgress {
  current: number;
  total: number;
  found: number;
  message: string;
}

const formatSrtTime = (seconds: number) => {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = (totalMs % 1000).toString().padStart(3, '0');
  const totalSec = Math.floor(totalMs / 1000);
  const s = (totalSec % 60).toString().padStart(2, '0');
  const m = (Math.floor(totalSec / 60) % 60).toString().padStart(2, '0');
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  return `${h}:${m}:${s},${ms}`;
};

function convertJsonToSrt(rawJson: any): string {
  const rawList = Array.isArray(rawJson)
    ? rawJson
    : Array.isArray(rawJson?.body)
    ? rawJson.body
    : Array.isArray(rawJson?.list)
    ? rawJson.list
    : Array.isArray(rawJson?.lines)
    ? rawJson.lines
    : [];

  let srt = '';
  let validIndex = 1;

  rawList.forEach((item: any) => {
    const from = typeof item.from === 'number' ? item.from : parseFloat(item.from) || 0;
    const to = typeof item.to === 'number' ? item.to : parseFloat(item.to) || (from + 2);
    const content = (item.content || item.text || item.words || '').trim();
    if (content) {
      srt += `${validIndex}\n`;
      srt += `${formatSrtTime(from)} --> ${formatSrtTime(to)}\n`;
      srt += `${content}\n\n`;
      validIndex++;
    }
  });

  return srt;
}

/**
 * 一键探测所有分 P 视频存在的字幕，并按命名规范打包到以视频标题为文件夹的 ZIP 压缩包中下载
 */
export async function batchDetectAndDownloadSubtitles(
  bvid: string,
  rawTitle: string,
  pages: VideoPageItem[],
  onProgress?: (progress: BatchSubtitleProgress) => void,
  traceId = '全集字幕打包',
  signal?: AbortSignal
): Promise<{ total: number; found: number; blob: Blob; fileName: string }> {
  const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_').trim();
  const folderName = cleanTitle;
  const total = pages.length;
  const zipFiles: ZipFileInput[] = [];

  logger.info(
    'BatchSubtitle',
    `启动全量分 P 字幕批量探测与打包任务: 共 ${total} 集`,
    { bvid, totalEpisodes: total },
    traceId
  );

  onProgress?.({
    current: 0,
    total,
    found: 0,
    message: `开始批量探测全集字幕 (共 ${total} 集)...`,
  });

  // 控制探测并发度为 3，兼顾极速与 API 请求频率安全
  const CONCURRENCY = 3;
  let processedCount = 0;
  let foundCount = 0;

  for (let i = 0; i < total; i += CONCURRENCY) {
    if (signal?.aborted) {
      throw new DOMException('已取消全集字幕打包任务', 'AbortError');
    }

    const batch = pages.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (page) => {
        if (signal?.aborted) return;
        const pageLabel = `P${String(page.page).padStart(2, '0')}`;
        const partTitle = page.part ? page.part.replace(/[\\/:*?"<>|]/g, '_').trim() : `第${page.page}集`;

        try {
          // 1. 发起 WBI 鉴权请求探测该分 P 播放器信息
          const signedQuery = await signWbiQuery({ bvid, cid: page.cid });
          const subRes = await requestJson<any>(`https://api.bilibili.com/x/player/wbi/v2?${signedQuery}`);
          const rawSubList = subRes?.data?.subtitle?.subtitles || subRes?.data?.subtitle?.list || [];

          if (Array.isArray(rawSubList) && rawSubList.length > 0) {
            // 优先选取中文字幕 (AI 生成或官方 CC)，若无则取首个
            const targetSub =
              rawSubList.find((s: any) => (s.lan || s.lang || '').includes('zh')) ||
              rawSubList[0];

            if (targetSub?.subtitle_url || targetSub?.url) {
              const subUrl = targetSub.subtitle_url || targetSub.url;
              const finalSubUrl = subUrl.startsWith('//') ? `https:${subUrl}` : subUrl;
              const subJson = await requestJson<any>(finalSubUrl);
              const srtText = convertJsonToSrt(subJson);

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
        } catch (err: any) {
          logger.warn(
            'BatchSubtitle',
            `[${pageLabel}] 字幕探测未获取到内容: ${err?.message || err}`,
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
    throw new DOMException('已取消全集字幕打包任务', 'AbortError');
  }

  if (zipFiles.length === 0) {
    throw new Error('未能在该视频的任何分 P 中探测到可提取的官方或 AI 字幕');
  }

  onProgress?.({
    current: total,
    total,
    found: foundCount,
    message: `正在封装并生成 ZIP 归档文件夹 (${foundCount} 集)...`,
  });

  // 生成 ZIP 归档包，内部直接包含以视频标题命名的文件夹
  const zipBlob = createZipArchive(zipFiles);
  const outFileName = `${cleanTitle}_全集字幕(${foundCount}P).zip`;

  saveBlobAsFile(zipBlob, outFileName, cleanTitle);

  logger.success(
    'BatchSubtitle',
    `全集字幕打包完成并已触发下载: 共 ${foundCount} 集 (${(zipBlob.size / 1024).toFixed(1)} KB)`,
    { zipFileName: outFileName, count: foundCount },
    traceId
  );

  return {
    total,
    found: foundCount,
    blob: zipBlob,
    fileName: outFileName,
  };
}
