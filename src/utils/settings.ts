/**
 * 下载落盘路径与保存偏好设置管理模块
 */

import { GM_getValue, GM_setValue } from '$';

export interface DownloadSettings {
  subfolder: string; // 下载相对子目录 (默认 'bili-dl')
  autoTitleFolder: boolean; // 是否自动以视频标题建立子目录 (默认 true)
  alwaysAskSaveAs: boolean; // 每次下载是否弹出另存为对话框 (默认 false)
  enableCdnPriority: boolean; // 智能优选国内高速 CDN 节点 (默认 true)
  cdnAutoFailover: boolean; // 慢速自动切换备选 CDN 节点 (默认 true)
  cdnMinSpeedKB: number; // 慢速换源判定阈值 (KB/s，默认 300)
  cdnFailoverDurationSec: number; // 慢速持续判定时间 (秒，默认 8)
  defaultDownloaderEngine: 'internal' | 'external'; // 默认下载引擎 (默认 'internal')
  externalDownloaderId: string; // 选用的外部持久化下载器 ID (默认 'abdm')
  externalDownloaderEnabled: boolean; // 是否启用外部持久化下载器功能 (默认 true)
  abdmPort: number; // AB Download Manager 监听端口 (默认 15151)
  aria2Port: number; // Aria2 监听端口 (默认 6800)
  aria2Secret?: string; // Aria2 RPC 访问密钥
  abdmEnabled?: boolean; // 兼容旧字段
}

export const DEFAULT_SETTINGS: DownloadSettings = {
  subfolder: 'bili-dl',
  autoTitleFolder: true,
  alwaysAskSaveAs: false,
  enableCdnPriority: true,
  cdnAutoFailover: true,
  cdnMinSpeedKB: 300,
  cdnFailoverDurationSec: 8,
  defaultDownloaderEngine: 'internal',
  externalDownloaderId: 'abdm',
  externalDownloaderEnabled: true,
  abdmPort: 15151,
  aria2Port: 6800,
  aria2Secret: '',
  abdmEnabled: true,
};

const SETTINGS_KEY = 'bili_dl_download_settings';

export function resetDownloadSettings(): DownloadSettings {
  saveDownloadSettings(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

export function getDownloadSettings(): DownloadSettings {
  try {
    let parsed: Partial<DownloadSettings> | null = null;
    if (typeof GM_getValue !== 'undefined') {
      const saved = (GM_getValue as (key: string) => string | undefined)(SETTINGS_KEY);
      if (saved) parsed = JSON.parse(saved);
    } else {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) parsed = JSON.parse(saved);
    }
    if (parsed) {
      if (parsed.abdmEnabled !== undefined && parsed.externalDownloaderEnabled === undefined) {
        parsed.externalDownloaderEnabled = parsed.abdmEnabled;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveDownloadSettings(settings: DownloadSettings): void {
  const jsonStr = JSON.stringify(settings);
  try {
    if (typeof GM_setValue !== 'undefined') {
      GM_setValue(SETTINGS_KEY, jsonStr);
    }
  } catch {}
  try {
    localStorage.setItem(SETTINGS_KEY, jsonStr);
  } catch {}
}

/**
 * 解析并生成最终文件在下载器中的相对路径
 */
export function resolveDownloadRelativePath(filename: string, videoTitle?: string): string {
  const settings = getDownloadSettings();
  const pathParts: string[] = [];

  const cleanSub = settings.subfolder.trim().replace(/^[/\\]+|[/\\]+$/g, '');
  if (cleanSub) {
    pathParts.push(cleanSub);
  }

  if (settings.autoTitleFolder && videoTitle) {
    const cleanTitle = videoTitle.split('_P')[0].replace(/[\\/:*?"<>|]/g, '_').trim();
    if (cleanTitle) {
      pathParts.push(cleanTitle);
    }
  }

  pathParts.push(filename);
  return pathParts.join('/');
}
