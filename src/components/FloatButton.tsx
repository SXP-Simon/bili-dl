import React from 'react';
import { Download, Loader2 } from 'lucide-react';

interface FloatButtonProps {
  loading: boolean;
  onClick: () => void;
}

export const FloatButton: React.FC<FloatButtonProps> = ({ loading, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="fixed right-6 bottom-24 z-[999999] flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-[#FF6699] to-[#FF3366] text-white font-bold text-sm shadow-xl shadow-pink-500/35 border border-white/40 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-pink-500/50 active:scale-95 cursor-pointer select-none"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span>{loading ? '解析中...' : '下载'}</span>
    </button>
  );
};
