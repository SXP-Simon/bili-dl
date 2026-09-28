import { requestBuffer } from '../api/http';

/**
 * 将 B 站 XML 格式弹幕转换为标准 ASS 字幕文件
 */
export async function fetchDanmakuAss(cid: number, title: string): Promise<Blob> {
  const url = `https://api.bilibili.com/x/v1/dm/list.so?oid=${cid}`;
  const buffer = await requestBuffer(url);
  const decoder = new TextDecoder('utf-8');
  const xmlText = decoder.decode(buffer);

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

  dElements.forEach((el) => {
    const pAttr = el.getAttribute('p');
    if (!pAttr) return;

    const [timeStr, , , colorIntStr] = pAttr.split(',');
    const startTimeSec = parseFloat(timeStr);
    const duration = 8.0; // 弹幕滚动显示时长（秒）
    const endTimeSec = startTimeSec + duration;

    const formatTime = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = (sec % 60).toFixed(2);
      return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(5, '0')}`;
    };

    const text = el.textContent || '';
    const colorHex = parseInt(colorIntStr || '16777215', 10).toString(16).padStart(6, '0');
    // BGR 转换
    const bgr = colorHex.substring(4, 6) + colorHex.substring(2, 4) + colorHex.substring(0, 2);

    const start = formatTime(startTimeSec);
    const end = formatTime(endTimeSec);

    assContent += `Dialogue: 0,${start},${end},Danmaku,,0,0,0,,{\\c&H${bgr}&}${text}\n`;
  });

  return new Blob([assContent], { type: 'text/plain;charset=utf-8' });
}
