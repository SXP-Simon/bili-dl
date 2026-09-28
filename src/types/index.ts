export type CategoryType = 'all' | 'video' | 'audio' | 'cover' | 'danmaku' | 'episodes';

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
}

export interface DownloadProgress {
  status: 'idle' | 'downloading_video' | 'downloading_audio' | 'muxing' | 'completed' | 'error';
  progress: number; // 0 ~ 100
  speed?: string;
  message?: string;
}
