/**
 * generate_sprint_dashboard.js
 * 
 * 从 BMAD-METHOD 输出文档生成 Sprint 进度仪表盘 HTML。
 * 
 * 数据源:
 *   - _bmad-output/implementation-artifacts/sprint-status.yaml  → 状态数据
 *   - _bmad-output/planning-artifacts/epics.md                  → Epic/Story 名称与摘要
 *   - _bmad/config.toml (可选)                                   → 自定义输出目录
 * 
 * 用法:
 *   node _bmad/scripts/generate_sprint_dashboard.js [--output <path>]
 * 
 * 输出:
 *   _bmad-output/implementation-artifacts/sprint-dashboard.html
 */

const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────
// 1. 配置解析
// ────────────────────────────────────────────────────────────

function findProjectRoot() {
  // 从当前工作目录向上查找 _bmad/config.toml（支持从任意位置运行）
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '_bmad', 'config.toml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // 到达文件系统根目录
    dir = parent;
  }
  // 回退：尝试从脚本所在位置向上查找
  dir = __dirname;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, '_bmad', 'config.toml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 最终回退：假设脚本在项目根目录下
  return process.cwd();
}

function readOutputDir(projectRoot) {
  const configPath = path.join(projectRoot, '_bmad', 'config.toml');
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    const match = content.match(/output_folder\s*=\s*"([^"]+)"/);
    if (match) {
      return match[1].replace('{project-root}', projectRoot);
    }
  }
  return path.join(projectRoot, '_bmad-output');
}

// ────────────────────────────────────────────────────────────
// 2. 解析 sprint-status.yaml
// ────────────────────────────────────────────────────────────

function parseSprintStatus(yamlPath) {
  if (!fs.existsSync(yamlPath)) {
    return null;
  }

  const content = fs.readFileSync(yamlPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  const meta = {};
  const status = {};
  let inDevStatus = false;

  // 提取元数据
  for (const line of lines) {
    // 跳过注释
    if (/^\s*#/.test(line) && !inDevStatus) continue;
    
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // 检测 development_status 段落
    if (/^development_status\s*:/.test(trimmed)) {
      inDevStatus = true;
      continue;
    }
    
    if (!inDevStatus) {
      const m = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
      if (m && !m[1].startsWith('#')) {
        meta[m[1]] = m[2].trim();
      }
      continue;
    }
    
    // 解析 development_status 条目
    if (inDevStatus) {
      // 跳过注释行
      if (/^\s*#/.test(line)) continue;
      
      const m = trimmed.match(/^([\w-]+)\s*:\s*(\S+)\s*$/);
      if (m) {
        const key = m[1];
        const value = m[2];
        // 跳过 retrospective 条目
        if (key.includes('retrospective')) continue;
        status[key] = value;
      }
    }
  }

  return { meta, status };
}

// ────────────────────────────────────────────────────────────
// 3. 解析 epics.md
// ────────────────────────────────────────────────────────────

function parseEpics(mdPath) {
  if (!fs.existsSync(mdPath)) {
    console.error(`[ERROR] epics.md 未找到: ${mdPath}`);
    return [];
  }

  const content = fs.readFileSync(mdPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  const epics = [];
  let currentEpic = null;
  let currentStory = null;
  let afterEpicHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 匹配 Epic 标题: ## Epic N: <名称>
    const epicMatch = line.match(/^## Epic (\d+):\s*(.+)$/);
    if (epicMatch) {
      // 保存上一个 Epic
      if (currentEpic) {
        epics.push(currentEpic);
      }
      
      currentEpic = {
        num: parseInt(epicMatch[1], 10),
        name: epicMatch[2].trim(),
        summary: '',
        stories: []
      };
      currentStory = null;
      afterEpicHeader = true;
      continue;
    }
    
    // 匹配 Story 标题: ### Story N.M: <名称>
    const storyMatch = line.match(/^### Story (\d+)\.(\d+):\s*(.+)$/);
    if (storyMatch && currentEpic) {
      currentStory = {
        id: `${storyMatch[1]}-${storyMatch[2]}`,
        name: storyMatch[3].trim(),
      };
      currentEpic.stories.push(currentStory);
      afterEpicHeader = false;
      continue;
    }
    
    // 收集 Epic 摘要 (Epic 标题后的第一段非空非元数据文字)
    if (afterEpicHeader && currentEpic && !currentEpic.summary) {
      const trimmed = line.trim();
      // 跳过空行、标题、元数据行（**开头）
      if (!trimmed) continue;
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('**')) continue;  // 元数据: **FRs covered / **Key / **UX / **Technical / **覆盖 等
      // 第一段非空非标题非元数据文字即为摘要
      currentEpic.summary = trimmed;
      afterEpicHeader = false;
    }
  }
  
  // 保存最后一个 Epic
  if (currentEpic) {
    epics.push(currentEpic);
  }

  return epics;
}

// ────────────────────────────────────────────────────────────
// 4. 合并数据: Epic/Story 名称 + 状态
// ────────────────────────────────────────────────────────────

function mergeData(epics, statusData) {
  const { meta, status } = statusData;
  
  const mergedEpics = epics.map(epic => {
    const epicKey = `epic-${epic.num}`;
    const epicStatus = status[epicKey] || 'backlog';
    
    const stories = epic.stories.map(story => {
      // 尝试多种 key 格式匹配 (sprint-status.yaml 使用 slug 格式)
      const slug = story.id + '-' + story.name
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      // 直接匹配或模糊匹配
      let storyStatus = 'backlog';
      
      // 尝试精确匹配 slug
      if (status[slug]) {
        storyStatus = status[slug];
      } else {
        // 尝试匹配以 story.id 开头的 key
        const prefix = story.id + '-';
        for (const [key, val] of Object.entries(status)) {
          if (key.startsWith(prefix)) {
            storyStatus = val;
            break;
          }
        }
      }
      
      return {
        id: story.id,
        name: story.name,
        status: storyStatus
      };
    });
    
    return {
      id: epicKey,
      num: epic.num,
      name: epic.name,
      summary: epic.summary,
      status: epicStatus,
      stories
    };
  });
  
  return {
    lastUpdated: meta.last_updated || new Date().toISOString().slice(0, 16),
    project: meta.project || 'unknown',
    epics: mergedEpics
  };
}

// ────────────────────────────────────────────────────────────
// 4.5. 检测 BMAD 各阶段完成状态
// ────────────────────────────────────────────────────────────

function detectPhases(outputDir) {
  const hasFile = (relativePath) => fs.existsSync(path.join(outputDir, relativePath));
  const hasDir = (relativePath) => {
    const d = path.join(outputDir, relativePath);
    return fs.existsSync(d) && fs.readdirSync(d).length > 0;
  };

  const phases = [
    {
      id: 'analysis',
      name: '需求分析',
      icon: '🔍',
      desc: 'PRD / 产品简报 / 头脑风暴',
      done: hasDir('planning-artifacts/prds') || hasFile('planning-artifacts/prd.md'),
    },
    {
      id: 'architecture',
      name: '架构设计',
      icon: '🏗️',
      desc: '架构文档 / UX 设计',
      done: hasFile('planning-artifacts/architecture.md'),
    },
    {
      id: 'planning',
      name: '开发规划',
      icon: '📋',
      desc: 'Epics 分解 / Sprint 规划',
      done: hasFile('planning-artifacts/epics.md') && hasFile('implementation-artifacts/sprint-status.yaml'),
      partial: hasFile('planning-artifacts/epics.md'),
    },
    {
      id: 'development',
      name: '开发执行',
      icon: '🚀',
      desc: 'Story 开发 / 代码审查',
      done: false, // 由 sprint-status 数据决定
      isCurrent: true,
    },
    {
      id: 'retro',
      name: '回顾总结',
      icon: '🎯',
      desc: 'Epic Retrospective',
      done: false,
    },
  ];

  return phases;
}

// ────────────────────────────────────────────────────────────
// 5. 生成 HTML
// ────────────────────────────────────────────────────────────

function generateHTML(data, phases, outputPath) {
  const dataJSON = JSON.stringify(data, null, 2);
  const phasesJSON = JSON.stringify(phases, null, 2);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.project} — 开发进度仪表盘</title>
<style>
/* ===================== CSS Variables ===================== */
:root {
  --color-primary: #2563EB;
  --color-primary-light: #DBEAFE;
  --color-success: #10B981;
  --color-success-light: #D1FAE5;
  --color-warning: #F59E0B;
  --color-warning-light: #FEF3C7;
  --color-danger: #EF4444;
  --color-danger-light: #FEE2E2;
  --color-info: #6366F1;
  --color-info-light: #E0E7FF;
  --color-done: #10B981;
  --color-review: #8B5CF6;
  --color-progress: #3B82F6;
  --color-backlog: #94A3B8;
  --color-bg: #F1F5F9;
  --color-surface: #FFFFFF;
  --color-text: #0F172A;
  --color-text-secondary: #475569;
  --color-border: #E2E8F0;
  --color-sidebar: #1E293B;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.08);
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --font-mono: 'Cascadia Code','Fira Code','JetBrains Mono','Consolas',monospace;
}

/* ===================== Base ===================== */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px; line-height: 1.5;
  background: var(--color-bg); color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

/* ===================== Header ===================== */
.header {
  background: linear-gradient(135deg, #1E293B 0%, #334155 100%);
  color: #F1F5F9; padding: 28px 32px 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}
.header h1 {
  font-size: 22px; font-weight: 700; margin-bottom: 4px;
  display: flex; align-items: center; gap: 10px;
}
.header h1 .icon { font-size: 24px }
.header .subtitle { color: #94A3B8; font-size: 13px; }

/* ===================== Phase Timeline ===================== */
.phase-timeline {
  background: var(--color-surface);
  margin: 0 32px 20px; border-radius: var(--radius-lg);
  padding: 16px 20px; margin-top: -16px;
  position: relative; z-index: 3;
  box-shadow: var(--shadow-lg);
}
.phase-timeline .phases { display: flex; gap: 0; align-items: flex-start; }
.phase-item {
  flex: 1; min-width: 108px; text-align: center; cursor: pointer;
  position: relative; padding: 10px 12px 14px;
  transition: all 0.2s;
}
.phase-item:not(:last-child)::after {
  content: ''; position: absolute; top: 28px; right: -1px;
  width: calc(100% - 32px); height: 3px; z-index: 0;
  background: #E2E8F0;
}
.phase-item.done:not(:last-child)::after { background: var(--color-success) }
.phase-item.partial:not(:last-child)::after { background: linear-gradient(90deg, var(--color-success) 50%, #E2E8F0 50%) }
.phase-item.current { background: #EEF2FF; border-radius: var(--radius-lg) }
.phase-dot {
  width: 24px; height: 24px; border-radius: 50%; margin: 0 auto 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; position: relative; z-index: 1;
  border: 3px solid #E2E8F0; background: #fff; color: #94A3B8;
  transition: all 0.3s;
}
.phase-item.done .phase-dot { border-color: var(--color-success); background: var(--color-success); color: #fff }
.phase-item.partial .phase-dot { border-color: var(--color-warning); background: var(--color-warning); color: #fff }
.phase-item.current .phase-dot { border-color: var(--color-primary); background: var(--color-primary); color: #fff; animation: pulse-dot 2s infinite }
@keyframes pulse-dot { 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,0.4)} 50%{box-shadow:0 0 0 6px rgba(37,99,235,0)} }
.phase-name { font-size: 13px; font-weight: 600; color: var(--color-text); margin-bottom: 2px }
.phase-item.done .phase-name { color: var(--color-success) }
.phase-item.current .phase-name { color: var(--color-primary) }
.phase-desc { font-size: 10px; color: #94A3B8; line-height: 1.3 }

/* ===================== Progress Bar ===================== */
.progress-section {
  background: var(--color-surface);
  margin: 0 32px; border-radius: var(--radius-lg);
  padding: 20px 24px; margin-top: -16px;
  position: relative; z-index: 2;
  box-shadow: var(--shadow-lg);
}
.progress-section .label-row {
  display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;
}
.progress-section .label { font-size: 13px; color: var(--color-text-secondary); }
.progress-section .value { font-size: 18px; font-weight: 700; color: var(--color-primary); }
.progress-bar {
  height: 8px; background: var(--color-border); border-radius: 4px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: linear-gradient(90deg, var(--color-primary), var(--color-info));
  border-radius: 4px; transition: width 0.6s ease;
}

/* ===================== Stats ===================== */
.stats-row {
  display: flex; flex-wrap: nowrap; gap: 16px;
  padding: 24px 32px 0;
}
.stat-card {
  flex: 1; min-width: 0;
  background: var(--color-surface); border-radius: var(--radius-lg);
  padding: 18px 20px; box-shadow: var(--shadow-card);
  display: flex; align-items: center; gap: 14px;
}
.stat-icon {
  width: 44px; height: 44px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.stat-icon.done { background: var(--color-success-light); color: var(--color-success) }
.stat-icon.review { background: var(--color-info-light); color: var(--color-review) }
.stat-icon.progress { background: var(--color-primary-light); color: var(--color-primary) }
.stat-icon.backlog { background: #F1F5F9; color: var(--color-backlog) }
.stat-info .stat-num { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.stat-info .stat-label { font-size: 12px; color: var(--color-text-secondary); }

/* ===================== Epic Cards ===================== */
.main-content { padding: 24px 32px 48px; }
.epic-grid { display: flex; flex-direction: column; gap: 16px; }
.epic-card {
  background: var(--color-surface); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card); overflow: hidden;
  border: 1px solid var(--color-border);
  transition: box-shadow 0.2s;
}
.epic-card:hover { box-shadow: var(--shadow-lg) }
.epic-card.current { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-light) }

.epic-header {
  padding: 16px 20px; display: flex; align-items: center;
  gap: 14px; cursor: pointer; user-select: none;
  background: #FAFBFC; border-bottom: 1px solid var(--color-border);
  transition: background 0.15s;
}
.epic-header:hover { background: #F8FAFC }
.epic-card.current .epic-header { background: #EEF2FF }

.epic-num {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; flex-shrink: 0;
  background: var(--color-border); color: var(--color-text-secondary);
}
.epic-card.done .epic-num { background: var(--color-success-light); color: var(--color-success) }
.epic-card.progress .epic-num { background: var(--color-primary-light); color: var(--color-primary) }

.epic-info { flex: 1; min-width: 0 }
.epic-name { font-size: 15px; font-weight: 600; }
.epic-desc { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.epic-meta { display: flex; align-items: center; gap: 10px; flex-shrink: 0 }
.epic-story-count { font-size: 12px; color: var(--color-text-secondary); }
.epic-arrow { font-size: 18px; color: #94A3B8; transition: transform 0.3s; }
.epic-card.open .epic-arrow { transform: rotate(90deg) }

/* ===================== Status Badge ===================== */
.badge {
  font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 9999px;
  white-space: nowrap; text-transform: uppercase; letter-spacing: 0.3px;
}
.badge-done { background: var(--color-success-light); color: #065F46 }
.badge-progress { background: var(--color-primary-light); color: #1E40AF }
.badge-review { background: var(--color-info-light); color: #3730A3 }
.badge-backlog { background: #F1F5F9; color: #64748B }

/* ===================== Story List ===================== */
.story-list {
  display: none; padding: 0; list-style: none;
}
.epic-card.open .story-list { display: block }

.story-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 20px 10px 56px;
  border-bottom: 1px solid #F1F5F9;
  transition: background 0.12s;
}
.story-item:last-child { border-bottom: none }
.story-item:hover { background: #F8FAFC }

.story-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.dot-done { background: var(--color-done) }
.dot-review { background: var(--color-review); animation: pulse 2s infinite }
.dot-progress { background: var(--color-primary); animation: pulse 1.5s infinite }
.dot-backlog { background: #CBD5E1 }

@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

.story-id { font-family: var(--font-mono); font-size: 11px; color: var(--color-text-secondary); width: 30px; flex-shrink: 0 }
.story-name { font-size: 13px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.story-status { flex-shrink: 0 }

/* ===================== Page Transition ===================== */
.fade-in { opacity: 0; transform: translateY(8px); }
.fade-in.visible { opacity: 1; transform: translateY(0); transition: opacity 0.3s, transform 0.3s }

/* ===================== Footer ===================== */
.footer {
  text-align: center; padding: 16px; color: #94A3B8; font-size: 11px;
}
.footer .mono { font-family: var(--font-mono) }

/* ===================== Responsive ===================== */
@media (max-width: 1024px) {
  .header,.phase-timeline,.progress-section,.main-content { margin-left:16px; margin-right:16px; padding-left:16px; padding-right:16px }
  .epic-desc { display: none }
  .stat-card { padding: 14px 12px; gap: 8px }
  .stat-icon { width: 36px; height: 36px; font-size: 16px }
  .stat-info .stat-num { font-size: 18px }
  .stat-info .stat-label { font-size: 11px }
  .phase-item { min-width: 80px; padding: 8px 6px 10px }
  .phase-desc { display: none }
}
@media (max-width: 640px) {
  .stats-row { padding: 16px 12px 0; gap: 8px }
  .stat-card { padding: 10px 8px; gap: 6px }
  .stat-icon { width: 30px; height: 30px; font-size: 14px }
  .stat-info .stat-num { font-size: 16px }
  .stat-info .stat-label { font-size: 10px }
  .phase-item { min-width: 58px; padding: 6px 3px 8px; font-size: 11px }
  .phase-name { font-size: 10px }
}
</style>
</head>
<body>

<div class="header">
  <h1><span class="icon">⚡</span>${data.project}</h1>
  <div class="subtitle">BMAD 全生命周期仪表盘 · 最后更新: <span id="lastUpdated">—</span></div>
</div>

<div class="phase-timeline" id="phaseTimeline">
  <div class="phases" id="phaseList"></div>
</div>

<div class="progress-section fade-in">
  <div class="label-row">
    <span class="label">整体完成度</span>
    <span class="value" id="overallPct">0%</span>
  </div>
  <div class="progress-bar"><div class="progress-fill" id="overallBar" style="width:0%"></div></div>
</div>

<div class="stats-row" id="statsRow"></div>

<div class="main-content">
  <div class="epic-grid" id="epicGrid"></div>
</div>

<div class="footer">
  <span class="mono">sprint-dashboard.html</span> · 数据源: sprint-status.yaml + epics.md · 自动生成 · <span id="generatedAt"></span>
</div>

<script>
// ========================================================================
// DATA — 自动从 sprint-status.yaml + epics.md 生成
// ========================================================================
const DATA = ${dataJSON};
const PHASES = ${phasesJSON};

// ========================================================================
// RENDER — Phase Timeline
// ========================================================================
(function renderPhases() {
  const list = document.getElementById('phaseList');
  let html = '';
  PHASES.forEach(function(p, i) {
    let cls = '';
    if (p.done) cls = 'done';
    else if (p.partial) cls = 'partial';
    else if (p.isCurrent) cls = 'current';
    let icon = p.done ? '✓' : (p.partial ? '◐' : (p.isCurrent ? '▶' : (i + 1)));
    html += '<div class="phase-item ' + cls + '" data-phase="' + p.id + '" onclick="scrollToPhase(this.dataset.phase)">' +
      '<div class="phase-dot">' + icon + '</div>' +
      '<div class="phase-name">' + p.icon + ' ' + p.name + '</div>' +
      '<div class="phase-desc">' + p.desc + '</div>' +
    '</div>';
  });
  list.innerHTML = html;
})();

function scrollToPhase(phaseId) {
  if (phaseId === 'development') {
    document.getElementById('epicGrid').scrollIntoView({ behavior: 'smooth' });
  }
}

// ========================================================================
// RENDER — Stats & Epics
// ========================================================================
document.getElementById('lastUpdated').textContent = DATA.lastUpdated;
document.getElementById('generatedAt').textContent = '生成时间: ' + new Date().toLocaleString('zh-CN');

function statusLabel(s) {
  const map = { done:'DONE', review:'REVIEW', 'in-progress':'DOING', 'ready-for-dev':'READY', backlog:'TODO' };
  return map[s] || s.toUpperCase();
}
function statusBadgeClass(s) {
  const map = { done:'badge-done', review:'badge-review', 'in-progress':'badge-progress', 'ready-for-dev':'badge-progress', backlog:'badge-backlog' };
  return map[s] || 'badge-backlog';
}
function dotClass(s) {
  const map = { done:'dot-done', review:'dot-review', 'in-progress':'dot-progress', 'ready-for-dev':'dot-progress', backlog:'dot-backlog' };
  return map[s] || 'dot-backlog';
}
function epicStatusBadgeClass(s) {
  const map = { done:'badge-done', 'in-progress':'badge-progress', backlog:'badge-backlog' };
  return map[s] || 'badge-backlog';
}

// Overall stats
let totalStories = 0, doneStories = 0, reviewStories = 0, progressStories = 0, backlogStories = 0;

DATA.epics.forEach(epic => {
  epic.stories.forEach(s => {
    totalStories++;
    if (s.status === 'done') doneStories++;
    else if (s.status === 'review') reviewStories++;
    else if (s.status === 'in-progress' || s.status === 'ready-for-dev') progressStories++;
    else backlogStories++;
  });
});

const pct = totalStories ? Math.round((doneStories / totalStories) * 100) : 0;
document.getElementById('overallPct').textContent = pct + '%';
document.getElementById('overallBar').style.width = pct + '%';

// Stats row
document.getElementById('statsRow').innerHTML = \`
  <div class="stat-card fade-in">
    <div class="stat-icon done">✅</div>
    <div class="stat-info"><div class="stat-num">\${doneStories}</div><div class="stat-label">已完成</div></div>
  </div>
  <div class="stat-card fade-in">
    <div class="stat-icon review">👁</div>
    <div class="stat-info"><div class="stat-num">\${reviewStories}</div><div class="stat-label">待审查</div></div>
  </div>
  <div class="stat-card fade-in">
    <div class="stat-icon progress">🚧</div>
    <div class="stat-info"><div class="stat-num">\${progressStories}</div><div class="stat-label">进行中</div></div>
  </div>
  <div class="stat-card fade-in">
    <div class="stat-icon backlog">📋</div>
    <div class="stat-info"><div class="stat-num">\${backlogStories}</div><div class="stat-label">待开始</div></div>
  </div>
\`;

// Epic cards
let epicHTML = '';
DATA.epics.forEach(epic => {
  const doneCount = epic.stories.filter(s=>s.status==='done').length;
  const totalCount = epic.stories.length;
  const epicPct = totalCount ? Math.round((doneCount/totalCount)*100) : 0;
  const isCurrent = epic.status === 'in-progress' || epic.status === 'done';
  const openClass = (epic.status === 'in-progress' || epic.status === 'done') ? ' open' : '';

  let storiesHTML = '';
  epic.stories.forEach(s => {
    storiesHTML += \`
      <li class="story-item">
        <span class="story-dot \${dotClass(s.status)}"></span>
        <span class="story-id">\${s.id}</span>
        <span class="story-name">\${s.name}</span>
        <span class="story-status"><span class="badge \${statusBadgeClass(s.status)}">\${statusLabel(s.status)}</span></span>
      </li>\`;
  });

  epicHTML += \`
    <div class="epic-card \${epic.status}\${openClass}\${isCurrent ? ' current' : ''}" data-epic="\${epic.id}">
      <div class="epic-header" onclick="this.parentElement.classList.toggle('open')">
        <div class="epic-num">\${epic.num}</div>
        <div class="epic-info">
          <div class="epic-name">Epic \${epic.num}: \${epic.name}</div>
          <div class="epic-desc">\${epic.summary}</div>
        </div>
        <div class="epic-meta">
          <span class="epic-story-count">\${doneCount}/\${totalCount} · \${epicPct}%</span>
          <span class="badge \${epicStatusBadgeClass(epic.status)}">\${statusLabel(epic.status)}</span>
          <span class="epic-arrow">▶</span>
        </div>
      </div>
      <ul class="story-list">\${storiesHTML}</ul>
    </div>\`;
});
document.getElementById('epicGrid').innerHTML = epicHTML;

// Fade-in animation
requestAnimationFrame(() => {
  document.querySelectorAll('.fade-in').forEach((el,i) => {
    setTimeout(() => el.classList.add('visible'), i * 60);
  });
});
</script>

</body>
</html>`;

  fs.writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

// ────────────────────────────────────────────────────────────
// 6. Main
// ────────────────────────────────────────────────────────────

function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  let outputPath = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[i + 1];
      i++;
    }
  }

  const projectRoot = findProjectRoot();
  const outputDir = readOutputDir(projectRoot);
  
  const sprintStatusPath = path.join(outputDir, 'implementation-artifacts', 'sprint-status.yaml');
  const epicsPath = path.join(outputDir, 'planning-artifacts', 'epics.md');
  
  if (!outputPath) {
    outputPath = path.join(outputDir, 'implementation-artifacts', 'sprint-dashboard.html');
  }

  console.log('═══════════════════════════════════════════');
  console.log('  BMAD Sprint Dashboard Generator');
  console.log('═══════════════════════════════════════════');
  console.log(`  项目根目录: ${projectRoot}`);
  console.log(`  输出目录:   ${outputDir}`);
  console.log(`  状态文件:   ${sprintStatusPath}`);
  console.log(`  Epic 文件:  ${epicsPath}`);
  console.log(`  输出文件:   ${outputPath}`);
  console.log('───────────────────────────────────────────');

  // 1. 解析 sprint-status.yaml
  console.log('\n[1/4] 解析 sprint-status.yaml ...');
  const statusData = parseSprintStatus(sprintStatusPath);
  if (!statusData) {
    console.log(`       ${'⚠ '.trim()} sprint-status.yaml 不存在`);
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════════════════╗');
    console.log('  ║  📋 仪表盘数据尚未就绪                                   ║');
    console.log('  ║                                                         ║');
    console.log('  ║  BMAD-METHOD 已安装，但还没有 Sprint 数据。              ║');
    console.log('  ║  请先完成以下 BMAD 工作流来生成数据:                     ║');
    console.log('  ║                                                         ║');
    console.log('  ║  1. 创建 PRD           → bmad-create-prd                 ║');
    console.log('  ║  2. 创建架构            → bmad-create-architecture         ║');
    console.log('  ║  3. 创建 Epics & Stories → bmad-create-epics-and-stories  ║');
    console.log('  ║  4. Sprint 规划         → bmad-sprint-planning           ║');
    console.log('  ║                                                         ║');
    console.log('  ║  完成后重新运行: node _bmad/scripts/generate_sprint_dashboard.js');
    console.log('  ╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    process.exit(0);
  }
  console.log(`       找到 ${Object.keys(statusData.status).length} 个状态条目`);
  console.log(`       最后更新: ${statusData.meta.last_updated}`);

  // 2. 解析 epics.md
  console.log('\n[2/4] 解析 epics.md ...');
  const epics = parseEpics(epicsPath);
  if (epics.length === 0) {
    console.log(`       ${'⚠'.trim()} epics.md 不存在或无 Epic 数据`);
    console.log('');
    console.log('  ╔═══════════════════════════════════════════════════════════╗');
    console.log('  ║  📋 Epic 数据尚未就绪                                   ║');
    console.log('  ║                                                         ║');
    console.log('  ║  请先运行: bmad-create-epics-and-stories                 ║');
    console.log('  ║  然后运行: bmad-sprint-planning                         ║');
    console.log('  ║                                                         ║');
    console.log('  ║  完成后重新运行: node _bmad/scripts/generate_sprint_dashboard.js');
    console.log('  ╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    process.exit(0);
  }
  epics.forEach(e => {
    console.log(`       Epic ${e.num}: ${e.name} (${e.stories.length} 个 Story)`);
  });

  // 3. 合并数据
  console.log('\n[3/4] 合并数据 ...');
  const data = mergeData(epics, statusData);
  
  // 统计
  let totalS = 0, doneS = 0, reviewS = 0;
  data.epics.forEach(e => {
    e.stories.forEach(s => {
      totalS++;
      if (s.status === 'done') doneS++;
      if (s.status === 'review') reviewS++;
    });
  });
  console.log(`       总计: ${totalS} Story, ${doneS} 完成, ${reviewS} 待审查`);
  console.log(`       Epic 状态: ${data.epics.map(e => `Epic${e.num}=${e.status}`).join(', ')}`);

  // 3.5 检测 BMAD 各阶段
  const phases = detectPhases(outputDir);
  // 根据 sprint 数据更新开发阶段和回顾阶段状态
  const devPhase = phases.find(p => p.id === 'development');
  if (devPhase) {
    if (doneS === totalS && totalS > 0) devPhase.done = true;
    else if (doneS > 0) devPhase.partial = true;
    devPhase.desc = `${doneS}/${totalS} Story 完成`;
  }
  const retroPhase = phases.find(p => p.id === 'retro');
  if (retroPhase && devPhase && devPhase.done) {
    // 检查是否有 retrospective 完成标记
    if (statusData.status && Object.values(statusData.status).some(v => v === 'done' && Object.keys(statusData.status).some(k => k.includes('retrospective')))) {
      retroPhase.done = true;
    }
  }

  // 4. 生成 HTML
  console.log('\n[4/4] 生成 HTML ...');
  const generatedPath = generateHTML(data, phases, outputPath);
  
  const fileSize = (fs.statSync(generatedPath).size / 1024).toFixed(1);
  console.log(`       生成完成: ${generatedPath} (${fileSize} KB)`);
  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ Dashboard 生成成功!');
  console.log(`  打开: file://${generatedPath.replace(/\\/g, '/')}`);
  console.log('═══════════════════════════════════════════\n');
}

main();
