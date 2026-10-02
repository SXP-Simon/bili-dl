import React, { useState, useRef } from 'react';
import { Download, Loader2, GripVertical, CheckCircle2, AlertCircle, ArrowUpRight } from 'lucide-react';
import type { DownloadTask } from '../types';

interface FloatButtonProps {
  loading: boolean;
  isSwitching?: boolean;
  tasks?: DownloadTask[];
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent, pos: { x: number; y: number }) => void;
}

export const FloatButton: React.FC<FloatButtonProps> = ({
  loading,
  isSwitching = false,
  tasks = [],
  onClick,
  onContextMenu,
}) => {
  const [position, setPosition] = useState<{ x?: number; y?: number }>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bili_dl_btn_pos');
        if (saved) {
          const parsed = JSON.parse(saved) as { x?: number; y?: number };
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const clampedX = Math.max(12, Math.min(window.innerWidth - 160, parsed.x));
            const clampedY = Math.max(12, Math.min(window.innerHeight - 50, parsed.y));
            return { x: clampedX, y: clampedY };
          }
        }
      }
    } catch {}
    return {};
  });
  const [isDragging, setIsDragging] = useState(false);
  const [tiltAngle, setTiltAngle] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  const lastPosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const currentPosRef = useRef<{ x: number; y: number }>({ x: position.x || 0, y: position.y || 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const wasDraggedRef = useRef(false);

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
    currentPosRef.current = { x: rect.left, y: rect.top };
    lastPosRef.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    velocityRef.current = { vx: 0, vy: 0 };
    wasDraggedRef.current = false;

    let hasExceededThreshold = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;

      // 超过微小阈值判定为正式拖拽
      if (!hasExceededThreshold && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasExceededThreshold = true;
        wasDraggedRef.current = true;
        setIsDragging(true);
      }

      if (hasExceededThreshold) {
        const now = performance.now();
        const dt = Math.max(1, now - lastPosRef.current.time);
        const instVx = (moveEvent.clientX - lastPosRef.current.x) / dt;
        const instVy = (moveEvent.clientY - lastPosRef.current.y) / dt;

        // 指数平滑滤波计算瞬时手速
        velocityRef.current = {
          vx: velocityRef.current.vx * 0.35 + instVx * 0.65,
          vy: velocityRef.current.vy * 0.35 + instVy * 0.65,
        };
        lastPosRef.current = { x: moveEvent.clientX, y: moveEvent.clientY, time: now };

        // 真实跟手坐标计算 (实时 1:1 响应无延迟)
        const btnWidth = rect.width || 180;
        const btnHeight = rect.height || 40;
        const newX = Math.max(8, Math.min(window.innerWidth - btnWidth - 8, dragStartRef.current.initialX + dx));
        const newY = Math.max(8, Math.min(window.innerHeight - btnHeight - 8, dragStartRef.current.initialY + dy));

        currentPosRef.current = { x: newX, y: newY };
        setPosition({ x: newX, y: newY });

        // 根据水平速度产生自然侧倾角度 (-4° ~ 4°)
        const targetTilt = Math.max(-4, Math.min(4, velocityRef.current.vx * 3));
        setTiltAngle(targetTilt);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (hasExceededThreshold) {
        const now = performance.now();
        const dt = now - lastPosRef.current.time;

        // 如果在松手前静止了超过 90ms，则不施加惯性冲量
        let vx = dt > 90 ? 0 : velocityRef.current.vx;
        let vy = dt > 90 ? 0 : velocityRef.current.vy;

        // 限制最大惯性初速度，防止飞出或过冲
        vx = Math.max(-2.2, Math.min(2.2, vx));
        vy = Math.max(-2.2, Math.min(2.2, vy));

        // 物理惯性滑行距离 (以毫秒速度投射 ~140ms 动量衰减)
        const throwDistX = vx * 140;
        const throwDistY = vy * 140;

        const btnWidth = rect.width || 180;
        const btnHeight = rect.height || 40;

        const targetX = Math.round(
          Math.max(12, Math.min(window.innerWidth - btnWidth - 12, currentPosRef.current.x + throwDistX))
        );
        const targetY = Math.round(
          Math.max(12, Math.min(window.innerHeight - btnHeight - 12, currentPosRef.current.y + throwDistY))
        );

        setPosition({ x: targetX, y: targetY });
        currentPosRef.current = { x: targetX, y: targetY };
        setTiltAngle(0);
        setIsDragging(false);

        try {
          localStorage.setItem('bili_dl_btn_pos', JSON.stringify({ x: targetX, y: targetY }));
        } catch {}

        // 延迟清除 wasDragged 状态，避免触发 onClick
        setTimeout(() => {
          wasDraggedRef.current = false;
        }, 100);
      } else {
        setIsDragging(false);
        setTiltAngle(0);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!wasDraggedRef.current && !isDragging && !loading) {
      onClick();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu && !wasDraggedRef.current) {
      const rect = buttonRef.current?.getBoundingClientRect();
      const pos = {
        x: e.clientX,
        y: e.clientY,
        buttonRect: rect
          ? {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            }
          : undefined,
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

  const showSpinLoader = isSwitching || loading || hasActiveTasks;

  return (
    <div
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Bili-DL 媒体下载 (左键打开面板 · 右键快捷下载 · 可拖拽移动)"
      style={{
        ...(isCustomPos
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
          : {}),
        transform: isDragging
          ? `scale(1.035) rotate(${tiltAngle}deg)`
          : isHovered
          ? 'translateY(-2px)'
          : 'scale(1) rotate(0deg)',
        transition: isDragging
          ? 'transform 0.08s ease-out'
          : 'left 0.45s cubic-bezier(0.16, 1, 0.3, 1), top 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
      }}
      className={`fixed ${
        !isCustomPos ? 'right-8 bottom-28' : ''
      } z-[99999999] group flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full bg-card/95 backdrop-blur-md text-card-foreground text-xs font-semibold shadow-lg border ${
        isSwitching
          ? 'border-primary/60 ring-2 ring-primary/20'
          : 'border-border/80'
      } ${
        isDragging
          ? 'cursor-grabbing shadow-2xl ring-2 ring-primary/30 border-primary/60'
          : 'cursor-pointer hover:shadow-xl hover:border-primary/50'
      } select-none overflow-hidden`}
    >
      <GripVertical
        className={`w-3.5 h-3.5 -mr-0.5 shrink-0 transition-colors ${
          isDragging ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'
        }`}
      />

      {/* 清新翠绿徽章指示器 (下载状态与切换状态自适应变幻) */}
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full font-bold shadow-2xs transition-all duration-300 shrink-0 ${
          hasActiveTasks || isSwitching
            ? 'bg-primary text-primary-foreground animate-pulse'
            : errorTasks.length > 0 && !hasActiveTasks
            ? 'bg-destructive text-destructive-foreground'
            : completedTasks.length > 0 && !hasActiveTasks && tasks.length > 0
            ? 'bg-emerald-600 text-white'
            : 'bg-primary text-primary-foreground'
        }`}
      >
        {showSpinLoader ? (
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
        {isSwitching ? (
          <span className="tracking-tight font-medium text-primary animate-pulse">识别新视频...</span>
        ) : loading ? (
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
