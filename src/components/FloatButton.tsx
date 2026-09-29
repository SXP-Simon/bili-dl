import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, GripVertical, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';
import type { DownloadTask } from '../types';

interface FloatButtonProps {
  loading: boolean;
  tasks?: DownloadTask[];
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent, pos: { x: number; y: number }) => void;
}

export const FloatButton: React.FC<FloatButtonProps> = ({
  loading,
  tasks = [],
  onClick,
  onContextMenu,
}) => {
  const [position, setPosition] = useState<{ x?: number; y?: number }>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bili_dl_btn_pos');
      if (saved) {
        setPosition(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };
    setIsDragging(false);

    let moved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        moved = true;
        setIsDragging(true);
        const newX = Math.max(12, Math.min(window.innerWidth - 180, dragStartRef.current.initialX + dx));
        const newY = Math.max(12, Math.min(window.innerHeight - 56, dragStartRef.current.initialY + dy));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (moved) {
        setTimeout(() => setIsDragging(false), 80);
        if (position.x !== undefined && position.y !== undefined) {
          localStorage.setItem('bili_dl_btn_pos', JSON.stringify(position));
        }
      } else {
        setIsDragging(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isDragging && !loading) {
      onClick();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      const rect = buttonRef.current?.getBoundingClientRect();
      const pos = {
        x: rect ? rect.left : e.clientX,
        y: rect ? rect.top : e.clientY,
      };
      onContextMenu(e, pos);
    }
  };

  const isCustomPos = position.x !== undefined && position.y !== undefined;

  // 任务进度计算
  const activeTasks = tasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'error' && t.status !== 'cancelled'
  );
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const errorTasks = tasks.filter((t) => t.status === 'error');
  const hasActiveTasks = activeTasks.length > 0;

  // 运行中的当前主任务与瞬时速度
  const runningTask = activeTasks.find((t) => t.status !== 'pending') || activeTasks[0];
  const overallProgress =
    tasks.length > 0
      ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length)
      : 0;

  return (
    <div
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Bili-DL 媒体下载 (左键打开面板 · 右键快捷下载 · 可拖拽移动)"
      style={
        isCustomPos
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
          : undefined
      }
      className={`fixed ${
        !isCustomPos ? 'right-8 bottom-28' : ''
      } z-[99999999] group flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full bg-card/95 backdrop-blur-md text-card-foreground text-xs font-semibold shadow-lg border border-border/80 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/50 active:scale-[0.98] cursor-pointer select-none overflow-hidden`}
    >
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-foreground -mr-0.5 cursor-grab active:cursor-grabbing transition-colors shrink-0" />

      {/* 清新翠绿徽章指示器 (下载状态自适应变幻) */}
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full font-bold shadow-2xs transition-all duration-300 shrink-0 ${
          hasActiveTasks
            ? 'bg-primary text-primary-foreground animate-pulse'
            : errorTasks.length > 0 && !hasActiveTasks
            ? 'bg-destructive text-destructive-foreground'
            : completedTasks.length > 0 && !hasActiveTasks && tasks.length > 0
            ? 'bg-emerald-600 text-white'
            : 'bg-primary text-primary-foreground'
        }`}
      >
        {loading || hasActiveTasks ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : errorTasks.length > 0 && !hasActiveTasks ? (
          <AlertCircle className="w-3 h-3" />
        ) : completedTasks.length > 0 && !hasActiveTasks && tasks.length > 0 ? (
          <CheckCircle2 className="w-3 h-3" />
        ) : (
          <Download className="w-3 h-3" />
        )}
      </div>

      {/* 按钮文字状态区 */}
      <div className="flex items-center gap-1.5 min-w-0">
        {loading ? (
          <span className="tracking-tight font-medium text-muted-foreground">正在解析...</span>
        ) : hasActiveTasks ? (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-mono font-bold text-primary">
              {tasks.length > 1 ? `${overallProgress}%` : `${runningTask?.progress || 0}%`}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[110px]">
              {tasks.length > 1
                ? `(${completedTasks.length}/${tasks.length})${runningTask?.speed ? ` · ${runningTask.speed}` : ''}`
                : runningTask?.speed || '下载中...'}
            </span>
          </div>
        ) : completedTasks.length > 0 && !hasActiveTasks && tasks.length > 0 ? (
          <span className="tracking-tight font-medium text-emerald-800 dark:text-emerald-300">
            全部完成 ({completedTasks.length})
          </span>
        ) : (
          <span className="tracking-tight font-medium">Bili-DL 下载</span>
        )}
      </div>

      {/* 悬浮球底部微细流光进度条 (有活动任务时呈现) */}
      {hasActiveTasks && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-muted/50 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200 relative overflow-hidden"
            style={{
              width: `${Math.min(
                100,
                Math.max(0, tasks.length > 1 ? overallProgress : runningTask?.progress || 0)
              )}%`,
            }}
          >
            <div className="absolute inset-0 animate-streaming" />
          </div>
        </div>
      )}

      {/* 鼠标悬停且有任务时展开的 Mini 进度浮窗 */}
      {isHovered && tasks.length > 0 && (
        <div className="absolute bottom-full right-0 mb-2.5 w-64 p-3 rounded-2xl bg-card/95 backdrop-blur-md border border-border/85 shadow-2xl text-card-foreground animate-modal-in pointer-events-none">
          <div className="flex items-center justify-between text-xs font-bold mb-2 pb-1.5 border-b border-border/60">
            <span className="flex items-center gap-1.5 text-foreground">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              下载任务状态
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {completedTasks.length}/{tasks.length} 完成
            </span>
          </div>

          <div className="space-y-2 max-h-36 overflow-hidden">
            {tasks.slice(0, 3).map((t) => (
              <div key={t.id} className="text-[11px] space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-semibold text-foreground truncate max-w-[130px]" title={t.title}>
                    {t.title}
                  </span>
                  <span className="font-mono font-medium text-[10px]">
                    {t.status === 'completed'
                      ? '已完成'
                      : t.status === 'error'
                      ? '失败'
                      : `${t.progress}% ${t.speed ? `· ${t.speed}` : ''}`}
                  </span>
                </div>
                <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      t.status === 'completed' ? 'bg-emerald-500' : t.status === 'error' ? 'bg-destructive' : 'bg-primary'
                    }`}
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
              </div>
            ))}
            {tasks.length > 3 && (
              <p className="text-[10px] text-muted-foreground text-center pt-0.5">
                + 其余 {tasks.length - 3} 个任务...
              </p>
            )}
          </div>

          <div className="mt-2.5 pt-1.5 border-t border-border/50 flex items-center justify-center text-[10px] text-primary font-semibold">
            <span>点击悬浮球查看完整面板</span>
            <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );
};
