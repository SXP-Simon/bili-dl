import { requestJson } from '../api/http';
import { logger } from '../utils/logger';
import { BiliSubtitleFileSchema, type BiliSubtitleBodyItem } from '../types/schemas';

export interface BiliSubtitleBody {
  from: number;
  to: number;
  location?: number;
  content?: string;
  text?: string;
  words?: string;
}

export const formatSrtTime = (seconds: number): string => {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = (totalMs % 1000).toString().padStart(3, '0');
  const totalSec = Math.floor(totalMs / 1000);
  const s = (totalSec % 60).toString().padStart(2, '0');
  const m = (Math.floor(totalSec / 60) % 60).toString().padStart(2, '0');
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  return `${h}:${m}:${s},${ms}`;
};

export function convertSubtitleJsonToSrt(data: unknown): string {
  let rawList: BiliSubtitleBodyItem[] = [];

  const parsed = BiliSubtitleFileSchema.safeParse(data);
  if (parsed.success) {
    if (Array.isArray(parsed.data)) {
      rawList = parsed.data;
    } else {
      rawList = parsed.data.body || parsed.data.list || parsed.data.lines || [];
    }
  }

  let srt = '';
  let validIndex = 1;
  rawList.forEach((item) => {
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
 * 将 B 站官方 JSON 双语字幕转换为标准 SRT 格式
 */
export async function fetchSubtitleSrt(subtitleUrl: string, traceId?: string): Promise<Blob> {
  const finalUrl = subtitleUrl.startsWith('//') ? `https:${subtitleUrl}` : subtitleUrl;
  logger.info('Subtitle', `开始请求外挂字幕源: ${finalUrl.slice(0, 70)}...`, null, traceId);
  const data = await requestJson<unknown>(finalUrl);

  const srt = convertSubtitleJsonToSrt(data);
  const lineCount = (srt.match(/\n\n/g) || []).length;
  logger.info('Subtitle', `成功获取并封装 SRT 字幕，有效字幕行数: ${lineCount}...`, null, traceId);

  // 使用 application/x-subrip 专有字幕 MIME 并降级支持 octet-stream，避免浏览器嗅探为 text/plain 强行追加 .txt
  const blob = new Blob([srt], { type: 'application/x-subrip;charset=utf-8' });
  logger.success('Subtitle', `SRT 字幕生成完成: 共 ${lineCount} 行 (${(blob.size / 1024).toFixed(1)} KB)`, null, traceId);
  return blob;
}
