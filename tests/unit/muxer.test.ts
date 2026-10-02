import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MP4File, MP4Info, MP4Sample } from 'mp4box';

// Mock mp4box module
vi.mock('mp4box', () => {
  return {
    default: {
      createFile: vi.fn(),
    },
  };
});

import MP4Box from 'mp4box';
import { muxMp4 } from '../../src/media/muxer';

describe('MP4 Muxer Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mux video and audio buffers into a single MP4 blob', async () => {
    const mockOutBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]).buffer;

    const mockOutMp4: Partial<MP4File> = {
      addTrack: vi.fn().mockReturnValue(1),
      addSample: vi.fn(),
      flush: vi.fn(),
      getBuffer: vi.fn().mockReturnValue(mockOutBuffer),
    };

    let inVideoReadyCb: ((info: MP4Info) => void) | undefined;
    let inVideoSamplesCb: ((trackId: number, ref: unknown, samples: MP4Sample[]) => void) | undefined;
    const mockInVideo: Partial<MP4File> = {
      set onReady(fn: (info: MP4Info) => void) {
        inVideoReadyCb = fn;
      },
      set onSamples(fn: (trackId: number, ref: unknown, samples: MP4Sample[]) => void) {
        inVideoSamplesCb = fn;
      },
      getTrackById: vi.fn().mockReturnValue({ mdia: { minf: { stbl: { stsd: { entries: [{ type: 'avc1' }] } } } } }),
      setExtractionOptions: vi.fn(),
      start: vi.fn(),
      appendBuffer: vi.fn().mockReturnValue(0),
      flush: vi.fn(),
    };

    let inAudioReadyCb: ((info: MP4Info) => void) | undefined;
    let inAudioSamplesCb: ((trackId: number, ref: unknown, samples: MP4Sample[]) => void) | undefined;
    const mockInAudio: Partial<MP4File> = {
      set onReady(fn: (info: MP4Info) => void) {
        inAudioReadyCb = fn;
      },
      set onSamples(fn: (trackId: number, ref: unknown, samples: MP4Sample[]) => void) {
        inAudioSamplesCb = fn;
      },
      getTrackById: vi.fn().mockReturnValue({ mdia: { minf: { stbl: { stsd: { entries: [{ type: 'mp4a' }] } } } } }),
      setExtractionOptions: vi.fn(),
      start: vi.fn(),
      appendBuffer: vi.fn().mockReturnValue(0),
      flush: vi.fn(),
    };

    // Return mockOutMp4, then mockInVideo, then mockInAudio
    let callCount = 0;
    (MP4Box.createFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockOutMp4;
      if (callCount === 2) return mockInVideo;
      return mockInAudio;
    });

    const videoBuffer = new ArrayBuffer(1024);
    const audioBuffer = new ArrayBuffer(512);
    const progressUpdates: number[] = [];

    const muxPromise = muxMp4(
      videoBuffer,
      audioBuffer,
      (p) => progressUpdates.push(p),
      'test-trace'
    );

    // Simulate video extraction ready
    expect(inVideoReadyCb).toBeDefined();
    inVideoReadyCb!({
      duration: 1000,
      timescale: 1000,
      isFragmented: false,
      isProgressive: true,
      hasMoov: true,
      tracks: [],
      videoTracks: [
        {
          id: 1,
          track_width: 1920,
          track_height: 1080,
          timescale: 30000,
          duration: 30000,
          nb_samples: 30,
          codec: 'avc1.640028',
        },
      ],
      audioTracks: [],
    });

    // Simulate audio extraction ready
    expect(inAudioReadyCb).toBeDefined();
    inAudioReadyCb!({
      duration: 1000,
      timescale: 1000,
      isFragmented: false,
      isProgressive: true,
      hasMoov: true,
      tracks: [],
      videoTracks: [],
      audioTracks: [
        {
          id: 2,
          timescale: 48000,
          duration: 48000,
          nb_samples: 48,
          codec: 'mp4a.40.2',
        },
      ],
    });

    // Simulate sample callbacks
    const mockSample: MP4Sample = {
      dts: 0,
      cts: 0,
      duration: 1000,
      is_sync: true,
      data: new Uint8Array([1, 2, 3]),
      size: 3,
    };

    inVideoSamplesCb!(1, null, [mockSample]);
    inAudioSamplesCb!(2, null, [mockSample]);

    // Simulate inVideo and inAudio flush triggering checkFinished
    // In actual implementation, checkFinished runs after appendBuffer and flush
    // Let's invoke flush on both
    (mockInVideo.flush as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (mockInAudio.flush as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    // In muxer.ts, appendBuffer is called with offset
    // Let's wait for muxPromise
    const resultBlob = await muxPromise;
    expect(resultBlob).toBeInstanceOf(Blob);
    expect(resultBlob.type).toBe('video/mp4');
    expect(mockOutMp4.addTrack).toHaveBeenCalled();
    expect(mockOutMp4.addSample).toHaveBeenCalled();
    expect(progressUpdates).toContain(100);
  });

  it('should support video-only muxing when audio buffer is omitted', async () => {
    const mockOutBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]).buffer;

    const mockOutMp4: Partial<MP4File> = {
      addTrack: vi.fn().mockReturnValue(1),
      addSample: vi.fn(),
      flush: vi.fn(),
      getBuffer: vi.fn().mockReturnValue(mockOutBuffer),
    };

    let inVideoReadyCb: ((info: MP4Info) => void) | undefined;
    let inVideoSamplesCb: ((trackId: number, ref: unknown, samples: MP4Sample[]) => void) | undefined;
    const mockInVideo: Partial<MP4File> = {
      set onReady(fn: (info: MP4Info) => void) {
        inVideoReadyCb = fn;
      },
      set onSamples(fn: (trackId: number, ref: unknown, samples: MP4Sample[]) => void) {
        inVideoSamplesCb = fn;
      },
      getTrackById: vi.fn().mockReturnValue({ mdia: { minf: { stbl: { stsd: { entries: [{ type: 'avc1' }] } } } } }),
      setExtractionOptions: vi.fn(),
      start: vi.fn(),
      appendBuffer: vi.fn().mockReturnValue(0),
      flush: vi.fn(),
    };

    let callCount = 0;
    (MP4Box.createFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockOutMp4;
      return mockInVideo;
    });

    const videoBuffer = new ArrayBuffer(512);
    const muxPromise = muxMp4(videoBuffer, null);

    inVideoReadyCb!({
      duration: 500,
      timescale: 1000,
      isFragmented: false,
      isProgressive: true,
      hasMoov: true,
      tracks: [],
      videoTracks: [
        {
          id: 1,
          track_width: 1280,
          track_height: 720,
          timescale: 30000,
          duration: 15000,
          nb_samples: 15,
          codec: 'avc1.64001f',
        },
      ],
      audioTracks: [],
    });

    inVideoSamplesCb!(1, null, [{
      dts: 0,
      cts: 0,
      duration: 1000,
      is_sync: true,
      data: new Uint8Array([4, 5, 6]),
      size: 3,
    }]);

    const result = await muxPromise;
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('video/mp4');
  });
});
