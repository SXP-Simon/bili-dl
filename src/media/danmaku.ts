import { requestBuffer } from '../api/http';
import { logger } from '../utils/logger';

/**
 * 将 B 站 XML 弹幕字符串解析为标准 ASS 字幕文本
 */
export function convertDanmakuXmlToAss(xmlText: string, title: string): string {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  const dElements = Array.from(xmlDoc.getElementsByTagName('d'));

  // 生成标准 ASS 头部
  let assContent = `[Script Info]
Title: ${title} - 弹幕
ScriptType: v4.00+
Collisions: Normal
PlayResX: 1920
PlayResY: 1080
Timer: 100.0000

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Danmaku, Microsoft YaHei, 48, &H00FFFFFF, &H00000000, &H00000000, &H00000000, 0, 0, 0, 0, 100, 100, 0, 0, 1, 2, 0, 2, 20, 20, 20, 1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const formatTime = (sec: number) => {
    const totalCs = Math.max(0, Math.round(sec * 100));
    const cs = (totalCs % 100).toString().padStart(2, '0');
    const totalSec = Math.floor(totalCs / 100);
    const s = (totalSec % 60).toString().padStart(2, '0');
    const m = (Math.floor(totalSec / 60) % 60).toString().padStart(2, '0');
    const h = Math.floor(totalSec / 3600);
    return `${h}:${m}:${s}.${cs}`;
  };

  dElements.forEach((el) => {
    const pAttr = el.getAttribute('p');
    if (!pAttr) return;

    const parts = pAttr.split(',');
    const timeStr = parts[0] || '0';
    const colorIntStr = parts[3];
    const startTimeSec = parseFloat(timeStr) || 0;
    const duration = 8.0; // 弹幕滚动显示时长（秒）
    const endTimeSec = startTimeSec + duration;

    const text = el.textContent || '';
    const colorHex = parseInt(colorIntStr || '16777215', 10).toString(16).padStart(6, '0');
    // BGR 转换
    const bgr = colorHex.substring(4, 6) + colorHex.substring(2, 4) + colorHex.substring(0, 2);

    const start = formatTime(startTimeSec);
    const end = formatTime(endTimeSec);

    assContent += `Dialogue: 0,${start},${end},Danmaku,,0,0,0,,{\\c&H${bgr}&}${text}\n`;
  });

  return assContent;
}

/**
 * 将 B 站 XML 格式弹幕转换为标准 ASS 字幕文件
 */
export async function fetchDanmakuAss(cid: number, title: string, traceId?: string): Promise<Blob> {
  logger.info('Danmaku', `开始拉取弹幕流 (CID: ${cid})`, null, traceId);
  const url = `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`;
  const buffer = await requestBuffer(url);
  const decoder = new TextDecoder('utf-8');
  const xmlText = decoder.decode(buffer);

  const assContent = convertDanmakuXmlToAss(xmlText, title);
  const blob = new Blob([assContent], { type: 'text/x-ssa;charset=utf-8' });
  logger.success('Danmaku', `弹幕转换完成: 输出 ASS ${(blob.size / 1024).toFixed(1)} KB`, null, traceId);
  return blob;
}
