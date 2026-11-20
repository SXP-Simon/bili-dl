import { afterEach, expect, it, vi } from 'vitest';
const originalFetch = globalThis.fetch;
afterEach(() => { vi.unstubAllGlobals(); globalThis.fetch = originalFetch; delete (window as unknown as { transformers?: unknown }).transformers; });
it('retries failed model loads and retains successful instances', async () => {
  vi.resetModules();
  const transcriber = vi.fn();
  const pipeline = vi.fn().mockRejectedValueOnce(new Error('resource download failed')).mockResolvedValue(transcriber);
  (window as unknown as { transformers: unknown }).transformers = { env: {}, pipeline };
  const { getWhisperPipeline } = await import('../../src/ai/whisper');
  await expect(getWhisperPipeline({ device: 'wasm' })).rejects.toThrow('resource download failed');
  expect((await getWhisperPipeline({ device: 'wasm' })).transcriber).toBe(transcriber);
  expect((await getWhisperPipeline({ device: 'wasm' })).transcriber).toBe(transcriber);
  expect(pipeline).toHaveBeenCalledTimes(2);
});
it('shares the WASM fallback when concurrent WebGPU initialization fails', async () => {
  vi.resetModules();
  vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => ({ requestDevice: async () => ({ destroy() {} }) }) } });
  const transcriber = vi.fn();
  const pipeline = vi.fn((_task, _model, options) => options.device === 'webgpu'
    ? Promise.reject(new Error('GPU init failed')) : Promise.resolve(transcriber));
  (window as unknown as { transformers: unknown }).transformers = { env: {}, pipeline };
  const { getWhisperPipeline } = await import('../../src/ai/whisper');
  const results = await Promise.all([getWhisperPipeline(), getWhisperPipeline()]);
  expect(results.map((result) => result.deviceUsed)).toEqual(['wasm', 'wasm']);
  expect(pipeline.mock.calls.filter((call) => call[2].device === 'wasm')).toHaveLength(1);
});
