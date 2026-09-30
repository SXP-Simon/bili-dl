/**
 * 下载落盘路径与保存偏好设置管理模块
 */

import { GM_getValue, GM_setValue } from '$';

export interface DownloadSettings {
  subfolder: string; // 下载相对子目录 (默认 'bili-dl')
  autoTitleFolder: boolean; // 是否自动以视频标题建立子目录 (默认 true)
  alwaysAskSaveAs: boolean; // 每次下载是否弹出另存为对话框 (默认 false)
  useLocalDirHandle: boolean; // 是否启用本地磁盘目录直连写入 (默认 false)
  localDirName?: string; // 已授权的本地目录展示名
  localFullPath?: string; // 用户记录/指定的本地绝对物理路径 (如 D:\Videos\Anime)
}

export const DEFAULT_SETTINGS: DownloadSettings = {
  subfolder: 'bili-dl',
  autoTitleFolder: true,
  alwaysAskSaveAs: false,
  useLocalDirHandle: false,
};

const SETTINGS_KEY = 'bili_dl_download_settings';
const IDB_NAME = 'bili_dl_storage';
const IDB_VERSION = 1;
const IDB_STORE = 'handles';
const IDB_KEY_DIR = 'dir_handle';

// 内存中缓存的本地目录句柄 (File System Access API)
let cachedDirHandle: FileSystemDirectoryHandle | null = null;

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available'));
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandleToIDB(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(handle, IDB_KEY_DIR);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

export async function getDirectoryHandleFromIDB(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY_DIR);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearDirectoryHandleFromIDB(): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(IDB_KEY_DIR);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}
}

// 模块初始化时主动异步预热加载持久化的目录句柄
(async () => {
  try {
    const restored = await getDirectoryHandleFromIDB();
    if (restored) {
      cachedDirHandle = restored;
    }
  } catch {}
})();

export function resetDownloadSettings(): DownloadSettings {
  clearCachedDirectoryHandle();
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
 * 唤起本地磁盘文件夹选择器 (File System Access API)，并持久化到 IndexedDB
 */
export async function pickLocalDirectory(): Promise<{ handle: FileSystemDirectoryHandle; name: string } | null> {
  if (typeof (window as any).showDirectoryPicker !== 'function') {
    throw new Error('当前浏览器不支持 File System Access API 目录选择功能');
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });
    cachedDirHandle = handle;
    await saveDirectoryHandleToIDB(handle);
    return { handle, name: handle.name };
  } catch (err: any) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export function getCachedDirectoryHandle(): FileSystemDirectoryHandle | null {
  return cachedDirHandle;
}

/**
 * 获取或从 IndexedDB 异步恢复本地目录句柄（并在必要时校验/唤起读写权限）
 */
export async function getOrRestoreDirectoryHandle(requestIfPrompt = false): Promise<FileSystemDirectoryHandle | null> {
  if (!cachedDirHandle) {
    cachedDirHandle = await getDirectoryHandleFromIDB();
  }
  if (cachedDirHandle) {
    try {
      const perm = await (cachedDirHandle as any).queryPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') {
        return cachedDirHandle;
      }
      if (perm === 'prompt' && requestIfPrompt) {
        const reqPerm = await (cachedDirHandle as any).requestPermission?.({ mode: 'readwrite' });
        if (reqPerm === 'granted') return cachedDirHandle;
      }
      return cachedDirHandle;
    } catch {
      return cachedDirHandle;
    }
  }
  return null;
}

export function clearCachedDirectoryHandle(): void {
  cachedDirHandle = null;
  clearDirectoryHandleFromIDB();
}

/**
 * 解析并生成最终文件在下载器或本地磁盘中的相对路径
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
