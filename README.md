# bmad-sprint-dashboard

BMAD-METHOD Sprint 开发进度仪表盘 Skill — 从 `sprint-status.yaml` + `epics.md` 自动生成可视化进度页面。

## 快速开始

### 已有 BMAD 项目（推荐）

如果项目已安装 BMAD-METHOD，只需进入项目目录运行：

```bash
npx github:lpt9/engineering
```

**自动完成：**
1. 安装 sprint-dashboard Skill 到全局 (`~/.codebuddy/skills/`)
2. 自动检测当前 BMAD 项目
3. 部署生成脚本到 `_bmad/scripts/`
4. 自动生成首版仪表盘 HTML

然后对 CodeBuddy 说 **"刷新仪表盘"** 即可随时更新。

### 部署到指定项目

```bash
npx github:lpt9/engineering --deploy /path/to/your-bmad-project
```

### 新项目一键初始化

在空项目目录下：

```bash
npx github:lpt9/engineering --init
```

执行流程：
1. 安装 [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (`npx bmad-method install`)
2. 安装 sprint-dashboard Skill 到全局
3. 部署生成脚本到项目 `_bmad/scripts/`
4. 自动生成首版仪表盘 HTML

## 四种使用模式

| 命令 | 说明 |
|------|------|
| `npx github:lpt9/engineering` | **安装 Skill + 自动部署** — 安装到全局，自动检测并部署到当前 BMAD 项目 |
| `npx github:lpt9/engineering --deploy [path]` | **指定项目部署** — 安装 Skill + 部署脚本到指定/当前项目 |
| `npx github:lpt9/engineering --init` | **一键初始化** — 安装 BMAD + Skill + 部署 + 生成仪表盘 |
| `npx github:lpt9/engineering --uninstall` | **卸载 Skill** |

## 手动使用

```bash
# 从全局 Skill 运行
node "$HOME/.codebuddy/skills/bmad-sprint-dashboard/scripts/generate_dashboard.js"

# 或通过项目内部署的脚本
node _bmad/scripts/generate_sprint_dashboard.js
```

## 仪表盘预览

生成的 HTML 页面包含：
- 📊 BMAD 全生命周期时间线（需求分析 → 架构设计 → 开发规划 → 开发执行 → 测试验收 → 回顾总结）
- 📄 各阶段产出物点击查看
- 📈 统计卡片（已完成/待审查/进行中/待开始）— 始终排在一行
- 📊 整体完成度进度条
- 📋 Epic 展开/折叠卡片，Story 状态一目了然
- 🔵 当前活跃 Epic 高亮
- 📱 响应式设计

## 数据源

| 文件 | 说明 |
|------|------|
| `_bmad/config.toml` | 输出目录配置 |
| `{output}/implementation-artifacts/sprint-status.yaml` | Epic/Story 状态 |
| `{output}/planning-artifacts/epics.md` | Epic 名称/摘要/Story 列表 |

## 要求

- Node.js >= 14.0
- 空目录或已安装 BMAD-METHOD 的目录
- **无需重新安装 BMAD-METHOD** — 已有 BMAD 的项目直接安装 Skill 即可

## License

MIT
