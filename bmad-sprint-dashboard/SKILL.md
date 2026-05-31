---
name: bmad-sprint-dashboard
description: >
  生成或刷新 Sprint 开发进度仪表盘 HTML 页面。从 BMAD-METHOD 输出文档
  (sprint-status.yaml + epics.md) 中读取 Epic/Story 状态和详细信息，
  自动生成可视化的进度仪表盘。当用户提到"仪表盘"、"dashboard"、
  "sprint dashboard"、"进度看板"、"查看开发进度"、"生成进度页面"、
  "刷新仪表盘"时触发此 Skill。此 Skill 为全局 Skill，适用于任意
  BMAD-METHOD 项目。
---

# BMAD Sprint Dashboard Generator

从 BMAD-METHOD 输出文档生成 Sprint 开发进度仪表盘 HTML。
**全局 Skill** — 安装一次，所有 BMAD-METHOD 项目通用。

## 目的

在 BMAD-METHOD 项目中，开发进度数据分散在多个文档中：
- `sprint-status.yaml` — 所有 Epic 和 Story 的当前状态
- `epics.md` — Epic 名称、摘要、Story 名称等详细信息

此 Skill 将这些数据整合为一个美观的可视化 HTML 仪表盘，方便随时查看整体开发进度。

## 安装

### 已有 BMAD-METHOD 的项目（推荐）

进入项目目录，运行以下命令即可安装 Skill 并自动部署到当前项目：

```bash
npx github:lpt9/engineering
```

**自动完成：**
1. 安装 Skill 到全局 (`~/.codebuddy/skills/`)
2. 自动检测当前目录是否为 BMAD 项目（通过 `_bmad/config.toml`）
3. 如果是，自动部署生成脚本到项目 `_bmad/scripts/`
4. 自动生成首版仪表盘 HTML

### 部署到指定项目

```bash
npx github:lpt9/engineering --deploy /path/to/your-project
```

### 新项目（需要同时安装 BMAD-METHOD）

```bash
npx github:lpt9/engineering --init
```

会自动依次完成：安装 BMAD-METHOD → 安装 Skill → 部署脚本 → 生成仪表盘。

### 卸载

```bash
npx github:lpt9/engineering --uninstall
```

## 使用场景

- 项目开始时，生成初始仪表盘了解 Sprint 规划
- Sprint 执行过程中，随时刷新仪表盘查看最新进度
- Story 状态变更后，更新仪表盘反映最新状态
- 需要与团队或利益相关者分享开发进度
- **切换项目后无需重新安装**，直接在当前项目目录下调用即可

## 执行方式

### 方式一：对 CodeBuddy 说（推荐）

在 BMAD-METHOD 项目目录下，直接说：

> **"刷新仪表盘"**

CodeBuddy 将自动运行 Skill 内置脚本生成最新仪表盘。

### 方式二：直接运行 Skill 内置脚本

```bash
# macOS / Linux
node "$HOME/.codebuddy/skills/bmad-sprint-dashboard/scripts/generate_dashboard.js"

# Windows PowerShell
node "$env:USERPROFILE\.codebuddy\skills\bmad-sprint-dashboard\scripts\generate_dashboard.js"
```

脚本会自动：
1. 从当前工作目录向上查找 `_bmad/config.toml` 确认 BMAD 项目
2. 从 `_bmad/config.toml` 读取输出目录配置（或使用默认值 `_bmad-output`）
3. 解析 `sprint-status.yaml` 获取所有状态数据
4. 解析 `epics.md` 获取 Epic/Story 名称和摘要
5. 合并数据并生成 `sprint-dashboard.html`

### 方式三：通过项目部署的脚本

```bash
node _bmad/scripts/generate_sprint_dashboard.js
```

### 指定自定义输出路径

```bash
node scripts/generate_dashboard.js --output path/to/custom-dashboard.html
```

## 生成后步骤

1. 脚本输出文件默认位置：`{项目目录}/_bmad-output/implementation-artifacts/sprint-dashboard.html`
2. 在浏览器中打开生成的 HTML 文件即可查看仪表盘
3. 仪表盘支持：
   - 整体完成度进度条
   - 按状态分类的统计卡片（已完成/待审查/进行中/待开始）
   - BMAD 全生命周期时间线（需求分析 → 架构设计 → 开发规划 → 开发执行 → 测试验收 → 回顾总结）
   - 各阶段产出物点击查看
   - 各 Epic 展开/折叠卡片，显示所有 Story 状态
   - 当前活跃 Epic 高亮显示
   - 响应式设计，支持移动端查看

## 数据源说明

脚本从当前项目以下 BMAD-METHOD 文档读取数据：

| 文件 | 内容 | 路径 |
|------|------|------|
| 配置文件 | 输出目录路径 | `_bmad/config.toml` |
| Sprint 状态 | Epic/Story 状态 | `{output}/implementation-artifacts/sprint-status.yaml` |
| Epic 定义 | 名称/摘要/Story列表 | `{output}/planning-artifacts/epics.md` |

## 项目检测

脚本从当前工作目录向上遍历，查找包含 `_bmad/config.toml` 的目录作为项目根目录。
如果当前目录不在 BMAD-METHOD 项目中，脚本会报错退出。

## 状态映射

| BMAD 状态 | 仪表盘标签 | 说明 |
|-----------|-----------|------|
| `done` | DONE ✅ | 已完成 |
| `review` | REVIEW 👁 | 待代码审查 |
| `in-progress` | DOING 🚧 | 开发中 |
| `ready-for-dev` | READY 🚧 | 就绪待开发 |
| `backlog` | TODO 📋 | 待开始 |
