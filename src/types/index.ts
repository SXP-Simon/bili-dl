export type CategoryType = 'all' | 'video' | 'audio' | 'cover' | 'danmaku' | 'episodes' | 'season' | 'ai';

export interface VideoStreamItem {
  id: number;
  qualityName: string;
  codecName: 'AVC' | 'HEVC' | 'AV1';
  codec: string;
  bandwidth: number;
  sizeMB: string;
  baseUrl: string;
  backupUrl?: string[];
  width: number;
  height: number;
  frameRate: string;
}

export interface AudioStreamItem {
  id: number;
  name: string;
  qualityDesc: string;
  codec: string;
  bandwidth: number;
  sizeMB: string;
  baseUrl: string;
  backupUrl?: string[];
}

export interface SubtitleItem {
  id: number;
  lan: string;
  lan_doc: string;
  subtitle_url: string;
}

export interface VideoPageItem {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

/**
 * 合集/系列单集条目信息
 */
export interface SeasonEpisodeItem {
  id: number;
  bvid: string;
  cid?: number;
  title: string;
  cover?: string;
  duration?: number;
  pageIndex: number;
}

/**
 * 合集/系列完整元信息
 */
export interface UgcSeasonData {
  id: number;
  mid: number;
  title: string;
  cover?: string;
  epCount: number;
  episodes: SeasonEpisodeItem[];
}

export interface MediaResourceData {
  bvid: string;
  cid: number;
  title: string;
  cover: string;
  duration: number;
  videos: VideoStreamItem[];
  audios: AudioStreamItem[];
  subtitles: SubtitleItem[];
  pages: VideoPageItem[];
  aiSummaryMarkdown?: string;
  ugcSeason?: UgcSeasonData;
}

export type TaskType = 'video' | 'audio' | 'danmaku' | 'subtitle' | 'cover' | 'batch_subtitle' | 'batch_video' | 'batch_audio' | 'ai_transcribe';

export interface DownloadTask {
  id: string;
  type: TaskType;
  title: string;
  status: 'pending' | 'downloading_video' | 'downloading_audio' | 'muxing' | 'completed' | 'error' | 'cancelled' | 'idle';
  progress: number; // 0 ~ 100
  speed?: string;
  message?: string;
  timestamp: number;
}

export interface DownloadProgress {
  status: 'idle' | 'downloading_video' | 'downloading_audio' | 'muxing' | 'completed' | 'error' | 'cancelled';
  progress: number; // 0 ~ 100
  speed?: string;
  message?: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: number;
  timeStr: string;
  level: LogLevel;
  tag: string;
  message: string;
  traceId?: string;
  details?: unknown;
}

export interface QuickMenuHeaderInfo {
  bvid?: string;
  pageText?: string;
  title?: string;
  isReady: boolean;
}

export interface QuickActionItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  badge?: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => Promise<void> | void;
}
