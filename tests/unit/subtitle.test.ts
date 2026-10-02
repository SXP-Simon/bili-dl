import { describe, it, expect } from 'vitest';
import { formatSrtTime, convertSubtitleJsonToSrt } from '../../src/media/subtitle';

describe('subtitle utility', () => {
  it('should format seconds into SRT time format correctly', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000');
    expect(formatSrtTime(65.123)).toBe('00:01:05,123');
    expect(formatSrtTime(3661.05)).toBe('01:01:01,050');
  });

  it('should convert standard Bilibili JSON body format to SRT', () => {
    const rawJson = {
      body: [
        { from: 1.5, to: 3.2, content: '第一句弹幕字幕' },
        { from: 4.0, to: 5.5, content: '第二句弹幕字幕' },
      ],
    };

    const srt = convertSubtitleJsonToSrt(rawJson);
    expect(srt).toContain('1\n00:00:01,500 --> 00:00:03,200\n第一句弹幕字幕');
    expect(srt).toContain('2\n00:00:04,000 --> 00:00:05,500\n第二句弹幕字幕');
  });

  it('should handle raw array format and string timestamps', () => {
    const rawArray = [
      { from: '10.5', to: '12.0', text: '文本兼容字段' },
    ];

    const srt = convertSubtitleJsonToSrt(rawArray);
    expect(srt).toContain('1\n00:00:10,500 --> 00:00:12,000\n文本兼容字段');
  });

  it('should return empty string on invalid or empty input', () => {
    expect(convertSubtitleJsonToSrt(null)).toBe('');
    expect(convertSubtitleJsonToSrt({})).toBe('');
    expect(convertSubtitleJsonToSrt({ body: [] })).toBe('');
  });
});
