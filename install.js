#!/usr/bin/env node

/**
 * bmad-sprint-dashboard Skill 安装脚本
 * 
 * 将 Skill 安装到 CodeBuddy 用户全局目录 (~/.codebuddy/skills/)
 * 安装一次，所有 BMAD-METHOD 项目通用。
 * 
 * 用法:
 *   npx github:lpt9/engineering          # 直接安装
 *   node install.js                       # 本地运行
 *   node install.js --uninstall           # 卸载
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILL_NAME = 'bmad-sprint-dashboard';
const SKILL_SRC = path.join(__dirname, SKILL_NAME);
const SKILL_DEST = path.join(os.homedir(), '.codebuddy', 'skills', SKILL_NAME);

// ── 颜色输出 ──────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(...args) { console.log(...args); }

// ── 递归复制目录 ──────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// ── 递归删除目录 ──────────────────────────────────
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── Main ──────────────────────────────────────────
const isUninstall = process.argv.includes('--uninstall') || process.argv.includes('-u');

if (isUninstall) {
  // 卸载
  log(`\n${c.bold}🗑  卸载 ${SKILL_NAME}...${c.reset}\n`);
  if (fs.existsSync(SKILL_DEST)) {
    removeDir(SKILL_DEST);
    log(`  ${c.green}✓${c.reset} 已移除: ${SKILL_DEST}`);
    log(`\n${c.green}${c.bold}✅ 卸载完成!${c.reset}\n`);
  } else {
    log(`  ${c.yellow}⚠${c.reset}  Skill 未安装: ${SKILL_DEST}`);
  }
  process.exit(0);
}

// 安装
log(`\n${c.bold}📦 安装 ${SKILL_NAME} v${require('./package.json').version}${c.reset}`);
log(`\n  来源: ${SKILL_SRC}`);
log(`  目标: ${SKILL_DEST}\n`);

// 检查源文件
if (!fs.existsSync(path.join(SKILL_SRC, 'SKILL.md'))) {
  log(`${c.red}✗ 错误: 未找到 SKILL.md，安装包可能不完整${c.reset}`);
  process.exit(1);
}

// 备份旧版本
if (fs.existsSync(SKILL_DEST)) {
  const backup = SKILL_DEST + '.bak';
  log(`  ${c.yellow}⚠${c.reset}  检测到已安装版本，备份到 .bak`);
  removeDir(backup);
  fs.renameSync(SKILL_DEST, backup);
}

// 复制
try {
  copyDir(SKILL_SRC, SKILL_DEST);
} catch (err) {
  log(`${c.red}✗ 安装失败: ${err.message}${c.reset}`);
  process.exit(1);
}

// 验证
const files = ['SKILL.md', 'scripts/generate_dashboard.js', 'references/data-schema.md'];
let allOk = true;
for (const f of files) {
  const fp = path.join(SKILL_DEST, f);
  if (fs.existsSync(fp)) {
    log(`  ${c.green}✓${c.reset} ${f}`);
  } else {
    log(`  ${c.red}✗${c.reset} 缺失: ${f}`);
    allOk = false;
  }
}

if (allOk) {
  log(`\n${c.green}${c.bold}✅ 安装成功!${c.reset}`);
  log(`\n${c.cyan}使用方式:${c.reset}`);
  log(`  在任意 BMAD-METHOD 项目中对 CodeBuddy 说: ${c.bold}"刷新仪表盘"${c.reset}`);
  log(`  或手动运行: ${c.bold}node ~/.codebuddy/skills/${SKILL_NAME}/scripts/generate_dashboard.js${c.reset}`);
  log(`\n${c.cyan}卸载:${c.reset} npx github:lpt9/engineering --uninstall\n`);
} else {
  log(`\n${c.red}安装不完整，请检查${c.reset}`);
  process.exit(1);
}
