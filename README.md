# Bili-DL · 现代化 B 站全能媒体下载器

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-7.0+-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19.0+-61DAFB?style=flat-square&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0+-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?style=flat-square&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

<p align="center">
  <b>极简 · 清爽 · 高性能</b><br>
  基于 React 19 + TypeScript 7 + Tailwind CSS v4 构建的现代化 B 站资源下载油猴脚本。<br>
  支持 4K/1080P 前端无损秒级合成 MP4、独立音频提取、弹幕转 ASS、官方字幕转 SRT 及多 P 批量导出。
</p>

</div>

---

## 🌟 核心特性

- 🎬 **前端音画无损封装（Remux）**：引入 `mp4box.js` 纯前端重构 ISO-BMFF 容器，秒级将 4K / 1080P DASH 视频流与高品质音频流打包为开箱即播的标准 `.mp4` 文件，零转码耗时、不占 CPU。
- 🎵 **高品质独立音频提取**：一键导出 Hi-Res 无损音频、杜比全景声、320Kbps / 128Kbps 独立音轨（`.m4a` / `.flac`）。
- 🖼️ **超高清封面原图保存**：自动解析官方未压缩、无水印的超高清封面大图。
- 💬 **全量弹幕转标准 ASS**：解析 B 站 XML 弹幕并转换为带颜色、字号和滚动轨迹的标准 `.ass` 字幕文件，播放器挂载即看。
- 📝 **官方双语字幕与 AI 总结导出**：支持官方 CC 双语字幕一键转导出为 `.srt`，支持将 B 站官方 AI 视频提炼与章节大纲一键复制为结构化 Markdown 笔记。
- 📑 **多 P / 合集分集自由切换**：自动识别当前视频所属的多 P 列表或合集剧集，快速切换解析。
- ⚡ **Aria2 / curl 命令行导出**：大文件一键生成带 Referer 防盗链请求头的多线程下载与混流脚本。
- 🎨 **TweakCN 现代轻质感设计**：
  - 采用 OKLCH 清新淡青/薄荷绿调色板与温润米灰纸实质感。
  - 物理微质感与丝滑交互（Cubic-bezier Spring 阻尼反馈、光斑跟随、按压回弹）。
  - 全面支持深色/浅色模式无缝自适应与手动切换。
  - 基于 **Shadow DOM** 彻底隔离宿主样式，绝不污染 B 站原生界面。

---

## 📦 安装与使用

### 方式一：直接安装脚本（推荐）
1. 在浏览器安装 [Tampermonkey（篡改猴）](https://www.tampermonkey.net/) 或 [ScriptCat（脚本猫）](https://scriptcat.org/) 扩展；
2. 下载本仓库中的编译产物 [`dist/bili-dl.user.js`](./dist/bili-dl.user.js) 并粘贴导入到扩展中保存；
3. 打开任意 B 站视频播放页面（`https://www.bilibili.com/video/BV...`），即可在右侧看到悬浮下载胶囊，点击即可唤起面板。

### 方式二：本地开发模式（支持 HMR 热更新）
```bash
# 1. 克隆仓库
git clone https://github.com/SXP-Simon/bili-dl.git
cd bili-dl

# 2. 安装依赖
pnpm install

# 3. 启动开发服务器
pnpm dev
```
按照终端提示在 Tampermonkey 中添加一次调试脚本代理，之后每次保存代码，B 站页面都会**实时热更新**，开发体验极佳。

---

## 🛠️ 项目架构与技术栈

```text
bili-dl/
├── src/
│   ├── api/                     # 🌐 数据请求与 B 站接口解析
│   │   ├── http.ts              # 封装 GM_xmlhttpRequest，注入 Referer 防盗链头与流式进度
│   │   ├── bilibili.ts          # 解析 DASH 视频流、音频流、分P列表、字幕与 AI 总结
│   │   └── storage.ts           # 用户设置持久化 (GM_getValue / GM_setValue)
│   │
│   ├── media/                   # 🎬 多媒体处理与格式转换
│   │   ├── muxer.ts             # mp4box.js 纯前端音画无损混流为 .mp4
│   │   ├── danmaku.ts           # 弹幕 XML 转标准 .ass 字幕
│   │   ├── subtitle.ts          # 官方 JSON 双语字幕转 .srt
│   │   ├── aria2.ts             # Aria2 / curl 命令行生成器
│   │   └── downloader.ts        # 文件流式下载与保存调度
│   │
│   ├── components/              # 🎨 UI 表现与交互组件
│   │   ├── FloatButton.tsx      # 可拖拽悬浮唤起胶囊
│   │   ├── DownloadModal.tsx    # 主下载弹窗 (深浅色模式、卡片列表)
│   │   ├── SpotlightCard.tsx    # 丝滑光斑与物理微质感卡片
│   │   ├── TabPill.tsx          # 分段滑动控制器
│   │   ├── EpisodePicker.tsx    # 多 P 分集选择器
│   │   ├── ProgressBar.tsx      # 流光动态进度条
│   │   └── Toast.tsx            # 轻量消息气泡通知
│   │
│   ├── styles/                  # 💄 样式
│   │   └── main.css             # Tailwind CSS v4 与 OKLCH 主题定义
│   │
│   ├── App.tsx                  # 🧩 应用主状态容器与主题监听
│   └── main.tsx                 # 🚀 脚本主入口 (Shadow DOM 隔离挂载)
│
├── package.json
├── tsconfig.json
└── vite.config.ts               # Vite + vite-plugin-monkey 打包配置
```

---

## 🔨 开发与工程化

本项目采用现代化的前端代码检查与自动化 CI/CD 工具链：

- **Linter**：使用又新又快的 **OXC ([Oxlint](https://oxc.rs/docs/guide/usage/linter.html))** 进行毫秒级代码静态检查。
- **Git Hooks**：基于 **[Lefthook](https://github.com/evilmartians/lefthook)** 实现轻量极速的 pre-commit 钩子，提交前并行校验 Typecheck 与 Oxlint。
- **CI / CD**：GitHub Actions 在代码推送或 PR 时复用 Lefthook 执行代码质检；并在检测到版本号变更（`package.json` 更新或推送 `v*` tag）时自动构建并发布 GitHub Release 产物。

```bash
# 1. 运行 OXC 代码静态检查
pnpm lint

# 2. 运行 TypeScript 类型检查
pnpm typecheck

# 3. 本地手动复用 Lefthook 运行全部 CI 校验
pnpm check # 或 pnpm lefthook run ci

# 4. 生产打包
pnpm build
```

打包产物将输出在 `dist/bili-dl.user.js`（单文件包含所有依赖与样式，可独立分发与运行）。

---

## 📄 开源许可

本项目基于 [MIT License](./LICENSE) 开源。仅供技术交流与学习使用。

