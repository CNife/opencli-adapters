#!/usr/bin/env node

/**
 * sync.mjs — 将仓库中的自定义 OpenCLI 适配器同步到 ~/.opencli/
 *
 * 功能：
 *   - 读取 git 跟踪的 clis/ 和 sites/ 下的文件
 *   - 差异同步（基于内容 hash）到 ~/.opencli/
 *   - 输出操作报告
 *
 * ⚠ 默认 dry-run 模式，只显示变更不实际执行。
 *   加上 --apply 才真正写入 ~/.opencli/。
 *   脚本只做单向复制，不会删除目标中已有的文件。
 *
 * 用法：
 *   node scripts/sync.mjs          # dry-run，预览变更
 *   node scripts/sync.mjs --apply  # 实际同步
 *   bun run sync                   # dry-run
 *   bun run sync -- --apply        # 实际同步
 */

import { existsSync, statSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const HOME = process.env.HOME || process.env.USERPROFILE;
const OPENCLI_DIR = resolve(HOME, '.opencli');
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

// 要同步的顶层目录
const SRC_DIRS = ['clis', 'sites'];

function getTrackedFiles(prefix) {
  try {
    const out = execSync(`git ls-files "${prefix}/"`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function fileHash(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function fileChanged(src, dest) {
  if (!existsSync(dest)) return true;
  try {
    const sSrc = statSync(src);
    const sDest = statSync(dest);
    if (sSrc.size !== sDest.size) return true;
    return fileHash(src) !== fileHash(dest);
  } catch {
    return true;
  }
}

function copyWithDir(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

const DRY_RUN = !process.argv.includes('--apply');

function run() {
  console.log('');
  console.log('  OpenCLI 适配器同步');
  console.log(`  仓库: ${REPO_ROOT}`);
  console.log(`  目标: ${OPENCLI_DIR}`);
  console.log(`  模式: ${DRY_RUN ? '🔍 dry-run (加 --apply 才写入)' : '✏️ apply'}`);
  console.log('');

  let totalCopied = 0;
  let totalUpToDate = 0;

  for (const dir of SRC_DIRS) {
    const tracked = getTrackedFiles(dir);
    if (tracked.length === 0) {
      console.log(`  ${dir}/  — 没有 git 跟踪的文件，跳过`);
      console.log('');
      continue;
    }

    console.log(`  [${dir}/]`);

    for (const relPath of tracked) {
      const src = resolve(REPO_ROOT, relPath);
      const dest = resolve(OPENCLI_DIR, relPath);

      if (!existsSync(src)) {
        console.log(`    ⚠   ${relPath}  (源文件不存在，跳过)`);
        continue;
      }

      if (fileChanged(src, dest)) {
        const icon = DRY_RUN ? '🔍' : '✓';
        console.log(`    ${icon}   ${relPath}`);
        if (!DRY_RUN) {
          copyWithDir(src, dest);
        }
        totalCopied++;
      } else {
        console.log(`    -   ${relPath}  (已是最新)`);
        totalUpToDate++;
      }
    }

    console.log('');
  }

  console.log(`  ─── 完成 ───`);
  if (DRY_RUN && totalCopied > 0) {
    console.log(`  待同步: ${totalCopied}  已最新: ${totalUpToDate}`);
    console.log(`  运行 "bun run sync -- --apply" 以写入变更`);
  } else {
    console.log(`  复制: ${totalCopied}  已最新: ${totalUpToDate}`);
  }
  console.log('');
}

try {
  run();
} catch (err) {
  console.error('\n  同步失败:', err.message);
  process.exit(1);
}
