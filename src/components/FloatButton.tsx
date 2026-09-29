import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, GripVertical } from 'lucide-react';

interface FloatButtonProps {
  loading: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent, pos: { x: number; y: number }) => void;
}

export const FloatButton: React.FC<FloatButtonProps> = ({ loading, onClick, onContextMenu }) => {
  const [position, setPosition] = useState<{ x?: number; y?: number }>({});
  const [isDragging, setIsDragging] = useState(false);
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

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        setIsDragging(true);
        const newX = Math.max(12, Math.min(window.innerWidth - 140, dragStartRef.current.initialX + dx));
        const newY = Math.max(12, Math.min(window.innerHeight - 56, dragStartRef.current.initialY + dy));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (position.x !== undefined && position.y !== undefined) {
        localStorage.setItem('bili_dl_btn_pos', JSON.stringify(position));
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClick = () => {
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

  return (
    <div
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title="Bili-DL 媒体下载 (左键打开面板 · 右键快捷下载 · 可拖拽移动)"
      style={
        isCustomPos
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
          : undefined
      }
      className={`fixed ${
        !isCustomPos ? 'right-8 bottom-28' : ''
      } z-[99999999] group flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-full bg-card text-card-foreground text-xs font-semibold shadow-md border border-border/80 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-border active:scale-[0.98] cursor-pointer select-none`}
    >
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground -mr-1 cursor-grab active:cursor-grabbing transition-colors" />

      {/* 清新翠绿徽章指示器 */}
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-2xs">
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Download className="w-3 h-3" />
        )}
      </div>

      <span className="tracking-tight font-medium">
        {loading ? '正在解析' : 'Bili-DL 下载'}
      </span>
    </div>
  );
};
