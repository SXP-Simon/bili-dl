import { describe, it, expect } from 'vitest';
import {
  getCdnNodeLabel,
  getCdnPriorityScore,
  sortCdnUrlsByQuality,
} from '../../src/api/http';

describe('HTTP & CDN Routing Unit Tests', () => {
  describe('getCdnNodeLabel', () => {
    it('should identify Tencent Cloud COS', () => {
      const label = getCdnNodeLabel('https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/123.mp4');
      expect(label).toContain('腾讯云 COS');
    });

    it('should identify Alibaba Cloud OSS', () => {
      const label = getCdnNodeLabel('https://upos-sz-mirroraliov.bilivideo.com/upgcxcode/123.mp4');
      expect(label).toContain('阿里云 OSS');
    });

    it('should identify Huawei Cloud OBS', () => {
      const label = getCdnNodeLabel('https://upos-sz-mirrorhw.bilivideo.com/upgcxcode/123.mp4');
      expect(label).toContain('华为云 OBS');
    });

    it('should identify Akamai overseas', () => {
      const label = getCdnNodeLabel('https://upos-hz-mirrorakam.akamaized.net/upgcxcode/123.mp4');
      expect(label).toContain('Akamai 海外');
    });

    it('should identify Fastly overseas', () => {
      const label = getCdnNodeLabel('https://fastly.bilivideo.com/upgcxcode/123.mp4');
      expect(label).toContain('Fastly 海外');
    });

    it('should identify PCDN node', () => {
      const label = getCdnNodeLabel('https://xy122x115x50x88xy.mcdn.bilivideo.cn:9102/upgcxcode/123.mp4');
      expect(label).toContain('PCDN 节点');
    });
  });

  describe('getCdnPriorityScore & sortCdnUrlsByQuality', () => {
    it('should rank domestic COS/OSS/OBS higher than overseas Akamai/Fastly', () => {
      const cosScore = getCdnPriorityScore('https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/123.mp4');
      const aliScore = getCdnPriorityScore('https://upos-sz-mirroraliov.bilivideo.com/upgcxcode/123.mp4');
      const akamaiScore = getCdnPriorityScore('https://upos-hz-mirrorakam.akamaized.net/upgcxcode/123.mp4');
      const mcdnScore = getCdnPriorityScore('https://xy122.mcdn.bilivideo.cn:9102/upgcxcode/123.mp4');

      expect(cosScore).toBeGreaterThan(akamaiScore);
      expect(aliScore).toBeGreaterThan(akamaiScore);
      expect(cosScore).toBeGreaterThan(mcdnScore);
      expect(mcdnScore).toBeGreaterThan(akamaiScore);
    });

    it('should correctly sort mixed candidate CDN URLs prioritizing domestic high-speed lines', () => {
      const urls = [
        'https://upos-hz-mirrorakam.akamaized.net/upgcxcode/akamai.mp4',
        'https://upos-sz-mirrorhwov.bilivideo.com/upgcxcode/hw.mp4',
        'https://xy122.mcdn.bilivideo.cn:9102/upgcxcode/pcdn.mp4',
        'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/cos.mp4',
        'https://upos-sz-mirroraliov.bilivideo.com/upgcxcode/ali.mp4',
      ];

      const sorted = sortCdnUrlsByQuality(urls);

      // Top priority should be COS, OSS, OBS
      expect(sorted[0]).toContain('mirrorcos');
      expect(sorted[1]).toContain('mirrorali');
      expect(sorted[2]).toContain('mirrorhw');
      // PCDN and Akamai should be in lower tiers
      expect(sorted[3]).toContain('mcdn');
      expect(sorted[4]).toContain('mirrorakam');
    });

    it('should deduplicate identical URLs and filter invalid values', () => {
      const urls = [
        'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/cos.mp4',
        'https://upos-sz-mirrorcosov.bilivideo.com/upgcxcode/cos.mp4',
        '',
      ];
      const sorted = sortCdnUrlsByQuality(urls);
      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toContain('mirrorcos');
    });
  });
});
