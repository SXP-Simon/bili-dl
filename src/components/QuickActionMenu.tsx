import React, { useEffect, useRef } from 'react';
import { Sparkles, Loader2, ChevronRight } from 'lucide-react';
import type { QuickActionItem } from '../types';

interface QuickActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  actions: QuickActionItem[];
  anchorPosition?: { x?: number; y?: number };
  title?: string;
}

/**
 * 抽象的高可复用快捷功能上下文菜单组件 (TweakCN Light Green + OKLCH 风格)
 * 方便后续随心扩展和注入各类批量与全局快捷功能
 */
export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  isOpen,
  onClose,
  actions,
  anchorPosition,
  title = '快捷下载菜单',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 20);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || actions.length === 0) return null;

  // 智能计算定位，确保菜单不会被屏幕边缘截断
  const menuWidth = 280;
  const menuHeight = actions.length * 68 + 60;

  let left = anchorPosition?.x !== undefined ? anchorPosition.x : window.innerWidth - menuWidth - 32;
  let top = anchorPosition?.y !== undefined ? anchorPosition.y - menuHeight : window.innerHeight - menuHeight - 110;

  // 视口边界碰撞检测与矫正
  left = Math.max(16, Math.min(window.innerWidth - menuWidth - 16, left));
  top = Math.max(16, Math.min(window.innerHeight - menuHeight - 16, top));

  return (
    <div className="fixed inset-0 z-[10000000] pointer-events-none">
      <div
        ref={menuRef}
        style={{ left: `${left}px`, top: `${top}px` }}
        className="pointer-events-auto absolute w-[280px] rounded-2xl bg-card/95 backdrop-blur-md border border-border/85 shadow-2xl overflow-hidden animate-modal-in select-none text-card-foreground"
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40 border-b border-border/70">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/20 text-emerald-800 dark:text-emerald-300 border border-primary/40 shadow-2xs font-bold">
              <Sparkles className="w-3 h-3 text-emerald-700 dark:text-emerald-300" strokeWidth={2.4} />
            </div>
            <span className="text-xs font-bold tracking-tight text-foreground">{title}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">右键快捷入口</span>
        </div>

        {/* 快捷动作列表 */}
        <div className="p-1.5 space-y-1">
          {actions.map((action) => {
            const isDisabled = action.disabled || action.loading;

            return (
              <button
                key={action.id}
                disabled={isDisabled}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isDisabled) return;
                  onClose();
                  try {
                    await action.onClick();
                  } catch (err) {
                    console.error('[QuickAction] 执行异常:', err);
                  }
                }}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 group cursor-pointer ${
                  action.danger
                    ? 'hover:bg-destructive/10 text-destructive'
                    : isDisabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-primary/15 active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                      action.danger
                        ? 'bg-destructive/15 text-destructive border border-destructive/30'
                        : 'bg-primary/20 text-emerald-900 dark:text-emerald-200 border border-primary/40 shadow-2xs group-hover:bg-primary/30'
                    }`}
                  >
                    {action.loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" strokeWidth={2.4} />
                    ) : (
                      action.icon
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground tracking-tight truncate">
                        {action.label}
                      </span>
                      {action.badge && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-secondary/40 text-secondary-foreground border border-secondary/50 shrink-0">
                          {action.badge}
                        </span>
                      )}
                    </div>
                    {action.description && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {action.description}
                      </p>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-1" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
