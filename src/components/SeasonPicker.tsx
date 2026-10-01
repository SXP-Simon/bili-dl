import React, { useRef, useEffect } from 'react';
import { Film, Loader2, FolderArchive, Download, Music } from 'lucide-react';
import type { UgcSeasonData } from '../types';

interface SeasonPickerProps {
  ugcSeason: UgcSeasonData;
  currentBvid: string;
  loadingBvid?: string | null;
  onSelectEpisode: (bvid: string) => void;
  onDownloadSeasonVideos?: () => void;
  onDownloadSeasonAudios?: () => void;
  onDownloadSeasonSubtitles?: () => void;
  isSeasonActionActive?: boolean;
}

export const SeasonPicker: React.FC<SeasonPickerProps> = ({
  ugcSeason,
  currentBvid,
  loadingBvid,
  onSelectEpisode,
  onDownloadSeasonVideos,
  onDownloadSeasonAudios,
  onDownloadSeasonSubtitles,
  isSeasonActionActive,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);
  const hasDragged = useRef(false);

  // 1. 鼠标滚轮转横向滚动
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

  // 2. 选中条目居中滚动
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeBtn = el.querySelector<HTMLElement>('[data-selected="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentBvid]);

  if (!ugcSeason || !ugcSeason.episodes || ugcSeason.episodes.length === 0) return null;

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
      <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Film className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" strokeWidth={2.2} />
          <span className="truncate" title={ugcSeason.title}>
            合集: {ugcSeason.title} ({ugcSeason.episodes.length} 集)
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {loadingBvid ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 animate-pulse mr-1">
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.4} />
              加载选集中...
            </span>
          ) : null}

          {onDownloadSeasonVideos && (
            <button
              onClick={onDownloadSeasonVideos}
              disabled={isSeasonActionActive}
              title="一键下载本合集所有选集的最高画质并混流 MP4"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
                isSeasonActionActive
                  ? 'bg-primary/30 text-emerald-950 dark:text-emerald-100 border-primary/50'
                  : 'bg-primary/20 hover:bg-primary/30 text-emerald-900 dark:text-emerald-200 border-primary/40 hover:border-primary/60'
              }`}
            >
              <Download className="w-3 h-3" strokeWidth={2.2} />
              <span>全集最高画质</span>
            </button>
          )}

          {onDownloadSeasonAudios && (
            <button
              onClick={onDownloadSeasonAudios}
              disabled={isSeasonActionActive}
              title="一键提取本合集所有选集的音频 (播客/学习)"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
                isSeasonActionActive
                  ? 'bg-primary/30 text-emerald-950 dark:text-emerald-100 border-primary/50'
                  : 'bg-primary/20 hover:bg-primary/30 text-emerald-900 dark:text-emerald-200 border-primary/40 hover:border-primary/60'
              }`}
            >
              <Music className="w-3 h-3" strokeWidth={2.2} />
              <span>全集音频</span>
            </button>
          )}

          {onDownloadSeasonSubtitles && (
            <button
              onClick={onDownloadSeasonSubtitles}
              disabled={isSeasonActionActive}
              title="一键探测合集全量字幕并打包为 ZIP 文件"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs ${
                isSeasonActionActive
                  ? 'bg-primary/30 text-emerald-950 dark:text-emerald-100 border-primary/50'
                  : 'bg-primary/20 hover:bg-primary/30 text-emerald-900 dark:text-emerald-200 border-primary/40 hover:border-primary/60'
              }`}
            >
              <FolderArchive className="w-3 h-3" strokeWidth={2.2} />
              <span>全集字幕</span>
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
        {ugcSeason.episodes.map((ep) => {
          const isSelected = ep.bvid === currentBvid;
          const isLoading = ep.bvid === loadingBvid;

          return (
            <button
              key={ep.bvid}
              data-selected={isSelected ? 'true' : undefined}
              onClick={() => {
                if (hasDragged.current) return;
                if (!loadingBvid && ep.bvid !== currentBvid) {
                  onSelectEpisode(ep.bvid);
                }
              }}
              disabled={!!loadingBvid}
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
              <span>第{ep.pageIndex}集: {ep.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
