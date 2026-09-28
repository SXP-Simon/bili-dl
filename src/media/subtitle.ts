import { requestJson } from '../api/http';

export interface BiliSubtitleBody {
  from: number;
  to: number;
  location: number;
  content: string;
}

/**
 * 将 B 站官方 JSON 双语字幕转换为标准 SRT 格式
 */
export async function fetchSubtitleSrt(subtitleUrl: string): Promise<Blob> {
  const finalUrl = subtitleUrl.startsWith('//') ? `https:${subtitleUrl}` : subtitleUrl;
  const data = await requestJson<{ body: BiliSubtitleBody[] }>(finalUrl);

  let srt = '';
  const formatSrtTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${s},${ms}`;
  };

  (data?.body || []).forEach((item, index) => {
    srt += `${index + 1}\n`;
    srt += `${formatSrtTime(item.from)} --> ${formatSrtTime(item.to)}\n`;
    srt += `${item.content}\n\n`;
  });

  return new Blob([srt], { type: 'text/plain;charset=utf-8' });
}
