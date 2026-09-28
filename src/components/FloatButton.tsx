import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Sparkles, GripVertical } from 'lucide-react';

interface FloatButtonProps {
  loading: boolean;
  onClick: () => void;
}

export const FloatButton: React.FC<FloatButtonProps> = ({ loading, onClick }) => {
  const [position, setPosition] = useState<{ x?: number; y?: number }>({});
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const buttonRef = useRef<HTMLDivElement>(null);

  // 恢复保存的位置
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bili_dl_btn_pos');
      if (saved) {
        setPosition(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 仅左键
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
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        setIsDragging(true);
        const newX = Math.max(10, Math.min(window.innerWidth - 120, dragStartRef.current.initialX + dx));
        const newY = Math.max(10, Math.min(window.innerHeight - 60, dragStartRef.current.initialY + dy));
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

  const isCustomPos = position.x !== undefined && position.y !== undefined;

  return (
    <div
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      title="点击唤起 Bili-DL 下载面板 (支持 4K/MP4/音频/弹幕/多P，可按住拖拽移动)"
      style={
        isCustomPos
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' }
          : undefined
      }
      className={`fixed ${
        !isCustomPos ? 'right-8 bottom-28' : ''
      } z-[99999999] group flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-[#FF6699] to-[#FF3366] text-white font-bold text-xs shadow-2xl shadow-pink-500/40 border border-white/30 backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:shadow-pink-500/60 active:scale-95 cursor-pointer select-none`}
    >
      <GripVertical className="w-3 h-3 text-white/50 -ml-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-white" />
      ) : (
        <Download className="w-4 h-4 text-white group-hover:-translate-y-0.5 transition-transform" />
      )}
      
      <span className="tracking-wide">{loading ? '解析中...' : 'Bili-DL 下载'}</span>

      {/* 鼠标悬浮 Tooltip 气泡 */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap px-3 py-1.5 rounded-xl bg-zinc-900/95 text-white text-[11px] font-medium shadow-xl border border-white/15 backdrop-blur-md">
        <span>支持 4K MP4 / 独立音频 / 弹幕 (可拖拽移动)</span>
      </div>
    </div>
  );
};
