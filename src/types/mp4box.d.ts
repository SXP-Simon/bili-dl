declare module 'mp4box' {
  export interface MP4MediaTrack {
    id: number;
    created: Date;
    modified: Date;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    language: string;
    nb_samples: number;
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: MP4MediaTrack[];
    videoTracks: MP4MediaTrack[];
    audioTracks: MP4MediaTrack[];
  }

  export class MP4File {
    onReady?: (info: MP4Info) => void;
    onError?: (e: string) => void;
    addTrack(options: any): number;
    appendBuffer(data: ArrayBuffer & { fileStart?: number }): number;
    flush(): void;
    save(name: string): void;
    getBuffer(): ArrayBuffer;
  }

  export function createFile(): MP4File;
}
