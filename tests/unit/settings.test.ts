import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDownloadSettings,
  saveDownloadSettings,
  resetDownloadSettings,
  resolveDownloadRelativePath,
  DEFAULT_SETTINGS,
} from '../../src/utils/settings';

describe('Settings & Path Resolution Unit Tests', () => {
  beforeEach(() => {
    resetDownloadSettings();
  });

  it('should return default settings initially', () => {
    const settings = getDownloadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.subfolder).toBe('bili-dl');
    expect(settings.autoTitleFolder).toBe(true);
    expect(settings.alwaysAskSaveAs).toBe(false);
    expect(settings.enableCdnPriority).toBe(true);
    expect(settings.cdnAutoFailover).toBe(true);
    expect(settings.cdnMinSpeedKB).toBe(300);
    expect(settings.cdnFailoverDurationSec).toBe(8);
  });

  it('should save and retrieve updated settings', () => {
    saveDownloadSettings({
      subfolder: 'Custom/Anime',
      autoTitleFolder: false,
      alwaysAskSaveAs: true,
      enableCdnPriority: false,
      cdnAutoFailover: false,
      cdnMinSpeedKB: 500,
      cdnFailoverDurationSec: 10,
    });

    const updated = getDownloadSettings();
    expect(updated.subfolder).toBe('Custom/Anime');
    expect(updated.autoTitleFolder).toBe(false);
    expect(updated.alwaysAskSaveAs).toBe(true);
    expect(updated.enableCdnPriority).toBe(false);
    expect(updated.cdnAutoFailover).toBe(false);
    expect(updated.cdnMinSpeedKB).toBe(500);
    expect(updated.cdnFailoverDurationSec).toBe(10);
  });

  it('should reset settings back to default', () => {
    saveDownloadSettings({
      subfolder: 'MyPath',
      autoTitleFolder: false,
      alwaysAskSaveAs: true,
      enableCdnPriority: false,
      cdnAutoFailover: false,
      cdnMinSpeedKB: 100,
      cdnFailoverDurationSec: 15,
    });

    const reset = resetDownloadSettings();
    expect(reset).toEqual(DEFAULT_SETTINGS);
    expect(getDownloadSettings().subfolder).toBe('bili-dl');
    expect(getDownloadSettings().enableCdnPriority).toBe(true);
    expect(getDownloadSettings().cdnAutoFailover).toBe(true);
    expect(getDownloadSettings().cdnMinSpeedKB).toBe(300);
    expect(getDownloadSettings().cdnFailoverDurationSec).toBe(8);
  });

  describe('resolveDownloadRelativePath', () => {
    it('should generate standard relative path with title folder', () => {
      const relPath = resolveDownloadRelativePath('video.mp4', '测试视频标题');
      expect(relPath).toBe('bili-dl/测试视频标题/video.mp4');
    });

    it('should strip _P1 suffix from folder name but retain it in filename', () => {
      const relPath = resolveDownloadRelativePath(
        '测试视频_P1_第一讲.mp4',
        '测试视频_P1_第一讲'
      );
      expect(relPath).toBe('bili-dl/测试视频/测试视频_P1_第一讲.mp4');
    });

    it('should sanitize illegal characters in folder name', () => {
      const dirtyTitle = '课程: 深入/浅出*探索? <第1章> | 特别篇';
      const relPath = resolveDownloadRelativePath('video.mp4', dirtyTitle);
      const folder = relPath.split('/')[1];
      expect(folder).not.toMatch(/[\\/:*?"<>|]/);
      expect(relPath).toBe('bili-dl/课程_ 深入_浅出_探索_ _第1章_ _ 特别篇/video.mp4');
    });

    it('should skip title folder when autoTitleFolder is disabled', () => {
      saveDownloadSettings({
        ...DEFAULT_SETTINGS,
        autoTitleFolder: false,
      });

      const relPath = resolveDownloadRelativePath('video.mp4', '测试视频标题');
      expect(relPath).toBe('bili-dl/video.mp4');
    });

    it('should handle custom multi-level subfolder', () => {
      saveDownloadSettings({
        ...DEFAULT_SETTINGS,
        subfolder: '/Videos/BiliBili/',
      });

      const relPath = resolveDownloadRelativePath('video.mp4', '测试视频');
      expect(relPath).toBe('Videos/BiliBili/测试视频/video.mp4');
    });

    it('should handle empty subfolder cleanly', () => {
      saveDownloadSettings({
        ...DEFAULT_SETTINGS,
        subfolder: '   ',
        autoTitleFolder: false,
      });

      const relPath = resolveDownloadRelativePath('video.mp4');
      expect(relPath).toBe('video.mp4');
    });
  });
});
