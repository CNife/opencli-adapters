# opencli-adapters

CNife 的自定义 OpenCLI 适配器集。

## 快速开始

```bash
# 克隆后首次使用
bun install

# 预览待同步的适配器
bun run sync

# 确认后实际同步到 ~/.opencli/
bun run sync -- --apply
```

## 添加新适配器

在 `clis/` 下以站点名为目录，每个命令一个文件：

```
clis/<site>/<command>.js
```

步骤：

1. 创建命令文件
2. `git add` 纳入跟踪
3. `bun run sync` 预览 → `bun run sync -- --apply` 同步
4. `opencli <site> <command>` 验证

> 如需浏览器自动化，命令函数的签名为 `async (page, kwargs)`，否则为 `async (kwargs)`。

## 目录结构

```
opencli-adapters/
├── clis/<site>/<command>.js    # 适配器命令文件
├── sites/<site>/endpoints.json # 站点元数据（可选）
├── scripts/sync.mjs            # 同步脚本
└── package.json
```

## 同步说明

`scripts/sync.mjs` 将 git 跟踪的 `clis/` 和 `sites/` 文件同步到 `~/.opencli/`：

- **默认 dry-run**，预览变更不实际写入
- **`--apply`** 才真正执行
- 基于内容 hash 检测差异，不变不重复写
- 不做双向同步，不删除目标中已有文件

## 环境要求

- Node.js >= 20
- [OpenCLI](https://github.com/jackwener/opencli)（已安装）
