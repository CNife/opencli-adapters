# opencli-adapters — AI 助手指引

本文件面向协助此仓库开发的 AI 助手，说明适配器开发规范、项目约定和常见操作指引。

## 仓库定位

用户的自定义 OpenCLI 适配器源码仓库。通过 `scripts/sync.mjs` 部署到 `~/.opencli/`。

## 适配器开发规范

### 文件格式

- JavaScript ES Module（`.js`），`import` / `export` 语法
- 使用 `cli()` 函数注册命令，不 `export`

```js
import { cli, Strategy } from '@jackwener/opencli/registry';

cli({
  site: '<site>',
  name: '<command>',
  description: '...',
  access: 'read',          // read | write
  domain: 'example.com',
  strategy: Strategy.PUBLIC, // PUBLIC | COOKIE | UI
  browser: false,           // true 时函数签名为 (page, kwargs)
  args: [ /* ... */ ],
  columns: ['col1', 'col2'],
  func: async (kwargs) => {
    // 实现逻辑
  },
});
```

### 命令约定

| 字段 | 规则 |
|------|------|
| `name` | kebab-case |
| `access` | `read`（查询）或 `write`（状态变更） |
| `strategy` | `PUBLIC`（无认证）、`COOKIE`（需浏览器登录）、`UI`（DOM 交互） |
| 文件名 | 每个文件一个命令，文件名 = 命令名 |

### 开发原则

1. **能用 HTTP API 优先用 fetch** — `browser: false` 减少浏览器依赖。仅在目标需要渲染或反爬时才设 `browser: true`
2. **测试文件**放在命令同目录，命名为 `*.test.js`
3. **站点元数据**（如 endpoint 定义）放在 `sites/<site>/endpoints.json`

### 导入路径

```js
import { cli, Strategy } from '@jackwener/opencli/registry';
import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
```

### 常用适配器模式

**无浏览器（HTTP API）：**
```js
func: async (kwargs) => {
  const res = await fetch(`https://api.example.com/search?q=${kwargs.query}`);
  return await res.json();
}
```

**需浏览器：**
```js
browser: true,
func: async (page, kwargs) => {
  await page.goto('https://example.com');
  // 操作页面...
}
```

## 同步脚本

`scripts/sync.mjs`：
- `bun run sync` — dry-run 预览
- `bun run sync -- --apply` — 实际写入
- 差异检测基于 SHA-256 内容 hash
- 只做单向复制，不删除目标已有文件

## 常见 AI 协助场景

1. **新建适配器**：在 `clis/<site>/` 下创建命令文件，确保遵循上述规范，然后告知用户运行 `bun run sync -- --apply`
2. **修改适配器**：直接编辑对应命令文件，告知用户重新同步
3. **添加站点元数据**：在 `sites/<site>/` 下添加 `endpoints.json`
4. **排查问题**：先检查 `opencli list -f yaml` 确认同步状态，再检查命令文件本身
