import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Bilibili Downloader Userscript E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept navigation to bilibili video page and supply a mock HTML page
    await page.route('https://www.bilibili.com/video/BV1test411c7mD', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!DOCTYPE html>
<html>
  <head>
    <title>【测试视频】_哔哩哔哩_bilibili</title>
    <script>
      // Mock GM storage & APIs
      const storage = new Map();
      window.GM_getValue = (key, defaultVal) => storage.has(key) ? storage.get(key) : defaultVal;
      window.GM_setValue = (key, val) => storage.set(key, val);
      window.GM_setClipboard = (data) => {};
      window.GM_download = (opts) => {};
      window.GM_xmlhttpRequest = (opts) => {
        setTimeout(() => {
          if (opts.onload) {
            let data = {};
            const url = opts.url || '';
            if (url.includes('pagelist')) {
              data = [{ cid: 10001, page: 1, part: 'P1 测试' }];
            } else if (url.includes('playurl')) {
              data = {
                duration: 120,
                dash: {
                  duration: 120,
                  video: [
                    {
                      id: 80,
                      baseUrl: 'https://example.com/video_1080p.m4s',
                      bandwidth: 2000000,
                      codecid: 7,
                      codecs: 'avc1.640028',
                      width: 1920,
                      height: 1080,
                      frameRate: '30'
                    }
                  ],
                  audio: [
                    {
                      id: 30280,
                      baseUrl: 'https://example.com/audio.m4s',
                      bandwidth: 320000,
                      codecid: 0,
                      codecs: 'mp4a.40.2'
                    }
                  ]
                }
              };
            } else if (url.includes('player') || url.includes('/wbi/v2')) {
              data = {
                subtitle: {
                  subtitles: [
                    { id: 1, lan: 'zh-CN', lan_doc: '中文', subtitle_url: 'https://example.com/sub.json' }
                  ]
                }
              };
            }
            const mockRes = JSON.stringify({ code: 0, data });
            opts.onload({
              status: 200,
              statusText: 'OK',
              response: mockRes,
              responseText: mockRes,
              responseHeaders: ''
            });
          }
        }, 10);
        return { abort: () => {} };
      };

      // Mock Bilibili page state
      window.__INITIAL_STATE__ = {
        bvid: 'BV1test411c7mD',
        wbi_img: {
          img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084481368485c98b3459604e2418e.png',
          sub_url: 'https://i0.hdslb.com/bfs/wbi/402c4e33b54245c8af73821080d302a2.png'
        },
        videoData: {
          bvid: 'BV1test411c7mD',
          title: '测试视频标题',
          pic: 'https://i0.hdslb.com/bfs/archive/test.jpg',
          owner: { mid: 123456 },
          pages: [
            { cid: 10001, page: 1, part: 'P1 测试' }
          ]
        }
      };
      window.__playinfo__ = {
        data: {
          dash: {
            duration: 120,
            video: [
              {
                id: 80,
                baseUrl: 'https://example.com/video_1080p.m4s',
                bandwidth: 2000000,
                codecid: 7,
                codecs: 'avc1.640028',
                width: 1920,
                height: 1080,
                frameRate: '30'
              }
            ],
            audio: [
              {
                id: 30280,
                baseUrl: 'https://example.com/audio.m4s',
                bandwidth: 320000,
                codecid: 0,
                codecs: 'mp4a.40.2'
              }
            ]
          }
        }
      };
    </script>
  </head>
  <body>
    <div id="app">Mock Bilibili Player Page</div>
  </body>
</html>`,
      });
    });

    await page.goto('https://www.bilibili.com/video/BV1test411c7mD');

    // Inject the built userscript
    const scriptPath = path.resolve(process.cwd(), 'dist/bili-dl.user.js');
    await page.addScriptTag({ path: scriptPath });
  });

  test('should mount shadow DOM and display the floating download button', async ({ page }) => {
    // Check root host container exists
    const host = page.locator('#bili-dl-root');
    await expect(host).toBeAttached();

    // Check floating action button inside shadow DOM is visible
    const floatBtn = page.getByText('Bili-DL 下载');
    await expect(floatBtn).toBeVisible();
  });

  test('should open download modal when clicking the floating button', async ({ page }) => {
    const floatBtn = page.getByText('Bili-DL 下载');
    await floatBtn.click();

    // Verify modal header is visible with title "bili-dl"
    await expect(page.getByRole('heading', { name: 'bili-dl' })).toBeVisible();

    // Verify default tabs exist
    await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^视频/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^音频/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '封面' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^弹幕\/字幕/ })).toBeVisible();

    // Verify dual video buttons (有声 MP4 priority button and 仅画面 button)
    await expect(page.getByRole('button', { name: '有声 MP4' })).toBeVisible();
    await expect(page.getByRole('button', { name: '仅画面' })).toBeVisible();
    await expect(page.getByRole('button', { name: '命令' })).toBeVisible();
  });

  test('should switch tabs properly inside the modal', async ({ page }) => {
    const floatBtn = page.getByText('Bili-DL 下载');
    await floatBtn.click();

    await expect(page.getByRole('heading', { name: 'bili-dl' })).toBeVisible();

    // Switch to Cover tab
    const coverTab = page.getByRole('button', { name: '封面' });
    await coverTab.click();
    await expect(page.getByRole('button', { name: '保存原图' })).toBeVisible();

    // Switch to Audio tab
    const audioTab = page.getByRole('button', { name: /^音频/ });
    await audioTab.click();
    await expect(page.getByRole('button', { name: '下载音频' })).toBeVisible();
  });

  test('should open and close the settings drawer', async ({ page }) => {
    const floatBtn = page.getByText('Bili-DL 下载');
    await floatBtn.click();

    await expect(page.getByRole('heading', { name: 'bili-dl' })).toBeVisible();

    // Click settings button (has title "偏好设置")
    const settingsBtn = page.locator('button[title="偏好设置"]');
    await settingsBtn.click();

    // Verify settings drawer is visible
    await expect(page.getByText('下载落盘路径与偏好设置')).toBeVisible();

    // Close settings via the close button
    const closeSettingsBtn = page.locator('button[title="关闭设置"]');
    await closeSettingsBtn.click();
    await expect(page.getByText('下载落盘路径与偏好设置')).not.toBeVisible();
  });

  test('should open diagnostic logs and toggle maximize mode', async ({ page }) => {
    const floatBtn = page.getByText('Bili-DL 下载');
    await floatBtn.click();

    await expect(page.getByRole('heading', { name: 'bili-dl' })).toBeVisible();

    // Click logs button
    const logsBtn = page.locator('button[title*="日志"]');
    await logsBtn.click();

    // Verify diagnostic logs console is visible
    await expect(page.getByText('诊断日志')).toBeVisible();

    // Click maximize
    const maxBtn = page.locator('button[title="全屏展开日志"]');
    await maxBtn.click();

    // Click restore
    const restoreBtn = page.locator('button[title="还原底栏模式"]');
    await restoreBtn.click();

    // Close logs console
    const closeLogsBtn = page.locator('button[title="关闭日志控制台"]');
    await closeLogsBtn.click();
    await expect(page.getByText('诊断日志')).not.toBeVisible();
  });

  test('should close modal when clicking the close button', async ({ page }) => {
    const floatBtn = page.getByText('Bili-DL 下载');
    await floatBtn.click();

    await expect(page.getByRole('heading', { name: 'bili-dl' })).toBeVisible();

    const closeModalBtn = page.locator('button[title="关闭 (Esc)"]');
    await closeModalBtn.click();

    await expect(page.getByRole('heading', { name: 'bili-dl' })).not.toBeVisible();
  });

  test('should open quick action menu on right click and close on Escape', async ({ page }) => {
    const floatBtn = page.getByText('Bili-DL 下载');
    await floatBtn.click({ button: 'right' });

    // Verify quick action menu items appear
    await expect(page.getByText('一键下载全部最高质量视频')).toBeVisible();
    await expect(page.getByText('一键下载全部最低质量音频')).toBeVisible();
    await expect(page.getByText('一键下载全部字幕')).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');
    await expect(page.getByText('一键下载全部最高质量视频')).not.toBeVisible();
  });
});

