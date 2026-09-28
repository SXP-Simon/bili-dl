import React from 'react';
import type { CategoryType } from '../types';

interface TabItem {
  key: CategoryType;
  label: string;
  badge?: number;
}

interface TabPillProps {
  tabs: TabItem[];
  activeTab: CategoryType;
  onChange: (tab: CategoryType) => void;
}

export const TabPill: React.FC<TabPillProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="flex p-1 gap-1 rounded-xl bg-black/5 dark:bg-white/10 backdrop-blur-md border border-white/10">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
              isActive
                ? 'bg-[#FF6699] text-white shadow-md shadow-pink-500/25 scale-[1.02]'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white hover:bg-white/30 dark:hover:bg-white/5'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isActive
                    ? 'bg-white text-[#FF6699]'
                    : 'bg-black/10 dark:bg-white/10 text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
