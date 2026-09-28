import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  content: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000000] flex flex-col gap-2 pointer-events-none items-center">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-zinc-900/90 dark:bg-zinc-800/95 text-white text-xs font-medium shadow-2xl border border-white/15 backdrop-blur-xl animate-spring-pop">
      {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
      {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
      {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />}
      <span className="leading-snug">{toast.content}</span>
      <button
        onClick={onRemove}
        className="ml-1 p-0.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
