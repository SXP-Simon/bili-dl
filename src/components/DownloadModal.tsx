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
} from 'lucide-react';
import { SpotlightCard } from './SpotlightCard';
import { TabPill } from './TabPill';
import { ProgressBar } from './ProgressBar';
import { EpisodePicker } from './EpisodePicker';
import { exportAria2Command } from '../media/aria2';
import { fetchDanmakuAss } from '../media/danmaku';
import { fetchSubtitleSrt } from '../media/subtitle';
import { saveBlobAsFile, directDownload } from '../media/downloader';
import type { MediaResourceData, CategoryType, VideoStreamItem, AudioStreamItem, DownloadProgress } from '../types';

interface DownloadModalProps {
  data: MediaResourceData;
  isDark: boolean;
  onToggleDark: () => void;
  onClose: () => void;
  onDownloadVideo: (video: VideoStreamItem, audio?: AudioStreamItem) => void;
  onSelectEpisode: (cid: number) => void;
  onShowToast: (content: string, type?: 'success' | 'error' | 'info') => void;
  progress: DownloadProgress;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  data,
  isDark,
  onToggleDark,
  onClose,
  onDownloadVideo,
  onSelectEpisode,
  onShowToast,
  progress,
}) => {
  const [activeTab, setActiveTab] = useState<CategoryType>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);

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
      const blob = await fetchDanmakuAss(data.cid, data.title);
      saveBlobAsFile(blob, `${data.title}-弹幕.ass`);
      onShowToast('弹幕文件已转换完成并保存', 'success');
    } catch (err: any) {
      onShowToast(`弹幕导出失败: ${err.message}`, 'error');
    }
  };

  const handleDownloadSubtitle = async (subUrl: string, lanDoc: string) => {
    try {
      const blob = await fetchSubtitleSrt(subUrl);
      saveBlobAsFile(blob, `${data.title}-${lanDoc}字幕.srt`);
      onShowToast(`${lanDoc}字幕已保存为 SRT 格式`, 'success');
    } catch (err: any) {
      onShowToast(`字幕导出失败: ${err.message}`, 'error');
    }
  };

  const bestAudio = data.audios[0];

  return (
    <div
      className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl bg-background text-foreground border border-border/80 shadow-2xl overflow-hidden animate-modal-in">
        {/* 顶部 Header：米色/浅灰温润渐变底色 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3.5 border-b border-border/70 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-2xs font-bold">
              <Sparkles className="w-4 h-4" strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Bili-DL 媒体资源下载
              </h2>
              <p className="text-xs text-muted-foreground">
                无损混流封装 · 独立音轨 · 弹幕与字幕导出
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
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

        {/* 视频信息预览 */}
        <div className="px-6 py-3">
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
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/80">
                  {data.bvid}
                </span>
                {data.pages.length > 1 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-primary/20 text-primary-foreground font-semibold border border-primary/30">
                    共 {data.pages.length} P
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 分 P 选择器 */}
        <div className="px-6">
          <EpisodePicker
            pages={data.pages}
            currentCid={data.cid}
            onSelectEpisode={onSelectEpisode}
          />
        </div>

        {/* Tab 控制条 */}
        <div className="px-6 py-1">
          <TabPill tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* 资源列表区 */}
        <div className="flex-1 overflow-y-auto px-6 py-2.5 space-y-2 max-h-[44vh] scrollbar-clean">
          {/* 1. 视频列表 */}
          {(activeTab === 'all' || activeTab === 'video') &&
            data.videos.map((v) => (
              <SpotlightCard
                key={`${v.id}_${v.codecName}`}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/80 shadow-2xs group-hover:bg-muted transition-colors">
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
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-muted text-foreground border border-border/80 cursor-help font-semibold"
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportAria2Command(data.title, v, bestAudio);
                      onShowToast('Aria2 / curl 下载命令已复制到剪贴板', 'success');
                    }}
                    title="复制 Aria2 / curl 多线程下载命令行"
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs"
                  >
                    <Terminal className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </button>

                  <button
                    onClick={() => onDownloadVideo(v, bestAudio)}
                    title="下载视频与音频并在浏览器中无损封装为 MP4 文件"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                    <span>合成 MP4</span>
                  </button>
                </div>
              </SpotlightCard>
            ))}

          {/* 2. 音频列表 */}
          {(activeTab === 'all' || activeTab === 'audio') &&
            data.audios.map((a) => (
              <SpotlightCard
                key={a.id}
                className="flex items-center justify-between group"
                onClick={() => {
                  directDownload(a.baseUrl, `${data.title}-${a.name}.m4a`);
                  onShowToast(`正在下载音频: ${a.name}`, 'info');
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/80 shadow-2xs group-hover:bg-muted transition-colors">
                    <Music className="w-4 h-4" strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground tracking-tight">
                        {a.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-muted text-foreground border border-border/80 font-semibold">
                        {a.qualityDesc}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground mt-0.5 block">
                      文件大小: {a.sizeMB} MB
                    </span>
                  </div>
                </div>

                <button
                  title="单独提取并下载该独立音轨 (.m4a / .flac)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted text-xs font-semibold transition-all duration-150 active:scale-[0.98] shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                  <span>下载音频</span>
                </button>
              </SpotlightCard>
            ))}

          {/* 3. 封面 */}
          {(activeTab === 'all' || activeTab === 'cover') && data.cover && (
            <SpotlightCard
              className="flex items-center justify-between group"
              onClick={() => {
                directDownload(data.cover, `${data.title}-高清原图封面.jpg`);
                onShowToast('正在下载超高清封面原图', 'info');
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/80 shadow-2xs group-hover:bg-muted transition-colors">
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
                title="保存 B 站官方未压缩封面原图"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted text-xs font-semibold transition-all duration-150 active:scale-[0.98] shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                <span>保存原图</span>
              </button>
            </SpotlightCard>
          )}

          {/* 4. 弹幕与官方字幕 */}
          {(activeTab === 'all' || activeTab === 'danmaku') && (
            <>
              <SpotlightCard
                className="flex items-center justify-between group"
                onClick={handleDownloadDanmaku}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/80 shadow-2xs group-hover:bg-muted transition-colors">
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
                  title="将本视频全量弹幕转换为标准 ASS 字幕文件"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted text-xs font-semibold transition-all duration-150 active:scale-[0.98] shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                  <span>导出 ASS</span>
                </button>
              </SpotlightCard>

              {data.subtitles.map((sub) => (
                <SpotlightCard
                  key={sub.id}
                  className="flex items-center justify-between group"
                  onClick={() => handleDownloadSubtitle(sub.subtitle_url, sub.lan_doc)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/80 shadow-2xs group-hover:bg-muted transition-colors">
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
                    title={`导出 ${sub.lan_doc} 官方双语字幕文件 (.srt)`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted text-xs font-semibold transition-all duration-150 active:scale-[0.98] shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={2.2} />
                    <span>导出 SRT</span>
                  </button>
                </SpotlightCard>
              ))}

              {data.aiSummaryMarkdown && (
                <SpotlightCard
                  className="flex items-center justify-between group"
                  onClick={handleCopyAiSummary}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/80 text-foreground border border-border/80 shadow-2xs group-hover:bg-muted transition-colors">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted text-xs font-semibold transition-all duration-150 active:scale-[0.98] shadow-2xs"
                  >
                    {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} /> : <Copy className="w-3.5 h-3.5" strokeWidth={2.2} />}
                    <span>{copiedSummary ? '已复制' : '复制 MD'}</span>
                  </button>
                </SpotlightCard>
              )}
            </>
          )}
        </div>

        {/* 底部进度条 */}
        <div className="px-6 pb-5 bg-background border-t border-border/60">
          <ProgressBar progress={progress} />
        </div>
      </div>
    </div>
  );
};
