import React, { useRef, useEffect } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Video,
  Music,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  FolderArchive,
  X,
  Sparkles,
} from 'lucide-react';
import type { DownloadTask, DownloadProgress, TaskType } from '../types';

interface ProgressBarProps {
  tasks?: DownloadTask[];
  onRemoveTask?: (id: string) => void;
  onClearCompleted?: () => void;
  // 兼容单任务旧模式
  progress?: DownloadProgress;
  compact?: boolean;
}

function getTaskIcon(type: TaskType) {
  switch (type) {
    case 'video':
      return <Video className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
    case 'audio':
      return <Music className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
    case 'danmaku':
      return <MessageSquare className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
    case 'subtitle':
      return <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
    case 'batch_subtitle':
      return <FolderArchive className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
    case 'cover':
      return <ImageIcon className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
    case 'ai_transcribe':
      return <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
    default:
      return <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
  }
}

/**
 * 任务状态优先级：当前正在进行/有进度的任务必须置顶
 */
function getTaskPriority(status: DownloadTask['status']): number {
  switch (status) {
    case 'downloading_video':
    case 'downloading_audio':
    case 'muxing':
      return 0; // 最高优先级：当前正在进行中的任务置于最前
    case 'pending':
      return 1; // 队列排队中
    case 'completed':
      return 2; // 已完成
    case 'error':
      return 3; // 失败
    case 'cancelled':
      return 4; // 已取消
    default:
      return 5;
  }
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  tasks = [],
  onRemoveTask,
  onClearCompleted,
  progress,
  compact = false,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const prevActiveTaskId = useRef<string | null>(null);

  // 智能队列排序：正在执行 (带进度) 的任务绝对置顶，确保用户一眼直达当前下载状态
  const sortedTasks = [...tasks].sort((a, b) => {
    const prioA = getTaskPriority(a.status);
    const prioB = getTaskPriority(b.status);
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    // 同为进行中的任务：最新活跃/变动的排在最前
    if (prioA === 0) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    }
    // 同为已完成的任务：最新完成的置于完成段的前面
    if (prioA === 2) {
      return (b.timestamp || 0) - (a.timestamp || 0);
    }
    return 0;
  });

  const activeRunningTask = sortedTasks.find(
    (t) => t.status === 'downloading_video' || t.status === 'downloading_audio' || t.status === 'muxing'
  );

  const activeTaskId = activeRunningTask?.id;

  // 当活跃任务发生切换时，自动轻量置顶滚动，避免用户迷失在大量排队项中
  useEffect(() => {
    if (activeTaskId && activeTaskId !== prevActiveTaskId.current) {
      prevActiveTaskId.current = activeTaskId;
      if (listRef.current) {
        listRef.current.scrollTop = 0;
      }
    }
  }, [activeTaskId]);

  // 如果使用多任务模式
  if (tasks.length > 0) {
    const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'error');
    const completedTasks = tasks.filter((t) => t.status === 'completed');

    return (
      <div className="mt-2.5 p-2.5 rounded-2xl bg-muted/40 border border-border/80 text-foreground shadow-xs animate-toast-in">
        {/* 顶部统计与清空按钮 */}
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
            <span>
              任务进度 ({activeTasks.length > 0 ? `${activeTasks.length} 个进行中` : '全部已完成'}
              {completedTasks.length > 0 && ` · ${completedTasks.length} 个完成`})
            </span>
          </div>
          {completedTasks.length > 0 && onClearCompleted && (
            <button
              onClick={onClearCompleted}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            >
              清除已完成
            </button>
          )}
        </div>

        {/* 任务列表：内部唯一滚动容器，自适应 compact 模式高度 */}
        <div
          ref={listRef}
          className={`space-y-2 overflow-y-auto pr-1 scrollbar-clean ${compact ? 'max-h-24' : 'max-h-40'}`}
        >
          {sortedTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isError = task.status === 'error';
            const isCancelled = task.status === 'cancelled';
            const isActive = !isCompleted && !isError && !isCancelled;

            return (
              <div
                key={task.id}
                className={`p-2.5 rounded-xl border transition-all duration-200 ${
                  isActive && task.status !== 'pending'
                    ? 'bg-card border-primary/50 shadow-xs ring-1 ring-primary/20'
                    : 'bg-card/75 border-border/70 shadow-2xs opacity-90 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  {/* 左侧：类型图标 + 任务标题 + 实时状态/速度 */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 border border-primary/30 shrink-0">
                      {getTaskIcon(task.type)}
                    </div>
                    <span className="font-semibold text-foreground text-xs truncate max-w-[130px]" title={task.title}>
                      {task.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate flex-1" title={task.message}>
                      {task.message || (isCompleted ? '已完成' : isCancelled ? '已取消' : '处理中...')}
                    </span>
                  </div>

                  {/* 右侧：状态指示器 + 进度百分比 + 取消/移除按键 */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" strokeWidth={2.4} />
                        100%
                      </span>
                    )}
                    {isError && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-md border border-destructive/20">
                        <AlertCircle className="w-3 h-3" strokeWidth={2.4} />
                        失败
                      </span>
                    )}
                    {isCancelled && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-border/60">
                        已取消
                      </span>
                    )}
                    {task.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md border border-border/60">
                        排队中
                      </span>
                    )}
                    {isActive && task.status !== 'pending' && (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 text-primary animate-spin" strokeWidth={2.4} />
                        <span className="font-mono font-bold text-xs text-primary">{task.progress}%</span>
                      </div>
                    )}

                    {onRemoveTask && (
                      <button
                        onClick={() => onRemoveTask(task.id)}
                        className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title={isActive ? '中断并取消当前下载任务' : '从列表中移除'}
                      >
                        <X className="w-3 h-3" strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 底部流光进度条 */}
                <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full transition-all duration-200 ease-out rounded-full relative overflow-hidden ${
                      isCompleted ? 'bg-emerald-500' : isCancelled ? 'bg-muted-foreground/40' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                  >
                    {isActive && <div className="absolute inset-0 animate-streaming" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 兼容单任务回退
  if (!progress || progress.status === 'idle') return null;

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-card border border-border/80 text-card-foreground shadow-xs animate-toast-in">
      <div className="flex justify-between items-center text-xs font-medium mb-2.5">
        <div className="flex items-center gap-2">
          {progress.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          {progress.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
          {progress.status !== 'completed' && progress.status !== 'error' && (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}
          <span className="text-foreground font-medium tracking-tight">{progress.message || '处理中...'}</span>
        </div>
        <span className="text-foreground font-mono font-bold text-xs">{progress.progress}%</span>
      </div>

      <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-200 ease-out rounded-full relative overflow-hidden"
          style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }}
        >
          {progress.status !== 'completed' && progress.status !== 'error' && (
            <div className="absolute inset-0 animate-streaming" />
          )}
        </div>
      </div>
    </div>
  );
};

