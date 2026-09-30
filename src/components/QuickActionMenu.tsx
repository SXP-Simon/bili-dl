import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { QuickActionItem } from '../types';

interface QuickActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  actions: QuickActionItem[];
  anchorPosition?: {
    x?: number;
    y?: number;
    buttonRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  };
}

/**
 * 极简原生感快捷右键菜单 (紧凑轻量、紧贴悬浮球、零多余占位)
 */
export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  isOpen,
  onClose,
  actions,
  anchorPosition,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || actions.length === 0) return null;

  // 极简紧凑尺寸：单项约 34px，整体 3 项仅 ~110px 高度，宽度 200px
  const itemHeight = 34;
  const menuPadding = 8;
  const menuWidth = 204;
  const menuHeight = actions.length * itemHeight + menuPadding;

  let left = 0;
  let top = 0;

  if (anchorPosition?.buttonRect) {
    const { buttonRect } = anchorPosition;
    // 悬浮球若在屏幕下半部分，贴在悬浮球正上方（间隙 4px）
    if (buttonRect.top > menuHeight + 16) {
      top = buttonRect.top - menuHeight - 4;
    } else {
      // 否则贴在悬浮球下方
      top = buttonRect.bottom + 4;
    }
    // 左侧对齐悬浮球，若超出屏幕右侧则右对齐
    left = Math.max(8, Math.min(window.innerWidth - menuWidth - 12, buttonRect.left));
  } else if (anchorPosition?.x !== undefined && anchorPosition?.y !== undefined) {
    if (anchorPosition.y > menuHeight + 16) {
      top = anchorPosition.y - menuHeight - 4;
    } else {
      top = anchorPosition.y + 4;
    }
    left = Math.max(8, Math.min(window.innerWidth - menuWidth - 12, anchorPosition.x));
  } else {
    top = window.innerHeight - menuHeight - 80;
    left = window.innerWidth - menuWidth - 24;
  }

  return (
    <div
      className="fixed inset-0 z-[10000000] bg-transparent"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div
        ref={menuRef}
        style={{ left: `${left}px`, top: `${top}px` }}
        onClick={(e) => e.stopPropagation()}
        className="absolute w-[204px] p-1 rounded-xl bg-card/95 dark:bg-neutral-900/95 backdrop-blur-md border border-border/80 shadow-xl select-none text-card-foreground animate-modal-in"
      >
        <div className="space-y-0.5">
          {actions.map((action) => {
            const isDisabled = action.disabled || action.loading;

            return (
              <button
                key={action.id}
                type="button"
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
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-colors duration-100 group cursor-pointer ${
                  action.danger
                    ? 'hover:bg-destructive/15 text-destructive'
                    : isDisabled
                    ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                    : 'text-foreground hover:bg-primary/15 dark:hover:bg-primary/20 active:scale-[0.99]'
                }`}
              >
                <div className="flex h-4 w-4 items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                  {action.loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" strokeWidth={2.4} />
                  ) : (
                    action.icon
                  )}
                </div>

                <span className="flex-1 truncate tracking-tight text-[12.5px]">
                  {action.label}
                </span>

                {action.badge && (
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border/60 group-hover:bg-primary/20 group-hover:text-primary transition-colors shrink-0">
                    {action.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
