import { requestJson } from '../api/http';
import { logger } from '../utils/logger';

export interface BiliSubtitleBody {
  from: number;
  to: number;
  location: number;
  content: string;
}

/**
 * 将 B 站官方 JSON 双语字幕转换为标准 SRT 格式
 */
export async function fetchSubtitleSrt(subtitleUrl: string, traceId?: string): Promise<Blob> {
  const finalUrl = subtitleUrl.startsWith('//') ? `https:${subtitleUrl}` : subtitleUrl;
  logger.info('Subtitle', `开始请求外挂字幕源: ${finalUrl.slice(0, 70)}...`, null, traceId);
  const data = await requestJson<{ body: BiliSubtitleBody[] }>(finalUrl);

  const list = data?.body || [];
  logger.info('Subtitle', `成功获取 ${list.length} 条字幕文本，正在封装 SRT...`, null, traceId);

  let srt = '';
  const formatSrtTime = (seconds: number) => {
    const totalMs = Math.max(0, Math.round(seconds * 1000));
    const ms = (totalMs % 1000).toString().padStart(3, '0');
    const totalSec = Math.floor(totalMs / 1000);
    const s = (totalSec % 60).toString().padStart(2, '0');
    const m = (Math.floor(totalSec / 60) % 60).toString().padStart(2, '0');
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    return `${h}:${m}:${s},${ms}`;
  };

  list.forEach((item, index) => {
    srt += `${index + 1}\n`;
    srt += `${formatSrtTime(item.from)} --> ${formatSrtTime(item.to)}\n`;
    srt += `${item.content?.trim() || ''}\n\n`;
  });

  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
  logger.success('Subtitle', `SRT 字幕生成完成: 共 ${list.length} 行 (${(blob.size / 1024).toFixed(1)} KB)`, null, traceId);
  return blob;
}
