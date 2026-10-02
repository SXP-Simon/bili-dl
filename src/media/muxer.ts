import MP4Box from 'mp4box';
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

/**
 * 将 B 站的视频轨 (video.m4s) 和音频轨 (audio.m4s) 通过 mp4box.js 提取 sample 并完整混流为标准可播放的 MP4
 */
export async function muxMp4(
  videoBuffer: ArrayBuffer,
  audioBuffer?: ArrayBuffer | null,
  onProgress?: (progress: number) => void,
  traceId?: string
): Promise<Blob> {
  logger.info(
    'Muxer',
    '开始音视频解封装与 MP4 容器混流...',
    {
      videoBytes: videoBuffer.byteLength,
      audioBytes: audioBuffer?.byteLength || 0,
    },
    traceId
  );
  return new Promise((resolve, reject) => {
    try {
      const outMp4 = MP4Box.createFile();
      const inVideo = MP4Box.createFile();
      const inAudio = audioBuffer && audioBuffer.byteLength > 0 ? MP4Box.createFile() : null;

      let videoOutTrackId: number | null = null;
      let audioOutTrackId: number | null = null;

      let videoDone = false;
      let audioDone = !inAudio;

      const checkFinished = () => {
        if (videoDone && audioDone) {
          try {
            // 计算并设置总时长到 mvhd、tkhd 及 mdhd，确保各主流播放器（如 Windows Media Player）能精准读取时长并允许拖动进度条
            const mvhdTimescale = outMp4.moov?.mvhd?.timescale || 600;
            let maxMovieDuration = 0;

            for (const trak of outMp4.moov?.traks || []) {
              const trakTimescale = trak.mdia?.mdhd?.timescale || 1;
              const sampleDuration = trak.samples_duration || trak.tkhd?.duration || 0;
              if (sampleDuration > 0) {
                if (trak.mdia?.mdhd) {
                  trak.mdia.mdhd.duration = sampleDuration;
                }
                const movieScaledDuration = Math.round((sampleDuration / trakTimescale) * mvhdTimescale);
                if (trak.tkhd) {
                  trak.tkhd.duration = movieScaledDuration;
                }
                if (movieScaledDuration > maxMovieDuration) {
                  maxMovieDuration = movieScaledDuration;
                }
              }
            }

            if (outMp4.moov?.mvhd && maxMovieDuration > 0) {
              outMp4.moov.mvhd.duration = maxMovieDuration;
            }

            outMp4.flush();
            const buffer = outMp4.getBuffer();
            if (buffer && buffer.byteLength > 0) {
              logger.success('Muxer', `MP4 封装合成成功: ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`, null, traceId);
              onProgress?.(100);
              resolve(new Blob([buffer], { type: 'video/mp4' }));
            } else {
              logger.warn('Muxer', '封装输出为空，降级回退原始视频流', null, traceId);
              resolve(new Blob([videoBuffer], { type: 'video/mp4' }));
            }
          } catch (e: unknown) {
            const msg = getErrorMessage(e);
            logger.error('Muxer', `MP4 导出异常: ${msg}`, e, traceId);
            reject(new Error(`MP4 导出异常: ${msg}`));
          }
        }
      };

      // 1. 视频轨解析与样本抽取
      inVideo.onReady = (info) => {
        if (info.videoTracks.length > 0) {
          const track = info.videoTracks[0];
          if (track) {
            const inTrak = inVideo.getTrackById(track.id) || inVideo.moov?.traks?.[0];
            const entry = inTrak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
            const entryType = entry?.type || (track.codec ? track.codec.substring(0, 4) : 'avc1');

            logger.info('Muxer', `提取视频轨: ${entryType} (${track.track_width}x${track.track_height}), 样本数: ${track.nb_samples}`, null, traceId);

            videoOutTrackId = outMp4.addTrack({
              type: entryType,
              hdlr: 'vide',
              width: track.track_width,
              height: track.track_height,
              timescale: track.timescale,
              duration: track.duration,
              nb_samples: track.nb_samples,
              codec: track.codec,
              description_boxes: entry?.boxes,
              avcDecoderConfigRecord: track.avcDecoderConfigRecord,
              hevcDecoderConfigRecord: track.hevcDecoderConfigRecord,
              hvcC: track.hvcC,
              av1C: track.av1C,
            });

            // 规范化视频轨 tkhd: 视频音量应为 0
            const vTrak = typeof outMp4.getTrackById === 'function' ? outMp4.getTrackById(videoOutTrackId) : undefined;
            if (vTrak?.tkhd) {
              vTrak.tkhd.volume = 0;
            }

            inVideo.setExtractionOptions(track.id, null, { nbSamples: 1000 });
          }
        }
        inVideo.start();
      };

      inVideo.onSamples = (_trackId, _ref, samples) => {
        if (videoOutTrackId !== null && videoOutTrackId !== undefined) {
          for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            if (sample) {
              outMp4.addSample(videoOutTrackId, sample.data, {
                duration: sample.duration,
                dts: sample.dts,
                cts: sample.cts,
                is_sync: sample.is_sync,
                is_leading: sample.is_leading,
                depends_on: sample.depends_on,
                is_depended_on: sample.is_depended_on,
                has_redundancy: sample.has_redundancy,
                degradation_priority: sample.degradation_priority,
              });
            }
          }
        }
        onProgress?.(50);
      };

      inVideo.onError = (err) => {
        logger.warn('Muxer', `视频样本解析警告: ${err}`);
      };

      // 2. 音频轨解析与样本抽取（如果存在）
      if (inAudio && audioBuffer) {
        inAudio.onReady = (info) => {
          if (info.audioTracks.length > 0) {
            const track = info.audioTracks[0];
            if (track) {
              const inTrak = inAudio.getTrackById(track.id) || inAudio.moov?.traks?.[0];
              const entry = inTrak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
              const entryType = entry?.type || (track.codec ? track.codec.substring(0, 4) : 'mp4a');

              logger.info(
                'Muxer',
                `提取音频轨: ${entryType}, 采样率: ${track.audio?.sample_rate || 44100}Hz, 声道: ${track.audio?.channel_count || 2}`,
                null,
                traceId
              );

              audioOutTrackId = outMp4.addTrack({
                type: entryType,
                hdlr: 'soun',
                timescale: track.timescale,
                duration: track.duration,
                channel_count: track.audio?.channel_count || track.channel_count || 2,
                samplerate: track.audio?.sample_rate || track.samplerate || 44100,
                samplesize: track.audio?.sample_size || track.samplesize || 16,
                codec: track.codec,
                description_boxes: entry?.boxes,
              });

              // 规范化音频轨 tkhd: 音频宽高为 0，音量为 1 (0x0100)
              const aTrak = typeof outMp4.getTrackById === 'function' ? outMp4.getTrackById(audioOutTrackId) : undefined;
              if (aTrak?.tkhd) {
                aTrak.tkhd.width = 0;
                aTrak.tkhd.height = 0;
                aTrak.tkhd.volume = 1;
              }

              inAudio.setExtractionOptions(track.id, null, { nbSamples: 1000 });
            }
          }
          inAudio.start();
        };

        inAudio.onSamples = (_trackId, _ref, samples) => {
          if (audioOutTrackId !== null && audioOutTrackId !== undefined) {
            for (let i = 0; i < samples.length; i++) {
              const sample = samples[i];
              if (sample) {
                outMp4.addSample(audioOutTrackId, sample.data, {
                  duration: sample.duration,
                  dts: sample.dts,
                  cts: sample.cts,
                  is_sync: sample.is_sync,
                  is_leading: sample.is_leading,
                  depends_on: sample.depends_on,
                  is_depended_on: sample.is_depended_on,
                  has_redundancy: sample.has_redundancy,
                  degradation_priority: sample.degradation_priority,
                });
              }
            }
          }
          onProgress?.(85);
        };

        inAudio.onError = (err) => {
          logger.warn('Muxer', `音频样本解析警告: ${err}`);
        };
      }

      // 3. 灌入 Buffer 触发完整解析
      try {
        const vBuf: ArrayBuffer & { fileStart?: number } = videoBuffer;
        vBuf.fileStart = 0;
        inVideo.appendBuffer(vBuf);
        inVideo.flush();
        videoDone = true;
      } catch (vErr: unknown) {
        const msg = getErrorMessage(vErr);
        logger.warn('Muxer', `视频流解析异常，直接使用原始视频流: ${msg}`, null, traceId);
        resolve(new Blob([videoBuffer], { type: 'video/mp4' }));
        return;
      }

      if (inAudio && audioBuffer) {
        try {
          const aBuf: ArrayBuffer & { fileStart?: number } = audioBuffer;
          aBuf.fileStart = 0;
          inAudio.appendBuffer(aBuf);
          inAudio.flush();
          audioDone = true;
        } catch (aErr: unknown) {
          const msg = getErrorMessage(aErr);
          logger.warn('Muxer', `音频流解析异常，跳过音频混流: ${msg}`, null, traceId);
          audioDone = true;
        }
      }

      checkFinished();
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      reject(new Error(`MP4 合成失败: ${msg}`));
    }
  });
}
