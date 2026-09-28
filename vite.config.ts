import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    monkey({
      entry: 'src/main.tsx',
      userscript: {
        name: 'Bilibili Modern Downloader',
        namespace: 'https://github.com/bilibili-downloader',
        version: '1.0.0',
        description: '现代化 B 站资源下载器：支持 4K/1080P 音画无损合成 MP4、纯音频/封面提取、弹幕转 ASS、多 P 批量导出',
        author: 'Simon',
        match: [
          'https://www.bilibili.com/video/*',
          'https://www.bilibili.com/bangumi/play/*',
          'https://www.bilibili.com/medialist/play/*'
        ],
        icon: 'https://www.bilibili.com/favicon.ico',
        grant: [
          'GM_download',
          'GM_xmlhttpRequest',
          'GM_setValue',
          'GM_getValue',
          'GM_setClipboard'
        ],
        connect: [
          'api.bilibili.com',
          '*.bilivideo.com',
          '*.hdslb.com',
          '*.akamaized.net'
        ]
      },
      build: {
        externalGlobals: {}
      }
    }),
  ],
});
