# Excel to AI Market-Informed Product Upgrade Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于 2026 年 3 月 19 日可见的成熟 AI 表格产品模式，补一轮面向中文产品的 UI / 交互改造计划，让 `excel-to-ai` 从“已完成基础工作台骨架”进一步升级为“更像成熟产品的 AI 表格工作台”。

**Architecture:** 保持平台统一 Key，不允许前端直连模型；产品形态收敛为“左侧数据舞台 + 右侧固定 AI 副驾驶”，可选极窄辅助 rail（仅承载入口与折叠控制）；不引入 Vue Router / Pinia / 真实会话后端。

**Tech Stack:** `Vue 3` + `TypeScript` + `Vite` + `Element Plus` + `Axios` + `Fastify` + `zod` + `pnpm workspace`

---

## 1. Source Snapshot

### 1.1 观察时间

- 截至 `2026-03-19`

### 1.2 参考来源

- ChatExcel 官网：
  [https://www.chatexcel.com/](https://www.chatexcel.com/)
- ChatExcel 官方文章：
  [北大ChatExcel，获得千万级新投资](https://chatexcel.com/blog/pkuchatexcel/)
- ChatExcel 官方文章：
  [用“聊天”干掉函数公式，让打工人的表格不再抓狂](https://chatexcel.com/blog/chatexcellive/)
- Rows 官方产品页：
  [Rows AI](https://rows.com/ai/)
- Google Workspace 官方产品页：
  [Gemini in Google Sheets](https://workspace.google.com/intl/en_in/resources/spreadsheet-ai/)
- Microsoft 官方支持页：
  [Get started with Copilot in Excel](https://support.microsoft.com/en-us/office/get-started-with-copilot-in-excel-d7110502-0334-4b4f-a175-a73abdfc118a)
- 额外参考：
  你在本次会话中提供的两张 ChatExcel 界面截图

### 1.3 参考产品提炼

#### ChatExcel

- ChatExcel 的典型形态是“左侧数据舞台 + 右侧固定 AI 栏”，空态也保留能力入口与对话壳层，强调从数据上下文出发而不是先学功能树。
- 其空态并不是纯上传页，而是“能力入口页”：中间给出官方能力演示、行业专题案例、模板式提示入口；右侧保留对话区和上传区。
- 其结果态并不是只给下载按钮，而是：右侧直接显示计划拆解、结果总结、可继续追问的问题、再试一次 / 分享等后续动作。
- 官方内容也明确它不是单一的 Excel 清洗器，而是通过聊天操作 Excel 的四大模块：处理 / 运算 / 分析 / 图表；并且支持数据库、网页等多数据源扩展。

#### Rows

- Rows 强调 “The cell is the prompt”，说明 AI 应该嵌进表格工作流本身，而不是浮在表格之外。
- 它把“加列、建图、查找替换、格式整理、汇总、预测、分类、网页研究、PDF / 图片转表”等动作全部统一到同一套工作台语义下。
- 它还强调：AI 入口既可以在右下角气泡里，也可以直接在单元格内触发，这说明“固定副驾驶 + 就地快捷动作”可以共存。

#### Gemini in Google Sheets

- Gemini in Sheets 把“创建表格、生成公式、复杂编辑与格式化、批量 AI function、理解数据、建图、快速找答案”都归到数据工作台本体里，而不是单独产品页。
- 这类产品的共同点是：用户不是先学功能树，而是先有数据，再直接提问题。

#### Copilot in Excel

- Copilot in Excel 当前公开能力强调：导入数据、高亮 / 排序 / 筛选、生成和理解公式、识别洞察，并把结果落成图表、透视表、摘要、趋势和异常点。
- 它的工作方式是：用户在 Excel 本体里调出侧边 Copilot 面板或局部入口，而不是跳到另一个“AI 页面”。

---

## 2. Current Product Diagnosis

基于当前代码和最近一轮 UI 重排，`excel-to-ai` 已经具备了工作台雏形，但离“成熟 AI 表格产品”还有 5 个明显差距：

### 2.1 左侧仍然只是“最近任务列表”，不是“导航”

- 当前左侧主要是 [RecentTasksPanel.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/RecentTasksPanel.vue)
- 它可以回看任务，但还不能承接：工作台入口、模板入口、当前文件、历史 / 文件 / 模板这几类固定导航角色

### 2.2 空态仍然偏“说明页”，不是“能力入口页”

- 当前 [EmptyDashboard.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/EmptyDashboard.vue) 已经收敛了杂乱度，但还没有像 ChatExcel 那样，把“官方能力演示”“行业场景案例”“模板 chips”变成明确的一层入口

### 2.3 中间主舞台仍偏“预览卡片”，不够像“数据操作舞台”

- 当前 [PreviewStage.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/PreviewStage.vue) 和 [ResultStage.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/ResultStage.vue) 已经能展示预览、变更和失败
- 但在视觉和信息结构上，中间舞台还缺：更稳定的顶层 tab、执行摘要条、结果总结条、继续操作入口

### 2.4 右侧 AI 面板仍偏“聊天卡片”，缺少“行动导向”

- 当前 [AiCopilotPanel.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/AiCopilotPanel.vue) 已有计划、消息、输入框
- 但它还不够像成熟产品中的“任务副驾驶”，缺少：固定输入器、结构化计划清单、结果摘要卡、建议下一步操作

### 2.5 产品叙事仍停留在“处理一次 Excel”，而不是“持续工作台”

- 市面成熟产品都在强调：多能力统一入口、历史会话、模板、图表、分析、持续使用
- 我们现阶段不需要把功能做全，但 UI 层必须先有这种产品心智

---

## 3. Product Decisions

### 3.1 明确借鉴的部分

- 借鉴 ChatExcel 的“左侧主舞台 + 右侧副驾驶”结构与空态能力入口表达
- 借鉴 ChatExcel 的空态能力入口和行业场景 chips
- 借鉴 ChatExcel 的右侧“计划 + 结果总结 + 后续提问”结构
- 借鉴 Rows / Gemini / Copilot 的“AI 应嵌入数据工作流本体”思路
- 借鉴 Excel / Sheets 产品的“预览、排序、筛选、图表、分析”统一舞台语义

### 3.2 明确不照搬的部分

- 不照搬 ChatExcel 的会员体系、促销按钮、套餐页
- 不照搬 ChatExcel 的 AI PPT / ChatDB / 全家桶产品矩阵
- 不照搬多产品路由和深层导航
- 不照搬真实多文件上传、多源接入、企业版、API 开放平台
- 不照搬“生成 PPT”“数据库对话”“网页抓取”等超出当前后端能力的功能

### 3.3 本轮产品边界

- 仍然只做 Excel -> 计划 -> 执行 -> 回看 -> 下载
- 仍然是中文产品
- 仍然不做前端直连模型
- 仍然不引入 Vue Router
- 仍然不新增真实会话后端
- 仍然优先复用现有 /api/ai/plan、/api/tasks、/api/tasks/execute、/api/tasks/:taskId/result

## 3.4 User-Confirmed Layout Override

基于本次会话中用户再次确认，并结合两张 ChatExcel 截图，这份文档的最终布局原则补充如下：

- 正确借鉴对象是“左大右小双栏工作台”，不是“三栏平均分配页面”
- 左侧主区负责：文件预览、结果预览、sheet 切换、处理结果摘要、差异对比
- 右侧固定栏负责：上传文件、与 AI 对话、计划确认、执行反馈、结果总结、后续追问
- 顶部只保留紧凑工作台栏，不再引入占高度的大 Hero
- 如果保留产品导航，它只能是极窄的辅助 rail，不能占据一个完整主栏
- 因此，这份文档后续所有“信息架构”和“任务拆解”都应优先按“左侧数据舞台 + 右侧 AI 副驾驶”来实现

这也意味着：

- 左侧不是“任务列表区”，而是整个产品的核心舞台
- 右侧不是普通聊天框，而是固定任务副驾驶
- 上传入口应该优先落在右侧副驾驶顶部或空态右栏中，而不是单独做一个中央大页
---

## 4. Target Information Architecture

### 4.1 顶层壳层

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│ 顶部紧凑工作台栏：品牌 / 当前文件 / 工作表 / 任务状态 / 主操作              │
├───────────────────────────────────────────────┬──────────────────────────────┤
│ 左侧主数据舞台                                 │ 右侧 AI 副驾驶固定栏         │
│                                               │                              │
│ 空态：能力入口 / 示例 / 预览占位               │ 上传文件 / 对话 / 提示词      │
│ 草稿：原始预览 / sheet 切换 / 文件上下文       │ 计划确认 / 模板 / 发送        │
│ 结果：结果预览 / 差异对比 / 失败记录 / 汇总     │ 结果总结 / 建议追问 / 再处理  │
└───────────────────────────────────────────────┴──────────────────────────────┘
```

说明：

- 核心不是三栏平均分配，而是左大右小双栏
- 左侧是唯一主舞台
- 右侧是固定副驾驶
- 如果要保留产品导航，只能是极窄折叠 rail，不能占完整主栏

### 4.2 可选辅助 Rail

第一阶段如果保留导航，不做完整左侧产品栏，而是做极窄辅助 rail，例如：

```ts
type WorkbenchRailItem =
  | "workspace"
  | "templates"
  | "history";
```

它的职责只能是：

- 当前工作台入口
- 模板入口
- 历史入口
- 折叠 / 展开控制

它不负责承担主内容展示，也不应该把“最近任务列表”单独做成左侧主栏。

### 4.3 中间数据舞台

中间区域是唯一主舞台，必须始终比左右两栏更重。

建议稳定为两级结构：

- 一级：`文件预览` / `处理结果`
- 二级：`结果预览` / `变更对比` / `失败记录`

在 `result` 模式下，中间舞台顶部还应出现：

- 执行摘要条
- 已完成动作清单
- 继续处理或重新处理的快捷入口

### 4.4 右侧 AI 副驾驶

右侧应该变成“行动面板”，而不是普通聊天框。

建议固定结构：

- 顶部：当前处理上下文摘要 + 重新开始按钮（非会话管理）
- 中部：交互消息流（仅用于本次处理）
- 结果阶段：结构化计划卡 / 结果总结卡 / 建议后续问题
- 底部：固定输入器和发送按钮

### 4.5 空态模式

空态不再只强调“上传文件”，而是做成能力入口：

- 官方能力矩阵（必须显式区分“当前可承接”与“预留能力”，预留项只做示例提示词，不承诺已实现）
- 行业场景 chips
- 主上传区
- 右侧仍保留 AI 面板骨架

---

## 5. Target File Layout

```txt
apps/web/src/
  App.vue
  style.css
  api.ts
  config/
    workbenchCatalog.ts              # new
  composables/
    useWorkbenchNavigation.ts        # new
    useWorkbenchSession.ts
    useTaskHistory.ts
  components/
    workbench/
      WorkbenchSidebar.vue           # new
      CapabilityMatrix.vue           # new
      ScenarioPromptChips.vue        # new
      PromptComposer.vue             # new
      TaskSummaryCard.vue            # new
      SuggestedNextActions.vue       # new
      WorkspaceHeader.vue
      EmptyDashboard.vue
      FileContextPanel.vue
      PreviewStage.vue
      ResultStage.vue
      AiCopilotPanel.vue
      RecentTasksPanel.vue
```

说明：

- 本轮新增的文件都只在前端
- 不强行新增服务端 API
- 模板、能力矩阵、行业场景先用本地静态配置承接

---

## 6. Task Breakdown

### Task 1: 引入工作台导航状态与市场参照配置

**Files:**
- Create: [apps/web/src/config/workbenchCatalog.ts](/D:/work/my-test/excel-to-ai/apps/web/src/config/workbenchCatalog.ts)
- Create: [apps/web/src/composables/useWorkbenchNavigation.ts](/D:/work/my-test/excel-to-ai/apps/web/src/composables/useWorkbenchNavigation.ts)
- Modify: [apps/web/src/App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue)

**Step 1: 创建市场参照配置文件**

在 [apps/web/src/config/workbenchCatalog.ts](/D:/work/my-test/excel-to-ai/apps/web/src/config/workbenchCatalog.ts) 中定义：

- 左侧导航 section
- 官方能力矩阵分组
- 行业场景模板 chips
- 右侧建议继续提问列表

**Step 2: 创建本地导航 composable**

在 [apps/web/src/composables/useWorkbenchNavigation.ts](/D:/work/my-test/excel-to-ai/apps/web/src/composables/useWorkbenchNavigation.ts) 中管理：

- 当前 section
- section 切换方法
- dashboard / draft / running / result 模式与 section 的组合规则

**Step 3: 在 [App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue) 中接入导航状态**

- 让左侧不再只接 `RecentTasksPanel`
- 为中间区和右侧区准备 section 级别的内容切换能力

**Step 4: 运行类型检查**

Run:

```bash
pnpm --filter @excel-to-ai/web typecheck
```

Expected:

- 通过

---

### Task 2: 将左侧区域升级为“导航轨”，而不是“任务列表”

**Files:**
- Create: [apps/web/src/components/workbench/WorkbenchSidebar.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/WorkbenchSidebar.vue)
- Modify: [apps/web/src/components/workbench/RecentTasksPanel.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/RecentTasksPanel.vue)
- Modify: [apps/web/src/App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue)
- Modify: [apps/web/src/style.css](/D:/work/my-test/excel-to-ai/apps/web/src/style.css)

**Step 1: 新建工作台侧栏组件**

在 [apps/web/src/components/workbench/WorkbenchSidebar.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/WorkbenchSidebar.vue) 中实现：

- 工作台
- 模板库
- 最近任务
- 当前文件

这 4 类导航入口。

**Step 2: 把 [RecentTasksPanel.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/RecentTasksPanel.vue) 降级为侧栏里的一个 section**

- 保持任务回看能力
- 继续使用轻量化历史导航轨样式
- 不再让它单独撑起整列布局

**Step 3: 在 [style.css](/D:/work/my-test/excel-to-ai/apps/web/src/style.css) 中固定三栏角色**

- 左侧更窄
- 中间更重
- 右侧保持固定副驾驶宽度

**Step 4: 手动验证**

- dashboard 模式下左侧是导航轨而不是单独卡片区
- result 模式下仍可以从侧栏快速切换历史任务

---

### Task 3: 把空态升级成“能力入口页”

**Files:**
- Create: [apps/web/src/components/workbench/CapabilityMatrix.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/CapabilityMatrix.vue)
- Create: [apps/web/src/components/workbench/ScenarioPromptChips.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/ScenarioPromptChips.vue)
- Modify: [apps/web/src/components/workbench/EmptyDashboard.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/EmptyDashboard.vue)
- Modify: [apps/web/src/App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue)

**Step 1: 实现官方能力矩阵**

在 [CapabilityMatrix.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/CapabilityMatrix.vue) 中展示 4 组能力：

- 数据清洗
- 数据运算
- 数据分析（预留：仅提供示例提示词，不承诺已实现）
- 图表生成（预留：仅提供示例提示词，不承诺已实现）

注意：这里只是 UI 入口，不等于后端已全部实现。

**Step 2: 实现场景模板 chips**

在 [ScenarioPromptChips.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/ScenarioPromptChips.vue) 中展示行业场景：

- 员工工资整理
- 订单管理
- 流量趋势准备
- 成绩整理
- 广告渠道整理

点击后只回填到现有请求输入框。

**Step 3: 重做 [EmptyDashboard.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/EmptyDashboard.vue)**

- 保留主上传区
- 引入能力矩阵
- 引入场景 chips
- 保持空态也是工作台的一部分，而不是单独首页

**Step 4: 构建验证**

Run:

```bash
pnpm build:web
```

Expected:

- 通过

---

### Task 4: 强化中间数据舞台的“结果感”和“继续处理感”

**Files:**
- Create: [apps/web/src/components/workbench/TaskSummaryCard.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/TaskSummaryCard.vue)
- Modify: [apps/web/src/components/workbench/FileContextPanel.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/FileContextPanel.vue)
- Modify: [apps/web/src/components/workbench/PreviewStage.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/PreviewStage.vue)
- Modify: [apps/web/src/components/workbench/ResultStage.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/ResultStage.vue)

**Step 1: 给中间区增加一级 tab 语义**

把中间舞台明确成：

- 文件预览
- 处理结果

不要只在结果阶段才看到 tab。

**Step 2: 增加任务摘要卡**

在 [TaskSummaryCard.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/TaskSummaryCard.vue) 中总结：

- 做了什么
- 修改了多少行
- 失败多少条
- 是否可继续追问

**Step 3: 改造 [ResultStage.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/ResultStage.vue)**

- 把结果指标卡和 tab 做得更像产品态而不是开发态
- 在结果顶部展示更短、更像“结论卡”的摘要
- 给继续处理留出入口

**Step 4: 手动验证**

- 预览和结果 tab 切换清晰
- 用户能一眼知道“刚才做了什么”
- 用户能继续下一轮处理，而不是只下载后离开

---

### Task 5: 把右侧 AI 面板升级成“任务副驾驶”

**Files:**
- Create: [apps/web/src/components/workbench/PromptComposer.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/PromptComposer.vue)
- Create: [apps/web/src/components/workbench/SuggestedNextActions.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/SuggestedNextActions.vue)
- Modify: [apps/web/src/components/workbench/AiCopilotPanel.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/AiCopilotPanel.vue)
- Modify: [apps/web/src/composables/useWorkbenchSession.ts](/D:/work/my-test/excel-to-ai/apps/web/src/composables/useWorkbenchSession.ts)

**Step 1: 拆出固定输入器**

在 [PromptComposer.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/PromptComposer.vue) 中承接：

- 输入框
- 发送按钮
- 模板快捷操作
- 可能的模式切换位

**Step 2: 加结构化结果卡**

在 [AiCopilotPanel.vue](/D:/work/my-test/excel-to-ai/apps/web/src/components/workbench/AiCopilotPanel.vue) 中引入：

- 计划清单
- 结果总结
- 建议继续操作

**Step 3: 在 [useWorkbenchSession.ts](/D:/work/my-test/excel-to-ai/apps/web/src/composables/useWorkbenchSession.ts) 中补充面板所需派生数据**

例如：

- `suggestedNextPrompts`
- `executionSummaryText`
- `planChecklist`

**Step 4: 运行类型检查**

Run:

```bash
pnpm --filter @excel-to-ai/web typecheck
```

Expected:

- 通过

---

### Task 6: 收口中文产品文案、手动 QA 与文档说明

**Files:**
- Modify: [apps/web/src/App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue)
- Modify: [apps/web/src/style.css](/D:/work/my-test/excel-to-ai/apps/web/src/style.css)
- Modify: [docs/archive/plans/2026-03-19-product-ui-rebuild-design.md](/D:/work/my-test/excel-to-ai/docs/archive/plans/2026-03-19-product-ui-rebuild-design.md)
- Modify: [docs/plans/2026-03-19-market-ui-benchmark-upgrade-plan.md](/D:/work/my-test/excel-to-ai/docs/plans/2026-03-19-market-ui-benchmark-upgrade-plan.md)

**Step 1: 清理仍然偏“说明页”的中文文案**

- 少写解释型长段落
- 多写动作型文案
- 让用户一眼知道“现在能做什么”

**Step 2: 把旧计划文档和新市场参照文档建立关系**

在 [2026-03-19-product-ui-rebuild-design.md](/D:/work/my-test/excel-to-ai/docs/archive/plans/2026-03-19-product-ui-rebuild-design.md) 中补一段说明（旧计划文档已归档到 `docs/archive/plans`）：

- 第一份文档负责骨架重构
- 第二份文档负责市场参照下的产品化升级

**Step 3: 跑最终构建**

Run:

```bash
pnpm build:web
```

Expected:

- 通过
- 允许保留现有大包 warning

**Task 6 收口结果（2026-03-22）**

- 已收短当前工作台顶部动作文案，把“先解释产品”改成“先做什么”。
- 已确认归档骨架文档与市场参照升级文档的边界关系，归档文档只补关系说明，不重复维护文案清单。
- 已在当前分支 `codex/task-6-copy-qa-docs` 基于 Task 5 修复后的 UI 形态走查 QA checklist。
- 最终构建以 `pnpm build:web` 通过收口，保留既有大包 warning。

---

## 7. Manual QA Checklist

- [x] 空态进入后，用户先看到“能力入口 + 上传入口”，没有退回说明页堆字。
- [x] 左侧保持导航轨语义，不再表现为孤立任务列表。
- [x] 中间区域仍是最强视觉中心，预览与结果两条主舞台都保留明显层级。
- [x] 右侧副驾驶在 `dashboard / draft / running / result` 四种模式下保持统一结构，Task 5 修复后历史结果恢复也不再误显示“待执行”。
- [x] 上传文件后，预览仍在主视区首屏附近，不需要长距离滚动才能看到。
- [x] 结果完成后，用户除了下载，还能看到继续处理入口与建议动作。
- [x] 最近任务切换后，中间区与右侧副驾驶内容可同步恢复。
- [x] 窄屏下降级路径保持三栏退化，不出现明显职责混乱。

---

## 8. Risks And Guardrails

- 风险：借鉴 ChatExcel 容易滑向“产品矩阵复制”
  约束：本轮只借 UI 结构和交互层次，不借功能边界
- 风险：为了做“像成熟产品”而虚构后端能力
  约束：所有模板、场景、建议动作先基于现有 API 可承接的能力
- 风险：左侧导航过度产品化，但数据不够支撑
  约束：第一阶段左侧可以是本地 section 和当前文件摘要，不强行做“我的文件中心”
- 风险：中间区和右侧区职责再次混淆
  约束：中间永远展示数据，右侧永远负责理解、计划、总结与继续操作

---

## 9. Recommended Execution Order

1. 先做 `Task 1`，把导航状态和本地目录配置立起来
2. 再做 `Task 2`，把左侧从“任务列”升级为“导航轨”
3. 接着做 `Task 3`，把空态做成能力入口页
4. 再做 `Task 4`，强化中间数据舞台
5. 然后做 `Task 5`，把右侧 AI 面板升级成任务副驾驶
6. 最后做 `Task 6`，统一文案、补文档、跑 QA

---

## 10. Decision Summary

一句话结论：

`excel-to-ai` 下一阶段不应该只是“把当前页面排得更好看”，而是要借鉴 ChatExcel、Rows、Gemini Sheets、Copilot in Excel 的成熟模式，把产品收敛为一个“可回看任务的中文 Excel 智能处理工作台”。

补充说明：本轮升级优先做 UI 叙事与交互层次的成熟表达，不把“数据分析 / 图表生成 / 真实会话管理”等能力写成当前已交付功能；这些能力只能以“预留”或“示例提示词”形式出现。



