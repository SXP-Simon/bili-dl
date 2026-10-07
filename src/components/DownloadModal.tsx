import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Video,
  Music,
  Image as ImageIcon,
  MessageSquare,
  FileText,
  Terminal,
  Download,
  Bot,
  Copy,
  Check,
  Sun,
  Moon,
  Loader2,
  FolderArchive,
  Settings,
  Film,
  DownloadCloud,
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { TabPill } from './TabPill';
import { ProgressBar } from './ProgressBar';
import { EpisodePicker } from './EpisodePicker';
import { getErrorMessage } from '../utils/error';
import { SeasonPicker } from './SeasonPicker';
import { LogViewer } from './LogViewer';
import { SettingsPanel } from './SettingsPanel';
import { WhisperTranscriber } from './WhisperTranscriber';
import { exportAria2Command } from '../media/aria2';
import { fetchDanmakuAss } from '../media/danmaku';
import { fetchSubtitleSrt } from '../media/subtitle';
import { saveBlobAsFile, directDownload } from '../media/downloader';
import { getDownloadSettings } from '../utils/settings';
import { externalDownloaderRegistry } from '../downloader';
import type { MediaResourceData, CategoryType, VideoStreamItem, AudioStreamItem, DownloadProgress, DownloadTask } from '../types';

interface DownloadModalProps {
  data: MediaResourceData;
  isDark: boolean;
  loadingCid?: number | null;
  loadingBvid?: string | null;
  tasks?: DownloadTask[];
  onRemoveTask?: (id: string) => void;
  onClearCompleted?: () => void;
  onToggleDark: () => void;
  onClose: () => void;
  onDownloadVideo: (video: VideoStreamItem, audio?: AudioStreamItem) => void;
  onDownloadAudio: (audio: AudioStreamItem) => void;
  onDownloadWithExternal?: (downloaderId: string, video?: VideoStreamItem, audio?: AudioStreamItem) => Promise<void>;
  onDownloadBatchSubtitles?: () => Promise<void>;
  onDownloadSeasonVideos?: () => Promise<void>;
  onDownloadSeasonAudios?: () => Promise<void>;
  onDownloadSeasonSubtitles?: () => Promise<void>;
  onSelectEpisode: (cid: number) => void;
  onSelectSeasonEpisode?: (bvid: string) => void;
  onShowToast: (content: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  progress?: DownloadProgress;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  data,
  isDark,
  loadingCid,
  loadingBvid,
  tasks = [],
  onRemoveTask,
  onClearCompleted,
  onToggleDark,
  onClose,
  onDownloadVideo,
  onDownloadAudio,
  onDownloadWithExternal,
  onDownloadBatchSubtitles,
  onDownloadSeasonVideos,
  onDownloadSeasonAudios,
  onDownloadSeasonSubtitles,
  onSelectEpisode,
  onSelectSeasonEpisode,
  onShowToast,
  progress,
}) => {
  const [activeTab, setActiveTab] = useState<CategoryType>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [isLogsMaximized, setIsLogsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const settings = getDownloadSettings();
  const isExternalEnabled = settings.externalDownloaderEnabled !== false;
  const activeDownloader = externalDownloaderRegistry.getActive(settings.externalDownloaderId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const tabs = [
    { key: 'all' as CategoryType, label: '全部' },
    { key: 'video' as CategoryType, label: '视频', badge: data.videos.length },
    { key: 'audio' as CategoryType, label: '音频', badge: data.audios.length },
    { key: 'cover' as CategoryType, label: '封面' },
    { key: 'danmaku' as CategoryType, label: '弹幕/字幕', badge: data.subtitles.length + 1 },
    { key: 'ai' as CategoryType, label: 'AI语音转写' },
  ];

  const handleCopyAiSummary = () => {
    if (data.aiSummaryMarkdown) {
      navigator.clipboard.writeText(data.aiSummaryMarkdown);
      setCopiedSummary(true);
      onShowToast('AI 提炼总结与大纲已复制为 Markdown', 'success');
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleDownloadDanmaku = async () => {
    try {
      const traceId = '弹幕-ASS';
      const blob = await fetchDanmakuAss(data.cid, data.title, traceId);
      saveBlobAsFile(blob, `${data.title}-弹幕.ass`, data.title);
      onShowToast('弹幕文件已转换完成并保存', 'success');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      onShowToast(`弹幕导出失败: ${msg}`, 'error');
    }
  };

  const handleDownloadSubtitle = async (subUrl: string, lanDoc: string) => {
    try {
      const traceId = `字幕-${lanDoc}`;
      const blob = await fetchSubtitleSrt(subUrl, traceId);
      saveBlobAsFile(blob, `${data.title}-${lanDoc}字幕.srt`, data.title);
      onShowToast(`${lanDoc}字幕已保存为 SRT 格式`, 'success');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      onShowToast(`字幕导出失败: ${msg}`, 'error');
    }
  };

  const bestAudio = data.audios[0];

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative w-full max-w-2xl flex flex-col rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden transition-all duration-200 ${
          showLogs || showSettings ? 'h-[85vh] max-h-[88vh]' : 'max-h-[85vh]'
        }`}
      >
        {/* 头部 Header (固定) */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/70 bg-card">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-2xl bg-primary/20 text-emerald-800 dark:text-emerald-300 border border-primary/30 shadow-2xs">
              <Sparkles className="w-4 h-4" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground tracking-tight">bili-dl</h2>
                
                {data.ugcSeason && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-emerald-800 dark:text-emerald-300 border border-primary/25">
                    <Film className="w-2.5 h-2.5" />
                    合集 ({data.ugcSeason.episodes.length}集)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* 设置按钮 */}
            <button
              onClick={() => {
                setShowSettings(!showSettings);
                if (showLogs) setShowLogs(false);
              }}
              title="偏好设置"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
                showSettings
                  ? 'bg-primary/25 text-emerald-950 dark:text-emerald-100 border-primary/50 font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted border-border/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={2.2} />
              <span className="text-[11px] font-medium">设置</span>
            </button>

            {/* 日志按钮 */}
            <button
              onClick={() => {
                setShowLogs(!showLogs);
                if (showSettings) setShowSettings(false);
              }}
              title={showLogs ? '收起诊断日志' : '查看运行日志与诊断信息'}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
                showLogs
                  ? 'bg-primary/25 text-emerald-950 dark:text-emerald-100 border-primary/50 font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted border-border/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" strokeWidth={2.2} />
              <span className="text-[11px] font-medium">日志</span>
            </button>

            <button
              onClick={onToggleDark}
              title={isDark ? '切换浅色模式' : '切换深色模式'}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-all duration-150 active:scale-95 cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" strokeWidth={2.2} /> : <Moon className="w-4 h-4" strokeWidth={2.2} />}
            </button>

            <button
              onClick={onClose}
              title="关闭 (Esc)"
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition-all duration-150 active:scale-95 cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {showSettings ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-card">
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onShowToast={onShowToast}
            />
          </div>
        ) : showLogs && isLogsMaximized ? (
          <div className="flex-1 min-h-[440px] flex flex-col overflow-hidden bg-card">
            <LogViewer
              onClose={() => {
                setShowLogs(false);
                setIsLogsMaximized(false);
              }}
              isMaximized={true}
              onToggleMaximize={() => setIsLogsMaximized(false)}
            />
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* 视频信息预览 (固定) */}
            <div className="flex-shrink-0 px-6 pt-3 pb-2">
              <div className="flex gap-3.5 p-3 rounded-2xl bg-card border border-border/80 items-center shadow-2xs">
                {data.cover && (
                  <img
                    src={data.cover}
                    alt="cover"
                    className="w-20 h-12 object-cover rounded-xl border border-border/80 flex-shrink-0 shadow-2xs"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-semibold text-foreground line-clamp-1 leading-snug" title={data.title}>
                    {data.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/70">
                      {data.bvid}
                    </span>
                    {data.pages.length > 1 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-secondary/30 text-secondary-foreground border border-secondary/40">
                        共 {data.pages.length} P
                      </span>
                    )}
                    {data.ugcSeason && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/20 text-emerald-800 dark:text-emerald-300 border border-primary/30">
                        合集: {data.ugcSeason.title} ({data.ugcSeason.episodes.length} 集)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 合集/系列 (Season/Series) 选集器 */}
            {data.ugcSeason && onSelectSeasonEpisode && (
              <div className="flex-shrink-0 px-6">
                <SeasonPicker
                  ugcSeason={data.ugcSeason}
                  currentBvid={data.bvid}
                  loadingBvid={loadingBvid}
                  onSelectEpisode={onSelectSeasonEpisode}
                  onDownloadSeasonVideos={
                    onDownloadSeasonVideos
                      ? async () => {
                          setActiveActionKey('season_videos');
                          try {
                            await onDownloadSeasonVideos();
                          } finally {
                            setActiveActionKey(null);
                          }
                        }
                      : undefined
                  }
                  onDownloadSeasonAudios={
                    onDownloadSeasonAudios
                      ? async () => {
                          setActiveActionKey('season_audios');
                          try {
                            await onDownloadSeasonAudios();
                          } finally {
                            setActiveActionKey(null);
                          }
                        }
                      : undefined
                  }
                  onDownloadSeasonSubtitles={
                    onDownloadSeasonSubtitles
                      ? async () => {
                          setActiveActionKey('season_subtitles');
                          try {
                            await onDownloadSeasonSubtitles();
                          } finally {
                            setActiveActionKey(null);
                          }
                        }
                      : undefined
                  }
                  isSeasonActionActive={
                    (tasks && tasks.some((t) => (t.id.startsWith('season_video_') || t.id.startsWith('season_audio_') || t.id.startsWith('season_subtitles_')) && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled')) ||
                    activeActionKey === 'season_videos' ||
                    activeActionKey === 'season_audios' ||
                    activeActionKey === 'season_subtitles'
                  }
                />
              </div>
            )}

            {/* 分 P 选择器 (固定) */}
            <div className="flex-shrink-0 px-6">
              <EpisodePicker
                pages={data.pages}
                currentCid={data.cid}
                loadingCid={loadingCid}
                onSelectEpisode={onSelectEpisode}
                onDownloadBatchSubtitles={
                  onDownloadBatchSubtitles
                    ? async () => {
                        setActiveActionKey('batch_subtitles');
                        try {
                          await onDownloadBatchSubtitles();
                        } finally {
                          setActiveActionKey(null);
                        }
                      }
                    : undefined
                }
                isBatchSubtitleActive={
                  (tasks && tasks.some((t) => t.id === `batch_subtitles_${data.bvid}` && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled')) ||
                  activeActionKey === 'batch_subtitles'
                }
              />
            </div>

            {/* Tab 控制条 (固定) */}
            <div className="flex-shrink-0 px-6 py-1">
              <TabPill tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* 资源列表区：弹性自适应滚动，当开启日志时紧凑收缩，为日志留出充足视口 */}
            <div
              className={`overflow-y-auto pl-6 pr-4 pb-2 scrollbar-clean ${
                showLogs ? 'max-h-[140px] flex-shrink-0' : 'flex-1 min-h-[140px] max-h-[400px]'
              }`}
            >
              <div className="space-y-2 py-2 pb-2">
                {/* 1. 视频列表 */}
                {(activeTab === 'all' || activeTab === 'video') &&
                  data.videos.map((v, idx) => {
                    const isMuxProcessing =
                      (tasks &&
                        tasks.some(
                          (t) =>
                            t.id === `video_mux_${v.id}_${v.codecName}` &&
                            t.status !== 'completed' &&
                            t.status !== 'error'
                        )) ||
                      activeActionKey === `video_mux_${v.id}_${v.codecName}`;

                    const isPureProcessing =
                      (tasks &&
                        tasks.some(
                          (t) =>
                            t.id === `video_pure_${v.id}_${v.codecName}` &&
                            t.status !== 'completed' &&
                            t.status !== 'error'
                        )) ||
                      activeActionKey === `video_pure_${v.id}_${v.codecName}`;

                    const isAnyProcessing = isMuxProcessing || isPureProcessing;
                    return (
                      <SpotlightCard
                        key={`${v.id}_${v.codecName}`}
                        style={{
                          animation: 'staggerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both',
                          animationDelay: `${idx * 28}ms`,
                        }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/30 text-emerald-800 dark:text-emerald-300 border border-secondary/40 shadow-2xs group-hover:bg-primary/25 group-hover:text-emerald-950 dark:group-hover:text-emerald-100 group-hover:scale-105 group-hover:border-primary/50 transition-all duration-200">
                            <Video className="w-4 h-4" strokeWidth={2.2} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground tracking-tight">
                                {v.qualityName}
                              </span>
                              <span
                                title={
                                  v.codecName === 'AVC'
                                    ? 'AVC (H.264)：全平台硬件解码与剪辑软件完美兼容'
                                    : v.codecName === 'HEVC'
                                    ? 'HEVC (H.265)：高压缩比，画质更细腻'
                                    : 'AV1：最新极致压缩格式'
                                }
                                className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-secondary/35 text-secondary-foreground border border-secondary/50 font-bold cursor-help"
                              >
                                {v.codecName}
                              </span>
                              {v.frameRate && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {v.frameRate}fps
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block">
                              预估体积: {v.sizeMB} MB
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportAria2Command(data.title, v, bestAudio);
                              onShowToast('Aria2 / curl 下载命令已复制到剪贴板', 'success');
                            }}
                            title="复制 Aria2 / curl / FFmpeg 多线程下载命令行"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-secondary/25 hover:bg-secondary/50 text-secondary-foreground border border-secondary/40 text-xs font-semibold shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer"
                          >
                            <Terminal className="w-3.5 h-3.5" strokeWidth={2.2} />
                            <span className="text-[11px] font-medium">命令</span>
                          </button>

                          <button
                            onClick={async () => {
                              setActiveActionKey(`video_pure_${v.id}_${v.codecName}`);
                              try {
                                await onDownloadVideo(v, undefined);
                              } finally {
                                setActiveActionKey(null);
                              }
                            }}
                            disabled={isAnyProcessing}
                            title="仅下载纯画面视频流 (无音频，适合专业剪辑/空镜素材)"
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-xs border shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer ${
                              isPureProcessing
                                ? 'bg-secondary/40 text-secondary-foreground border-secondary/60 cursor-wait'
                                : 'bg-secondary/20 hover:bg-secondary/45 text-secondary-foreground hover:text-foreground border-secondary/40 hover:border-secondary'
                            }`}
                          >
                            {isPureProcessing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.4} />
                                <span className="text-[11px]">处理中...</span>
                              </>
                            ) : (
                              <>
                                <Film className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2.2} />
                                <span className="text-[11px]">仅画面</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={async () => {
                              setActiveActionKey(`video_mux_${v.id}_${v.codecName}`);
                              try {
                                await onDownloadVideo(v, bestAudio);
                              } finally {
                                setActiveActionKey(null);
                              }
                            }}
                            disabled={isAnyProcessing}
                            title={bestAudio ? `一键混流：下载视频 + ${bestAudio.name}，封装为完整 MP4` : '下载完整 MP4 视频'}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border shadow-2xs active:scale-95 transition-all duration-200 cursor-pointer ${
                              isMuxProcessing
                                ? 'bg-primary/40 text-emerald-950 dark:text-emerald-100 border-primary/60 cursor-wait'
                                : 'bg-primary/25 hover:bg-primary text-emerald-950 dark:text-emerald-100 hover:text-primary-foreground border-primary/50 hover:border-primary hover:shadow-xs'
                            }`}
                          >
                            {isMuxProcessing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-800 dark:text-emerald-200" strokeWidth={2.4} />
                                <span>处理中...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" strokeWidth={2.4} />
                                <span>有声 MP4</span>
                              </>
                            )}
                          </button>

                          {isExternalEnabled && (
                            <button
                              onClick={async () => {
                                setActiveActionKey(`video_ext_${v.id}_${v.codecName}`);
                                try {
                                  await onDownloadWithExternal?.(activeDownloader.id, v, bestAudio);
                                } finally {
                                  setActiveActionKey(null);
                                }
                              }}
                              disabled={isAnyProcessing}
                              title={`发送至 ${activeDownloader.name} (桌面客户端持久化下载，不受网页切换/休眠影响)`}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold border border-border/70 hover:border-primary/60 bg-muted/20 hover:bg-primary/10 text-foreground transition-all duration-200 cursor-pointer shadow-2xs"
                            >
                              <DownloadCloud className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
                              <span className="text-[11px]">{activeDownloader.shortName || activeDownloader.name}</span>
                            </button>
                          )}
                        </div>
                      </SpotlightCard>
                    );
                  })}

                {/* 2. 音频列表 */}
                {(activeTab === 'all' || activeTab === 'audio') &&
                  data.audios.map((a, idx) => {
                    const isProcessing =
                      (tasks && tasks.some((t) => t.id === `audio_${a.id}` && t.status !== 'completed' && t.status !== 'error')) ||
                      activeActionKey === `audio_${a.id}`;
                    return (
                      <SpotlightCard
                        key={a.id}
                        style={{
                          animation: 'staggerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both',
                          animationDelay: `${(activeTab === 'all' ? data.videos.length + idx : idx) * 28}ms`,
                        }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/30 text-emerald-800 dark:text-emerald-300 border border-secondary/40 shadow-2xs group-hover:bg-primary/25 group-hover:text-emerald-950 dark:group-hover:text-emerald-100 group-hover:scale-105 group-hover:border-primary/50 transition-all duration-200">
                            <Music className="w-4 h-4" strokeWidth={2.2} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground tracking-tight">
                                {a.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-secondary/35 text-secondary-foreground border border-secondary/50 font-bold">
                                {a.qualityDesc}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block">
                              文件大小: {a.sizeMB} MB
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isExternalEnabled && (
                            <button
                              onClick={async () => {
                                setActiveActionKey(`audio_ext_${a.id}`);
                                try {
                                  await onDownloadWithExternal?.(activeDownloader.id, undefined, a);
                                } finally {
                                  setActiveActionKey(null);
                                }
                              }}
                              disabled={isProcessing}
                              title={`发送音频至 ${activeDownloader.name} (桌面客户端持久化下载)`}
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold border border-border/70 hover:border-primary/60 bg-muted/20 hover:bg-primary/10 text-foreground transition-all duration-200 cursor-pointer shadow-2xs"
                            >
                              <DownloadCloud className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
                              <span className="text-[11px]">{activeDownloader.shortName || activeDownloader.name}</span>
                            </button>
                          )}

                          <button
                            onClick={async () => {
                              setActiveActionKey(`audio_${a.id}`);
                              try {
                                await onDownloadAudio(a);
                              } finally {
                                setActiveActionKey(null);
                              }
                            }}
                            disabled={isProcessing}
                            title="单独提取并下载该独立音轨 (.m4a / .flac)"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold text-xs transition-all duration-200 active:scale-95 shadow-2xs cursor-pointer ${
                              isProcessing
                                ? 'bg-primary/40 text-emerald-950 dark:text-emerald-100 border-primary/60 cursor-wait'
                                : 'bg-primary/20 hover:bg-primary text-emerald-950 dark:text-emerald-100 hover:text-primary-foreground border-primary/40 hover:border-primary hover:shadow-xs'
                            }`}
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-800 dark:text-emerald-200" strokeWidth={2.4} />
                                <span>下载中...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                                <span>下载音频</span>
                              </>
                            )}
                          </button>
                        </div>
                      </SpotlightCard>
                    );
                  })}

                {/* 3. 封面 */}
                {(activeTab === 'all' || activeTab === 'cover') && data.cover && (
                  <SpotlightCard
                    style={{
                      animation: 'staggerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both',
                      animationDelay: `${(activeTab === 'all' ? data.videos.length + data.audios.length : 0) * 28}ms`,
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/30 text-emerald-800 dark:text-emerald-300 border border-secondary/40 shadow-2xs group-hover:bg-primary/25 group-hover:text-emerald-950 dark:group-hover:text-emerald-100 group-hover:scale-105 group-hover:border-primary/50 transition-all duration-200">
                        <ImageIcon className="w-4 h-4" strokeWidth={2.2} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground tracking-tight block">
                          超高清视频封面 (原图)
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5 block">
                          官方未压缩原始图源
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setActiveActionKey('cover');
                        directDownload(data.cover, `${data.title}-高清原图封面.jpg`);
                        onShowToast('已触发封面下载', 'info');
                        setTimeout(() => setActiveActionKey(null), 1500);
                      }}
                      title="保存 B 站官方未压缩封面原图"
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-semibold text-xs transition-all duration-200 active:scale-95 shadow-2xs cursor-pointer ${
                        activeActionKey === 'cover'
                          ? 'bg-secondary/60 text-secondary-foreground border-secondary/80'
                          : 'bg-secondary/25 hover:bg-secondary/50 text-secondary-foreground border-secondary/40'
                      }`}
                    >
                      {activeActionKey === 'cover' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} />
                          <span>已触发</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                          <span>保存原图</span>
                        </>
                      )}
                    </button>
                  </SpotlightCard>
                )}

                {/* 4. 弹幕与官方字幕 */}
                {(activeTab === 'all' || activeTab === 'danmaku') && (
                  <>
                    <SpotlightCard
                      style={{
                        animation: 'staggerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both',
                        animationDelay: `${(activeTab === 'all' ? data.videos.length + data.audios.length + 1 : 0) * 28}ms`,
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/30 text-emerald-800 dark:text-emerald-300 border border-secondary/40 shadow-2xs group-hover:bg-primary/25 group-hover:text-emerald-950 dark:group-hover:text-emerald-100 group-hover:scale-105 group-hover:border-primary/50 transition-all duration-200">
                          <MessageSquare className="w-4 h-4" strokeWidth={2.2} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-foreground tracking-tight block">
                            全量弹幕转 ASS 字幕
                          </span>
                          <span className="text-[11px] text-muted-foreground mt-0.5 block">
                            支持本地播放器直接挂载，保留弹幕样式与时间轴
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          setActiveActionKey('danmaku');
                          try {
                            await handleDownloadDanmaku();
                          } finally {
                            setActiveActionKey(null);
                          }
                        }}
                        title="将本视频全量弹幕转换为标准 ASS 字幕文件"
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-semibold text-xs transition-all duration-200 active:scale-95 shadow-2xs cursor-pointer ${
                          activeActionKey === 'danmaku'
                            ? 'bg-secondary/60 text-secondary-foreground border-secondary/80'
                            : 'bg-secondary/25 hover:bg-secondary/50 text-secondary-foreground border-secondary/40'
                        }`}
                      >
                        {activeActionKey === 'danmaku' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.4} />
                            <span>转换中...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                            <span>导出 ASS</span>
                          </>
                        )}
                      </button>
                    </SpotlightCard>

                    {/* 多 P 剧集全量字幕一键打包导出入口 */}
                    {data.pages.length > 1 && onDownloadBatchSubtitles && (
                      <SpotlightCard
                        style={{
                          animation: 'staggerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both',
                          animationDelay: `${(activeTab === 'all' ? data.videos.length + data.audios.length + 2 : 1) * 28}ms`,
                        }}
                        className="flex items-center justify-between border-primary/40 bg-primary/5 hover:border-primary/60 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-emerald-800 dark:text-emerald-300 border border-primary/40 shadow-2xs group-hover:bg-primary/30 group-hover:scale-105 transition-all duration-200">
                            <FolderArchive className="w-4 h-4" strokeWidth={2.2} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground tracking-tight block">
                                全集字幕一键打包导出
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-secondary/35 text-secondary-foreground border border-secondary/50 font-bold">
                                共 {data.pages.length} P
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground mt-0.5 block">
                              自动探测全集字幕，打包为【{data.title.split('_P')[0]}】文件夹 ZIP 压缩包
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            setActiveActionKey('batch_subtitles');
                            try {
                              await onDownloadBatchSubtitles();
                            } finally {
                              setActiveActionKey(null);
                            }
                          }}
                          disabled={
                            (tasks && tasks.some((t) => t.id === `batch_subtitles_${data.bvid}` && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled')) ||
                            activeActionKey === 'batch_subtitles'
                          }
                          title="一键探测所有分 P 视频存在的字幕并打包为 ZIP 文件夹下载"
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-semibold text-xs transition-all duration-200 active:scale-95 shadow-2xs cursor-pointer ${
                            (tasks && tasks.some((t) => t.id === `batch_subtitles_${data.bvid}` && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled')) ||
                            activeActionKey === 'batch_subtitles'
                              ? 'bg-primary/40 text-emerald-950 dark:text-emerald-100 border-primary/60 cursor-wait'
                              : 'bg-primary/20 hover:bg-primary text-emerald-950 dark:text-emerald-100 hover:text-primary-foreground border-primary/40 hover:border-primary hover:shadow-xs'
                          }`}
                        >
                          {(tasks && tasks.some((t) => t.id === `batch_subtitles_${data.bvid}` && t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled')) ||
                          activeActionKey === 'batch_subtitles' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-800 dark:text-emerald-200" strokeWidth={2.4} />
                              <span>探测打包中...</span>
                            </>
                          ) : (
                            <>
                              <FolderArchive className="w-3.5 h-3.5" strokeWidth={2.2} />
                              <span>一键打包全集</span>
                            </>
                          )}
                        </button>
                      </SpotlightCard>
                    )}

                    {data.subtitles.map((sub, sIdx) => {
                      const isSubActive = activeActionKey === `subtitle_${sub.id}`;
                      return (
                        <SpotlightCard
                          key={sub.id}
                          style={{
                            animation: 'staggerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both',
                            animationDelay: `${(activeTab === 'all' ? data.videos.length + data.audios.length + 2 + sIdx : sIdx + 1) * 28}ms`,
                          }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/30 text-emerald-800 dark:text-emerald-300 border border-secondary/40 shadow-2xs group-hover:bg-primary/25 group-hover:text-emerald-950 dark:group-hover:text-emerald-100 group-hover:scale-105 group-hover:border-primary/50 transition-all duration-200">
                              <FileText className="w-4 h-4" strokeWidth={2.2} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-foreground tracking-tight block">
                                官方字幕 ({sub.lan_doc})
                              </span>
                              <span className="text-[11px] text-muted-foreground mt-0.5 block">
                                导出为标准 .srt 字幕格式
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={async () => {
                              setActiveActionKey(`subtitle_${sub.id}`);
                              try {
                                await handleDownloadSubtitle(sub.subtitle_url, sub.lan_doc);
                              } finally {
                                setActiveActionKey(null);
                              }
                            }}
                            title={`导出 ${sub.lan_doc} 官方双语字幕文件 (.srt)`}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border font-semibold text-xs transition-all duration-200 active:scale-95 shadow-2xs cursor-pointer ${
                              isSubActive
                                ? 'bg-secondary/60 text-secondary-foreground border-secondary/80'
                                : 'bg-secondary/25 hover:bg-secondary/50 text-secondary-foreground border-secondary/40'
                            }`}
                          >
                            {isSubActive ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.4} />
                                <span>导出中...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                                <span>导出 SRT</span>
                              </>
                            )}
                          </button>
                        </SpotlightCard>
                      );
                    })}

                    {data.aiSummaryMarkdown && (
                      <SpotlightCard
                        style={{
                          animation: 'staggerIn 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both',
                          animationDelay: `${(activeTab === 'all' ? data.videos.length + data.audios.length + 3 + data.subtitles.length : data.subtitles.length + 1) * 28}ms`,
                        }}
                        className="flex items-center justify-between"
                        onClick={handleCopyAiSummary}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/30 text-emerald-800 dark:text-emerald-300 border border-secondary/40 shadow-2xs group-hover:bg-primary/25 group-hover:text-emerald-950 dark:group-hover:text-emerald-100 group-hover:scale-105 group-hover:border-primary/50 transition-all duration-200">
                            <Bot className="w-4 h-4" strokeWidth={2.2} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-foreground tracking-tight block">
                              AI 提炼总结与章节大纲
                            </span>
                            <span className="text-[11px] text-muted-foreground mt-0.5 block">
                              一键复制 Markdown 格式笔记
                            </span>
                          </div>
                        </div>

                        <button
                          title="复制 B 站官方 AI 总结与时间轴章节笔记"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary/25 hover:bg-secondary/50 text-secondary-foreground border border-secondary/40 font-semibold text-xs transition-all duration-200 active:scale-95 shadow-2xs"
                        >
                          {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />}
                          <span>{copiedSummary ? '已复制' : '复制 MD'}</span>
                        </button>
                      </SpotlightCard>
                    )}
                  </>
                )}

                {/* 5. 本地 AI 语音转文字 (Whisper / WebGPU) */}
                {(activeTab === 'all' || activeTab === 'danmaku' || activeTab === 'ai') && (
                  <div className="pt-1">
                    <WhisperTranscriber
                      key={`${data.bvid}_${data.cid}`}
                      cacheKey={`${data.bvid}_${data.cid}`}
                      title={data.title}
                      audios={data.audios}
                      onShowToast={onShowToast}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 底部进度条与多任务并发管理面板（由内部统一负责列表纵向滚动，外层杜绝二次滚动条） */}
            {((tasks && tasks.length > 0) || (progress && progress.status !== 'idle')) && (
              <div className="flex-shrink-0 px-6 pb-2.5 bg-muted/30 border-t border-border/70 overflow-hidden">
                <ProgressBar
                  tasks={tasks}
                  onRemoveTask={onRemoveTask}
                  onClearCompleted={onClearCompleted}
                  progress={progress}
                  compact={showLogs}
                />
              </div>
            )}

            {/* 底部运行日志与诊断控制台 (底栏停靠模式，自适应填充，保证内部独立滚动且绝不被挤出视口) */}
            {showLogs && (
              <div className="flex-1 min-h-[220px] border-t border-border/70 flex flex-col overflow-hidden bg-card">
                <LogViewer
                  onClose={() => setShowLogs(false)}
                  isMaximized={false}
                  onToggleMaximize={() => setIsLogsMaximized(true)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
