import type { LogEntry, LogLevel } from '../types';

type LogListener = (logs: LogEntry[]) => void;

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 250;
  private listeners: Set<LogListener> = new Set();

  public log(level: LogLevel, tag: string, message: string, details?: any): void {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now
      .getMilliseconds()
      .toString()
      .padStart(3, '0')}`;

    const entry: LogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      timeStr,
      level,
      tag,
      message,
      details,
    };

    this.logs = [...this.logs.slice(-(this.maxLogs - 1)), entry];

    // 同步输出到控制台
    const prefix = `[Bili-DL][${tag}]`;
    if (level === 'error') {
      console.error(prefix, message, details !== undefined ? details : '');
    } else if (level === 'warn') {
      console.warn(prefix, message, details !== undefined ? details : '');
    } else if (level === 'success') {
      console.log(`%c${prefix} ${message}`, 'color: #10b981; font-weight: bold;', details !== undefined ? details : '');
    } else {
      console.log(prefix, message, details !== undefined ? details : '');
    }

    this.notify();
  }

  public info(tag: string, message: string, details?: any): void {
    this.log('info', tag, message, details);
  }

  public success(tag: string, message: string, details?: any): void {
    this.log('success', tag, message, details);
  }

  public warn(tag: string, message: string, details?: any): void {
    this.log('warn', tag, message, details);
  }

  public error(tag: string, message: string, details?: any): void {
    this.log('error', tag, message, details);
  }

  public debug(tag: string, message: string, details?: any): void {
    this.log('debug', tag, message, details);
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public clear(): void {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.logs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.logs);
    }
  }
}

export const logger = new Logger();
