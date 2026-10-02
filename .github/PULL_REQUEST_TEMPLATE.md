## 变更概述 (Summary)

<!-- 简要说明此 PR 解决的问题或新增的特性 -->

## 关联 Issue (Related Issues)

<!-- 例如 Fixes #123, Closes #456 -->
Fixes #

## 变更类型 (Type of Change)

- [ ] 🐛 Bug 修复 (Bug Fix)
- [ ] ✨ 新特性 (New Feature)
- [ ] 💄 UI / 交互微调 (UI / UX Enhancement)
- [ ] ⚡ 性能优化 (Performance Optimization)
- [ ] ♻️ 代码重构与类型增强 (Refactoring / Type Strictness)
- [ ] 📝 文档更新 (Documentation)
- [ ] 🧪 单元/集成/E2E 测试补充 (Testing)

## 详细改动 (Detailed Changes)

<!-- 列出具体的修改点与设计考量 -->
- 

## 自检清单 (Checklist)

- [ ] 严格遵循 TypeScript 强类型规范，**严禁引入任何 `any` 类型**（使用 `unknown` + 类型守卫或 `zod` 校验）。
- [ ] 本地执行 `pnpm lint`（Oxlint）通过，0 警告 0 报错。
- [ ] 本地执行 `pnpm typecheck`（TypeScript strict 模式）通过，0 错误。
- [ ] 本地执行 `pnpm test`（Vitest 单元与集成测试）全部通过。
- [ ] 本地执行 `pnpm test:e2e`（Playwright 端到端测试）全部通过。
- [ ] 本地执行 `pnpm build` 顺利产出 `dist/bili-dl.user.js`。
- [ ] 在真实浏览器油猴环境中完成基本功能人工冒烟测试。
