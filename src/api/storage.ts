import { GM_getValue, GM_setValue } from '$';

export interface UserSettings {
  preferredCodec: 'AVC' | 'HEVC' | 'AV1';
  autoMuxMp4: boolean;
  exportDanmakuFormat: 'ass' | 'srt';
  showFloatingButton: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  preferredCodec: 'AVC',
  autoMuxMp4: true,
  exportDanmakuFormat: 'ass',
  showFloatingButton: true,
};

const STORAGE_KEY = 'bili_dl_settings';

export function getSettings(): UserSettings {
  try {
    if (typeof GM_getValue !== 'undefined') {
      const saved = GM_getValue(STORAGE_KEY, '') as string;
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<UserSettings>): void {
  try {
    const current = getSettings();
    const updated = { ...current, ...settings };
    if (typeof GM_setValue !== 'undefined') {
      GM_setValue(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}
