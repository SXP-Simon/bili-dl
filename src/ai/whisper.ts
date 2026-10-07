import {
  GM_xmlhttpRequest,
  type GMXMLHttpRequestResponse,
  type GMXMLHttpRequestError,
} from '$';
import { requestChunkedBuffer } from '../api/http';
import { logger } from '../utils/logger';
import { getDownloadSettings, DownloadSettings } from '../utils/settings';
import { getErrorMessage, isAbortError } from '../utils/error';
import type { AudioStreamItem } from '../types';

export type WhisperPipelineFn = (
  input: Float32Array,
  options?: Record<string, unknown>
) => Promise<{
  text?: string;
  chunks?: Array<{ text: string; timestamp?: [number, number | null] }>;
}>;

export interface TransformersAPI {
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<WhisperPipelineFn>;
  env: Record<string, unknown>;
}

let transformersPromise: Promise<TransformersAPI> | null = null;

/**
 * 动态加载 Transformers.js (使用原生动态 ESM 导入)
 */
export async function loadTransformers(): Promise<TransformersAPI> {
  if (transformersPromise) return transformersPromise;

  transformersPromise = (async () => {
    // 1. 检查当前环境或 window 下是否已有 transformers 全局对象
    const win = typeof window !== 'undefined' ? (window as unknown as { transformers?: TransformersAPI }) : undefined;
    if (win?.transformers?.pipeline) {
      logger.info('Whisper', '检测到已就绪的 Transformers.js 模块');
      return win.transformers;
    }

    const cdnList = [
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3',
      'https://fastly.jsdelivr.net/npm/@huggingface/transformers@3.3.3',
      'https://unpkg.com/@huggingface/transformers@3.3.3',
    ];

    // 2. 通过动态 import 加载 ESM 模块（避免普通 script 标签触发 Cannot use 'import.meta' 语法错误）
    for (const url of cdnList) {
      try {
        let mod: { pipeline?: (task: string, model: string, options?: Record<string, unknown>) => Promise<WhisperPipelineFn>; env?: Record<string, unknown>; default?: { pipeline?: (task: string, model: string, options?: Record<string, unknown>) => Promise<WhisperPipelineFn>; env?: Record<string, unknown> } } | undefined;
        try {
          mod = (await import(/* @vite-ignore */ url)) as typeof mod;
        } catch {
          const dynamicImport = new Function('u', 'return import(u)');
          mod = (await dynamicImport(url)) as typeof mod;
        }

        if (mod && (mod.pipeline || mod.default?.pipeline)) {
          const api: TransformersAPI = (mod.default?.pipeline ? mod.default : mod) as TransformersAPI;
          logger.info('Whisper', `成功动态载入 Transformers.js 模块: ${url}`);
          return api;
        }
      } catch (e) {
        logger.warn('Whisper', `尝试从 CDN 动态导入 Transformers.js 失败: ${url}`, e);
      }
    }

    throw new Error('未能加载 Transformers.js 模块，请检查网络或刷新页面重试');
  })();

  return transformersPromise;
}

export interface WhisperProgressUpdate {
  stage: 'downloading_audio' | 'decoding_audio' | 'loading_model' | 'transcribing' | 'completed' | 'error';
  progress: number; // 0 ~ 100
  message: string;
  downloadedBytes?: number;
  totalBytes?: number;
}

export interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

export interface WhisperTranscriptionResult {
  text: string;
  srt: string;
  chunks: WhisperChunk[];
  duration: number;
  model: string;
  device: 'webgpu' | 'wasm';
  language: string;
}

export const SUPPORTED_WHISPER_MODELS = [
  {
    id: 'onnx-community/whisper-tiny',
    name: 'Whisper-Tiny (推荐 / 极速 ~39MB)',
    sizeMB: 39,
    desc: '多语言极小模型，首次加载仅需数秒，显存占用低至 150MB',
  },
  {
    id: 'onnx-community/whisper-base',
    name: 'Whisper-Base (均衡 ~73MB)',
    sizeMB: 73,
    desc: '多语言平衡模型，兼顾识别准确率与推理速度',
  },
  {
    id: 'onnx-community/whisper-small',
    name: 'Whisper-Small (高精 ~240MB)',
    sizeMB: 240,
    desc: '多语言高精度模型，识别率高，适合配置较高显卡',
  },
  {
    id: 'onnx-community/whisper-tiny.en',
    name: 'Whisper-Tiny.en (纯英语 ~39MB)',
    sizeMB: 39,
    desc: '专用于英语视频，处理英文极度精准且速度快',
  },
] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'chinese', name: '中文 (Chinese)' },
  { code: 'auto', name: '自动检测 (Auto Detect)' },
  { code: 'english', name: '英语 (English)' },
  { code: 'japanese', name: '日语 (Japanese)' },
  { code: 'cantonese', name: '粤语 (Cantonese)' },
  { code: 'korean', name: '韩语 (Korean)' },
] as const;

// 缓存已初始化的 pipeline 实例：key 为 `${model}_${device}`
const pipelineCache = new Map<string, Promise<WhisperPipelineFn>>();

// 内存缓存每个视频/分P的转写结果：key 为 `${bvid}_${cid}` 或 `title`，页面内切换 Tab 不丢失
const transcriptionCache = new Map<string, WhisperTranscriptionResult>();

export function getTranscriptionResult(cacheKey: string): WhisperTranscriptionResult | undefined {
  return transcriptionCache.get(cacheKey);
}

export function saveTranscriptionResult(cacheKey: string, result: WhisperTranscriptionResult): void {
  transcriptionCache.set(cacheKey, result);
}

export function clearTranscriptionResult(cacheKey?: string): void {
  if (cacheKey) {
    transcriptionCache.delete(cacheKey);
  } else {
    transcriptionCache.clear();
  }
}

/**
 * 主动释放并销毁所有缓存的 Whisper 模型与显存/内存实例
 */
export async function clearWhisperPipelineCache(): Promise<void> {
  for (const [key, promise] of pipelineCache.entries()) {
    try {
      const p = await promise;
      if (p && typeof (p as unknown as { dispose?: () => Promise<void> | void }).dispose === 'function') {
        await (p as unknown as { dispose: () => Promise<void> | void }).dispose();
      }
    } catch {}
    pipelineCache.delete(key);
  }
  logger.info('Whisper', '已主动释放所有 Whisper 显存/内存模型缓存');
}

/**
 * 微任务让渡事件循环：防止长时间连续计算导致主线程 UI 掉帧卡顿
 */
export async function yieldToMainLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * 检查当前浏览器和系统硬件是否支持 WebGPU (严格测试 requestDevice 获取硬件实例)
 */
export async function checkWebGpuSupport(): Promise<{ supported: boolean; adapterInfo?: string }> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false };
    }
    // 严格检查是否能实际创建 GPU 设备
    const device = await adapter.requestDevice().catch(() => null);
    if (!device) {
      return { supported: false };
    }
    // 立即销毁测试 device
    try {
      device.destroy();
    } catch {}

    const info = (adapter as unknown as { info?: { description?: string; vendor?: string; architecture?: string } }).info;
    const desc = info ? [info.vendor, info.architecture, info.description].filter(Boolean).join(' ') : 'WebGPU 硬件加速就绪';
    return { supported: true, adapterInfo: desc || 'WebGPU 加速可用' };
  } catch {
    return { supported: false };
  }
}

/**
 * 使用 GM_xmlhttpRequest 执行跨域模型与权重下载，包装为标准 Fetch Response
 */
export async function gmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  return new Promise<Response>((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v: string, k: string) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([k, v]: [string, string]) => { headers[k] = v; });
      } else {
        Object.assign(headers, init.headers);
      }
    }

    GM_xmlhttpRequest({
      method: (init?.method as 'GET' | 'POST' | 'HEAD') || 'GET',
      url,
      headers,
      responseType: 'arraybuffer',
      onload: (res: GMXMLHttpRequestResponse) => {
        const respHeaders = new Headers();
        if (res.responseHeaders) {
          res.responseHeaders.split('\r\n').forEach((line: string) => {
            const parts = line.split(': ');
            if (parts.length >= 2) {
              respHeaders.set(parts[0], parts.slice(1).join(': '));
            }
          });
        }

        const responseObj = new Response(res.response as ArrayBuffer, {
          status: res.status,
          statusText: res.statusText,
          headers: respHeaders,
        });

        const finalUrl = (res as unknown as { finalUrl?: string }).finalUrl || url;
        Object.defineProperty(responseObj, 'url', { value: finalUrl });
        resolve(responseObj);
      },
      onerror: (err: GMXMLHttpRequestError) => reject(new Error(`GM_xmlhttpRequest failed for ${url}: ${err.error || err.statusText}`)),
      ontimeout: () => reject(new Error(`GM_xmlhttpRequest timeout for ${url}`)),
    });
  });
}

let fetchProxyInstalled = false;

/**
 * 代理原生 fetch：针对 HuggingFace / hf-mirror 模型权重请求使用 GM_xmlhttpRequest 绕过浏览器 CORS 跨域拦截
 */
export function setupFetchProxy(): void {
  if (fetchProxyInstalled || typeof window === 'undefined') return;
  fetchProxyInstalled = true;

  const originalFetch = window.fetch;
  const targetHosts = [
    'hf-mirror.com',
    'huggingface.co',
    'hf.co',
    'cdn-lfs.huggingface.co',
    'cdn-lfs-us-1.huggingface.co',
    'cdn-lfs.hf-mirror.com',
    'jsdelivr.net',
    'fastly.jsdelivr.net',
    'unpkg.com',
  ];

  const proxiedFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isTarget = targetHosts.some((h) => url.includes(h));

    if (!isTarget) {
      return originalFetch.apply(window, [input, init]);
    }

    try {
      return await gmFetch(input, init);
    } catch {
      return originalFetch.apply(window, [input, init]);
    }
  };

  window.fetch = proxiedFetch as unknown as typeof fetch;

  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.fetch = proxiedFetch as unknown as typeof fetch;
    }
  } catch {}

  try {
    const winWithUnsafe = window as unknown as { unsafeWindow?: { fetch?: typeof fetch } };
    if (winWithUnsafe.unsafeWindow) {
      winWithUnsafe.unsafeWindow.fetch = proxiedFetch as unknown as typeof fetch;
    }
  } catch {}
}

/**
 * 获取镜像站基础 URL
 */
export function getMirrorBaseUrl(mirror: string, customUrl?: string): string {
  if (mirror === 'hf-mirror') {
    return 'https://hf-mirror.com/';
  }
  if (mirror === 'custom' && customUrl && customUrl.trim()) {
    const u = customUrl.trim();
    return u.endsWith('/') ? u : `${u}/`;
  }
  return 'https://huggingface.co/';
}

/**
 * 配置 Transformers.js 运行环境 (镜像节点、浏览器缓存与本地模型策略)
 */
export async function configureTransformersEnv(settings?: DownloadSettings): Promise<void> {
  setupFetchProxy();
  const s = settings || getDownloadSettings();
  const remoteHost = getMirrorBaseUrl(s.whisperMirror || 'hf-mirror', s.whisperCustomMirrorUrl);
  const transformers = await loadTransformers();
  const env = transformers.env;

  if (env && typeof env === 'object') {
    env.remoteHost = remoteHost;
    env.remotePathTemplate = '{model}/resolve/{revision}/';
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    env.allowRemoteModels = true;
    try {
      env.fetch = window.fetch;
    } catch {}
  }
}

/**
 * 将任意格式音频的 ArrayBuffer 解码并高质量重采样为 16000Hz 单声道 Float32Array
 */
export async function decodeAudioTo16kMono(audioBuffer: ArrayBuffer): Promise<{ float32: Float32Array; duration: number }> {
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtxClass) {
    throw new Error('当前浏览器不支持 Web Audio API，无法完成音频解码');
  }

  const audioCtx = new AudioCtxClass();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(audioBuffer.slice(0));
  } finally {
    audioCtx.close().catch(() => {});
  }

  const duration = decoded.duration;
  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.ceil(duration * targetSampleRate));

  const OfflineCtxClass =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  if (!OfflineCtxClass) {
    // 简易单声道与线性插值降级方案
    const channelData = decoded.getChannelData(0);
    return { float32: channelData, duration };
  }

  const offlineCtx = new OfflineCtxClass(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const float32 = renderedBuffer.getChannelData(0);

  return { float32, duration };
}

/**
 * 秒数格式化为 SRT 标准时间格式: HH:MM:SS,mmm
 */
export function formatSecondsToSrtTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const totalMs = Math.round(totalSeconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(milliseconds)}`;
}

/**
 * 将 Whisper 输出的 chunks 转换为标准 SRT 字符串
 */
export function chunksToSrt(chunks: WhisperChunk[], totalDuration = 0): string {
  if (!chunks || chunks.length === 0) return '';

  return chunks
    .map((chunk, index) => {
      const start = chunk.timestamp[0] ?? 0;
      const end = chunk.timestamp[1] ?? (index < chunks.length - 1 ? chunks[index + 1].timestamp[0] : totalDuration || start + 3);
      const text = (chunk.text || '').trim();
      if (!text) return '';

      return `${index + 1}\n${formatSecondsToSrtTime(start)} --> ${formatSecondsToSrtTime(end || start + 2)}\n${text}\n`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * 获取或实例化 Whisper ASR pipeline
 */
export async function getWhisperPipeline(options?: {
  model?: string;
  device?: 'auto' | 'webgpu' | 'wasm';
  onProgress?: (update: WhisperProgressUpdate) => void;
  signal?: AbortSignal;
}): Promise<{
  transcriber: WhisperPipelineFn;
  deviceUsed: 'webgpu' | 'wasm';
  modelUsed: string;
}> {
  const settings = getDownloadSettings();
  await configureTransformersEnv(settings);
  const { pipeline } = await loadTransformers();

  const model = options?.model || settings.whisperModel || 'onnx-community/whisper-tiny';
  const targetDevice = options?.device || settings.whisperDevice || 'auto';

  let selectedDevice: 'webgpu' | 'wasm' = 'wasm';
  if (targetDevice === 'webgpu') {
    selectedDevice = 'webgpu';
  } else if (targetDevice === 'auto') {
    const gpuCheck = await checkWebGpuSupport();
    selectedDevice = gpuCheck.supported ? 'webgpu' : 'wasm';
  }

  const cacheKey = `${model}_${selectedDevice}`;
  if (pipelineCache.has(cacheKey)) {
    return {
      transcriber: await pipelineCache.get(cacheKey)!,
      deviceUsed: selectedDevice,
      modelUsed: model,
    };
  }

  options?.onProgress?.({
    stage: 'loading_model',
    progress: 0,
    message: `正在加载 Whisper 模型 (${selectedDevice === 'webgpu' ? 'WebGPU 显卡加速' : 'CPU Wasm'})...`,
  });

  const progressCallback = (info: { file?: string; name?: string; progress?: number; loaded?: number; total?: number }) => {
    if (options?.signal?.aborted) return;
    if (info && typeof info === 'object') {
      const file = info.file || info.name || '';
      const progress = typeof info.progress === 'number' ? Math.round(info.progress) : 0;
      const loaded = info.loaded;
      const total = info.total;

      const loadedMB = loaded ? (loaded / (1024 * 1024)).toFixed(1) : '';
      const totalMB = total ? (total / (1024 * 1024)).toFixed(1) : '';
      const sizeMsg = totalMB ? ` (${loadedMB}/${totalMB} MB)` : '';

      options?.onProgress?.({
        stage: 'loading_model',
        progress: progress || 0,
        message: `正在拉取模型权重 [${file}]${sizeMsg} - ${progress}%`,
        downloadedBytes: loaded,
        totalBytes: total,
      });
    }
  };

  try {
    const p = pipeline('automatic-speech-recognition', model, {
      device: selectedDevice,
      progress_callback: progressCallback,
    });
    pipelineCache.set(cacheKey, p);
    const transcriber = await p;

    return { transcriber, deviceUsed: selectedDevice, modelUsed: model };
  } catch (err) {
    if (selectedDevice === 'webgpu' && targetDevice === 'auto') {
      logger.warn('Whisper', 'WebGPU 初始化异常，自动降级至 CPU Wasm 模式', err);
      options?.onProgress?.({
        stage: 'loading_model',
        progress: 10,
        message: 'WebGPU 加速不可用，已自动降级为 CPU Wasm 模式加载...',
      });
      const wasmCacheKey = `${model}_wasm`;
      const p = pipeline('automatic-speech-recognition', model, {
        device: 'wasm',
        progress_callback: progressCallback,
      });
      pipelineCache.set(wasmCacheKey, p);
      const transcriber = await p;
      return { transcriber, deviceUsed: 'wasm', modelUsed: model };
    }
    throw err;
  }
}

/**
 * 完整转写指定的音频 ArrayBuffer
 */
export async function transcribeAudioBuffer(
  audioBuffer: ArrayBuffer,
  options?: {
    model?: string;
    device?: 'auto' | 'webgpu' | 'wasm';
    language?: string;
    returnTimestamps?: boolean;
    onProgress?: (update: WhisperProgressUpdate) => void;
    onChunk?: (chunk: WhisperChunk) => void;
    signal?: AbortSignal;
    traceId?: string;
  }
): Promise<WhisperTranscriptionResult> {
  const traceId = options?.traceId || 'Whisper-Local';
  const settings = getDownloadSettings();
  const language = options?.language || settings.whisperLanguage || 'chinese';
  const returnTimestamps = options?.returnTimestamps ?? settings.whisperReturnTimestamps ?? true;

  try {
    if (options?.signal?.aborted) {
      throw new DOMException('Transcription aborted by user', 'AbortError');
    }

    // 1. 解码重采样音频为 16kHz mono Float32Array (微任务让渡防止卡顿)
    await yieldToMainLoop();
    options?.onProgress?.({
      stage: 'decoding_audio',
      progress: 5,
      message: '正在解码并重采样音频 (16000Hz 单声道)...',
    });

    const { float32, duration } = await decodeAudioTo16kMono(audioBuffer);
    logger.info('Whisper', `音频解码重采样完成: 时长 ${duration.toFixed(1)}s, 采样点数 ${float32.length}`, null, traceId);

    if (options?.signal?.aborted) {
      throw new DOMException('Transcription aborted by user', 'AbortError');
    }

    await yieldToMainLoop();

    // 2. 加载或复用 Whisper Pipeline
    const { transcriber, deviceUsed, modelUsed } = await getWhisperPipeline({
      model: options?.model,
      device: options?.device,
      onProgress: options?.onProgress,
      signal: options?.signal,
    });

    if (options?.signal?.aborted) {
      throw new DOMException('Transcription aborted by user', 'AbortError');
    }

    await yieldToMainLoop();

    // 3. 执行 ASR 语音识别推理
    options?.onProgress?.({
      stage: 'transcribing',
      progress: 30,
      message: `正在通过 ${deviceUsed === 'webgpu' ? 'WebGPU 显卡' : 'CPU Wasm'} 异步推理转录中...`,
    });

    logger.info('Whisper', `开始本地模型推理: ${modelUsed} (${deviceUsed}), 语言: ${language}`, null, traceId);

    const handleChunkOutput = (chunkData: { text?: string; timestamp?: [number, number | null] }) => {
      if (options?.signal?.aborted) return;
      if (chunkData && chunkData.text) {
        options?.onChunk?.({
          text: chunkData.text,
          timestamp: chunkData.timestamp || [0, null],
        });

        if (duration > 0 && chunkData.timestamp && typeof chunkData.timestamp[0] === 'number') {
          const currentSec = chunkData.timestamp[1] ?? chunkData.timestamp[0];
          const pct = Math.min(98, Math.max(30, 30 + Math.round((currentSec / duration) * 65)));
          options?.onProgress?.({
            stage: 'transcribing',
            progress: pct,
            message: `正在通过 ${deviceUsed === 'webgpu' ? 'WebGPU 显卡' : 'CPU Wasm'} 推理转录中 (${Math.round(currentSec)}s / ${Math.round(duration)}s)...`,
          });
        }
      }
    };

    const pipelineOptions: Record<string, unknown> = {
      task: 'transcribe',
      return_timestamps: returnTimestamps ? true : false,
      chunk_length_s: 30,
      stride_length_s: 5,
      callback_function: handleChunkOutput,
      chunk_callback: handleChunkOutput,
    };

    if (language && language !== 'auto') {
      pipelineOptions.language = language;
    }

    const rawResult = await transcriber(float32, pipelineOptions);

    if (options?.signal?.aborted) {
      throw new DOMException('Transcription aborted by user', 'AbortError');
    }

    await yieldToMainLoop();

    const text = (rawResult?.text || '').trim();
    const rawChunks: Array<{ text: string; timestamp?: [number, number | null] }> = rawResult?.chunks || [];
    const chunks: WhisperChunk[] = rawChunks.map((c) => ({
      text: c.text,
      timestamp: c.timestamp || [0, null],
    }));

    const srt = chunksToSrt(chunks, duration);

    options?.onProgress?.({
      stage: 'completed',
      progress: 100,
      message: '语音转文字与字幕生成完成！',
    });

    logger.success(
      'Whisper',
      `本地 ASR 转录完成: 生成文本 ${text.length} 字符, 字幕 ${chunks.length} 句`,
      { model: modelUsed, device: deviceUsed, duration: `${duration.toFixed(1)}s` },
      traceId
    );

    return {
      text,
      srt,
      chunks,
      duration,
      model: modelUsed,
      device: deviceUsed,
      language,
    };
  } catch (err) {
    if (options?.signal?.aborted || isAbortError(err)) {
      throw err;
    }
    const msg = getErrorMessage(err);
    logger.error('Whisper', `语音识别转录失败: ${msg}`, err, traceId);
    throw err;
  }
}

/**
 * 一键拉取当前视频音频流并执行纯前端 Whisper 本地识别
 */
export async function transcribeMediaAudio(
  audio: AudioStreamItem,
  options?: {
    model?: string;
    device?: 'auto' | 'webgpu' | 'wasm';
    language?: string;
    returnTimestamps?: boolean;
    onProgress?: (update: WhisperProgressUpdate) => void;
    onChunk?: (chunk: WhisperChunk) => void;
    signal?: AbortSignal;
    traceId?: string;
  }
): Promise<WhisperTranscriptionResult> {
  const traceId = options?.traceId || `Whisper-${audio.id}`;

  try {
    options?.onProgress?.({
      stage: 'downloading_audio',
      progress: 0,
      message: '正在拉取音频媒体流...',
    });

    const audioUrls = [audio.baseUrl, ...(audio.backupUrl || [])].filter(Boolean);
    const audioBuffer = await requestChunkedBuffer(
      audioUrls,
      (loaded, total) => {
        if (options?.signal?.aborted) return;
        const pct = total > 0 ? Math.min(25, Math.floor((loaded / total) * 25)) : 10;
        options?.onProgress?.({
          stage: 'downloading_audio',
          progress: pct,
          message: `正在下载音频流: ${pct * 4}%`,
        });
      },
      2,
      traceId,
      'Whisper音频流',
      options?.signal
    );

    return await transcribeAudioBuffer(audioBuffer, {
      ...options,
      traceId,
    });
  } catch (err) {
    if (options?.signal?.aborted || isAbortError(err)) {
      options?.onProgress?.({
        stage: 'error',
        progress: 0,
        message: '语音识别任务已取消',
      });
      throw err;
    }
    const msg = getErrorMessage(err);
    options?.onProgress?.({
      stage: 'error',
      progress: 0,
      message: `转录失败: ${msg}`,
    });
    logger.error('Whisper', `转录流程异常: ${msg}`, err, traceId);
    throw err;
  }
}
