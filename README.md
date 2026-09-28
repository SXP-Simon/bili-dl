# 🎬 Bili-DL (Bilibili Modern Downloader)

现代化、全功能的 B 站资源下载器油猴脚本。采用 **React 19 + TypeScript 7 + Tailwind CSS v4 + Vite Monkey** 构建。

---

## ✨ 核心特性

- 🎥 **高清音画无损合成**：利用 `mp4box.js` 在浏览器纯前端直接将 4K/1080P 视频轨与音频轨无损封装为 `.mp4` 文件（无需安装第三方转码器，1~2 秒合成完毕）。
- 🎵 **独立纯音频提取**：支持一键提取 Hi-Res 无损 / 杜比全景声 / 320Kbps / 128Kbps 独立音频文件 (`.m4a` / `.flac`)。
- 🖼️ **超高清封面导出**：一键保存官方未压缩无水印原始封面大图。
- 💬 **全量弹幕转 ASS**：将 B 站 XML 弹幕直接转换为标准 `.ass` 字幕，支持本地播放器（PotPlayer / VLC）直接挂载并保留弹幕颜色与滚动轨迹。
- 📝 **官方双语字幕与 AI 总结**：支持导出官方 CC 字幕为 `.srt`，支持一键复制 B 站官方 AI 总结提炼笔记（Markdown 格式）。
- 📑 **多 P / 剧集批量选择**：自动识别分 P 列表，自由切换下载。
- ⚡ **Aria2 / curl 命令行导出**：大文件一键复制带 Referer 防盗链多线程下载命令。
- 🎨 **React Bits 质感动效**：支持 Spotlight 光斑卡片、平滑 Tab 分段器、Shimmer 流光进度条、Shadow DOM 样式隔离防污染。

---

## 🛠️ 技术栈

- **前端框架**：[React 19](https://react.dev/) + [TypeScript 7](https://www.typescriptlang.org/)
- **样式方案**：[Tailwind CSS v4](https://tailwindcss.com/)
- **构建工具**：[Vite](https://vitejs.dev/) + [`vite-plugin-monkey`](https://github.com/lisonge/vite-plugin-monkey)
- **多媒体处理**：[mp4box.js](https://github.com/gpac/mp4box.js/)
- **图标库**：[Lucide React](https://lucide.dev/)

---

## 🚀 开发与构建

### 1. 安装依赖
```bash
pnpm install
```

### 2. 本地开发（支持 HMR 热更新）
```bash
pnpm dev
```
运行后在浏览器中打开 Tampermonkey 提示的调试链接，即可在 B 站页面直接进行实时开发调试。

### 3. 构建发布
```bash
pnpm build
```
构建产物位于 `dist/bili-dl.user.js`，可直接分发或发布到 Greasy Fork。
