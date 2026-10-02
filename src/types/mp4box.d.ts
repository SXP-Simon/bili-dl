declare module 'mp4box' {
  export interface MP4TrackAudio {
    sample_rate?: number;
    channel_count?: number;
    sample_size?: number;
  }

  export interface MP4MediaTrack {
    id: number;
    created?: Date;
    modified?: Date;
    volume?: number;
    track_width?: number;
    track_height?: number;
    timescale: number;
    duration: number;
    bitrate?: number;
    codec: string;
    language?: string;
    nb_samples: number;
    audio?: MP4TrackAudio;
    channel_count?: number;
    samplerate?: number;
    samplesize?: number;
    avcDecoderConfigRecord?: unknown;
    hevcDecoderConfigRecord?: unknown;
    hvcC?: unknown;
    av1C?: unknown;
  }

  export interface MP4Sample {
    data: Uint8Array | ArrayBuffer;
    duration: number;
    dts: number;
    cts: number;
    is_sync: boolean;
    size?: number;
    is_leading?: number;
    depends_on?: number;
    is_depended_on?: number;
    has_redundancy?: number;
    degradation_priority?: number;
  }

  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented?: boolean;
    isProgressive?: boolean;
    hasMoov?: boolean;
    hasIOD?: boolean;
    brands?: string[];
    created?: Date;
    modified?: Date;
    tracks?: MP4MediaTrack[];
    videoTracks: MP4MediaTrack[];
    audioTracks: MP4MediaTrack[];
  }

  export interface MP4TrackBoxEntry {
    type?: string;
    boxes?: unknown[];
  }

  export interface MP4TrackBox {
    id?: number;
    samples_duration?: number;
    tkhd?: {
      track_id?: number;
      duration?: number;
      width?: number;
      height?: number;
      volume?: number;
    };
    mdia?: {
      mdhd?: {
        timescale?: number;
        duration?: number;
      };
      hdlr?: {
        handler?: string;
      };
      minf?: {
        stbl?: {
          stsd?: {
            entries?: MP4TrackBoxEntry[];
          };
        };
      };
    };
  }

  export interface MP4BoxTrackOptions {
    type: string;
    hdlr?: string;
    width?: number;
    height?: number;
    timescale: number;
    duration?: number;
    nb_samples?: number;
    codec?: string;
    description_boxes?: unknown[];
    avcDecoderConfigRecord?: unknown;
    hevcDecoderConfigRecord?: unknown;
    hvcC?: unknown;
    av1C?: unknown;
    channel_count?: number;
    samplerate?: number;
    samplesize?: number;
  }

  export interface MP4BoxSampleOptions {
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

  export class MP4File {
    onReady?: (info: MP4Info) => void;
    onError?: (e: string) => void;
    onSamples?: (trackId: number, ref: unknown, samples: MP4Sample[]) => void;
    moov?: {
      mvhd?: {
        timescale?: number;
        duration?: number;
      };
      traks?: MP4TrackBox[];
    };
    getTrackById(id: number): MP4TrackBox | undefined;
    addTrack(options: MP4BoxTrackOptions): number;
    addSample(trackId: number, data: Uint8Array | ArrayBuffer, options: MP4BoxSampleOptions): void;
    setExtractionOptions(trackId: number, user: unknown, options: { nbSamples?: number }): void;
    start(): void;
    appendBuffer(data: ArrayBuffer & { fileStart?: number }): number;
    flush(): void;
    save(name: string): void;
    getBuffer(): ArrayBuffer;
  }

  export function createFile(): MP4File;

  export interface BoxParserResult {
    code: number;
    box?: {
      type: string;
      size: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  export const BoxParser: {
    OK: number;
    ERR_NOT_ENOUGH_DATA: number;
    parseOneBox: (stream: unknown, headerOnly?: boolean, parentSize?: number) => BoxParserResult;
    [key: string]: unknown;
  };
}
