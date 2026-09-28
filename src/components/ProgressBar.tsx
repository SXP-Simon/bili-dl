import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, HardDriveDownload } from 'lucide-react';
import type { DownloadProgress } from '../types';

interface ProgressBarProps {
  progress: DownloadProgress;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (progress.status === 'idle') return null;

  return (
    <div className="mt-3 p-3 rounded-2xl bg-zinc-900/90 dark:bg-zinc-800/95 border border-white/10 shadow-2xl backdrop-blur-xl animate-spring-pop text-white">
      <div className="flex justify-between items-center text-xs font-semibold mb-2">
        <div className="flex items-center gap-2">
          {progress.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {progress.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {progress.status !== 'completed' && progress.status !== 'error' && (
            <Loader2 className="w-4 h-4 text-[#FF6699] animate-spin" />
          )}
          <span className="text-zinc-200">{progress.message || '处理中...'}</span>
        </div>
        <span className="text-[#FF6699] font-mono font-bold">{progress.progress}%</span>
      </div>

      <div className="relative h-2 w-full bg-zinc-700/60 rounded-full overflow-hidden">
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
