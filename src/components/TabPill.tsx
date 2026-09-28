import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  const [indicatorStyle, setIndicatorStyle] = useState<{ x: number; width: number; opacity: number }>({
    x: 0,
    width: 0,
    opacity: 0,
  });

  const updateIndicator = useCallback(() => {
    const activeEl = tabRefs.current.get(activeTab);
    if (activeEl) {
      setIndicatorStyle({
        x: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        opacity: 1,
      });
    }
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
    // 延迟一帧确保 DOM 布局已完全就绪（兼容弹窗入场动画）
    const rafId = requestAnimationFrame(updateIndicator);
    const timer = setTimeout(updateIndicator, 80);

    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer);
      };
    }

    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [updateIndicator, tabs]);

  return (
    <div
      ref={containerRef}
      className="relative flex p-1 gap-1 rounded-xl bg-muted/80 border border-border/70 select-none overflow-hidden"
    >
      {/* 真实物理平滑滑块（Sliding Pill） - GPU 硬件加速 TranslateX + 弹性阻尼过渡 */}
      <div
        className="absolute top-1 bottom-1 left-0 rounded-lg bg-card border border-border/80 shadow-xs pointer-events-none"
        style={{
          width: `${indicatorStyle.width}px`,
          transform: `translateX(${indicatorStyle.x}px)`,
          opacity: indicatorStyle.opacity,
          transition: 'transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), width 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.15s ease',
          willChange: 'transform, width',
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
