import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DownloadProgress } from '../types';

interface ProgressBarProps {
  progress: DownloadProgress;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  if (progress.status === 'idle') return null;

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-card border border-border/80 text-card-foreground shadow-xs animate-toast-in">
      <div className="flex justify-between items-center text-xs font-medium mb-2.5">
        <div className="flex items-center gap-2">
          {progress.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          {progress.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
          {progress.status !== 'completed' && progress.status !== 'error' && (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}
          <span className="text-foreground font-medium tracking-tight">{progress.message || '处理中...'}</span>
        </div>
        <span className="text-foreground font-mono font-bold text-xs">{progress.progress}%</span>
      </div>

      <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-200 ease-out rounded-full relative overflow-hidden"
          style={{ width: `${Math.min(100, Math.max(0, progress.progress))}%` }}
        >
          {progress.status !== 'completed' && progress.status !== 'error' && (
            <div className="absolute inset-0 animate-streaming" />
          )}
        </div>
      </div>
    </div>
  );
};
