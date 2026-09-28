import { GM_setClipboard } from '$';
import type { VideoStreamItem, AudioStreamItem } from '../types';

/**
 * 生成 Aria2 / curl 下载命令并写入剪贴板
 */
export function exportAria2Command(
  title: string,
  video: VideoStreamItem,
  audio?: AudioStreamItem
): void {
  const videoFileName = `${title}_${video.qualityName}_${video.codecName}.m4s`;
  let cmd = `# 1. 下载视频轨\naria2c -c -s 16 -x 16 --header="Referer: https://www.bilibili.com/" --header="User-Agent: ${navigator.userAgent}" -o "${videoFileName}" "${video.baseUrl}"\n`;

  if (audio) {
    const audioFileName = `${title}_${audio.name}.m4s`;
    cmd += `\n# 2. 下载音频轨\naria2c -c -s 16 -x 16 --header="Referer: https://www.bilibili.com/" --header="User-Agent: ${navigator.userAgent}" -o "${audioFileName}" "${audio.baseUrl}"\n`;
    cmd += `\n# 3. 本地一键无损混流为 MP4 (需本地安装 ffmpeg)\nffmpeg -i "${videoFileName}" -i "${audioFileName}" -c copy "${title}.mp4"\n`;
  }

  if (typeof GM_setClipboard !== 'undefined') {
    GM_setClipboard(cmd, 'text');
  } else {
    navigator.clipboard.writeText(cmd);
  }
}
