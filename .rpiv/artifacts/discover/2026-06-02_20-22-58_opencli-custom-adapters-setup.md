---
date: 2026-06-02T20:22:58+0800
author: CNife
commit: no-commit
branch: main
repository: opencli-adapters
topic: "OpenCLI Custom Adapters Setup"
tags: [intent, frd, opencli, adapter, nodejs]
status: complete
last_updated: 2026-06-02T20:22:58+0800
last_updated_by: CNife
---

# FRD: OpenCLI Custom Adapters Setup

## Summary
将自定义 OpenCLI 适配器纳入 Git 仓库管理（当前仓库 opencli-adapters），通过一个同步脚本差异部署到 `~/.opencli/`。项目根目录采用与 `~/.opencli` 一致的扁平结构（`clis/<site>/` + `sites/<site>/`），使用 bun 管理依赖，初始化时生成 README.md（中文）、AGENTS.md（中文）、LICENSE（MIT）。

## Problem & Intent
> "我想在当前git仓库放我自定义的OpenCLI Adapter，用一个脚本同步安装到 ~/.opencli 下。个人使用，逐步增多。"

开发者目前有 5 个自定义站点（dlsite、doubao、grok、jina、tavily），适配器已直接存在于 `~/.opencli/clis/` 中。随着适配器数量增加，需要：
1. 一个规范的开发环境（Node.js 项目结构、依赖管理）
2. 一个可靠的同步脚本，替代手动复制
3. 标准的 GitHub 仓库文件，便于版本管理和潜在的分享

## Goals
- 搭建 Node.js 项目骨架（package.json、目录结构）用于适配器开发
- 编写差异同步脚本，将仓库中 git 跟踪的适配器文件同步到 `~/.opencli/`
- 初始化 GitHub 仓库基础文件（README.md、AGENTS.md、LICENSE）

## Non-Goals
- 不涉及 CI/CD 或自动化测试
- 不需要 git hooks 或 watch 模式的自动同步
- 不需要反向导入脚本（用户手动将现有适配器放入仓库）
- 不需要发布到 npm 或 OpenCLI 插件市场
- 不迁移现有适配器到 TypeScript

## Functional Requirements
1. **项目初始化**：仓库根目录应提供 `package.json`，使用 bun 管理，定义 `sync` script 命令
2. **目录结构**：仓库根目录下 `clis/<site>/` 放置 JS 适配器文件，`sites/<site>/` 放置站点端元数据（如 `endpoints.json`）
3. **同步脚本**：运行 `bun run sync`（或等价的 `npm run sync`）时，将仓库中 `clis/` 和 `sites/` 下 git 跟踪的文件同步到 `~/.opencli/clis/` 和 `~/.opencli/sites/`
4. **差异同步**：只复制有变更的文件（基于文件修改时间或内容比较），避免不必要的 I/O
5. **覆盖策略**：自定义适配器优先于官方同名适配器（同步时直接写入 `~/.opencli/clis/<site>/`）
6. **仓库文件**：在根目录生成 README.md（中文）、AGENTS.md（中文）、LICENSE（MIT）

## Non-Functional Requirements
- **Performance**: 同步脚本应在秒级完成（适配器数量 < 50 时）
- **Reliability**: 同步脚本应正确处理目录创建、文件删除场景；如果 `~/.opencli` 不存在应提示
- **UX**: 同步脚本应输出清晰的进度（哪些文件被复制/跳过/删除）

## Constraints & Assumptions
- **运行时**：开发者使用 bun，兼容 Node.js >=20（与 OpenCLI 上游一致）
- **适配器格式**：JavaScript ES Module，使用 `import { cli, Strategy } from '@jackwener/opencli/registry'`
- **上游源码**：`OpenCLI/` 子目录是上游 subtree，已在 `.gitignore` 中排除
- **OpenCLI 版本**：上游 @jackwener/opencli v1.8.1
- **假设**：`~/.opencli/clis/` 和 `~/.opencli/sites/` 始终存在（若不存在则脚本创建）

## Acceptance Criteria
- [ ] 运行 `bun run sync` 后，`clis/tavily/billing.js` 出现在 `~/.opencli/clis/tavily/billing.js` 中
- [ ] 运行 `opencli list -f yaml` 能列出同步后的自定义适配器
- [ ] `opencli tavily billing` 能正常执行（tavily API 可达时）
- [ ] 仓库根目录存在 README.md、AGENTS.md、LICENSE 三个文件
- [ ] 仓库根目录存在 `package.json`，包含 `sync` script 定义

## Recommended Approach
在仓库根目录创建 package.json（bun 管理），采用扁平目录（`clis/` + `sites/`）。编写一个 Node.js 同步脚本 `scripts/sync.mjs`，读取仓库中 git 跟踪的 `clis/` 和 `sites/` 下的文件，按差异同步策略复制到 `~/.opencli/` 对应目录。同步时先扫描源和目标的文件列表，基于 mtime 或内容 hash 决定需要复制的文件，并清理目标中已不存在的文件。

## Decisions

### 适配器格式
**Question**: 保持 JavaScript 还是迁移到 TypeScript？
**Recommended**: 保持 JavaScript ES Module
**Chosen**: JavaScript
**Rationale**: 当前所有适配器均为 .js 文件，无需额外编译步骤，开发迭代最快

### 管理方式
**Question**: 源码在仓库同步到 ~/.opencli，还是直接在 ~/.opencli 下工作？
**Recommended**: 源码在仓库，同步到 ~/.opencli
**Chosen**: 源码在仓库，同步到 ~/.opencli
**Rationale**: 版本管理和逐步增多的适配器需要 Git 跟踪

### 目录结构
**Question**: 扁平站点目录、src 源码目录还是 packages 多包结构？
**Recommended**: 扁平站点目录
**Chosen**: 扁平站点目录（clis/<site>/ + sites/<site>/）
**Rationale**: 与 ~/.opencli 结构一致，无额外抽象，适配器数量不多时最简单

### 同步策略
**Question**: 全量覆盖、差异同步还是双向同步？
**Recommended**: 全量覆盖
**Chosen**: 差异同步
**Rationale**: 开发者明确选择差异同步，减少不必要的 I/O

### 冲突策略
**Question**: 覆盖官方适配器还是使用不同站点名？
**Recommended**: 覆盖官方适配器
**Chosen**: 覆盖官方适配器
**Rationale**: 自定义适配器是用户要用的版本，写入 ~/.opencli/clis/ 即覆盖官方

### 已有适配器处理
**Question**: 需要反向导入脚本还是手动搬运？
**Recommended**: 反向导入脚本
**Chosen**: 手动搬运（不需要反向导入脚本）
**Rationale**: 开发者选择手动将 ~/.opencli 中的现有适配器放入仓库

### 运行方式
**Question**: 仅手动、git hooks 还是 watch 模式？
**Recommended**: 仅手动运行
**Chosen**: 仅手动运行（`bun run sync`）
**Rationale**: 适配器开发不是高频变更，手动触发足够

### 同步范围识别
**Question**: 白名单、git 跟踪文件还是排除官方？
**Recommended**: 按目录列表（白名单）
**Chosen**: 按 git 跟踪的文件同步
**Rationale**: 开发者希望 git 跟踪自然定义同步范围

### 包管理器
**Question**: pnpm、npm 还是 bun？
**Recommended**: pnpm
**Chosen**: bun
**Rationale**: 开发者选择 bun

### GitHub 仓库文件
**Question**: 需要哪些文件？
**Recommended**: 标准化全套（中英文 README + AGENTS.md + LICENSE + CONTRIBUTING.md）
**Chosen**: README.md（中文）、AGENTS.md（中文）、LICENSE（MIT）
**Rationale**: 开发者明确指定内容，无需英文版和贡献指南

### 验收标准
**Question**: 哪些标志项目完成？
**Recommended**: 仓库初始化 + 同步脚本两者
**Chosen**: 仓库初始化 + 同步脚本
**Rationale**: 基础和工具同等重要

## Open Questions
无 — 所有问题已在采访中得到明确决策。

## Suggested Follow-ups
（本节留空 — 采访中未发现超出范围但值得关注的发现。）

## References
- 上游 OpenCLI 源码: `/OpenCLI/`（subtree，已 `.gitignore`）
- 现有自定义适配器: `~/.opencli/clis/` （dlsite, doubao, grok, jina, tavily）
- 现有自定义站点元数据: `~/.opencli/sites/dlsite/endpoints.json`
