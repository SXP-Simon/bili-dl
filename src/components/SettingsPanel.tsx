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
  DownloadCloud,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ListOrdered,
  Globe,
  Rocket,
  AlertCircle,
  FolderPen,
  Plug,
  Bot,
  Cpu,
} from 'lucide-react';
import {
  SUPPORTED_WHISPER_MODELS,
  SUPPORTED_LANGUAGES,
  checkWebGpuSupport,
} from '../ai/whisper';
import {
  getDownloadSettings,
  saveDownloadSettings,
  resetDownloadSettings,
  type DownloadSettings,
} from '../utils/settings';
import { externalDownloaderRegistry } from '../downloader';
import { CDN_NODE_RULES, DEFAULT_CDN_ORDER, normalizeCdnOrder } from '../utils/cdn';

interface SettingsPanelProps {
  onClose: () => void;
  onShowToast: (content: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose, onShowToast }) => {
  const [settings, setSettings] = useState<DownloadSettings>(() => getDownloadSettings());
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message: string; ok?: boolean } | null>(null);
  const [webGpuStatus, setWebGpuStatus] = useState<{ supported: boolean; adapterInfo?: string } | null>(null);

  React.useEffect(() => {
    checkWebGpuSupport().then(setWebGpuStatus);
  }, []);

  const registeredDownloaders = externalDownloaderRegistry.getAll();
  const activeDownloader = externalDownloaderRegistry.getActive(settings.externalDownloaderId);

  const updateSetting = <K extends keyof DownloadSettings>(key: K, value: DownloadSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveDownloadSettings(next);
  };

  const handleResetAll = () => {
    const defaults = resetDownloadSettings();
    setSettings(defaults);
    setTestStatus(null);
    onShowToast('已恢复全部默认下载设置', 'info');
  };

  const currentCdnOrder = normalizeCdnOrder(settings.cdnPriorityOrder);

  const handleMoveCdn = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentCdnOrder.length) return;
    const nextOrder = [...currentCdnOrder];
    const [moved] = nextOrder.splice(index, 1);
    if (!moved) return;
    nextOrder.splice(targetIndex, 0, moved);
    updateSetting('cdnPriorityOrder', nextOrder);
  };

  const handleResetCdnOrder = () => {
    updateSetting('cdnPriorityOrder', [...DEFAULT_CDN_ORDER]);
    onShowToast('已恢复 CDN 节点官方默认推荐排序', 'info');
  };

  const handleUpdateActivePort = (newPort: number) => {
    const defaultPort = activeDownloader.defaultPort || 15151;
    const val = Number.isNaN(newPort) ? defaultPort : newPort;
    const nextConfigs = { ...settings.downloadersConfig };
    nextConfigs[activeDownloader.id] = {
      ...nextConfigs[activeDownloader.id],
      port: val,
    };
    const nextSettings: DownloadSettings = {
      ...settings,
      downloadersConfig: nextConfigs,
    };
    if (activeDownloader.id === 'abdm') {
      nextSettings.abdmPort = val;
    } else if (activeDownloader.id === 'aria2_rpc') {
      nextSettings.aria2Port = val;
    }
    setSettings(nextSettings);
    saveDownloadSettings(nextSettings);
  };

  const handleTestConnection = async () => {
    const port = externalDownloaderRegistry.getDownloaderPort(activeDownloader, settings);
    const options = activeDownloader.resolveConfig ? activeDownloader.resolveConfig(settings) : { port };

    setTestStatus({ loading: true, message: `正在探测 127.0.0.1:${port}...` });
    try {
      const res = await activeDownloader.checkAvailability({ ...options, port, timeoutMs: 2000 });
      setTestStatus({
        loading: false,
        ok: res.isAvailable,
        message: res.message,
      });
      if (res.isAvailable) {
        onShowToast(`${activeDownloader.name} 连接测试成功！`, 'success');
      } else {
        onShowToast(`连接失败: ${res.message}`, 'warning');
      }
    } catch (e) {
      setTestStatus({
        loading: false,
        ok: false,
        message: `测试异常: ${String(e)}`,
      });
    }
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
            <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>失焦或回车自动保存</span>
            </span>
          </div>

          <div className="relative group">
            <div className="flex items-center rounded-xl bg-background border border-border/80 group-hover:border-primary/60 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-2xs transition-all overflow-hidden">
              <div className="px-2.5 py-1.5 bg-muted/50 border-r border-border/60 text-muted-foreground font-mono text-xs select-none flex items-center gap-1.5 shrink-0">
                <FolderPen className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                <span>~/Downloads/</span>
              </div>
              <input
                type="text"
                value={settings.subfolder}
                onChange={(e) => updateSetting('subfolder', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') {
                    e.stopPropagation();
                  }
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                    onShowToast(`已保存下载子目录: ${settings.subfolder || '(根目录)'}`, 'info');
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key !== 'Escape') {
                    e.stopPropagation();
                  }
                }}
                placeholder="点击输入子目录名称 (如 bili-dl)"
                className="flex-1 min-w-0 px-3 py-1.5 bg-transparent text-foreground font-mono text-xs focus:outline-none placeholder:text-muted-foreground/50"
                title="点击输入下载相对子目录名称"
              />
              {settings.subfolder && (
                <button
                  type="button"
                  onClick={() => {
                    updateSetting('subfolder', '');
                    onShowToast('已清空子目录（直接保存至下载根目录）', 'info');
                  }}
                  className="px-2.5 py-1 text-muted-foreground hover:text-foreground text-[10px] cursor-pointer hover:bg-muted/60 transition-colors shrink-0"
                  title="清空子目录"
                >
                  清空
                </button>
              )}
            </div>
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

          {/* CDN 优先级顺序配置与展示 */}
          {settings.enableCdnPriority && (
            <div className="pt-2 pl-6 space-y-2 border-t border-border/30">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ListOrdered className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                  <span className="font-semibold text-foreground">CDN 调度优先级顺序</span>
                  <span className="text-[10px] text-muted-foreground">(内置下载与外部下载器均优先使用排头节点)</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetCdnOrder}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
                  title="恢复官方默认推荐优先级顺序"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复默认</span>
                </button>
              </div>

              {/* 排序列表 */}
              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                {currentCdnOrder.map((nodeId, index) => {
                  const rule = CDN_NODE_RULES.find((r) => r.id === nodeId);
                  if (!rule) return null;
                  const isFirst = index === 0;
                  const isLast = index === currentCdnOrder.length - 1;

                  return (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-card/70 dark:bg-card/40 border border-border/60 text-xs transition-all hover:border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 flex items-center justify-center rounded font-mono text-[10px] font-bold shrink-0 ${
                            index === 0
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                              : index < 3
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-muted text-muted-foreground border border-border/40'
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground truncate">{rule.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground/80 truncate">
                              ({rule.patterns[0]})
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">{rule.desc}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveCdn(index, 'up')}
                          className={`p-1 rounded hover:bg-muted transition-colors ${
                            isFirst ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer text-muted-foreground hover:text-foreground active:scale-95'
                          }`}
                          title={isFirst ? '已是最高优先级' : '上移优先级'}
                          aria-label={`将 ${rule.name} 上移`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveCdn(index, 'down')}
                          className={`p-1 rounded hover:bg-muted transition-colors ${
                            isLast ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer text-muted-foreground hover:text-foreground active:scale-95'
                          }`}
                          title={isLast ? '已是最低优先级' : '下移优先级'}
                          aria-label={`将 ${rule.name} 下移`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

        {/* 5. 默认下载引擎配置 */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
                <span className="font-semibold text-foreground">默认下载引擎</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                决定右键快捷任务与资源卡片下载的默认触发方式。
              </p>
            </div>

            <div className="flex items-center bg-background rounded-xl p-1 border border-border/80 shrink-0">
              <button
                type="button"
                onClick={() => updateSetting('defaultDownloaderEngine', 'internal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settings.defaultDownloaderEngine !== 'external'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                <span>浏览器内置</span>
              </button>
              <button
                type="button"
                onClick={() => updateSetting('defaultDownloaderEngine', 'external')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  settings.defaultDownloaderEngine === 'external'
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Rocket className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                <span>外部下载器</span>
              </button>
            </div>
          </div>
        </div>

        {/* 6. 外部持久化下载器集成与选择 (支持 AB Download Manager、Aria2 RPC 等) */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <DownloadCloud className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
                <span className="font-semibold text-foreground">外部持久化下载器集成</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                联动外部桌面端下载器接管任务，解决浏览器切 Tab、最小化或休眠时下载中断的问题。
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.externalDownloaderEnabled}
              onClick={() => {
                const nextVal = !settings.externalDownloaderEnabled;
                updateSetting('externalDownloaderEnabled', nextVal);
                updateSetting('abdmEnabled', nextVal);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.externalDownloaderEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.externalDownloaderEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {settings.externalDownloaderEnabled && (
            <div className="pt-2 pl-6 space-y-3 border-t border-border/30">
              {/* 选择默认外部下载器 */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">选择外部下载器引擎：</span>
                <div className="grid grid-cols-2 gap-2">
                  {registeredDownloaders.map((downloader) => {
                    const isSelected = (settings.externalDownloaderId || 'abdm') === downloader.id;
                    const port = externalDownloaderRegistry.getDownloaderPort(downloader, settings);

                    return (
                      <button
                        key={downloader.id}
                        type="button"
                        onClick={() => {
                          updateSetting('externalDownloaderId', downloader.id);
                          setTestStatus(null);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-primary/15 border-primary text-emerald-950 dark:text-emerald-100 shadow-2xs font-bold'
                            : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{downloader.name}</span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted border border-border/60">
                            :{port}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/80 line-clamp-1">
                          {downloader.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 端口配置与连接测试 */}
              <div className="flex items-center justify-between gap-3 text-[11px] pt-1">
                <div className="space-y-0.5">
                  <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                    <Plug className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
                    <span>{activeDownloader.name} 监听端口：</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 block">
                    可点击右侧输入框修改端口 (失焦或回车自动保存)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex items-center rounded-lg bg-background border border-border/80 hover:border-primary/60 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 shadow-2xs transition-all overflow-hidden group">
                    <span className="pl-2 pr-0.5 text-muted-foreground font-mono text-xs select-none">
                      :
                    </span>
                    <input
                      type="number"
                      value={externalDownloaderRegistry.getDownloaderPort(activeDownloader, settings)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleUpdateActivePort(val);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Escape') {
                          e.stopPropagation();
                        }
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                          const currentPort = externalDownloaderRegistry.getDownloaderPort(activeDownloader, settings);
                          onShowToast(`已保存 ${activeDownloader.name} 监听端口: ${currentPort}`, 'info');
                        }
                      }}
                      onKeyUp={(e) => {
                        if (e.key !== 'Escape') {
                          e.stopPropagation();
                        }
                      }}
                      placeholder="端口"
                      className="w-20 pr-2 py-1 bg-transparent text-foreground font-mono text-xs text-left focus:outline-none"
                      title="点击修改端口号，失焦或回车自动保存"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testStatus?.loading}
                    className="px-2.5 py-1.5 rounded-lg bg-secondary/40 hover:bg-secondary text-secondary-foreground text-[10px] font-semibold border border-secondary/60 transition-colors cursor-pointer"
                  >
                    {testStatus?.loading ? '探测中...' : '测试连接'}
                  </button>
                </div>
              </div>

              {testStatus && (
                <div
                  className={`p-2 rounded-xl text-[10px] flex items-center gap-2 ${
                    testStatus.ok
                      ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20'
                  }`}
                >
                  {testStatus.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  )}
                  <span>{testStatus.message}</span>
                </div>
              )}

              {/* 格式与混流特别说明 */}
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-semibold block">关于外部下载器文件格式的特别说明：</span>
                  <p className="text-[10.5px] text-amber-800/90 dark:text-amber-300/90">
                    B站官方采用音视频分离的 DASH 流架构。外部下载器 (如 AB Download Manager、Aria2、Motrix) 仅负责网络分块下载，<strong>不会自动混流封装为 MP4/M4A</strong>，落盘的文件为原始 <code>.m4s</code> 视频/音频轨（主流播放器如 PotPlayer / VLC / mpv 支持直接拖入播放，或使用 ffmpeg 单条命令快速无损合并）。
                  </p>
                  <p className="text-[10.5px] text-amber-800/90 dark:text-amber-300/90">
                    如需自动生成单文件完整 MP4（音画已在浏览器中封装完毕），请将默认下载引擎切换为<strong>「浏览器内置」</strong>。
                  </p>
                </div>
              </div>

              <div className="text-[10.5px] text-muted-foreground/80 leading-relaxed">
                提示：请确保电脑已安装并启动对应客户端（例如 AB Download Manager 或 Motrix/Aria2），且端口保持一致。
              </div>
            </div>
          )}
        </div>

        {/* 7. 本地 AI 语音转文字 (Whisper / WebGPU 硬件加速) */}
        <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/70 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
                <span className="font-semibold text-foreground">本地 AI 语音转文字 (Whisper / WebGPU)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                基于 Transformers.js + ONNX Runtime 纯前端本地推理，0 服务器成本，保护隐私不上传。
              </p>
            </div>

            {webGpuStatus?.supported ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>WebGPU 已就绪</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono text-muted-foreground bg-muted border border-border/70">
                <Cpu className="w-3 h-3" />
                <span>CPU Wasm 兼容</span>
              </span>
            )}
          </div>

          <div className="pt-2 pl-6 space-y-3 border-t border-border/30">
            {/* 默认 Whisper 模型 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">默认 Whisper 识别模型：</span>
                <span className="text-[10px] text-muted-foreground font-mono">首次下载后浏览器永久 Cache 缓存</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_WHISPER_MODELS.map((model) => {
                  const isSelected = (settings.whisperModel || 'onnx-community/whisper-tiny') === model.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => updateSetting('whisperModel', model.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-primary/15 border-primary text-emerald-950 dark:text-emerald-100 shadow-2xs font-bold'
                          : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{model.name.split(' ')[0]}</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-muted border border-border/60">
                          ~{model.sizeMB}MB
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/80 line-clamp-1">{model.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 推理加速硬件引擎 */}
            <div className="flex items-center justify-between gap-4 text-[11px] pt-1">
              <div className="space-y-0.5">
                <span className="text-muted-foreground font-medium">推理加速硬件设备：</span>
                <span className="text-[10px] text-muted-foreground block">
                  {webGpuStatus?.adapterInfo || '显卡 WebGPU 加速速度快 5-10 倍'}
                </span>
              </div>
              <div className="flex items-center bg-background rounded-xl p-1 border border-border/80 shrink-0">
                {(['auto', 'webgpu', 'wasm'] as const).map((dev) => (
                  <button
                    key={dev}
                    type="button"
                    onClick={() => updateSetting('whisperDevice', dev)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      (settings.whisperDevice || 'auto') === dev
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {dev === 'auto' ? '自动探测' : dev === 'webgpu' ? 'WebGPU (显卡)' : 'Wasm (CPU)'}
                  </button>
                ))}
              </div>
            </div>

            {/* 模型下载镜像源 */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">模型权重下载镜像源：</span>
                <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium">国内网络推荐 hf-mirror</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'hf-mirror', label: 'hf-mirror.com (国内高速镜像 / 推荐)' },
                  { id: 'huggingface', label: 'Hugging Face 官方 (海外)' },
                  { id: 'custom', label: '自定义镜像 URL' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateSetting('whisperMirror', m.id as 'hf-mirror' | 'huggingface' | 'custom')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      (settings.whisperMirror || 'hf-mirror') === m.id
                        ? 'bg-primary/20 text-emerald-950 dark:text-emerald-100 border-primary/60 shadow-2xs font-bold'
                        : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {settings.whisperMirror === 'custom' && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={settings.whisperCustomMirrorUrl || ''}
                    onChange={(e) => updateSetting('whisperCustomMirrorUrl', e.target.value)}
                    placeholder="请输入自定义镜像 Base URL (例如 https://hf-mirror.com/)"
                    className="w-full px-3 py-1.5 rounded-xl bg-background border border-border/80 text-foreground font-mono text-xs focus:outline-none focus:border-primary shadow-2xs"
                  />
                </div>
              )}
            </div>

            {/* 默认语言与时间戳开关 */}
            <div className="flex items-center justify-between gap-4 text-[11px] pt-1">
              <div className="space-y-0.5">
                <span className="text-muted-foreground font-medium">默认识别语言：</span>
                <select
                  value={settings.whisperLanguage || 'chinese'}
                  onChange={(e) => updateSetting('whisperLanguage', e.target.value)}
                  className="mt-1 block px-2.5 py-1 rounded-xl bg-background border border-border/80 text-foreground text-xs font-semibold focus:outline-none focus:border-primary shadow-2xs cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5 text-right">
                <span className="text-muted-foreground font-medium block">生成 SRT 时间戳字幕：</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.whisperReturnTimestamps !== false}
                  onClick={() => updateSetting('whisperReturnTimestamps', !(settings.whisperReturnTimestamps !== false))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1 ${
                    settings.whisperReturnTimestamps !== false ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      settings.whisperReturnTimestamps !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
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
