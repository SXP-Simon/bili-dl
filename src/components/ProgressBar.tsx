import React from 'react';
import type { DownloadProgress } from '../types';

interface ProgressBarProps {
  progress: DownloadProgress;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (progress.status === 'idle') return null;

  return (
    <div className="mt-4 p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-800/90 border border-[#FF6699]/30 shadow-lg backdrop-blur-md animate-spring-pop">
      <div className="flex justify-between items-center text-xs font-bold mb-2">
        <span className="text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
          {progress.status === 'completed' ? '✨' : '⚡'}
          {progress.message || '处理中...'}
        </span>
        <span className="text-[#FF6699] font-extrabold">{progress.progress}%</span>
      </div>

      <div className="relative h-2.5 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#FF6699] via-pink-400 to-[#00AEEC] transition-all duration-300 rounded-full relative"
          style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }}
        >
          {progress.status !== 'completed' && progress.status !== 'error' && (
            <div className="absolute inset-0 animate-shimmer" />
          )}
        </div>
      </div>
    </div>
  );
};
