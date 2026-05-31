# bmad-sprint-dashboard

BMAD-METHOD Sprint 开发进度仪表盘 Skill — 从 BMAD 输出文档自动生成可视化进度页面。

## 功能

- 🎯 从 `sprint-status.yaml` + `epics.md` 自动读取数据
- 📊 可视化展示整体完成度、各 Epic/Story 状态
- 🔄 Story 状态变更后一键刷新
- 🌐 全局 Skill，安装一次，所有 BMAD-METHOD 项目通用
- 💻 纯静态 HTML，浏览器直接打开即可查看

## 安装

### 方式一：npx 安装（推荐）

```bash
npx github:lpt9/engineering
```

### 方式二：Git 克隆安装

```bash
git clone https://github.com/lpt9/engineering.git
cd engineering
node install.js
```

### 卸载

```bash
npx github:lpt9/engineering --uninstall
```

## 使用

在任意 BMAD-METHOD 项目目录下：

### CodeBuddy 中

直接对 CodeBuddy 说：
- "刷新仪表盘"
- "查看开发进度"
- "生成进度页面"

### 命令行

```bash
node ~/.codebuddy/skills/bmad-sprint-dashboard/scripts/generate_dashboard.js
```

生成的 HTML 文件位于：`{项目目录}/_bmad-output/implementation-artifacts/sprint-dashboard.html`

在浏览器中打开即可查看。

## 数据源

| 文件 | 说明 |
|------|------|
| `_bmad/config.toml` | 读取输出目录配置 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Epic/Story 状态数据 |
| `_bmad-output/planning-artifacts/epics.md` | Epic 名称、摘要、Story 列表 |

## 仪表盘预览

- ✅ 整体完成度进度条
- 📈 统计卡片（已完成 / 待审查 / 进行中 / 待开始）
- 📋 各 Epic 展开/折叠卡片
- 🔵 当前活跃 Epic 高亮
- 📱 响应式设计，支持移动端

## 要求

- Node.js >= 14.0.0
- 项目已安装 [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)

## License

MIT
