import { describe, it, expect } from 'vitest';
import { convertDanmakuXmlToAss } from '../../src/media/danmaku';

describe('danmaku converter', () => {
  it('should parse Bilibili danmaku XML and generate valid ASS structure', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<i>
  <chatserver>chat.bilibili.com</chatserver>
  <chatid>123456</chatid>
  <d p="2.50000,1,25,16777215,1600000000,0,user1,1234">第一条弹幕内容</d>
  <d p="10.25000,1,25,16711680,1600000001,0,user2,1235">红色弹幕测试</d>
</i>`;

    const ass = convertDanmakuXmlToAss(xml, '测试视频标题');
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('Title: 测试视频标题 - 弹幕');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('[Events]');
    expect(ass).toContain('Dialogue: 0,0:00:02.50,0:00:10.50,Danmaku,,0,0,0,,{\\c&Hffffff&}第一条弹幕内容');
    expect(ass).toContain('Dialogue: 0,0:00:10.25,0:00:18.25,Danmaku,,0,0,0,,{\\c&H0000ff&}红色弹幕测试');
  });

  it('should handle XML with no danmaku comments gracefully', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><i><chatid>1</chatid></i>`;
    const ass = convertDanmakuXmlToAss(xml, '空弹幕视频');
    expect(ass).toContain('[Script Info]');
    expect(ass).not.toContain('Dialogue:');
  });
});
