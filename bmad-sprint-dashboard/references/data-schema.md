# BMAD Sprint Dashboard - 数据模型参考

## sprint-status.yaml 结构

```yaml
# 元数据
generated: 2026-05-28
last_updated: 2026-05-30T20:58
project: bmad-method
project_key: NOKEY
tracking_system: file-system
story_location: _bmad-output/implementation-artifacts

# 开发状态
development_status:
  epic-1: done                    # Epic 状态
  1-1-maven-module-skeleton: done # Story 状态 (slug 格式)
  1-2-dual-database-flyway: done
  epic-2: in-progress
  2-1-global-model-pool: review
  ...
```

### 状态定义

**Epic 状态流程**: `backlog` → `in-progress` → `done`

**Story 状态流程**: `backlog` → `ready-for-dev` → `in-progress` → `review` → `done`

**Retrospective 状态**: `optional` | `done`

### Story Key 格式

格式: `{epic}-{story}-{slug-name}`

示例: `1-1-maven-module-skeleton`, `2-1-global-model-pool`

## epics.md 结构

### Epic 定义
```markdown
## Epic N: 标题

摘要描述文本（第一段非空非元数据文字）

### Story N.M: 故事标题
```

### Story 格式
```markdown
### Story 1.1: Maven 13 模块项目骨架 + BOM 管理

As a <角色>,
I want <目标>,
So that <价值>.

**Acceptance Criteria:**
...
```

## 数据匹配逻辑

脚本通过以下方式将 epics.md 中的 Story 与 sprint-status.yaml 中的状态关联：

1. 优先尝试直接 slug 匹配 Story 名称
2. 回退到前缀匹配（`{epic}-{story}-`）

## 仪表盘 HTML 数据格式

```javascript
const DATA = {
  lastUpdated: "2026-05-30T20:58",
  project: "bmad-method",
  epics: [
    {
      id: "epic-1",
      num: 1,
      name: "平台基础与多租户管理",
      summary: "...",
      status: "done",      // backlog | in-progress | done
      stories: [
        {
          id: "1-1",
          name: "Maven 13 模块项目骨架 + BOM 管理",
          status: "done"   // backlog | ready-for-dev | in-progress | review | done
        }
      ]
    }
  ]
};
```
