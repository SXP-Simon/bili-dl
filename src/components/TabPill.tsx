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
    <div className="flex p-1 gap-1 rounded-xl bg-muted/80 border border-border/70">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] ${
              isActive
                ? 'bg-card text-foreground font-semibold shadow-xs border border-border/70'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50 border border-transparent'
            }`}
          >
            <span className="tracking-tight">{tab.label}</span>
            {typeof tab.badge === 'number' && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary-foreground font-semibold'
                    : 'bg-muted text-muted-foreground'
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
