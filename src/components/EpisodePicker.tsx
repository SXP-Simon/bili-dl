import React from 'react';
import { Layers } from 'lucide-react';
import type { VideoPageItem } from '../types';

interface EpisodePickerProps {
  pages: VideoPageItem[];
  currentCid: number;
  onSelectEpisode: (cid: number) => void;
}

export const EpisodePicker: React.FC<EpisodePickerProps> = ({
  pages,
  currentCid,
  onSelectEpisode,
}) => {
  if (!pages || pages.length <= 1) return null;

  return (
    <div className="mb-3 p-3 rounded-2xl bg-muted/40 border border-border/70">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <Layers className="w-3.5 h-3.5 text-primary" />
        <span>分 P 剧集 ({pages.length} 集)</span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-clean">
        {pages.map((p) => {
          const isSelected = p.cid === currentCid;
          return (
            <button
              key={p.cid}
              onClick={() => onSelectEpisode(p.cid)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-card text-card-foreground hover:bg-muted border border-border/70 shadow-2xs'
              }`}
            >
              P{p.page}: {p.part || `第${p.page}集`}
            </button>
          );
        })}
      </div>
    </div>
  );
};
