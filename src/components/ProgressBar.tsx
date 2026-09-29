import React from 'react';
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
    default:
      return <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />;
  }
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  tasks = [],
  onRemoveTask,
  onClearCompleted,
  progress,
}) => {
  // 如果使用多任务模式
  if (tasks.length > 0) {
    const activeTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'error');
    const completedTasks = tasks.filter((t) => t.status === 'completed');

    return (
      <div className="mt-3 p-3 rounded-2xl bg-muted/40 border border-border/80 text-foreground shadow-xs animate-toast-in">
        {/* 顶部统计与清空按钮 */}
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2 px-1">
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

        {/* 任务列表 */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-clean">
          {tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isError = task.status === 'error';
            const isCancelled = task.status === 'cancelled';
            const isActive = !isCompleted && !isError && !isCancelled;

            return (
              <div
                key={task.id}
                className="p-2.5 rounded-xl bg-card border border-border/70 shadow-2xs transition-all duration-200"
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

