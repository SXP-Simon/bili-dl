import React, { useRef, useState, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<CategoryType, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  useEffect(() => {
    const activeEl = tabRefs.current.get(activeTab);
    const container = containerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
        opacity: 1,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div
      ref={containerRef}
      className="relative flex p-1 gap-1 rounded-xl bg-muted/80 border border-border/70 select-none overflow-hidden"
    >
      {/* 真实物理平滑滑块（Sliding Pill） */}
      <div
        className="absolute top-1 bottom-1 rounded-lg bg-card border border-border/80 shadow-xs pointer-events-none transition-all duration-300"
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
          opacity: indicatorStyle.opacity,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.key, el);
              else tabRefs.current.delete(tab.key);
            }}
            onClick={() => onChange(tab.key)}
            className={`relative z-10 flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] ${
              isActive
                ? 'text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="tracking-tight">{tab.label}</span>
            {typeof tab.badge === 'number' && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/20 text-emerald-950 dark:text-emerald-200 shadow-2xs'
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
