import { describe, it, expect } from 'vitest';
import {
  getCdnNodeId,
  getCdnNodeLabel,
  getCdnPriorityScore,
  sortCdnUrls,
  getPrioritizedCdnUrls,
  DEFAULT_CDN_ORDER,
  normalizeCdnOrder,
} from '../../src/utils/cdn';

describe('CDN Priority & Quality Utilities', () => {
  it('should identify CDN node ID accurately from URLs', () => {
    expect(getCdnNodeId('https://upos-sz-mirrorcos.bilivideo.com/video.m4s')).toBe('cos');
    expect(getCdnNodeId('https://upos-sz-mirrorali.bilivideo.com/video.m4s')).toBe('ali');
    expect(getCdnNodeId('https://upos-sz-mirrorhw.bilivideo.com/video.m4s')).toBe('hw');
    expect(getCdnNodeId('https://upos-sz-mirrorbos.bilivideo.com/video.m4s')).toBe('bos');
    expect(getCdnNodeId('https://upos-sz-upcdntx.bilivideo.com/video.m4s')).toBe('tx');
    expect(getCdnNodeId('https://upos-sz-mirror08c.bilivideo.com/video.m4s')).toBe('ks3');
    expect(getCdnNodeId('https://upos-sz-upcdnws.bilivideo.com/video.m4s')).toBe('ws');
    expect(getCdnNodeId('https://xy1x2x3.mcdn.bilivideo.cn:8082/video.m4s')).toBe('pcdn');
    expect(getCdnNodeId('https://upos-sz-mirrorakamai.bilivideo.com/video.m4s')).toBe('oversea');
    expect(getCdnNodeId('https://cn-gdfs-cmcc-01.bilivideo.com/video.m4s')).toBe('bili');
    expect(getCdnNodeId('https://unknown-domain.example.com/video.m4s')).toBeNull();
  });

  it('should provide friendly node labels with provider and host', () => {
    const label = getCdnNodeLabel('https://upos-sz-mirrorcos.bilivideo.com/video.m4s');
    expect(label).toContain('腾讯云 COS');
    expect(label).toContain('upos-sz-mirrorcos.bilivideo.com');
  });

  it('should calculate priority scores respecting custom CDN order', () => {
    const defaultOrder = DEFAULT_CDN_ORDER;
    const cosScore = getCdnPriorityScore('https://upos-sz-mirrorcos.bilivideo.com/video.m4s', defaultOrder);
    const aliScore = getCdnPriorityScore('https://upos-sz-mirrorali.bilivideo.com/video.m4s', defaultOrder);
    expect(cosScore).toBeGreaterThan(aliScore);

    // If custom order places ali first:
    const customOrder = ['ali', 'cos', ...defaultOrder.filter((id) => id !== 'ali' && id !== 'cos')];
    const customCosScore = getCdnPriorityScore('https://upos-sz-mirrorcos.bilivideo.com/video.m4s', customOrder);
    const customAliScore = getCdnPriorityScore('https://upos-sz-mirrorali.bilivideo.com/video.m4s', customOrder);
    expect(customAliScore).toBeGreaterThan(customCosScore);
  });

  it('should sort URLs based on customized CDN priority order', () => {
    const urls = [
      'https://xy1.mcdn.bilivideo.cn:8082/video.m4s', // pcdn
      'https://upos-sz-mirrorali.bilivideo.com/video.m4s', // ali
      'https://upos-sz-mirrorcos.bilivideo.com/video.m4s', // cos
      'https://upos-sz-mirrorakamai.bilivideo.com/video.m4s', // oversea
    ];

    // Default: cos > ali > ... > pcdn / oversea
    const sortedDefault = sortCdnUrls(urls);
    expect(sortedDefault[0]).toContain('mirrorcos');
    expect(sortedDefault[1]).toContain('mirrorali');
    expect(sortedDefault[3]).toMatch(/mcdn|akamai/);

    // Custom: put ali at #1
    const customOrder = ['ali', 'cos', 'pcdn', 'oversea'];
    const sortedCustom = sortCdnUrls(urls, customOrder);
    expect(sortedCustom[0]).toContain('mirrorali');
    expect(sortedCustom[1]).toContain('mirrorcos');
  });

  it('should prioritize baseUrl and backupUrls cleanly', () => {
    const baseUrl = 'https://xy1.mcdn.bilivideo.cn:8082/video.m4s';
    const backupUrls = [
      'https://upos-sz-mirrorali.bilivideo.com/video.m4s',
      'https://upos-sz-mirrorcos.bilivideo.com/video.m4s',
    ];

    // With priority enabled (default)
    const prioritized = getPrioritizedCdnUrls(baseUrl, backupUrls, {
      enableCdnPriority: true,
      cdnPriorityOrder: DEFAULT_CDN_ORDER,
    });
    expect(prioritized[0]).toContain('mirrorcos');

    // With priority disabled: preserve initial order
    const unprioritized = getPrioritizedCdnUrls(baseUrl, backupUrls, {
      enableCdnPriority: false,
    });
    expect(unprioritized[0]).toBe(baseUrl);
  });

  it('should normalize invalid or incomplete custom CDN orders', () => {
    const incomplete = ['ali'];
    const normalized = normalizeCdnOrder(incomplete);
    expect(normalized[0]).toBe('ali');
    expect(normalized.length).toBe(DEFAULT_CDN_ORDER.length);
    expect(normalized).toContain('cos');
  });
});
