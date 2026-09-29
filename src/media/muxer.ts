import MP4Box from 'mp4box';
import { logger } from '../utils/logger';

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
          } catch (e: any) {
            logger.error('Muxer', `MP4 导出异常: ${e.message}`, e, traceId);
            reject(new Error(`MP4 导出异常: ${e.message}`));
          }
        }
      };

      // 1. 视频轨解析与样本抽取
      inVideo.onReady = (info) => {
        if (info.videoTracks.length > 0) {
          const track = info.videoTracks[0];
          const inTrak = (inVideo as any).getTrackById(track.id) || (inVideo as any).moov?.traks?.[0];
          const entry = inTrak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
          const entryType = entry?.type || (track.codec ? track.codec.substring(0, 4) : 'avc1');

          logger.info('Muxer', `提取视频轨: ${entryType} (${track.track_width}x${track.track_height}), 样本数: ${track.nb_samples}`, null, traceId);

          videoOutTrackId = outMp4.addTrack({
            type: entryType,
            width: track.track_width,
            height: track.track_height,
            timescale: track.timescale,
            duration: track.duration,
            nb_samples: track.nb_samples,
            codec: track.codec,
            description_boxes: entry?.boxes,
            avcDecoderConfigRecord: (track as any).avcDecoderConfigRecord,
            hevcDecoderConfigRecord: (track as any).hevcDecoderConfigRecord,
            hvcC: (track as any).hvcC,
            av1C: (track as any).av1C,
          });

          inVideo.setExtractionOptions(track.id, null, { nbSamples: 1000 });
        }
        inVideo.start();
      };

      inVideo.onSamples = (trackId, ref, samples) => {
        if (videoOutTrackId !== null && videoOutTrackId !== undefined) {
          for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
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
            const inTrak = (inAudio as any).getTrackById(track.id) || (inAudio as any).moov?.traks?.[0];
            const entry = inTrak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
            const entryType = entry?.type || (track.codec ? track.codec.substring(0, 4) : 'mp4a');

            logger.info(
              'Muxer',
              `提取音频轨: ${entryType}, 采样率: ${(track as any).audio?.sample_rate || 44100}Hz, 声道: ${(track as any).audio?.channel_count || 2}`,
              null,
              traceId
            );

            audioOutTrackId = outMp4.addTrack({
              type: entryType,
              timescale: track.timescale,
              duration: track.duration,
              channel_count: (track as any).audio?.channel_count || (track as any).channel_count || 2,
              samplerate: (track as any).audio?.sample_rate || (track as any).samplerate || 44100,
              samplesize: (track as any).audio?.sample_size || (track as any).samplesize || 16,
              codec: track.codec,
              description_boxes: entry?.boxes,
            });

            inAudio.setExtractionOptions(track.id, null, { nbSamples: 1000 });
          }
          inAudio.start();
        };

        inAudio.onSamples = (trackId, ref, samples) => {
          if (audioOutTrackId !== null && audioOutTrackId !== undefined) {
            for (let i = 0; i < samples.length; i++) {
              const sample = samples[i];
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
          onProgress?.(85);
        };

        inAudio.onError = (err) => {
          logger.warn('Muxer', `音频样本解析警告: ${err}`);
        };
      }

      // 3. 灌入 Buffer 触发完整解析
      const vBuf: any = videoBuffer;
      vBuf.fileStart = 0;
      inVideo.appendBuffer(vBuf);
      inVideo.flush();
      videoDone = true;

      if (inAudio && audioBuffer) {
        const aBuf: any = audioBuffer;
        aBuf.fileStart = 0;
        inAudio.appendBuffer(aBuf);
        inAudio.flush();
        audioDone = true;
      }

      checkFinished();
    } catch (err: any) {
      reject(new Error(`MP4 合成失败: ${err.message}`));
    }
  });
}

