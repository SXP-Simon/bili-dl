/**
 * 下载落盘路径与保存偏好设置管理模块
 */

import { GM_getValue, GM_setValue } from '$';

export interface DownloadSettings {
  subfolder: string; // 下载相对子目录 (默认 'bili-dl')
  autoTitleFolder: boolean; // 是否自动以视频标题建立子目录 (默认 true)
  alwaysAskSaveAs: boolean; // 每次下载是否弹出另存为对话框 (默认 false)
}

export const DEFAULT_SETTINGS: DownloadSettings = {
  subfolder: 'bili-dl',
  autoTitleFolder: true,
  alwaysAskSaveAs: false,
};

const SETTINGS_KEY = 'bili_dl_download_settings';

export function resetDownloadSettings(): DownloadSettings {
  saveDownloadSettings(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

export function getDownloadSettings(): DownloadSettings {
  try {
    if (typeof GM_getValue !== 'undefined') {
      const saved = (GM_getValue as (key: string) => string | undefined)(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } else {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
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
