import MP4Box, { type MP4Sample } from 'mp4box';
import { writeProgressiveMp4, type ProgressiveTrack } from './progressiveMp4';
import { logger } from '../utils/logger';
import { getErrorMessage } from '../utils/error';

// 补丁：修复 mp4box.js 当遇到非 mdat 且 size 为 0 的残缺/末尾补零 box 时返回 OK 导致的同步死循环卡死主线程缺陷
if (typeof MP4Box.BoxParser?.parseOneBox === 'function') {
  const originalParseOneBox = MP4Box.BoxParser.parseOneBox;
  MP4Box.BoxParser.parseOneBox = function (stream: unknown, headerOnly?: boolean, parentSize?: number) {
    const ret = originalParseOneBox.call(this, stream, headerOnly, parentSize);
    if (ret && ret.code === MP4Box.BoxParser.OK && ret.box && ret.box.size === 0 && ret.box.type !== 'mdat') {
      return { code: MP4Box.BoxParser.ERR_NOT_ENOUGH_DATA };
    }
    return ret;
  };
}

/** Remux DASH tracks into an indexed, non-fragmented MP4 without re-encoding. */
export async function muxMp4(
  videoBuffer: ArrayBuffer,
  audioBuffer?: ArrayBuffer | null,
  onProgress?: (progress: number) => void,
  traceId?: string
): Promise<Blob> {
  logger.info('Muxer', '开始音视频解封装与 MP4 容器混流...', {
    videoBytes: videoBuffer.byteLength, audioBytes: audioBuffer?.byteLength || 0,
  }, traceId);
  try {
    if (audioBuffer && audioBuffer.byteLength === 0) throw new Error('音频流为空');
    const output = MP4Box.createFile();
    const tracks: ProgressiveTrack[] = [];
    const extract = (buffer: ArrayBuffer, video: boolean) => {
      const label = video ? '视频轨' : '音频轨';
      const input = MP4Box.createFile();
      const samples: MP4Sample[] = [];
      let sourceId: number | undefined;
      let parseError: string | undefined;
      let timescale = 0;
      input.onError = (error) => { parseError = `${label}解析失败: ${error}`; };
      input.onReady = (info) => {
        const track = (video ? info.videoTracks : info.audioTracks)[0];
        if (!track) return;
        sourceId = track.id;
        timescale = track.timescale;
        const entry = input.getTrackById(track.id)?.mdia?.minf?.stbl?.stsd?.entries?.[0];
        const type = entry?.type || track.codec.substring(0, 4);
        const id = output.addTrack({
          type, hdlr: video ? 'vide' : 'soun', timescale,
          width: video ? track.track_width : undefined,
          height: video ? track.track_height : undefined,
          codec: track.codec, description_boxes: entry?.boxes,
          avcDecoderConfigRecord: track.avcDecoderConfigRecord,
          hevcDecoderConfigRecord: track.hevcDecoderConfigRecord,
          channel_count: track.audio?.channel_count || track.channel_count || 2,
          samplerate: track.audio?.sample_rate || track.samplerate || 44100,
          samplesize: track.audio?.sample_size || track.samplesize || 16,
        });
        if (id == null) throw new Error(`${label}编码不受支持: ${type}`);
        const outTrack = output.getTrackById(id);
        if (outTrack?.tkhd) {
          outTrack.tkhd.volume = video ? 0 : 1;
          if (!video) { outTrack.tkhd.width = 0; outTrack.tkhd.height = 0; }
        }
        logger.info('Muxer', `提取${label}: ${type}`, null, traceId);
        input.setExtractionOptions(track.id, null, { nbSamples: 1000 });
        input.start();
      };
      input.onSamples = (_id, _ref, batch) => { samples.push(...batch); };
      input.appendBuffer(Object.assign(buffer, { fileStart: 0 }));
      input.flush();
      if (parseError) throw new Error(parseError);
      if (sourceId === undefined || samples.length === 0) throw new Error(`${label}未能提取有效样本`);
      // onReady can precede moof parsing. Validate against the final sample table.
      const expected = input.getTrackById(sourceId)?.samples?.length;
      if (expected === undefined || samples.length !== expected) {
        throw new Error(`${label}样本不完整: 预期 ${expected ?? '未知'}，实际 ${samples.length}`);
      }
      tracks.push({ samples, timescale });
    };
    extract(videoBuffer, true);
    onProgress?.(50);
    if (audioBuffer) extract(audioBuffer, false);
    onProgress?.(85);
    const result = writeProgressiveMp4(output.getBuffer(), tracks);
    logger.success('Muxer', `MP4 封装合成成功: ${(result.size / 1024 / 1024).toFixed(1)} MB`, null, traceId);
    onProgress?.(100);
    return result;
  } catch (error: unknown) {
    const message = `MP4 合成失败: ${getErrorMessage(error)}`;
    logger.error('Muxer', message, error, traceId);
    throw new Error(message);
  }
}
