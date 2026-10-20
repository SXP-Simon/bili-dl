import type { MP4Sample } from 'mp4box';

export interface ProgressiveTrack {
  samples: MP4Sample[];
  timescale: number;
}
interface Chunk { track: number; samples: MP4Sample[]; time: number; offset: number }
const UINT32_MAX = 0xffffffff;

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}
function words(values: number[]): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(values.length * 4);
  const view = new DataView(result.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value));
  return result;
}
function box(type: string, ...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const payload = concat(parts);
  const header = words([8 + payload.byteLength, 0]);
  for (let i = 0; i < 4; i++) header[4 + i] = type.charCodeAt(i);
  return concat([header, payload]);
}
function fullBox(type: string, values: number[], version = 0): Uint8Array<ArrayBuffer> {
  return box(type, words([version * 0x1000000, ...values]));
}
function children(data: Uint8Array): { type: string; data: Uint8Array }[] {
  const result = [];
  for (let offset = 0; offset < data.byteLength;) {
    if (offset + 8 > data.byteLength) throw new Error('MP4 元数据头不完整');
    const size = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0);
    if (size < 8 || offset + size > data.byteLength) throw new Error('MP4 元数据长度无效');
    result.push({ type: String.fromCharCode(...data.subarray(offset + 4, offset + 8)), data: data.subarray(offset, offset + size) });
    offset += size;
  }
  return result;
}
function runs(values: number[]): number[] {
  const result: number[] = [];
  for (const value of values) {
    if (result.length && result[result.length - 1] === value) result[result.length - 2]!++;
    else result.push(1, value);
  }
  return result;
}

// MP4Box 0.5.x writes version-0 duration headers. Promote long tracks to version 1
// instead of letting high-timescale / long recordings wrap at 2^32 ticks.
function durationHeader(type: string, data: Uint8Array, duration: number): Uint8Array {
  if (!Number.isSafeInteger(duration) || duration < 0) throw new Error('MP4 时长无效');
  const durationOffset = type === 'tkhd' ? 28 : 24;
  if (duration <= UINT32_MAX) {
    const result = Uint8Array.from(data);
    new DataView(result.buffer).setUint32(durationOffset, duration);
    return result;
  }
  const prefix = concat([data.subarray(8, 12), new Uint8Array(16), data.subarray(20, durationOffset)]);
  prefix[0] = 1;
  const longDuration = new Uint8Array(8);
  new DataView(longDuration.buffer).setBigUint64(0, BigInt(duration));
  return box(type, prefix, longDuration, data.subarray(durationOffset + 4));
}

/** Write indexed, fast-start MP4 without MP4Box.addSample's per-sample moof/mdat.
 * Decoder descriptions come from MP4Box; compressed media is kept unchanged.
 */
export function writeProgressiveMp4(metadata: ArrayBuffer, tracks: ProgressiveTrack[]): Blob {
  const top = children(new Uint8Array(metadata));
  const ftyp = top.find((entry) => entry.type === 'ftyp')?.data;
  const moov = top.find((entry) => entry.type === 'moov')?.data;
  if (!ftyp || !moov || tracks.length === 0) throw new Error('MP4 封装元数据为空');
  const chunks: Chunk[] = [];
  for (const [track, { samples, timescale }] of tracks.entries()) {
    if (!samples.length || !Number.isInteger(timescale) || timescale <= 0) throw new Error('MP4 轨道无效');
    let chunk: Chunk | undefined;
    const origin = samples[0]!.dts;
    for (const [index, sample] of samples.entries()) {
      const offset = sample.cts - sample.dts;
      if (!Number.isInteger(sample.duration) || sample.duration <= 0 || sample.duration > UINT32_MAX ||
          !Number.isInteger(offset) || offset < -0x80000000 || offset > 0x7fffffff || (sample.data.byteLength === 0 || sample.data.byteLength > UINT32_MAX)) {
        throw new Error('MP4 样本数据或时间信息无效');
      }
      if (index > 0 && sample.dts !== samples[index - 1]!.dts + samples[index - 1]!.duration) {
        throw new Error('MP4 解码时间轴不连续');
      }
      const time = (sample.dts - origin) / timescale;
      if (!chunk || time - chunk.time >= 1) {
        chunk = { track, samples: [], time, offset: 0 };
        chunks.push(chunk);
      }
      chunk.samples.push(sample);
    }
  }
  chunks.sort((a, b) => a.time - b.time || a.track - b.track);
  const payloadBytes = chunks.reduce((total, chunk) => total + chunk.samples.reduce((sum, sample) => sum + sample.data.byteLength, 0), 0);
  if (!Number.isSafeInteger(payloadBytes)) throw new Error('MP4 文件大小超出安全范围');
  const mdatHeader = words([payloadBytes + 8 <= UINT32_MAX ? payloadBytes + 8 : 1, 0x6d646174]);
  const extendedSize = new Uint8Array(payloadBytes + 8 <= UINT32_MAX ? 0 : 8);
  if (extendedSize.length) new DataView(extendedSize.buffer).setBigUint64(0, BigInt(payloadBytes + 16));
  const trackChunks = tracks.map((_, id) => chunks.filter((chunk) => chunk.track === id));
  const durations = tracks.map(({ samples }) => samples.reduce((sum, sample) => sum + sample.duration, 0));
  const mvhd = children(moov.subarray(8)).find((entry) => entry.type === 'mvhd')?.data;
  if (!mvhd) throw new Error('MP4 缺少影片头');
  const movieTimescale = new DataView(mvhd.buffer, mvhd.byteOffset + 20, 4).getUint32(0);
  const movieDurations = tracks.map((track, index) => Math.ceil(durations[index]! / track.timescale * movieTimescale));
  let wideOffsets = false;

  function sampleTable(track: number, stsd: Uint8Array): Uint8Array {
    const samples = tracks[track]!.samples;
    const offsets = samples.map((sample) => sample.cts - sample.dts);
    const composition = runs(offsets);
    const signed = offsets.some((offset) => offset < 0);
    if (signed && offsets.some((offset) => offset > 0x7fffffff)) throw new Error('MP4 显示时间偏移超出范围');
    const stsc: number[] = [];
    trackChunks[track]!.forEach((chunk, index, list) => {
      if (index === 0 || chunk.samples.length !== list[index - 1]!.samples.length) stsc.push(index + 1, chunk.samples.length, 1);
    });
    const offsetData = new Uint8Array(trackChunks[track]!.length * (wideOffsets ? 8 : 4));
    const view = new DataView(offsetData.buffer);
    trackChunks[track]!.forEach((chunk, index) => {
      if (wideOffsets) view.setBigUint64(index * 8, BigInt(chunk.offset));
      else view.setUint32(index * 4, chunk.offset);
    });
    const sync = samples.flatMap((sample, index) => sample.is_sync ? [index + 1] : []);
    const decoding = runs(samples.map((sample) => sample.duration));
    return box('stbl', stsd,
      fullBox('stts', [decoding.length / 2, ...decoding]),
      ...(offsets.some(Boolean) ? [fullBox('ctts', [composition.length / 2, ...composition], signed ? 1 : 0)] : []),
      fullBox('stsc', [stsc.length / 3, ...stsc]),
      fullBox('stsz', [0, samples.length, ...samples.map((sample) => sample.data.byteLength)]),
      box(wideOffsets ? 'co64' : 'stco', words([0, trackChunks[track]!.length]), offsetData),
      ...(sync.length !== samples.length ? [fullBox('stss', [sync.length, ...sync])] : []));
  }
  function rewrite(data: Uint8Array, track: number): Uint8Array {
    const type = String.fromCharCode(...data.subarray(4, 8));
    if (type === 'mvhd') return durationHeader(type, data, Math.max(...movieDurations));
    if (type === 'tkhd') return durationHeader(type, data, movieDurations[track]!);
    if (type === 'mdhd') return durationHeader(type, data, durations[track]!);
    if (type === 'stbl') {
      const stsd = children(data.subarray(8)).find((entry) => entry.type === 'stsd')?.data;
      if (!stsd) throw new Error('MP4 缺少解码器配置');
      return sampleTable(track, stsd);
    }
    if (!['moov', 'trak', 'mdia', 'minf'].includes(type)) return data;
    let trackIndex = 0;
    return box(type, ...children(data.subarray(8)).filter((entry) => entry.type !== 'mvex').map((entry) => {
      const id = entry.type === 'trak' ? trackIndex++ : track;
      return rewrite(entry.data, id);
    }));
  }
  // Table lengths are stable after choosing stco/co64. Recompute absolute offsets
  // after moving moov ahead of mdat (including a possible 64-bit mdat header).
  let header = rewrite(moov, 0);
  for (;;) {
    let offset = ftyp.byteLength + header.byteLength + mdatHeader.byteLength + extendedSize.byteLength;
    for (const chunk of chunks) {
      chunk.offset = offset;
      offset += chunk.samples.reduce((sum, sample) => sum + sample.data.byteLength, 0);
    }
    if (!wideOffsets && offset > UINT32_MAX) {
      wideOffsets = true;
      header = rewrite(moov, 0);
      continue;
    }
    header = rewrite(moov, 0);
    break;
  }
  const media: BlobPart[] = chunks.flatMap((chunk) => chunk.samples.map((sample) => sample.data as BlobPart));
  return new Blob([ftyp as BlobPart, header as BlobPart, mdatHeader, extendedSize, ...media], { type: 'video/mp4' });
}
