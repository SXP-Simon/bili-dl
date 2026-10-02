import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Copy,
  Check,
  Trash2,
  X,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { logger } from '../utils/logger';
import type { LogEntry, LogLevel } from '../types';

interface LogViewerProps {
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ onClose, isMaximized = false, onToggleMaximize }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterTrace, setFilterTrace] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const logContainerRef = useRef<HTMLDivElement>(null);
  const traceScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs([...newLogs]);
    });
    return () => unsubscribe();
  }, []);

  // 内部精确定位滚动，避免 scrollIntoView 导致上层 Modal 或 Header 被顶出视口
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const isDraggingTrace = useRef(false);
  const traceStartX = useRef(0);
  const traceScrollLeft = useRef(0);
  const hasDraggedTrace = useRef(false);

  const availableTraces = Array.from(
    new Set(logs.map((l) => l.traceId).filter((t): t is string => Boolean(t)))
  );

  // 任务 TraceID 标签栏支持鼠标滚轮横向滑动 (低灵敏度阻尼，支持精细逐像素/逐标签细粒度平滑浏览)
  useEffect(() => {
    const el = traceScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta !== 0) {
        e.preventDefault();
        // 降低滚轮灵敏度系数至 0.22x，使单格滚轮位移降至 ~22px 细粒度微调
        el.scrollLeft += delta * 0.22;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [availableTraces.length]);

  const handleTraceMouseDown = (e: React.MouseEvent) => {
    if (!traceScrollRef.current) return;
    isDraggingTrace.current = true;
    hasDraggedTrace.current = false;
    traceStartX.current = e.pageX - traceScrollRef.current.offsetLeft;
    traceScrollLeft.current = traceScrollRef.current.scrollLeft;
  };

  const handleTraceMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingTrace.current || !traceScrollRef.current) return;
    const x = e.pageX - traceScrollRef.current.offsetLeft;
    // 1:1 稳健细粒度跟手拖拽，避免超调
    const walk = x - traceStartX.current;
    if (Math.abs(walk) > 3) {
      hasDraggedTrace.current = true;
    }
    traceScrollRef.current.scrollLeft = traceScrollLeft.current - walk;
  };

  const handleTraceMouseUpOrLeave = () => {
    isDraggingTrace.current = false;
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterTrace !== 'all' && log.traceId !== filterTrace) return false;
    return true;
  });

  const handleCopyLogs = () => {
    const targetLogs = filterTrace !== 'all' || filterLevel !== 'all' ? filteredLogs : logs;
    const text = targetLogs
      .map(
        (l) =>
          `[${l.timeStr}] [${l.level.toUpperCase()}] [${l.tag}]${l.traceId ? ` [${l.traceId}]` : ''} ${l.message}${
            l.details ? `\nDetails: ${typeof l.details === 'object' ? JSON.stringify(l.details, null, 2) : String(l.details)}` : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleDetail = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const warnCount = logs.filter((l) => l.level === 'warn').length;

  const renderLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-destructive/15 text-destructive border border-destructive/30">
            <AlertCircle className="w-2.5 h-2.5" /> ERR
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-2.5 h-2.5" /> WARN
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-2.5 h-2.5" /> OK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            <Info className="w-2.5 h-2.5" /> INFO
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-t border-border/80 text-foreground animate-toast-in">
      {/* 日志控制栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-3.5 py-1.5 bg-muted/60 border-b border-border/70 gap-2">
        {/* 左侧：标题与计数徽章 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30">
            <Terminal className="w-3 h-3" strokeWidth={2.2} />
          </div>
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            诊断日志 ({logs.length})
          </span>
          {errorCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-destructive/20 text-destructive border border-destructive/30 whitespace-nowrap">
              {errorCount} 异常
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
              {warnCount} 警告
            </span>
          )}
        </div>

        {/* 中间：任务 TraceID 快速筛选 (自适应伸缩容器，支持滚轮横向滑动与鼠标拖拽，绝不挤压右侧操作区) */}
        {availableTraces.length > 0 && (
          <div
            ref={traceScrollRef}
            onMouseDown={handleTraceMouseDown}
            onMouseMove={handleTraceMouseMove}
            onMouseUp={handleTraceMouseUpOrLeave}
            onMouseLeave={handleTraceMouseUpOrLeave}
            className={`flex-1 min-w-0 ${
              isMaximized ? 'max-w-[420px]' : 'max-w-[240px]'
            } flex items-center bg-background rounded-lg p-0.5 border border-border/70 text-[10px] overflow-x-auto scrollbar-clean cursor-grab active:cursor-grabbing select-none`}
          >
            <button
              onClick={() => {
                if (!hasDraggedTrace.current) setFilterTrace('all');
              }}
              className={`px-1.5 py-0.5 rounded shrink-0 transition-colors cursor-pointer ${
                filterTrace === 'all'
                  ? 'bg-primary/20 text-emerald-950 dark:text-emerald-100 font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              全部
            </button>
            {availableTraces.map((tr) => (
              <button
                key={tr}
                onClick={() => {
                  if (!hasDraggedTrace.current) {
                    setFilterTrace(filterTrace === tr ? 'all' : tr);
                  }
                }}
                title={`仅查看任务 [#${tr}] 的穿透日志`}
                className={`px-1.5 py-0.5 rounded shrink-0 transition-colors cursor-pointer ${
                  filterTrace === tr
                    ? 'bg-primary/25 text-emerald-950 dark:text-emerald-100 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                #{tr}
              </button>
            ))}
          </div>
        )}

        {/* 右侧：固定操作控制区 (级别筛选器、复制、清空、全屏/还原、关闭，使用 shrink-0 ml-auto，永远完整呈现) */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* 级别筛选器 */}
          <div className="flex items-center bg-background rounded-lg p-0.5 border border-border/70 text-[10px]">
            {['all', 'info', 'success', 'error'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-1.5 py-0.5 rounded-md font-medium capitalize transition-colors cursor-pointer ${
                  filterLevel === lvl
                    ? 'bg-primary/20 text-emerald-950 dark:text-emerald-100 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lvl === 'all' ? '全部' : lvl}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopyLogs}
            title={filterTrace !== 'all' ? `复制任务 [#${filterTrace}] 的日志` : '复制全部日志到剪贴板'}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Copy className="w-3 h-3 shrink-0" />
            )}
            <span className="whitespace-nowrap">{copied ? '已复制' : '复制'}</span>
          </button>

          <button
            onClick={() => logger.clear()}
            title="清空日志记录"
            className="p-1 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-destructive border border-border/70 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title={isMaximized ? '还原底栏模式' : '全屏展开日志'}
              className="p-1 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
            >
              {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={onClose}
            title="关闭日志控制台"
            className="p-1 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/70 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 日志内容区域：使用全局字体渲染日志条目，避免中文字符降级为宋体 */}
      <div
        ref={logContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 text-[11px] space-y-1.5 scrollbar-clean bg-background/50"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground/60 text-xs">
            <Terminal className="w-6 h-6 mb-1 opacity-40" />
            <span>{filterTrace !== 'all' ? `未找到任务 [#${filterTrace}] 的日志` : '暂无日志记录'}</span>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const hasDetails = log.details !== undefined && log.details !== null && log.details !== '';
            const isExpanded = !!expandedDetails[log.id];

            return (
              <div
                key={log.id}
                className={`p-1.5 rounded-lg border transition-colors ${
                  log.level === 'error'
                    ? 'bg-destructive/5 border-destructive/20 text-destructive'
                    : log.level === 'warn'
                    ? 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-card/70 border-border/50 text-foreground'
                }`}
              >
                <div className="flex items-start gap-2 leading-relaxed">
                  <span className="text-muted-foreground/70 text-[10px] shrink-0 font-medium font-mono">
                    {log.timeStr}
                  </span>
                  {renderLevelBadge(log.level)}
                  <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/60 shrink-0">
                    {log.tag}
                  </span>
                  {log.traceId && (
                    <button
                      onClick={() => setFilterTrace(filterTrace === log.traceId ? 'all' : log.traceId!)}
                      title={`点击聚焦该任务 (#${log.traceId}) 的链路日志`}
                      className={`inline-flex items-center text-[9px] px-1.5 py-0.2 rounded font-semibold transition-all cursor-pointer shrink-0 ${
                        filterTrace === log.traceId
                          ? 'bg-primary/30 text-emerald-950 dark:text-emerald-100 border border-primary/60 shadow-2xs font-bold'
                          : 'bg-secondary/35 text-secondary-foreground hover:bg-secondary/60 border border-secondary/50'
                      }`}
                    >
                      #{log.traceId}
                    </button>
                  )}
                  <span className="flex-1 break-all text-xs font-normal">
                    {log.message}
                  </span>
                  {hasDetails && (
                    <button
                      onClick={() => toggleDetail(log.id)}
                      className="text-muted-foreground hover:text-foreground shrink-0 p-0.5 cursor-pointer"
                      title="展开/收起详情"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {hasDetails && isExpanded && (
                  <pre className="mt-1.5 p-2 rounded-md bg-muted/70 text-[10px] overflow-x-auto text-muted-foreground border border-border/60">
                    {typeof log.details === 'object'
                      ? JSON.stringify(log.details, null, 2)
                      : String(log.details)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
