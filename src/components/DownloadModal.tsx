import React, { useState } from 'react';
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
  onClose: () => void;
  onDownloadVideo: (video: VideoStreamItem, audio?: AudioStreamItem) => void;
  onSelectEpisode: (cid: number) => void;
  onShowToast: (content: string, type?: 'success' | 'error' | 'info') => void;
  progress: DownloadProgress;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  data,
  onClose,
  onDownloadVideo,
  onSelectEpisode,
  onShowToast,
  progress,
}) => {
  const [activeTab, setActiveTab] = useState<CategoryType>('all');
  const [copiedSummary, setCopiedSummary] = useState(false);

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
      onShowToast('AI 提炼总结已复制到剪贴板', 'success');
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleDownloadDanmaku = async () => {
    try {
      const blob = await fetchDanmakuAss(data.cid, data.title);
      saveBlobAsFile(blob, `${data.title}-弹幕.ass`);
      onShowToast('弹幕文件已生成并开始下载', 'success');
    } catch (err: any) {
      onShowToast(`弹幕导出失败: ${err.message}`, 'error');
    }
  };

  const handleDownloadSubtitle = async (subUrl: string, lanDoc: string) => {
    try {
      const blob = await fetchSubtitleSrt(subUrl);
      saveBlobAsFile(blob, `${data.title}-${lanDoc}字幕.srt`);
      onShowToast(`${lanDoc}字幕已生成并开始下载`, 'success');
    } catch (err: any) {
      onShowToast(`字幕导出失败: ${err.message}`, 'error');
    }
  };

  const bestAudio = data.audios[0];

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/50 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-zinc-900/90 text-white backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/40 overflow-hidden animate-spring-pop">
        {/* 顶部 Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-pink-500/10 text-[#FF6699] border border-pink-500/20">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                哔哩下载 · Bili-DL
              </h2>
              <p className="text-[11px] font-normal text-zinc-400">
                4K / 1080P 前端无损混流 · 独立纯音频 · 弹幕字幕
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 视频预览信息 */}
        <div className="px-6 py-2">
          <div className="flex gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 items-center">
            {data.cover && (
              <img
                src={data.cover}
                alt="cover"
                className="w-24 h-14 object-cover rounded-xl border border-white/10 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-relaxed">
                {data.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#FF6699]/15 text-[#FF6699] border border-[#FF6699]/20">
                  {data.bvid}
                </span>
                {data.pages.length > 1 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/20">
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
        <div className="px-6 py-2">
          <TabPill tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* 资源列表区 */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-2.5 max-h-[46vh] scrollbar-thin">
          {/* 1. 视频列表 */}
          {(activeTab === 'all' || activeTab === 'video') &&
            data.videos.map((v) => (
              <SpotlightCard
                key={`${v.id}_${v.codecName}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-pink-500/10 text-[#FF6699] border border-pink-500/20">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-100">
                        {v.qualityName}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wide ${
                          v.codecName === 'AVC'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                            : v.codecName === 'HEVC'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {v.codecName}
                      </span>
                      {v.frameRate && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono text-zinc-400 bg-white/5">
                          {v.frameRate}fps
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 mt-0.5 block">
                      预估大小: {v.sizeMB} MB
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
                    title="复制 Aria2 下载命令"
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer border border-white/5"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDownloadVideo(v, bestAudio)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FF6699] hover:bg-[#FF3366] text-white font-semibold text-xs shadow-md shadow-pink-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
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
                className="flex items-center justify-between"
                onClick={() => {
                  directDownload(a.baseUrl, `${data.title}-${a.name}.m4a`);
                  onShowToast(`正在下载音频: ${a.name}`, 'info');
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-100">
                        {a.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
                        {a.qualityDesc}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 mt-0.5 block">
                      文件大小: {a.sizeMB} MB
                    </span>
                  </div>
                </div>

                <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold text-xs shadow-md shadow-purple-500/20 transition-all">
                  <Download className="w-3.5 h-3.5" />
                  <span>下载音频</span>
                </button>
              </SpotlightCard>
            ))}

          {/* 3. 封面 */}
          {(activeTab === 'all' || activeTab === 'cover') && data.cover && (
            <SpotlightCard
              className="flex items-center justify-between"
              onClick={() => {
                directDownload(data.cover, `${data.title}-高清原图封面.jpg`);
                onShowToast('正在下载超高清封面原图', 'info');
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-100">
                    超高清视频封面 (原图)
                  </span>
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">
                    无水印高清大图
                  </span>
                </div>
              </div>

              <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all">
                <Download className="w-3.5 h-3.5" />
                <span>保存原图</span>
              </button>
            </SpotlightCard>
          )}

          {/* 4. 弹幕与官方字幕 */}
          {(activeTab === 'all' || activeTab === 'danmaku') && (
            <>
              <SpotlightCard
                className="flex items-center justify-between"
                onClick={handleDownloadDanmaku}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-100">
                      全量弹幕转 ASS 字幕
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      支持播放器直接挂载，保留弹幕颜色与滚动轨迹
                    </span>
                  </div>
                </div>

                <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md shadow-amber-500/20 transition-all">
                  <Download className="w-3.5 h-3.5" />
                  <span>导出 ASS</span>
                </button>
              </SpotlightCard>

              {data.subtitles.map((sub) => (
                <SpotlightCard
                  key={sub.id}
                  className="flex items-center justify-between"
                  onClick={() => handleDownloadSubtitle(sub.subtitle_url, sub.lan_doc)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-zinc-100">
                        官方字幕 ({sub.lan_doc})
                      </span>
                      <span className="text-[11px] text-zinc-400 mt-0.5 block">
                        导出为标准 .srt 字幕格式
                      </span>
                    </div>
                  </div>

                  <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-xs shadow-md shadow-indigo-500/20 transition-all">
                    <Download className="w-3.5 h-3.5" />
                    <span>导出 SRT</span>
                  </button>
                </SpotlightCard>
              ))}

              {data.aiSummaryMarkdown && (
                <SpotlightCard
                  className="flex items-center justify-between"
                  onClick={handleCopyAiSummary}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-zinc-100">
                        AI 提炼总结与章节大纲
                      </span>
                      <span className="text-[11px] text-zinc-400 mt-0.5 block">
                        一键复制 Markdown 格式笔记
                      </span>
                    </div>
                  </div>

                  <button className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all">
                    {copiedSummary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSummary ? '已复制' : '复制 MD'}</span>
                  </button>
                </SpotlightCard>
              )}
            </>
          )}
        </div>

        {/* 底部进度条 */}
        <div className="px-6 pb-5">
          <ProgressBar progress={progress} />
        </div>
      </div>
    </div>
  );
};
