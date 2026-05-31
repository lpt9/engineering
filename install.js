#!/usr/bin/env node

/**
 * bmad-sprint-dashboard — Skill 安装 & 项目部署脚本
 *
 * 四种模式:
 *   npx github:lpt9/engineering                     → 安装 Skill 到全局 + 自动检测项目并部署
 *   npx github:lpt9/engineering --deploy [path]     → 安装 Skill + 部署到指定/当前项目
 *   npx github:lpt9/engineering --init              → 新项目：先安装 BMAD-METHOD，再安装 Skill + 部署
 *   npx github:lpt9/engineering --uninstall          → 卸载 Skill
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const SKILL_NAME = 'bmad-sprint-dashboard';
const SKILL_SRC = path.join(__dirname, SKILL_NAME);
const SKILL_DEST = path.join(os.homedir(), '.codebuddy', 'skills', SKILL_NAME);
const PKG_VERSION = require('./package.json').version;

// ── 颜色 ──────────────────────────────────────
const C = {
  R: '\x1b[0m',      B: '\x1b[1m',
  G: '\x1b[32m',     Y: '\x1b[33m',
  r: '\x1b[31m',     c: '\x1b[36m',
  D: '\x1b[2m',
};
const I = { G:'✅', Y:'⚠', R:'❌', B:'📦', S:'🚀', D:'📋', H:'🏠' };

function log(...a) { console.log(...a); }
function sep() { log(`${C.D}───────────────────────────────────────────────${C.R}`); }

// ── 工具函数 ─────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
function removeDir(dir) { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }

/** 从给定目录向上查找包含 _bmad/config.toml 的项目根 */
function findBmadRoot(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '_bmad', 'config.toml'))) return dir;
    const p = path.dirname(dir); if (p === dir) break; dir = p;
  }
  return null;
}

/**
 * 同步执行命令（仅用于简单的部署操作）
 */
function runSync(cmd, args, opts = {}) {
  try {
    const result = require('child_process').execSync(
      [cmd, ...args].join(' ') + ' 2>&1',
      { encoding: 'utf-8', stdio: 'pipe', ...opts }
    );
    return { ok: true, output: result };
  } catch (e) {
    return { ok: false, error: e.message, output: (e.stdout || '') + (e.stderr || '') };
  }
}

/**
 * 异步执行命令，继承父进程 stdio（保留完整终端交互能力）
 */
function runInteractive(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    log(`\n  ${C.D}$ ${cmd} ${args.join(' ')}${C.R}\n`);
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', (err) => {
      log(`\n  ${C.r}✗${C.R} ${err.message}\n`);
      resolve(false);
    });
  });
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

// ── 仅安装 Skill 到全局 ─────────────────────
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

// ── 部署脚本到项目 + 生成仪表盘 ─────────────
function deployToProject(projectRoot) {
  // 1. 拷贝生成脚本
  const scriptDir = path.join(projectRoot, '_bmad', 'scripts');
  const projectScript = path.join(scriptDir, 'generate_sprint_dashboard.js');
  const srcScript = path.join(SKILL_DEST, 'scripts', 'generate_dashboard.js');

  if (!fs.existsSync(scriptDir)) {
    fs.mkdirSync(scriptDir, { recursive: true });
  }
  if (fs.existsSync(srcScript)) {
    fs.copyFileSync(srcScript, projectScript);
    log(`  ${C.G}✓${C.R} 脚本已部署: _bmad/scripts/generate_sprint_dashboard.js`);
  } else {
    log(`  ${C.r}✗${C.R} 源脚本未找到: ${srcScript}`);
    return false;
  }

  // 2. 执行脚本生成仪表盘
  const code = runSync('node', [projectScript], { cwd: projectRoot });
  if (code.ok) {
    const htmlPath = path.join(projectRoot, '_bmad-output', 'implementation-artifacts', 'sprint-dashboard.html');
    if (fs.existsSync(htmlPath)) {
      const size = (fs.statSync(htmlPath).size / 1024).toFixed(1);
      log(`  ${C.G}✓${C.R} 仪表盘已生成: _bmad-output/implementation-artifacts/sprint-dashboard.html (${size} KB)`);
      return true;
    }
    log(`  ${C.Y}⚠${C.R} 仪表盘生成完成，但未找到输出文件（可能数据尚未就绪）`);
  } else {
    // 脚本可能有信息输出但没有错误（数据文件缺失时 exit(0)）
    log(`  ${C.Y}⚠${C.R} 生成脚本执行完成（可能数据文件尚未就绪，待 BMAD 工作流生成数据后再刷新）`);
  }
  return true; // 脚本部署成功即可
}

/** 部署到指定项目目录 */
function doDeploy(projectPath) {
  const targetPath = projectPath ? path.resolve(projectPath) : process.cwd();
  const projectRoot = findBmadRoot(targetPath);

  if (!projectRoot) {
    log(`\n${C.r}${I.R}${C.R} 当前目录不是 BMAD-METHOD 项目（未找到 _bmad/config.toml）`);
    log(`\n${C.c}提示:${C.R}`);
    log(`  1. 请确认在正确的项目目录下`);
    log(`  2. 如果是新项目，请使用 ${C.B}--init${C.R} 参数一键初始化`);
    log(`  3. 如果是已有 BMAD 项目，检查 _bmad/config.toml 是否存在\n`);
    return false;
  }

  log(`\n${C.B}🚀 部署到项目${C.R}`);
  log(`  项目目录: ${projectRoot}`);
  sep();

  // 确保 Skill 已安装
  if (!fs.existsSync(path.join(SKILL_DEST, 'SKILL.md'))) {
    log(`\n  ${C.Y}⚠${C.R} Skill 尚未安装，先安装...`);
    const ok = doInstallSkill();
    if (!ok) return false;
  } else {
    log(`\n  ${C.G}✓${C.R} Skill 已安装: ${SKILL_DEST}`);
  }

  // 部署
  const result = deployToProject(projectRoot);

  if (result) {
    sep();
    log(`\n${C.G}${C.B}🎉 部署完成!${C.R}\n`);
    log(`${C.c}后续使用:${C.R}`);
    log(`  对 CodeBuddy 说: ${C.B}"刷新仪表盘"${C.R}`);
    log(`  或手动: ${C.B}node _bmad/scripts/generate_sprint_dashboard.js${C.R}`);
  }
  return result;
}

// ── 自动检测并部署 ──────────────────────────
function doAutoDetect() {
  // 先安装 Skill（如果尚未安装）
  const skillNeedsInstall = !fs.existsSync(path.join(SKILL_DEST, 'SKILL.md'));

  log(`\n${C.B}${I.B}  ${SKILL_NAME} v${PKG_VERSION}${C.R}\n`);

  if (skillNeedsInstall) {
    const ok = doInstallSkill();
    if (!ok) return;
  } else {
    log(`${C.G}✓${C.R} Skill 已安装: ${SKILL_DEST}`);
  }

  // 检测当前工作目录是否是 BMAD 项目
  const projectRoot = findBmadRoot(process.cwd());

  if (projectRoot) {
    log(`\n${C.G}✓${C.R} 检测到 BMAD 项目: ${projectRoot}`);
    log(`\n  自动部署到当前项目...`);
    deployToProject(projectRoot);
  }

  // 最终提示
  sep();
  log(`\n${C.G}${C.B}✅ 安装完成!${C.R}\n`);
  log(`${C.c}使用方式:${C.R}`);
  log(`  在任意 BMAD-METHOD 项目中对 CodeBuddy 说: ${C.B}"刷新仪表盘"${C.R}`);
  if (!projectRoot) {
    log(`  在当前项目部署: ${C.B}npx github:lpt9/engineering --deploy${C.R}`);
  }
  log(`  手动运行: ${C.B}node ~/.codebuddy/skills/${SKILL_NAME}/scripts/generate_dashboard.js${C.R}\n`);
  log(`${C.c}初始化新项目:${C.R} 进入空目录后运行 ${C.B}npx github:lpt9/engineering --init${C.R}\n`);
  log(`${C.c}卸载:${C.R} npx github:lpt9/engineering --uninstall\n`);
}

// ── 完整初始化（新项目） ────────────────────
async function doInit() {
  const cwd = process.cwd();
  log(`\n${C.B}${I.S}  BMAD Sprint Dashboard — 项目初始化${C.R}`);
  log(`  工作目录: ${cwd}`);
  sep();

  // ── ① 检测 BMAD-METHOD ──────────────────
  const bmadRoot = findBmadRoot(cwd);
  if (bmadRoot) {
    log(`\n${C.G}${I.G}${C.R} BMAD-METHOD 已安装: ${bmadRoot}`);
    log(`  ${C.c}跳过 BMAD 安装，直接进入 Skill 部署...${C.R}`);
  } else {
    log(`\n${C.B}${C.Y}[1/3]${C.R} ${C.B}安装 BMAD-METHOD${C.R}`);
    sep();

    const ok = await runInteractive('npx', ['bmad-method', 'install'], { cwd });
    if (!ok) {
      log(`\n${C.r}✗ BMAD-METHOD 安装未成功完成${C.R}`);
      log(`${C.Y}  提示: 可手动执行 npx bmad-method install 后，再运行本脚本${C.R}`);
      process.exit(1);
    }
  }

  // ── ② 安装 Skill + 部署 ──────────────────
  log(`\n${C.B}${C.Y}[2/3]${C.R} ${C.B}部署 sprint-dashboard Skill${C.R}`);
  sep();

  const skillOk = doInstallSkill();
  if (!skillOk) {
    log(`\n${C.r}✗ Skill 安装失败${C.R}`);
    process.exit(1);
  }

  // ── ③ 部署到项目并生成仪表盘 ────────────
  log(`\n${C.B}${C.Y}[3/3]${C.R} ${C.B}部署脚本 & 生成仪表盘${C.R}`);
  sep();

  const root = findBmadRoot(cwd) || cwd;
  const result = deployToProject(root);

  // ── 完成 ──────────────────────────────────
  sep();
  log(`\n${C.G}${C.B}🎉 初始化完成!${C.R}\n`);
  log(`${C.c}后续使用:${C.R}`);
  log(`  对 CodeBuddy 说: ${C.B}"刷新仪表盘"${C.R}  或`);
  log(`  手动: ${C.B}node _bmad/scripts/generate_sprint_dashboard.js${C.R}\n`);
  log(`${C.c}查看仪表盘:${C.R}`);
  log(`  打开: ${C.B}_bmad-output/implementation-artifacts/sprint-dashboard.html${C.R}\n`);
  log(`${C.c}卸载 Skill:${C.R} npx github:lpt9/engineering --uninstall\n`);
}

// ── 帮助信息 ────────────────────────────────
function showHelp() {
  log(`\n${C.B}  ${SKILL_NAME} v${PKG_VERSION}${C.R}`);
  log(`${C.D}───────────────────────────────────────────────${C.R}\n`);
  log(`用法: npx github:lpt9/engineering [选项]\n`);
  log(`选项:`);
  log(`  (无参数)              安装 Skill 到全局，自动检测并部署到当前 BMAD 项目`);
  log(`  ${C.B}--deploy [path]${C.R}      安装 Skill + 部署脚本 & 生成仪表盘到指定/当前项目`);
  log(`  ${C.B}--init${C.R}              新项目: 安装 BMAD-METHOD → 安装 Skill → 部署脚本 → 生成仪表盘`);
  log(`  ${C.B}--uninstall${C.R}         卸载 Skill`);
  log(`  ${C.B}--help${C.R}             显示帮助\n`);
  log(`场景:`);
  log(`  ${C.c}已有 BMAD 项目:${C.R}  在项目目录下运行 npx github:lpt9/engineering`);
  log(`  ${C.c}部署到指定项目:${C.R}  npx github:lpt9/engineering --deploy /path/to/project`);
  log(`  ${C.c}新项目:${C.R}         进入空目录后 npx github:lpt9/engineering --init`);
  log(`  ${C.c}重新部署:${C.R}        npx github:lpt9/engineering --deploy\n`);
}

// ── Main ──────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--uninstall') || args.includes('-u')) {
    doUninstall();
    return;
  }

  if (args.includes('--init') || args.includes('-i')) {
    await doInit();
    return;
  }

  if (args.includes('--deploy') || args.includes('-d')) {
    const idx = args.findIndex(a => a === '--deploy' || a === '-d');
    const projectPath = (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('-'))
      ? args[idx + 1] : null;
    doDeploy(projectPath);
    return;
  }

  // 默认: 安装 Skill + 自动检测项目并部署
  doAutoDetect();
}

main().catch(err => {
  log(`${C.r}${err.message}${C.R}`);
  process.exit(1);
});
