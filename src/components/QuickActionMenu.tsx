import React, { useEffect, useRef } from 'react';
import { Loader2, Globe, Rocket, AlertCircle, Languages } from 'lucide-react';
import type { QuickActionItem, QuickMenuHeaderInfo } from '../types';

interface QuickActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  actions: QuickActionItem[];
  headerInfo?: QuickMenuHeaderInfo;
  anchorPosition?: {
    x?: number;
    y?: number;
    buttonRect?: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  };
  engine?: 'internal' | 'external';
  onToggleEngine?: (engine: 'internal' | 'external') => void;
  activeDownloaderShortName?: string;
  isExternalAvailable?: boolean;
  isCheckingExternal?: boolean;
  languages?: ReadonlyArray<{ code: string; name: string }>;
  selectedLanguage?: string;
  onSelectLanguage?: (lang: string) => void;
}

/**
 * 极简原生感快捷右键菜单 (紧凑轻量、紧贴悬浮球、零多余占位、带目标视频实时就绪指示头与引擎切换器)
 */
export const QuickActionMenu: React.FC<QuickActionMenuProps> = ({
  isOpen,
  onClose,
  actions,
  headerInfo,
  anchorPosition,
  engine = 'internal',
  onToggleEngine,
  activeDownloaderShortName = '外部',
  isExternalAvailable = false,
  isCheckingExternal = false,
  languages,
  selectedLanguage = 'chinese',
  onSelectLanguage,
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

  const itemHeight = 34;
  const menuPadding = 8;
  const headerHeight = headerInfo ? 36 : 0;
  const engineSwitcherHeight = onToggleEngine ? 30 : 0;
  const langSelectorHeight = onSelectLanguage && languages && languages.length > 0 ? 30 : 0;
  const noticeHeight = engine === 'external' ? 24 : 0;
  const menuWidth = 295;
  const menuHeight = actions.length * itemHeight + menuPadding + headerHeight + engineSwitcherHeight + langSelectorHeight + noticeHeight;

  let left = 0;
  let top = 0;

  if (anchorPosition?.buttonRect) {
    const { buttonRect } = anchorPosition;
    // 悬浮球若在屏幕下半部分，贴在悬浮球正上方（间隔 4px）
    if (buttonRect.top > menuHeight + 16) {
      top = buttonRect.top - menuHeight - 4;
    } else {
      // 否则贴在悬浮球下方
      top = buttonRect.bottom + 4;
    }
    // 左侧对齐悬浮球，若超出屏幕右侧则自适应靠右
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
        className="absolute w-[295px] p-1 rounded-xl bg-card/95 dark:bg-neutral-900/95 backdrop-blur-md border border-border/80 shadow-xl select-none text-card-foreground animate-modal-in overflow-hidden"
      >
        {/* 顶部目标信息上下文头：标明操作对象，消除切换盲区 */}
        {headerInfo && (
          <div className="px-2.5 py-1.5 mb-1 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-between gap-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {headerInfo.isReady ? (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ) : (
                <Loader2 className="w-2.5 h-2.5 shrink-0 text-primary animate-spin" />
              )}
              <span className="truncate font-medium text-foreground">
                {headerInfo.isReady
                  ? headerInfo.title || headerInfo.pageText || headerInfo.bvid || '视频已就绪'
                  : '正在同步新视频数据...'}
              </span>
            </div>

            {headerInfo.bvid && (
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 bg-background/80 px-1 py-0.2 rounded border border-border/40">
                {headerInfo.bvid.slice(0, 8)}..
              </span>
            )}
          </div>
        )}

        {/* 顶部下载引擎切换器: 浏览器内置 vs 外部持久化下载器 */}
        {onToggleEngine && (
          <div className="flex items-center justify-between p-0.5 mb-1 rounded-lg bg-muted/50 border border-border/40 text-[11px]">
            <button
              type="button"
              onClick={() => onToggleEngine('internal')}
              className={`flex-1 py-1 rounded-md text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                engine !== 'external'
                  ? 'bg-card text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
              <span>浏览器内置</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleEngine('external')}
              className={`flex-1 py-1 rounded-md text-center font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                engine === 'external'
                  ? 'bg-primary/20 text-emerald-950 dark:text-emerald-100 font-bold shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
              <span>{activeDownloaderShortName}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isCheckingExternal
                    ? 'bg-sky-400 animate-pulse'
                    : isExternalAvailable
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
                title={isExternalAvailable ? '客户端在线已就绪' : '未检测到客户端运行'}
              />
            </button>
          </div>
        )}

        {/* 语言选择栏（用于 AI Whisper 本地转写及字幕语言指定） */}
        {onSelectLanguage && languages && languages.length > 0 && (
          <div className="flex items-center justify-between px-2 py-1 mb-1 rounded-lg bg-muted/40 border border-border/40 text-[11px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Languages className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>转写语言</span>
            </div>
            <select
              value={selectedLanguage}
              onChange={(e) => onSelectLanguage(e.target.value)}
              className="bg-card/90 text-foreground border border-border/60 rounded px-1.5 py-0.5 text-[10.5px] font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer shadow-2xs"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-popover text-popover-foreground">
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-colors duration-100 group cursor-pointer ${
                  action.danger
                    ? 'hover:bg-destructive/15 text-destructive'
                    : isDisabled
                    ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                    : 'text-foreground hover:bg-primary/15 dark:hover:bg-primary/20 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="flex h-4 w-4 items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                    {action.loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" strokeWidth={2.4} />
                    ) : (
                      action.icon
                    )}
                  </div>

                  <span className="whitespace-nowrap tracking-tight text-[12.5px]">
                    {action.label}
                  </span>
                </div>

                {action.badge && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border transition-colors shrink-0 ${
                      action.badge.includes('在线') || action.badge.includes('已就绪') || action.badge.includes('已连接')
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 shadow-2xs font-bold'
                        : action.badge.includes('离线') || action.badge.includes('未运行') || action.badge.includes('未检测')
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30'
                        : 'bg-muted text-muted-foreground border-border/60 group-hover:bg-primary/20 group-hover:text-primary'
                    }`}
                  >
                    {action.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 外部下载器原始流提醒 */}
        {engine === 'external' && (
          <div className="mt-1 pt-1 border-t border-border/40 px-2 py-0.5 flex items-center gap-1.5 text-[10px] text-amber-800 dark:text-amber-300 bg-amber-500/10 rounded-md">
            <AlertCircle className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate">外部下载为原始 .m4s 轨（不自动混流合成 MP4）</span>
          </div>
        )}
      </div>
    </div>
  );
};
