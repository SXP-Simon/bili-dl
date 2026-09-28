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

  export interface MP4Sample {
    data: Uint8Array | ArrayBuffer;
    duration: number;
    dts: number;
    cts: number;
    is_sync: boolean;
    is_leading?: number;
    depends_on?: number;
    is_depended_on?: number;
    has_redundancy?: number;
    degradation_priority?: number;
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
    onSamples?: (trackId: number, ref: any, samples: MP4Sample[]) => void;
    addTrack(options: any): number;
    addSample(trackId: number, data: any, options: any): void;
    setExtractionOptions(trackId: number, user: any, options: { nbSamples?: number }): void;
    start(): void;
    appendBuffer(data: ArrayBuffer & { fileStart?: number }): number;
    flush(): void;
    save(name: string): void;
    getBuffer(): ArrayBuffer;
  }

  export function createFile(): MP4File;
}
