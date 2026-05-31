# bmad-sprint-dashboard

BMAD-METHOD Sprint 开发进度仪表盘 Skill — 从 `sprint-status.yaml` + `epics.md` 自动生成可视化进度页面。

## 快速开始

### 新项目一键初始化

在空项目目录下，一条命令完成所有安装：

```bash
npx github:lpt9/engineering --init
```

执行流程：
1. 安装 [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (`npx bmad-method install`)
2. 安装 sprint-dashboard Skill 到全局 (`~/.codebuddy/skills/`)
3. 部署生成脚本到项目 `_bmad/scripts/`
4. 自动生成首版仪表盘 HTML

### 已有 BMAD 项目

如果项目已安装 BMAD-METHOD，只需：

```bash
npx github:lpt9/engineering          # 仅安装 Skill
```

然后在项目目录下，对 CodeBuddy 说 **"刷新仪表盘"** 即可。

或者手动运行：

```bash
node _bmad/scripts/generate_sprint_dashboard.js
```

## 三种使用模式

| 命令 | 说明 |
|------|------|
| `npx github:lpt9/engineering --init` | **一键初始化** — 安装 BMAD + Skill + 生成仪表盘 |
| `npx github:lpt9/engineering` | **仅安装 Skill** — 安装到 `~/.codebuddy/skills/` |
| `npx github:lpt9/engineering --uninstall` | **卸载 Skill** |

## 仪表盘预览

生成的 HTML 页面包含：
- 📊 整体完成度进度条
- 📈 统计卡片（已完成/待审查/进行中/待开始）
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

## License

MIT
