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
    <div className="mb-4 p-3 rounded-2xl bg-white/40 dark:bg-zinc-800/40 border border-white/20 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-2">
        <Layers className="w-3.5 h-3.5 text-[#FF6699]" />
        <span>分 P / 剧集选择 (共 {pages.length} 集)</span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {pages.map((p) => {
          const isSelected = p.cid === currentCid;
          return (
            <button
              key={p.cid}
              onClick={() => onSelectEpisode(p.cid)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-[#FF6699] text-white shadow-sm scale-105'
                  : 'bg-white/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-600'
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
