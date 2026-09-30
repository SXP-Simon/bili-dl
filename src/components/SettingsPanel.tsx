import React, { useState } from 'react';
import {
  Folder,
  FolderTree,
  Sliders,
  HardDrive,
  Check,
  X,
  HelpCircle,
  FolderCheck,
  RotateCcw,
} from 'lucide-react';
import {
  getDownloadSettings,
  saveDownloadSettings,
  pickLocalDirectory,
  getCachedDirectoryHandle,
  clearCachedDirectoryHandle,
  type DownloadSettings,
} from '../utils/settings';

interface SettingsPanelProps {
  onClose: () => void;
  onShowToast: (content: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onShowToast }) => {
  const [settings, setSettings] = useState<DownloadSettings>(() => getDownloadSettings());
  const [hasDirHandle, setHasDirHandle] = useState<boolean>(() => !!getCachedDirectoryHandle());

  const updateSetting = <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveDownloadSettings(next);
  };

  const handlePickDirectory = async () => {
    try {
      const res = await pickLocalDirectory();
      if (res) {
        const next = {
          ...settings,
          useLocalDirHandle: true,
          localDirName: res.name,
        };
        setSettings(next);
        saveDownloadSettings(next);
        setHasDirHandle(true);
        onShowToast(`已成功授权本地磁盘目录: ${res.name}`, 'success');
      }
    } catch (err: any) {
      onShowToast(`授权目录失败: ${err.message}`, 'error');
    }
  };

  const handleClearDirectory = () => {
    clearCachedDirectoryHandle();
    const next = {
      ...settings,
      useLocalDirHandle: false,
      localDirName: undefined,
    };
    setSettings(next);
    saveDownloadSettings(next);
    setHasDirHandle(false);
    onShowToast('已重置为默认下载器落盘模式', 'info');
  };

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground animate-toast-in select-none">
      {/* 顶部标题栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 bg-muted/40 border-b border-border/70">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/20 text-emerald-800 dark:text-emerald-300 border border-primary/40 shadow-2xs font-bold">
            <Sliders className="w-3.5 h-3.5" strokeWidth={2.4} />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-tight text-foreground">下载落盘路径与偏好设置</h3>
            <p className="text-[10px] text-muted-foreground">自定义文件落盘目录结构与磁盘直连授权</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-all cursor-pointer"
          title="关闭设置"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 设置项主体区 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scrollbar-clean text-xs">
        {/* 1. 默认子目录配置 */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
              <span className="font-semibold text-foreground">下载相对子目录 (Subfolder)</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">基于浏览器默认下载目录</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={settings.subfolder}
                onChange={(e) => updateSetting('subfolder', e.target.value)}
                placeholder="例如: bili-dl 或 Videos/Bili"
                className="w-full px-3 py-1.5 rounded-xl bg-background border border-border/80 text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed flex items-center gap-1">
            <HelpCircle className="w-3 h-3 shrink-0 text-muted-foreground/70" />
            Tampermonkey / 浏览器下载管理器将自动在系统默认下载目录中创建该子文件夹。
          </p>
        </div>

        {/* 2. 自动按视频标题分文件夹 */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
              <span className="font-semibold text-foreground">自动创建视频专属子文件夹</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              开启后在子目录下自动为每个视频/剧集建立以标题命名的独立文件夹，批量下载更整齐。
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.autoTitleFolder}
            onClick={() => updateSetting('autoTitleFolder', !settings.autoTitleFolder)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.autoTitleFolder ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                settings.autoTitleFolder ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 3. 每次下载前弹出保存位置确认 */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
              <span className="font-semibold text-foreground">每次下载前弹出「另存为」确认框</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              开启后每次下载触发系统原生文件选择弹窗，允许手动选择电脑任意磁盘盘符与路径。
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.alwaysAskSaveAs}
            onClick={() => updateSetting('alwaysAskSaveAs', !settings.alwaysAskSaveAs)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.alwaysAskSaveAs ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                settings.alwaysAskSaveAs ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* 4. 本地磁盘文件夹直连 (File System Access API) */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
              <span className="font-semibold text-foreground">指定本地磁盘任意文件夹 (直连模式)</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary/50 text-secondary-foreground border border-secondary/60">
              Chromium 特性
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            直接授权浏览器读写电脑上的指定本地文件夹（如 <code>D:\Videos\Anime</code>），文件将直接落盘写入目标目录，无需经过浏览器下载弹窗。
          </p>

          <div className="flex items-center gap-2 pt-1">
            {hasDirHandle && settings.localDirName ? (
              <div className="flex-1 flex items-center justify-between p-2 rounded-xl bg-card border border-emerald-500/40">
                <div className="flex items-center gap-2 truncate">
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-mono text-xs font-semibold text-foreground truncate">
                    已授权: {settings.localDirName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={handlePickDirectory}
                    className="px-2 py-1 rounded-lg bg-primary/20 text-emerald-950 dark:text-emerald-100 border border-primary/40 text-[11px] font-medium hover:bg-primary/30 transition-colors cursor-pointer"
                  >
                    更换
                  </button>
                  <button
                    onClick={handleClearDirectory}
                    title="重置为默认下载器"
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handlePickDirectory}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary/20 hover:bg-primary text-emerald-950 dark:text-emerald-100 hover:text-primary-foreground border border-primary/40 hover:border-primary font-semibold text-xs transition-all duration-150 active:scale-[0.99] cursor-pointer shadow-2xs"
              >
                <Folder className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span>选择本地磁盘文件夹授权...</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
