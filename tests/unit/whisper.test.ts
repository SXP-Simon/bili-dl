import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatSecondsToSrtTime,
  chunksToSrt,
  getMirrorBaseUrl,
  checkWebGpuSupport,
  decodeAudioTo16kMono,
  transcribeAudioBuffer,
  transcribeMediaAudio,
  SUPPORTED_WHISPER_MODELS,
  SUPPORTED_LANGUAGES,
} from '../../src/ai/whisper';
import * as httpApi from '../../src/api/http';

describe('Whisper Speech-to-Text Unit Tests', () => {
  describe('Metadata and Format Constants', () => {
    it('should provide supported models including whisper-tiny and whisper-base', () => {
      const modelIds = SUPPORTED_WHISPER_MODELS.map((m) => m.id);
      expect(modelIds).toContain('onnx-community/whisper-tiny');
      expect(modelIds).toContain('onnx-community/whisper-base');
      expect(modelIds).toContain('onnx-community/whisper-small');
      expect(modelIds).toContain('onnx-community/whisper-tiny.en');
    });

    it('should support major languages including Chinese, Auto, English, Japanese', () => {
      const langCodes = SUPPORTED_LANGUAGES.map((l) => l.code);
      expect(langCodes).toContain('chinese');
      expect(langCodes).toContain('auto');
      expect(langCodes).toContain('english');
      expect(langCodes).toContain('japanese');
    });
  });

  describe('SRT Formatting Utilities', () => {
    it('should format seconds into standard SRT timestamp HH:MM:SS,mmm', () => {
      expect(formatSecondsToSrtTime(0)).toBe('00:00:00,000');
      expect(formatSecondsToSrtTime(1.5)).toBe('00:00:01,500');
      expect(formatSecondsToSrtTime(65.123)).toBe('00:01:05,123');
      expect(formatSecondsToSrtTime(3661.045)).toBe('01:01:01,045');
      expect(formatSecondsToSrtTime(-5)).toBe('00:00:00,000');
    });

    it('should format chunks into standard SubRip (SRT) format with sequential indices', () => {
      const chunks = [
        { text: '大家好，欢迎来到本期视频。', timestamp: [0, 3.2] as [number, number] },
        { text: '今天我们来讲解 WebGPU 本地语音识别。', timestamp: [3.5, 7.8] as [number, number] },
      ];

      const srt = chunksToSrt(chunks);
      expect(srt).toContain('1\n00:00:00,000 --> 00:00:03,200\n大家好，欢迎来到本期视频。');
      expect(srt).toContain('2\n00:00:03,500 --> 00:00:07,800\n今天我们来讲解 WebGPU 本地语音识别。');
    });

    it('should handle null/missing timestamps and empty chunk lists gracefully', () => {
      expect(chunksToSrt([])).toBe('');

      const chunkWithNullEnd = [
        { text: '这是最后一句话', timestamp: [10, null] as [number, null] },
      ];
      const srt = chunksToSrt(chunkWithNullEnd, 15);
      expect(srt).toContain('1\n00:00:10,000 --> 00:00:15,000\n这是最后一句话');
    });
  });

  describe('Mirror Base URL Resolution', () => {
    it('should resolve hf-mirror to https://hf-mirror.com/', () => {
      expect(getMirrorBaseUrl('hf-mirror')).toBe('https://hf-mirror.com/');
    });

    it('should resolve huggingface to https://huggingface.co/', () => {
      expect(getMirrorBaseUrl('huggingface')).toBe('https://huggingface.co/');
    });

    it('should handle custom mirror URL and append trailing slash if needed', () => {
      expect(getMirrorBaseUrl('custom', 'https://custom-mirror.example.com')).toBe('https://custom-mirror.example.com/');
      expect(getMirrorBaseUrl('custom', 'https://custom-mirror.example.com/')).toBe('https://custom-mirror.example.com/');
    });
  });

  describe('WebGPU Hardware Acceleration Detection', () => {
    const originalNavigator = global.navigator;

    afterEach(() => {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        configurable: true,
      });
    });

    it('should return false when navigator.gpu is undefined', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { ...originalNavigator, gpu: undefined },
        configurable: true,
      });

      const res = await checkWebGpuSupport();
      expect(res.supported).toBe(false);
    });

    it('should return true with adapter info when navigator.gpu adapter is available', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          ...originalNavigator,
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue({
              info: { vendor: 'NVIDIA', architecture: 'Ampere', description: 'RTX 3080' },
            }),
          },
        },
        configurable: true,
      });

      const res = await checkWebGpuSupport();
      expect(res.supported).toBe(true);
      expect(res.adapterInfo).toContain('NVIDIA');
    });
  });

  describe('Audio Decoding and 16kHz Mono Resampling', () => {
    let originalAudioContext: unknown;
    let originalOfflineAudioContext: unknown;

    beforeEach(() => {
      originalAudioContext = (window as unknown as Record<string, unknown>).AudioContext;
      originalOfflineAudioContext = (window as unknown as Record<string, unknown>).OfflineAudioContext;
    });

    afterEach(() => {
      (window as unknown as Record<string, unknown>).AudioContext = originalAudioContext;
      (window as unknown as Record<string, unknown>).OfflineAudioContext = originalOfflineAudioContext;
    });

    it('should decode and resample audio buffer into Float32Array at 16000Hz', async () => {
      const mockChannelData = new Float32Array(16000 * 2);
      mockChannelData[0] = 0.5;

      const mockAudioBuffer = {
        duration: 2,
        getChannelData: vi.fn().mockReturnValue(mockChannelData),
      };

      const mockAudioContext = function (this: { decodeAudioData: unknown; close: unknown }) {
        this.decodeAudioData = vi.fn().mockResolvedValue(mockAudioBuffer);
        this.close = vi.fn().mockResolvedValue(undefined);
      };

      const mockRenderedAudioBuffer = {
        getChannelData: vi.fn().mockReturnValue(mockChannelData),
      };

      const offlineConstructorSpy = vi.fn();
      const mockOfflineAudioContext = function (
        this: { createBufferSource: unknown; destination: unknown; startRendering: unknown },
        channels: number,
        length: number,
        sampleRate: number
      ) {
        offlineConstructorSpy(channels, length, sampleRate);
        this.createBufferSource = vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
        });
        this.destination = {};
        this.startRendering = vi.fn().mockResolvedValue(mockRenderedAudioBuffer);
      };

      (window as unknown as Record<string, unknown>).AudioContext = mockAudioContext;
      (window as unknown as Record<string, unknown>).OfflineAudioContext = mockOfflineAudioContext;

      const dummyBuffer = new ArrayBuffer(1024);
      const res = await decodeAudioTo16kMono(dummyBuffer);

      expect(res.duration).toBe(2);
      expect(res.float32).toBeInstanceOf(Float32Array);
      expect(offlineConstructorSpy).toHaveBeenCalledWith(1, 32000, 16000);
    });
  });

  describe('Full Transcription Pipeline Execution', () => {
    let originalAudioContext: unknown;
    let originalOfflineAudioContext: unknown;
    let originalTransformers: unknown;

    beforeEach(() => {
      originalAudioContext = (window as unknown as Record<string, unknown>).AudioContext;
      originalOfflineAudioContext = (window as unknown as Record<string, unknown>).OfflineAudioContext;
      originalTransformers = (window as unknown as Record<string, unknown>).transformers;

      // Mock Web Audio Context
      const mockChannelData = new Float32Array(16000);
      const mockAudioContext = function (this: { decodeAudioData: unknown; close: unknown }) {
        this.decodeAudioData = vi.fn().mockResolvedValue({
          duration: 1,
          getChannelData: vi.fn().mockReturnValue(mockChannelData),
        });
        this.close = vi.fn().mockResolvedValue(undefined);
      };

      const mockOfflineAudioContext = function (this: {
        createBufferSource: unknown;
        destination: unknown;
        startRendering: unknown;
      }) {
        this.createBufferSource = vi.fn().mockReturnValue({
          connect: vi.fn(),
          start: vi.fn(),
        });
        this.destination = {};
        this.startRendering = vi.fn().mockResolvedValue({
          getChannelData: vi.fn().mockReturnValue(mockChannelData),
        });
      };

      (window as unknown as Record<string, unknown>).AudioContext = mockAudioContext;
      (window as unknown as Record<string, unknown>).OfflineAudioContext = mockOfflineAudioContext;

      // Mock Transformers pipeline via window.transformers
      const mockTranscriber = vi.fn().mockResolvedValue({
        text: '测试音频转写文本。',
        chunks: [
          { text: '测试音频转写文本。', timestamp: [0, 1.0] },
        ],
      });

      (window as unknown as Record<string, unknown>).transformers = {
        env: { remoteHost: '' },
        pipeline: vi.fn().mockResolvedValue(mockTranscriber),
      };
    });

    afterEach(() => {
      (window as unknown as Record<string, unknown>).AudioContext = originalAudioContext;
      (window as unknown as Record<string, unknown>).OfflineAudioContext = originalOfflineAudioContext;
      (window as unknown as Record<string, unknown>).transformers = originalTransformers;
    });

    it('should transcribe audio buffer and produce text and SRT output', async () => {
      const progressList: string[] = [];
      const dummyBuffer = new ArrayBuffer(512);

      const result = await transcribeAudioBuffer(dummyBuffer, {
        language: 'chinese',
        model: 'onnx-community/whisper-tiny',
        device: 'wasm',
        returnTimestamps: true,
        onProgress: (p) => progressList.push(p.stage),
      });

      expect(result.text).toBe('测试音频转写文本。');
      expect(result.srt).toContain('00:00:00,000 --> 00:00:01,000');
      expect(result.chunks.length).toBe(1);
      expect(result.device).toBe('wasm');
      expect(progressList).toContain('decoding_audio');
      expect(progressList).toContain('transcribing');
      expect(progressList).toContain('completed');
    });

    it('should support AbortSignal cancellation', async () => {
      const controller = new AbortController();
      controller.abort();

      const dummyBuffer = new ArrayBuffer(512);
      await expect(
        transcribeAudioBuffer(dummyBuffer, {
          signal: controller.signal,
        })
      ).rejects.toThrow();
    });

    it('should fetch audio stream and transcribe media audio end-to-end', async () => {
      vi.spyOn(httpApi, 'requestChunkedBuffer').mockResolvedValue(new ArrayBuffer(1024));

      const mockAudioItem = {
        id: 30280,
        name: '64Kbps',
        qualityDesc: '极速',
        codec: 'mp4a.40.2',
        bandwidth: 64000,
        sizeMB: '1.2',
        baseUrl: 'https://example.com/audio.m4a',
      };

      const result = await transcribeMediaAudio(mockAudioItem, {
        language: 'chinese',
        device: 'wasm',
      });

      expect(result.text).toBe('测试音频转写文本。');
      expect(httpApi.requestChunkedBuffer).toHaveBeenCalled();
    });
  });
});
