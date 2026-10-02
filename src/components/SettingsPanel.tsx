import React, { useState } from 'react';
import {
  Folder,
  FolderTree,
  Sliders,
  HardDrive,
  X,
  HelpCircle,
  Sparkles,
  Zap,
  Server,
  Gauge,
  Timer,
} from 'lucide-react';
import {
  getDownloadSettings,
  saveDownloadSettings,
  resetDownloadSettings,
  type DownloadSettings,
} from '../utils/settings';

interface SettingsPanelProps {
  onClose: () => void;
  onShowToast: (content: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onShowToast }) => {
  const [settings, setSettings] = useState<DownloadSettings>(() => getDownloadSettings());

  const updateSetting = <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveDownloadSettings(next);
  };

  const handleResetAll = () => {
    const defaults = resetDownloadSettings();
    setSettings(defaults);
    onShowToast('已恢复全部默认下载设置', 'info');
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
            <p className="text-[10px] text-muted-foreground">自定义文件落盘目录结构与下载偏好</p>
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

      {/* 设置项主体区 (带充足舒适的底部呼吸边距) */}
      <div className="flex-1 overflow-y-auto px-6 py-4 pb-6 space-y-3.5 scrollbar-clean text-xs">
        {/* 1. 默认子目录配置 */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
              <span className="font-semibold text-foreground">下载相对子目录 (Subfolder)</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">基于浏览器默认下载目录</span>
          </div>

          <div className="relative">
            <input
              type="text"
              value={settings.subfolder}
              onChange={(e) => updateSetting('subfolder', e.target.value)}
              placeholder="例如: bili-dl 或 Videos/Bili"
              className="w-full px-3 py-1.5 rounded-xl bg-background border border-border/80 text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
            <HelpCircle className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70 mt-0.5" />
            <span>
              浏览器下载器将自动在系统默认「下载 (Downloads)」目录中创建该子文件夹。按 <kbd className="px-1.5 py-0.5 rounded-md bg-muted text-foreground font-mono text-[10px] font-semibold border border-border/70 shadow-2xs">Ctrl + J</kbd> 在浏览器下载列表中点击「在文件夹中显示」即可直达。
            </span>
          </div>
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

        {/* 4. CDN 智能调度与慢速自愈换源 */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
          {/* CDN 智能节点优选 */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
                <span className="font-semibold text-foreground">国内高速 CDN 节点智能优选</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                优先调度腾讯云 COS、阿里云 OSS、华为云 OBS 等国内骨干专线，海外 Akamai/Fastly 慢速节点自动下沉备选。
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.enableCdnPriority}
              onClick={() => updateSetting('enableCdnPriority', !settings.enableCdnPriority)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.enableCdnPriority ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.enableCdnPriority ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-border/40 my-1" />

          {/* 慢速自动自愈换源 */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
                <span className="font-semibold text-foreground">分片传输慢速自愈换源</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                被动测速（零额外探测防风控）：分片下载中若持续低于设定速率，自动切断并无缝换用下一备用 CDN 节点。
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.cdnAutoFailover}
              onClick={() => updateSetting('cdnAutoFailover', !settings.cdnAutoFailover)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.cdnAutoFailover ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.cdnAutoFailover ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 慢速判定阈值选择 */}
          {settings.cdnAutoFailover && (
            <div className="pt-2 pl-6 space-y-2 border-t border-border/30">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                  <span>换源速率判定阈值</span>
                </div>
                <span className="font-mono font-medium text-foreground">
                  当前: {settings.cdnMinSpeedKB >= 1000 ? `${(settings.cdnMinSpeedKB / 1000).toFixed(0)} MB/s` : `${settings.cdnMinSpeedKB} KB/s`}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[100, 200, 300, 500, 1000].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => updateSetting('cdnMinSpeedKB', speed)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer border ${
                      settings.cdnMinSpeedKB === speed
                        ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                        : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                    }`}
                  >
                    {speed >= 1000 ? `${(speed / 1000).toFixed(0)} MB/s` : `${speed} KB/s`}
                    {speed === 300 && ' (推荐)'}
                  </button>
                ))}
              </div>

              {/* 持续超时触发时长配置 */}
              <div className="pt-2 border-t border-border/30 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Timer className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                    <span>持续低速触发换源时长</span>
                  </div>
                  <span className="font-mono font-medium text-foreground">
                    当前: {settings.cdnFailoverDurationSec} 秒
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[5, 8, 10, 15, 20].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateSetting('cdnFailoverDurationSec', sec)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer border ${
                        settings.cdnFailoverDurationSec === sec
                          ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                          : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                      }`}
                    >
                      {sec} 秒
                      {sec === 8 && ' (推荐)'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部状态提示栏 (提供舒适的留白与重置控制) */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-muted/30 border-t border-border/70 text-[11px]">
        <span className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span>配置实时保存并自动生效</span>
        </span>
        <button
          onClick={handleResetAll}
          className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer transition-colors"
        >
          恢复默认设置
        </button>
      </div>
    </div>
  );
};
