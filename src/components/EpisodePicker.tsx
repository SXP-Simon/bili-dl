import React, { useRef, useEffect } from 'react';
import { Layers, Loader2, FolderArchive } from 'lucide-react';
import type { VideoPageItem } from '../types';

interface EpisodePickerProps {
  pages: VideoPageItem[];
  currentCid: number;
  loadingCid?: number | null;
  onSelectEpisode: (cid: number) => void;
  onDownloadBatchSubtitles?: () => void;
  isBatchSubtitleActive?: boolean;
}

export const EpisodePicker: React.FC<EpisodePickerProps> = ({
  pages,
  currentCid,
  loadingCid,
  onSelectEpisode,
  onDownloadBatchSubtitles,
  isBatchSubtitleActive,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const hasDragged = useRef(false);

  // 1. 监听鼠标滚轮垂直滑动，转换为平滑横向滚动
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // 2. 当前选中集数自动平滑滚动至居中视口
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeBtn = el.querySelector<HTMLElement>('[data-selected="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentCid]);

  if (!pages || pages.length <= 1) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftPos.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    if (Math.abs(walk) > 3) {
      hasDragged.current = true;
    }
    scrollContainerRef.current.scrollLeft = scrollLeftPos.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  return (
    <div className="mb-3 p-3 rounded-2xl bg-muted/40 border border-border/70">
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" strokeWidth={2.2} />
          <span>分 P 剧集 ({pages.length} 集 · 支持滚轮/拖拽横滑)</span>
        </div>
        
        <div className="flex items-center gap-2">
          {loadingCid ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.4} />
              正在解析切换...
            </span>
          ) : null}

          {onDownloadBatchSubtitles && (
            <button
              onClick={onDownloadBatchSubtitles}
              disabled={isBatchSubtitleActive}
              title="一键探测全集官方/AI字幕并打包为 ZIP 文件夹下载"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
                isBatchSubtitleActive
                  ? 'bg-primary/30 text-emerald-950 dark:text-emerald-100 border-primary/50'
                  : 'bg-primary/20 hover:bg-primary/30 text-emerald-900 dark:text-emerald-200 border-primary/40 hover:border-primary/60'
              }`}
            >
              {isBatchSubtitleActive ? (
                <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.4} />
              ) : (
                <FolderArchive className="w-3 h-3" strokeWidth={2.2} />
              )}
              <span>打包全集字幕</span>
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-clean cursor-grab active:cursor-grabbing select-none"
      >
        {pages.map((p) => {
          const isSelected = p.cid === currentCid;
          const isLoading = p.cid === loadingCid;

          return (
            <button
              key={p.cid}
              data-selected={isSelected ? 'true' : undefined}
              onClick={() => {
                if (hasDragged.current) return;
                if (!loadingCid && p.cid !== currentCid) {
                  onSelectEpisode(p.cid);
                }
              }}
              disabled={!!loadingCid}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                isLoading
                  ? 'bg-primary/20 text-emerald-950 dark:text-emerald-100 border border-primary/60 shadow-xs ring-1 ring-primary/30'
                  : isSelected
                  ? 'bg-primary/25 text-emerald-950 dark:text-emerald-100 border border-primary/50 shadow-2xs'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70 shadow-2xs'
              }`}
            >
              {isLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-700 dark:text-emerald-300 shrink-0" strokeWidth={2.4} />
              )}
              <span>P{p.page}: {p.part || `第${p.page}集`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
