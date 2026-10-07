import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Cpu,
  Download,
  Copy,
  Check,
  Loader2,
  FileText,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
  Trash2,
} from 'lucide-react';
import {
  checkWebGpuSupport,
  clearWhisperPipelineCache,
  clearTranscriptionResult,
  subscribeTranscriptionState,
  startTranscriptionTask,
  abortTranscriptionTask,
  getActiveTranscriptionState,
  SUPPORTED_WHISPER_MODELS,
  SUPPORTED_LANGUAGES,
  type ActiveTranscriptionState,
} from '../ai/whisper';
import { saveBlobAsFile } from '../media/downloader';
import { getDownloadSettings } from '../utils/settings';
import { getErrorMessage, isAbortError } from '../utils/error';
import type { AudioStreamItem } from '../types';

interface WhisperTranscriberProps {
  cacheKey?: string;
  title: string;
  audios: AudioStreamItem[];
  onShowToast: (content: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const WhisperTranscriber: React.FC<WhisperTranscriberProps> = ({
  cacheKey,
  title,
  audios,
  onShowToast,
}) => {
  const effectiveKey = cacheKey || title;
  const initialTaskState = getActiveTranscriptionState(effectiveKey);

  const [taskState, setTaskState] = useState<ActiveTranscriptionState>(initialTaskState);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedSrt, setCopiedSrt] = useState(false);
  const [showFullView, setShowFullView] = useState(!!initialTaskState.result);
  const [showChunks, setShowChunks] = useState(false);
  const [webGpuStatus, setWebGpuStatus] = useState<{ supported: boolean; adapterInfo?: string } | null>(null);

  const settings = getDownloadSettings();
  const [selectedModel, setSelectedModel] = useState<string>(
    settings.whisperModel || 'onnx-community/whisper-tiny'
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    settings.whisperLanguage || 'chinese'
  );

  // 订阅当前分 P 的全局转写任务状态（关闭 Modal 再次打开自动无缝恢复）
  useEffect(() => {
    return subscribeTranscriptionState(effectiveKey, (state) => {
      setTaskState(state);
      if (state.result) {
        setShowFullView(true);
      }
    });
  }, [effectiveKey]);

  useEffect(() => {
    checkWebGpuSupport().then(setWebGpuStatus);
  }, []);

  const handleStartTranscribe = async () => {
    if (taskState.isRunning) return;

    // 优先选取码率最低的音频流（体积最小，拉取最快，ASR 识别率与高码率完全一致）
    const sortedAudios = [...audios].sort((a, b) => a.bandwidth - b.bandwidth);
    const targetAudio = sortedAudios[0] || audios[0];

    if (!targetAudio) {
      onShowToast('未能获取到音频流，无法进行本地语音识别', 'error');
      return;
    }

    try {
      await startTranscriptionTask(effectiveKey, targetAudio, {
        model: selectedModel,
        language: selectedLanguage,
        returnTimestamps: true,
      });
      onShowToast('本地 AI 语音转文字完成！', 'success');
    } catch (err) {
      if (isAbortError(err)) {
        onShowToast('语音转写任务已手动取消', 'info');
      } else {
        const msg = getErrorMessage(err);
        onShowToast(`语音转写失败: ${msg}`, 'error');
      }
    }
  };

  const handleClearMemory = async () => {
    await clearWhisperPipelineCache();
    onShowToast('已释放 Whisper 显存与内存模型缓存', 'info');
  };

  const handleCancel = () => {
    abortTranscriptionTask(effectiveKey);
  };

  const handleCopyText = () => {
    if (!result?.text) return;
    navigator.clipboard.writeText(result.text);
    setCopiedText(true);
    onShowToast('纯文本内容已复制到剪贴板', 'success');
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopySrt = () => {
    if (!result?.srt) return;
    navigator.clipboard.writeText(result.srt);
    setCopiedSrt(true);
    onShowToast('SRT 字幕内容已复制到剪贴板', 'success');
    setTimeout(() => setCopiedSrt(false), 2000);
  };

  const handleDownloadSrt = () => {
    if (!result?.srt) return;
    const blob = new Blob([result.srt], { type: 'text/plain;charset=utf-8' });
    saveBlobAsFile(blob, `${title}-本地AI生成字幕.srt`, title);
    onShowToast('SRT 字幕文件已保存', 'success');
  };

  const handleDownloadTxt = () => {
    if (!result?.text) return;
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    saveBlobAsFile(blob, `${title}-本地AI语音转写纯文本.txt`, title);
    onShowToast('纯文本文件已保存', 'success');
  };

  const { isRunning, progress, liveChunks, result } = taskState;

  const currentModelMeta =
    SUPPORTED_WHISPER_MODELS.find((m) => m.id === selectedModel) || SUPPORTED_WHISPER_MODELS[0];

  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-3.5 space-y-3 shadow-2xs">
      {/* 头部标题与特性标签 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-emerald-800 dark:text-emerald-300 border border-primary/40 shadow-2xs shrink-0">
            <Bot className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-foreground tracking-tight">
                本地 AI 语音转文字 (WebGPU)
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                0 服务器成本
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-primary/20 text-emerald-800 dark:text-emerald-300 border border-primary/30">
                浏览器 100% 本地运行
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              使用 Transformers.js + Whisper-Tiny/Base 显卡加速，无需后端与 API Key，无隐私泄露
            </p>
          </div>
        </div>

        {/* WebGPU 硬件状态指示 */}
        <div className="shrink-0">
          {webGpuStatus?.supported ? (
            <span
              title={`已检测到 WebGPU 硬件加速: ${webGpuStatus.adapterInfo || '就绪'}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 cursor-help"
            >
              <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>WebGPU 已加速</span>
            </span>
          ) : (
            <span
              title="当前浏览器未启用 WebGPU，将自动降级为 CPU Wasm 多线程模式"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono text-muted-foreground bg-muted border border-border/70 cursor-help"
            >
              <Cpu className="w-3 h-3" />
              <span>CPU Wasm 兼容模式</span>
            </span>
          )}
        </div>
      </div>

      {/* 控制与参数选择器 */}
      {!isRunning && !result && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* 模型选择 */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] text-muted-foreground">模型:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-2 py-1 rounded-xl bg-background border border-border/80 text-foreground text-xs font-semibold focus:outline-none focus:border-primary cursor-pointer shadow-2xs"
            >
              {SUPPORTED_WHISPER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 语言选择 */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] text-muted-foreground">语言:</span>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="px-2 py-1 rounded-xl bg-background border border-border/80 text-foreground text-xs font-semibold focus:outline-none focus:border-primary cursor-pointer shadow-2xs"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleClearMemory}
              title="释放模型显存与内存占用"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-all active:scale-95 cursor-pointer border border-border/60"
            >
              <Trash2 className="w-3 h-3" />
              <span>释放显存</span>
            </button>
            <button
              onClick={handleStartTranscribe}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>开始转写字幕 & 纯文本</span>
            </button>
          </div>
        </div>
      )}

      {/* 运行中进度与实时流式识别展示 */}
      {isRunning && progress && (
        <div className="p-3 rounded-xl bg-background/80 border border-primary/40 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700 dark:text-emerald-300" strokeWidth={2.4} />
              <span>{progress.message}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold text-primary">
                {progress.progress}%
              </span>
              <button
                onClick={handleCancel}
                className="px-2 py-0.5 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 text-[10px] font-semibold transition-colors cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-300 ease-out"
              style={{ width: `${Math.max(5, progress.progress)}%` }}
            />
          </div>

          {/* 实时流式输出预览 */}
          {liveChunks.length > 0 && (
            <div className="p-2 rounded-lg bg-muted/40 border border-border/60 text-xs text-foreground max-h-20 overflow-y-auto font-sans leading-relaxed scrollbar-clean">
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 mr-1.5">[实时流]</span>
              {liveChunks.map((c) => c.text).join('')}
            </div>
          )}

          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground">
            <span>
              {progress.stage === 'loading_model'
                ? `首次加载下载 ${currentModelMeta.sizeMB}MB 模型，浏览器永久本地缓存`
                : progress.stage === 'transcribing'
                ? 'WebGPU 显卡异步调度推理中，界面丝滑无卡顿...'
                : '处理音频流中...'}
            </span>
            <span>{currentModelMeta.name.split(' ')[0]}</span>
          </div>
        </div>
      )}

      {/* 识别完成结果视窗 */}
      {result && (
        <div className="p-3 rounded-xl bg-background/90 border border-border/80 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">转写完成</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/60">
                {result.model.split('/').pop()} ({result.device})
              </span>
              <span className="text-[10px] text-muted-foreground">
                音频时长: {result.duration.toFixed(1)}s | 识别文本: {result.text.length} 字
              </span>
              {result.metrics && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <Zap className="w-3 h-3 shrink-0" />
                  耗时 {(result.metrics.totalElapsedMs / 1000).toFixed(1)}s ({result.metrics.realtimeFactor}x 速) · {result.metrics.throughputCharsPerSec} 字/s
                </span>
              )}
            </div>

            {/* 操作工具栏 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={handleCopyText}
                title="复制纯文本内容"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/30 hover:bg-secondary/60 text-secondary-foreground text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                {copiedText ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedText ? '已复制' : '复制纯文本'}</span>
              </button>

              <button
                onClick={handleCopySrt}
                title="复制带有时间戳的 SRT 字幕内容"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/30 hover:bg-secondary/60 text-secondary-foreground text-xs font-semibold transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                {copiedSrt ? (
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                <span>{copiedSrt ? '已复制' : '复制 SRT'}</span>
              </button>

              <button
                onClick={handleDownloadSrt}
                title="导出为标准 .srt 字幕文件"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/25 hover:bg-primary/40 text-emerald-950 dark:text-emerald-100 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <Download className="w-3 h-3" strokeWidth={2.4} />
                <span>导出 .srt</span>
              </button>

              <button
                onClick={handleDownloadTxt}
                title="导出为纯文本 .txt 文件"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <Download className="w-3 h-3" />
                <span>导出 .txt</span>
              </button>

              <button
                onClick={() => {
                  clearTranscriptionResult(effectiveKey);
                }}
                title="重新转写"
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 纯文本预览框 */}
          <div className="relative">
            <div
              className={`p-2.5 rounded-lg bg-muted/40 border border-border/60 text-xs text-foreground leading-relaxed overflow-y-auto font-sans scrollbar-clean select-text ${
                showFullView ? 'max-h-48' : 'max-h-24'
              }`}
            >
              {result.text || '(未识别到有效语音文本)'}
            </div>
          </div>

          {/* 带时间戳分句展开 */}
          {result.chunks.length > 0 && (
            <div>
              <button
                onClick={() => setShowChunks(!showChunks)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer font-medium"
              >
                <Clock className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
                <span>查看时间轴逐句分段 ({result.chunks.length} 句)</span>
                {showChunks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showChunks && (
                <div className="mt-1.5 max-h-36 overflow-y-auto space-y-1 pr-1 scrollbar-clean">
                  {result.chunks.map((chunk, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-md bg-card border border-border/60 text-[11px] flex items-start gap-2 select-text"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0 bg-muted px-1 rounded">
                        {chunk.timestamp[0].toFixed(1)}s
                      </span>
                      <span className="text-foreground leading-normal">{chunk.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
