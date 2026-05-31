#!/usr/bin/env node

/**
 * bmad-sprint-dashboard — Skill 安装 & 项目初始化脚本
 *
 * 三种模式:
 *   npx github:lpt9/engineering                    → 仅安装 Skill 到全局
 *   npx github:lpt9/engineering --init             → 完整初始化: BMAD-METHOD + Skill + 生成仪表盘
 *   npx github:lpt9/engineering --uninstall        → 卸载 Skill
 *
 * --init 流程:
 *   ① 安装 BMAD-METHOD (npx bmad-method install)
 *   ② 安装 sprint-dashboard Skill 到 ~/.codebuddy/skills/
 *   ③ 拷贝生成脚本到项目 _bmad/scripts/
 *   ④ 自动生成首版 sprint-dashboard.html
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const SKILL_NAME = 'bmad-sprint-dashboard';
const SKILL_SRC = path.join(__dirname, SKILL_NAME);
const SKILL_DEST = path.join(os.homedir(), '.codebuddy', 'skills', SKILL_NAME);
const PKG_VERSION = require('./package.json').version;

// ── 颜色 ──────────────────────────────────────
const C = {
  R: '\x1b[0m',      B: '\x1b[1m',
  G: '\x1b[32m',     Y: '\x1b[33m',
  r: '\x1b[31m',     C: '\x1b[36m',
  D: '\x1b[2m',
};

const I = { G:'✅', Y:'⚠', R:'❌', B:'📦', S:'🚀', D:'📋', H:'🏠' };

function log(...a) { console.log(...a); }
function sep() { log(`${C.D}───────────────────────────────────────────────${C.R}`); }
function step(n, title) { log(`\n${C.B}[${n}/4]${C.R} ${title}`); }

// ── 工具函数 ─────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
function removeDir(dir) { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }

/** 从当前目录向上查找包含 _bmad/config.toml 的项目根 */
function findBmadRoot() {
  let dir = process.cwd(), root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '_bmad', 'config.toml'))) return dir;
    const p = path.dirname(dir); if (p === dir) break; dir = p;
  }
  return null;
}

/** 执行命令并实时输出（交互式场景用 spawnSync） */
function run(cmd, args, opts = {}) {
  log(`  ${C.D}$ ${cmd} ${args.join(' ')}${C.R}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if (r.error || r.status !== 0) {
    log(`  ${C.r}✗${C.R} 命令失败 (exit ${r.status || r.error?.message})`);
    return false;
  }
  return true;
}

// ── 卸载 ─────────────────────────────────────
function doUninstall() {
  log(`\n${C.B}🗑  卸载 ${SKILL_NAME}...${C.R}\n`);
  if (fs.existsSync(SKILL_DEST)) {
    removeDir(SKILL_DEST);
    log(`  ${C.G}✓${C.R} 已移除: ${SKILL_DEST}`);
    log(`\n${C.G}${C.B}✅ 卸载完成!${C.R}\n`);
  } else {
    log(`  ${C.Y}⚠${C.R}  Skill 未安装`);
  }
}

// ── 仅安装 Skill ─────────────────────────────
function doInstallSkill() {
  log(`\n${C.B}📦 安装 ${SKILL_NAME} v${PKG_VERSION}${C.R}`);
  log(`  目标: ${SKILL_DEST}\n`);

  if (!fs.existsSync(path.join(SKILL_SRC, 'SKILL.md'))) {
    log(`${C.r}✗ 安装包不完整 — 未找到 SKILL.md${C.R}`);
    return false;
  }
  if (fs.existsSync(SKILL_DEST)) {
    removeDir(SKILL_DEST + '.bak');
    fs.renameSync(SKILL_DEST, SKILL_DEST + '.bak');
    log(`  ${C.Y}⚠${C.R}  已备份旧版本`);
  }
  copyDir(SKILL_SRC, SKILL_DEST);

  const files = ['SKILL.md', 'scripts/generate_dashboard.js', 'references/data-schema.md'];
  let ok = true;
  for (const f of files) {
    if (fs.existsSync(path.join(SKILL_DEST, f))) {
      log(`  ${C.G}✓${C.R} ${f}`);
    } else {
      log(`  ${C.r}✗${C.R} 缺失: ${f}`); ok = false;
    }
  }
  return ok;
}

// ── 完整初始化 ───────────────────────────────
async function doInit() {
  const cwd = process.cwd();
  log(`\n${C.B}${I.S}  BMAD Sprint Dashboard — 项目初始化${C.R}`);
  log(`  工作目录: ${cwd}`);
  sep();

  // ── ① 安装 BMAD-METHOD ──────────────────────
  step(1, '安装 BMAD-METHOD');
  const bmadRoot = findBmadRoot();
  if (bmadRoot) {
    log(`  ${C.G}✓${C.R} BMAD-METHOD 已安装: ${bmadRoot}`);
  } else {
    log(`  ${C.Y}⚠${C.R} 未检测到 BMAD-METHOD，开始安装...\n`);
    const ok = run('npx', ['bmad-method', 'install'], { cwd });
    if (!ok) {
      log(`\n${C.r}✗ BMAD-METHOD 安装失败，请手动执行: npx bmad-method install${C.R}`);
      process.exit(1);
    }
  }

  // ── ② 安装 Skill 到全局 ─────────────────────
  step(2, `安装 ${SKILL_NAME} Skill 到全局`);
  const skillOk = doInstallSkill();
  if (!skillOk) {
    log(`\n${C.r}✗ Skill 安装失败${C.R}`);
    process.exit(1);
  }

  // ── ③ 拷贝生成脚本到项目 ────────────────────
  step(3, '部署生成脚本到项目');
  const root = findBmadRoot() || cwd;
  const projectScriptDir = path.join(root, '_bmad', 'scripts');
  const projectScript = path.join(projectScriptDir, 'generate_sprint_dashboard.js');

  if (!fs.existsSync(projectScriptDir)) {
    fs.mkdirSync(projectScriptDir, { recursive: true });
  }

  const srcScript = path.join(SKILL_DEST, 'scripts', 'generate_dashboard.js');
  if (fs.existsSync(srcScript)) {
    fs.copyFileSync(srcScript, projectScript);
    log(`  ${C.G}✓${C.R} 已复制到: ${projectScript}`);
  } else {
    log(`  ${C.Y}⚠${C.R} 源脚本未找到，跳过`);
  }

  // ── ④ 生成首版仪表盘 ────────────────────────
  step(4, '生成 Sprint 进度仪表盘');
  if (fs.existsSync(projectScript)) {
    const ok = run('node', [projectScript], { cwd: root });
    if (ok) {
      const htmlPath = path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-dashboard.html');
      if (fs.existsSync(htmlPath)) {
        const size = (fs.statSync(htmlPath).size / 1024).toFixed(1);
        log(`  ${C.G}✓${C.R} 仪表盘已生成 (${size} KB)`);
      }
    }
  } else {
    log(`  ${C.Y}⚠${C.R} 跳过 — 项目尚未配置 BMAD 输出文档`);
    log(`  ${C.D}  完成 Epic/Story 规划后运行: node _bmad/scripts/generate_sprint_dashboard.js${C.R}`);
  }

  // ── 完成 ──────────────────────────────────
  sep();
  log(`\n${C.G}${C.B}🎉 初始化完成!${C.R}\n`);
  log(`${C.C}后续使用:${C.R}`);
  log(`  对 CodeBuddy 说: ${C.B}刷新仪表盘${C.R}  或`);
  log(`  手动运行: ${C.B}node _bmad/scripts/generate_sprint_dashboard.js${C.R}`);
  log(`\n${C.C}查看仪表盘:${C.R}`);
  log(`  打开: ${C.B}_bmad-output/implementation-artifacts/sprint-dashboard.html${C.R}`);
  log(`\n${C.C}卸载 Skill:${C.R} npx github:lpt9/engineering --uninstall\n`);
}

// ── Main ──────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--uninstall') || args.includes('-u')) {
    doUninstall();
    return;
  }

  if (args.includes('--init') || args.includes('-i')) {
    await doInit();
    return;
  }

  // 默认: 仅安装 Skill 到全局
  log(`\n${C.B}${I.B}  ${SKILL_NAME} v${PKG_VERSION} — 仅安装 Skill${C.R}\n`);
  log(`  ${C.D}提示: 使用 ${C.B}--init${C.R}${C.D} 参数可一键初始化整个项目${C.R}`);
  const ok = doInstallSkill();
  if (ok) {
    log(`\n${C.G}${C.B}✅ Skill 安装成功!${C.R}`);
    log(`\n${C.C}使用方式:${C.R}`);
    log(`  在任意 BMAD-METHOD 项目中对 CodeBuddy 说: ${C.B}"刷新仪表盘"${C.R}`);
    log(`  或手动: ${C.B}node ~/.codebuddy/skills/${SKILL_NAME}/scripts/generate_dashboard.js${C.R}`);
    log(`\n${C.C}项目初始化:${C.R} 进入项目目录后运行 ${C.B}npx github:lpt9/engineering --init${C.R}`);
    log(`\n${C.C}卸载:${C.R} npx github:lpt9/engineering --uninstall\n`);
  } else {
    process.exit(1);
  }
}

main().catch(err => {
  log(`${C.r}${err.message}${C.R}`);
  process.exit(1);
});
