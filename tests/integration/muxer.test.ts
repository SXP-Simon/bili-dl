// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import MP4Box, { type MP4Sample } from 'mp4box';
import { muxMp4 } from '../../src/media/muxer';
import { writeProgressiveMp4 } from '../../src/media/progressiveMp4';

function fixture(name: string): ArrayBuffer {
  const data = readFileSync(new URL(`../fixtures/media/${name}.mp4`, import.meta.url));
  return Uint8Array.from(data).buffer;
}
function inspect(buffer: ArrayBuffer) {
  const file = MP4Box.createFile();
  const samples = new Map<number, MP4Sample[]>();
  file.onError = (error) => { throw new Error(error); };
  file.onReady = (info) => {
    for (const track of [...info.videoTracks, ...info.audioTracks]) {
      samples.set(track.id, []);
      file.setExtractionOptions(track.id, null, { nbSamples: 1000 });
    }
    file.start();
  };
  file.onSamples = (id, _ref, batch) => samples.get(id)!.push(...batch);
  file.appendBuffer(Object.assign(buffer, { fileStart: 0 }));
  file.flush();
  return { file, samples };
}

function topLevelTypes(buffer: ArrayBuffer): string[] {
  const view = new DataView(buffer);
  const types = [];
  for (let offset = 0; offset < buffer.byteLength;) {
    const size = view.getUint32(offset);
    expect(size).toBeGreaterThanOrEqual(8);
    types.push(String.fromCharCode(...new Uint8Array(buffer, offset + 4, 4)));
    offset += size;
    expect(offset).toBeLessThanOrEqual(buffer.byteLength);
  }
  return types;
}

describe('real MP4 remuxing (no MP4Box mock)', () => {
  it.each(['video', 'video-hevc', 'video-av1'].flatMap((video) => [true, false].map((audio) => [video, audio] as const)))(
    'preserves %s samples, codec and timing with audio=%s', async (video, withAudio) => {
      const progress = vi.fn();
      const result = await muxMp4(fixture(video), withAudio ? fixture('audio') : undefined, progress);
      expect(result.type).toBe('video/mp4');
      const buffer = await result.arrayBuffer();
      expect(topLevelTypes(buffer)).toEqual(['ftyp', 'moov', 'mdat']);
      const output = inspect(buffer);
      expect(output.file.moov?.traks).toHaveLength(withAudio ? 2 : 1);
      for (const [index, name] of (withAudio ? [video, 'audio'] : [video]).entries()) {
        const source = inspect(fixture(name));
        const expected = [...source.samples.values()][0]!;
        const actual = output.samples.get(index + 1)!;
        expect(actual.length).toBeGreaterThan(0);
        expect(actual).toHaveLength(expected.length);
        actual.forEach((sample, i) => {
          expect(new Uint8Array(sample.data)).toEqual(new Uint8Array(expected[i]!.data));
          expect(sample.duration).toBe(expected[i]!.duration);
          expect(sample.dts).toBe(expected[i]!.dts - expected[0]!.dts);
          expect(sample.cts - sample.dts).toBe(expected[i]!.cts - expected[i]!.dts);
          expect(sample.is_sync).toBe(expected[i]!.is_sync);
        });
        const track = output.file.moov!.traks![index]!;
        expect(track.mdia?.mdhd?.duration).toBe(expected.reduce((sum, sample) => sum + sample.duration, 0));
        expect(track.mdia?.minf?.stbl?.stsd?.entries?.[0]?.type).toBe(source.file.moov?.traks?.[0]?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.type);
        expect(track.tkhd?.volume).toBe(index === 0 ? 0 : 1);
        if (index > 0) { expect(track.tkhd?.width).toBe(0); expect(track.tkhd?.height).toBe(0); }
        expect(track.tkhd?.duration).toBeGreaterThan(0);
      }
      expect(progress).toHaveBeenLastCalledWith(100);
  });

  it('preserves signed composition offsets and long version-1 duration headers', async () => {
    const source = inspect(fixture('video'));
    const sample = [...source.samples.values()][0]![0]!;
    const samples = Array.from({ length: 4 }, (_, index) => ({
      ...sample, dts: index * 0x40000000, cts: index * 0x40000000 - 1, duration: 0x40000000,
    }));
    const file = MP4Box.createFile();
    file.addTrack({ type: 'avc1', hdlr: 'vide', timescale: 1 });
    const blob = writeProgressiveMp4(file.getBuffer(), [{ timescale: 1, samples }]);
    const output = inspect(await blob.arrayBuffer());
    const actual = [...output.samples.values()][0]!;
    expect(actual.map((item) => item.cts - item.dts)).toEqual([-1, -1, -1, -1]);
    expect(actual.map((item) => item.duration)).toEqual([0x40000000, 0x40000000, 0x40000000, 0x40000000]);
    expect(output.file.moov?.traks?.[0]?.mdia?.mdhd?.duration).toBe(0x100000000);
    expect(output.file.moov?.traks?.[0]?.tkhd?.duration).toBe(0x100000000);
    expect(output.file.moov?.mvhd?.duration).toBe(0x100000000);
  });

  it('remuxes progressive input with multiple extraction batches and interleaved chunks', async () => {
    const source = inspect(fixture('video'));
    const original = [...source.samples.values()][0]!;
    const duration = original.reduce((sum, sample) => sum + sample.duration, 0);
    const samples = Array.from({ length: 50 }, (_, repeat) => original.map((sample) => ({
      ...sample, dts: sample.dts + repeat * duration, cts: sample.cts + repeat * duration,
    }))).flat();
    expect(samples.length).toBeGreaterThan(1000);
    const timescale = source.file.moov!.traks![0]!.mdia!.mdhd!.timescale!;
    const input = await writeProgressiveMp4(fixture('video'), [{ timescale, samples }]).arrayBuffer();
    const output = inspect(await (await muxMp4(input, fixture('audio'))).arrayBuffer());
    const actual = output.samples.get(1)!;
    expect(actual).toHaveLength(samples.length);
    const payloadHash = (items: MP4Sample[]) => {
      const hash = createHash('sha256');
      for (const sample of items) hash.update(new Uint8Array(sample.data));
      return hash.digest('hex');
    };
    expect(payloadHash(actual)).toBe(payloadHash(samples));
    const timing = (items: MP4Sample[]) => items.map((sample) => [sample.dts, sample.cts, sample.duration, sample.is_sync]);
    expect(timing(actual)).toEqual(timing(samples));
    expect(output.samples.get(2)!.length).toBeGreaterThan(0);
  });

  const damaged = new Uint8Array([1, 2, 3, 4]).buffer;
  it.each([
    ['damaged video', () => damaged.slice(0), () => fixture('audio')],
    ['damaged audio', () => fixture('video'), () => damaged.slice(0)],
    ['empty video', () => new ArrayBuffer(0), () => fixture('audio')],
    ['empty audio', () => fixture('video'), () => new ArrayBuffer(0)],
    ['missing video track', () => fixture('audio'), () => fixture('audio')],
    ['missing audio track', () => fixture('video'), () => fixture('video')],
    ['truncated video', () => fixture('video').slice(0, -100), () => fixture('audio')],
    ['truncated audio', () => fixture('video'), () => fixture('audio').slice(0, -100)],
  ] as const)('rejects %s without reporting completion', async (_name, video, audio) => {
    const progress = vi.fn();
    await expect(muxMp4(video(), audio(), progress)).rejects.toThrow();
    expect(progress).not.toHaveBeenCalledWith(100);
  });
});
