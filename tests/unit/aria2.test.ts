import { describe, it, expect } from 'vitest';
import { buildAria2CommandString } from '../../src/media/aria2';
import type { VideoStreamItem, AudioStreamItem } from '../../src/types';

describe('aria2 command generator', () => {
  const dummyVideo: VideoStreamItem = {
    id: 80,
    qualityName: '1080P 高清',
    codecName: 'AVC',
    codec: 'avc1.640032',
    bandwidth: 1500000,
    sizeMB: '15.0',
    baseUrl: 'https://cn-upcdn.bilivideo.com/video.m4s',
    width: 1920,
    height: 1080,
    frameRate: '30',
  };

  const dummyAudio: AudioStreamItem = {
    id: 30280,
    name: '320K 极高音质',
    qualityDesc: '320Kbps',
    codec: 'mp4a.40.2',
    bandwidth: 320000,
    sizeMB: '3.2',
    baseUrl: 'https://cn-upcdn.bilivideo.com/audio.m4s',
  };

  it('should generate video-only command when audio is not provided', () => {
    const cmd = buildAria2CommandString('测试视频', dummyVideo);
    expect(cmd).toContain('aria2c -c -s 16 -x 16');
    expect(cmd).toContain('-o "测试视频_1080P 高清_AVC.m4s"');
    expect(cmd).toContain('"https://cn-upcdn.bilivideo.com/video.m4s"');
    expect(cmd).not.toContain('ffmpeg');
  });

  it('should generate video, audio, and ffmpeg muxing commands when audio is provided', () => {
    const cmd = buildAria2CommandString('测试视频', dummyVideo, dummyAudio);
    expect(cmd).toContain('# 1. 下载视频轨');
    expect(cmd).toContain('# 2. 下载音频轨');
    expect(cmd).toContain('# 3. 本地一键无损混流为 MP4');
    expect(cmd).toContain('ffmpeg -i "测试视频_1080P 高清_AVC.m4s" -i "测试视频_320K 极高音质.m4s" -c copy "测试视频.mp4"');
  });
});
