# Excel to AI Product UI Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前“表单式单页工具”重构为“预览主导、AI 对话副驾驶、任务可回看”的产品化工作台，同时保留现有服务端受控执行链路。

**Architecture:** 第一阶段不引入新前端框架层，不上 `Vue Router`、`Pinia`、真实多会话聊天后端。继续保持单页应用，但把当前 [App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue) 拆成工作台组件和状态组合函数。AI 对话区只作为交互壳层，底层仍然复用现有 `/api/ai/plan`、`/api/tasks/execute`、`/api/tasks/:taskId/result`；服务端只补“最近任务列表”和“任务上下文字段”，支撑刷新恢复和历史回看。

**Tech Stack:** `Vue 3` + `TypeScript` + `Vite` + `Element Plus` + `Axios` + `Fastify` + `zod` + `pnpm workspace`

---

## 0. 文档关系说明（2026-03-19）

- 第一份文档（本文）负责“工作台骨架重构”：完成组件拆分、状态重组与基础交互链路收敛。
- 第二份文档 [docs/plans/2026-03-19-market-ui-benchmark-upgrade-plan.md](/D:/work/my-test/excel-to-ai/docs/plans/2026-03-19-market-ui-benchmark-upgrade-plan.md) 负责“市场参照下的产品化升级”：在骨架稳定后统一信息架构、文案语义与成熟产品表达。
- 执行顺序保持“先骨架、后升级”；第二份文档不改写第一份已确认的功能边界。
- 2026-03-22 补充：最终中文文案收口、手动 QA 记录与最终构建结果统一回填到第二份市场参照文档；本文继续只维护骨架层设计结论，不重复维护逐项 UI 文案清单。

---

## 1. Product Decisions

### 1.1 重构目标

- 主视觉从“输入控件”切到“Excel 预览和变化结果”
- 用户主要通过对话输入需求，但不需要理解规则 JSON
- AI 仍然只负责理解需求，程序仍然负责执行和导出
- 页面刷新后可以恢复最近任务，不丢失正在执行或刚执行完成的结果
- 同一页面能看到最近任务，形成“可持续使用”的产品感

### 1.2 第一阶段不做

- 不做真实聊天会话服务，不新增 `/api/ai/chat`
- 不做多页面路由系统
- 不做登录、用户空间、多租户
- 不做复杂模板市场
- 不在本轮引入前端单元测试框架

### 1.3 交互模型

- 顶部：文件、工作表、任务状态、主操作
- 中间主区域：Excel 预览 / 处理后预览 / 变更对比 / 失败记录
- 右侧面板：AI 对话区，支持自然语言输入、AI 回复、计划确认、执行反馈
- 辅助区域：最近任务列表、继续上次任务、查看历史结果

### 1.4 技术约束

- 保持平台统一 Key，不允许前端直连模型
- 保持后端解析 Excel、后端执行任务、后端导出结果
- 现有异步任务机制继续复用
- 所有用户可见文本继续使用中文

---

## 2. Target File Layout

```txt
apps/web/src/
  App.vue
  api.ts
  style.css
  components/
    workbench/
      WorkspaceHeader.vue
      FileContextPanel.vue
      PreviewStage.vue
      ResultStage.vue
      AiCopilotPanel.vue
      RecentTasksPanel.vue
      EmptyDashboard.vue
  composables/
    useWorkbenchSession.ts
    useTaskHistory.ts

packages/shared/src/
  api.ts
  index.ts

apps/server/src/
  app.ts
  app.test.ts
  db/repository.ts

docs/
  api.md
```

说明：

- 当前前端文件过于集中，第一步必须拆组件，否则这轮 UI 重构会继续把 [App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue) 做成不可维护的大文件
- 组件命名围绕“工作台”语义，不再沿用“上传区/计划区/结果区”这种流程页语义

---

## 3. State Model

### 3.1 前端状态

前端工作台需要明确区分这 4 类状态：

- `dashboard`：无当前文件，展示最近任务、上传入口、示例需求
- `draft`：已有文件和预览，尚未执行任务
- `running`：任务已提交，轮询中
- `result`：已有任务结果，可下载、回看、切换历史任务

建议状态结构：

```ts
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  status?: "streaming" | "done" | "error";
};

type RecentTaskItem = {
  taskId: string;
  fileId: string;
  fileName: string;
  sheetName: string;
  userRequest: string;
  status: TaskStatus;
  changedRows: number;
  failedRows: number;
  createdAt: string;
  finishedAt: string | null;
};
```

### 3.2 服务端返回扩展

最近任务和任务详情必须带出这些上下文字段：

- `fileId`
- `fileName`
- `sheetName`
- `userRequest`
- `createdAt`
- `finishedAt`

否则刷新后只能拿到执行结果，拿不到“这是什么任务”的业务语义。

---

## 4. Task Breakdown

### Task 1: 扩展任务 API，补齐最近任务与上下文字段

**Files:**
- Modify: [packages/shared/src/api.ts](/D:/work/my-test/excel-to-ai/packages/shared/src/api.ts)
- Modify: [packages/shared/src/index.ts](/D:/work/my-test/excel-to-ai/packages/shared/src/index.ts)
- Modify: [apps/server/src/db/repository.ts](/D:/work/my-test/excel-to-ai/apps/server/src/db/repository.ts)
- Modify: [apps/server/src/app.ts](/D:/work/my-test/excel-to-ai/apps/server/src/app.ts)
- Modify: [apps/server/src/app.test.ts](/D:/work/my-test/excel-to-ai/apps/server/src/app.test.ts)
- Modify: [docs/api.md](/D:/work/my-test/excel-to-ai/docs/api.md)

**Step 1: 写后端失败测试，覆盖最近任务列表和结果上下文**

在 [apps/server/src/app.test.ts](/D:/work/my-test/excel-to-ai/apps/server/src/app.test.ts) 增加场景：

- `GET /api/tasks` 返回最近任务列表
- `GET /api/tasks/:taskId/result` 返回 `fileId/fileName/sheetName/userRequest`
- 列表按 `createdAt` 倒序

**Step 2: 运行目标测试，确认当前失败**

Run:

```bash
pnpm --filter @excel-to-ai/server test
```

Expected:

- 新增断言失败
- 或缺少字段 / 缺少接口

**Step 3: 扩展共享 schema**

在 [packages/shared/src/api.ts](/D:/work/my-test/excel-to-ai/packages/shared/src/api.ts) 增加：

```ts
export const recentTaskItemSchema = z.object({
  taskId: z.string(),
  fileId: z.string(),
  fileName: z.string(),
  sheetName: z.string(),
  userRequest: z.string(),
  status: taskStatusSchema,
  changedRows: z.number().int().nonnegative(),
  failedRows: z.number().int().nonnegative(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
```

并为 `taskResultResponseSchema` 增加上下文字段。

**Step 4: 实现任务查询能力**

在 [apps/server/src/db/repository.ts](/D:/work/my-test/excel-to-ai/apps/server/src/db/repository.ts) 增加：

- `listTasks()`
- 如有必要，增加按 `file_id` 关联文件记录的 helper

在 [apps/server/src/app.ts](/D:/work/my-test/excel-to-ai/apps/server/src/app.ts) 新增：

- `GET /api/tasks`

返回最近 20 条任务，按创建时间倒序。

**Step 5: 扩展结果接口**

修改 [apps/server/src/app.ts](/D:/work/my-test/excel-to-ai/apps/server/src/app.ts) 中的任务结果返回：

- 附带文件名、工作表、用户请求
- 保持当前 preview / failures / downloadUrl 行为不变

**Step 6: 运行测试并修正文档**

Run:

```bash
pnpm --filter @excel-to-ai/server test
```

Expected:

- 新老测试全部通过

**Step 7: Commit**

```bash
git add packages/shared/src/api.ts packages/shared/src/index.ts apps/server/src/db/repository.ts apps/server/src/app.ts apps/server/src/app.test.ts docs/api.md
git commit -m "feat: add task history api for workbench ui"
```

### Task 2: 拆分前端工作台骨架，结束单文件堆叠

**Files:**
- Modify: [apps/web/src/App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue)
- Create: `apps/web/src/components/workbench/WorkspaceHeader.vue`
- Create: `apps/web/src/components/workbench/EmptyDashboard.vue`
- Create: `apps/web/src/components/workbench/FileContextPanel.vue`
- Create: `apps/web/src/components/workbench/PreviewStage.vue`
- Create: `apps/web/src/components/workbench/ResultStage.vue`
- Create: `apps/web/src/components/workbench/AiCopilotPanel.vue`
- Create: `apps/web/src/components/workbench/RecentTasksPanel.vue`
- Create: `apps/web/src/composables/useWorkbenchSession.ts`
- Modify: [apps/web/src/style.css](/D:/work/my-test/excel-to-ai/apps/web/src/style.css)

**Step 1: 先抽状态，再抽视图**

不要先拆模板。先在 `apps/web/src/composables/useWorkbenchSession.ts` 收敛这些状态：

- 文件上传与预览
- 用户需求输入
- AI 计划生成
- 任务提交与轮询
- 当前任务恢复

**Step 2: 保持 App.vue 只负责装配**

[apps/web/src/App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue) 应只保留：

- imports
- `useWorkbenchSession()`
- `useTaskHistory()`
- 页面级布局

目标：脚本区尽量控制在 120 行内。

**Step 3: 创建页面骨架组件**

组件职责：

- `WorkspaceHeader.vue`：顶部产品标题、文件上下文、任务状态、主按钮
- `EmptyDashboard.vue`：空状态、上传入口、示例需求、最近任务摘要
- `PreviewStage.vue`：原始表格预览、结果标签切换入口
- `ResultStage.vue`：结果预览、差异对比、失败记录、下载
- `AiCopilotPanel.vue`：聊天记录、输入框、计划确认、执行按钮
- `RecentTasksPanel.vue`：最近任务列表和点击切换

**Step 4: 用工作台语义重写布局**

布局目标：

- 左窄列：最近任务
- 中宽列：预览和结果
- 右窄列：AI 副驾驶

而不是当前的“上半表单、下半结果”。

**Step 5: 跑类型检查**

Run:

```bash
pnpm --filter @excel-to-ai/web typecheck
```

Expected:

- 所有新组件和组合函数类型通过

**Step 6: Commit**

```bash
git add apps/web/src/App.vue apps/web/src/components/workbench apps/web/src/composables/useWorkbenchSession.ts apps/web/src/style.css
git commit -m "refactor: split workbench ui into components"
```

### Task 3: 实现“预览主导 + AI 对话副驾驶”交互

**Files:**
- Modify: `apps/web/src/components/workbench/AiCopilotPanel.vue`
- Modify: `apps/web/src/components/workbench/PreviewStage.vue`
- Modify: `apps/web/src/components/workbench/ResultStage.vue`
- Modify: `apps/web/src/composables/useWorkbenchSession.ts`
- Modify: [apps/web/src/api.ts](/D:/work/my-test/excel-to-ai/apps/web/src/api.ts)

**Step 1: 定义聊天只承载产品语义，不暴露技术细节**

AI 面板消息模板只展示：

- 用户需求
- AI 对需求的自然语言理解
- 将执行的动作摘要
- 执行完成后的结果总结
- 失败或警告说明

不要把原始 `plan` JSON 作为默认可见内容。

**Step 2: 保留“计划确认”，但换成自然语言卡片**

`AiCopilotPanel.vue` 中的计划确认卡片建议结构：

- 标题：AI 将帮你完成这些处理
- 内容：1 到 4 条自然语言动作
- 辅助信息：涉及工作表、预计影响列
- 操作：`确认执行` / `重新描述需求`

**Step 3: 将结果状态回写到聊天区**

任务完成后追加 assistant 消息：

- 成功：`已处理 128 行，修改 87 行，可直接下载结果`
- 部分成功：`已完成主要处理，但有 3 条失败记录需要复核`
- 失败：`任务执行失败，请查看失败原因`

**Step 4: 让预览始终成为主画面**

处理中用户仍应优先看到：

- 当前表格预览
- 结果标签页入口
- 任务状态条

对话区只占辅助宽度，不抢主视觉。

**Step 5: 跑构建**

Run:

```bash
pnpm build:web
```

Expected:

- 构建成功

**Step 6: Commit**

```bash
git add apps/web/src/components/workbench/AiCopilotPanel.vue apps/web/src/components/workbench/PreviewStage.vue apps/web/src/components/workbench/ResultStage.vue apps/web/src/composables/useWorkbenchSession.ts apps/web/src/api.ts
git commit -m "feat: add preview-first ai copilot interaction"
```

### Task 4: 实现最近任务列表与刷新恢复

**Files:**
- Create: `apps/web/src/composables/useTaskHistory.ts`
- Modify: `apps/web/src/components/workbench/RecentTasksPanel.vue`
- Modify: `apps/web/src/composables/useWorkbenchSession.ts`
- Modify: [apps/web/src/api.ts](/D:/work/my-test/excel-to-ai/apps/web/src/api.ts)
- Modify: [apps/web/src/style.css](/D:/work/my-test/excel-to-ai/apps/web/src/style.css)

**Step 1: 加最近任务接口请求**

在 [apps/web/src/api.ts](/D:/work/my-test/excel-to-ai/apps/web/src/api.ts) 增加：

```ts
export async function fetchRecentTasks() {}
```

**Step 2: 建立本地恢复键**

在 `useWorkbenchSession.ts` 使用固定 key：

```ts
const LAST_TASK_STORAGE_KEY = "excel-to-ai:last-task-id";
```

保存时机：

- 任务创建成功
- 用户切换历史任务

恢复时机：

- 页面初始化

**Step 3: 恢复逻辑只恢复“当前任务”，不恢复上传原文件**

刷新后恢复内容：

- 当前任务结果
- 任务状态
- 文件名、工作表、用户需求

不恢复内容：

- 本地 file input
- 未提交的草稿文件对象

这是浏览器安全模型决定的，不能强行恢复。

**Step 4: 最近任务列表支持点击切换**

点击行为：

- 若任务 `pending/running`，进入轮询状态
- 若任务已完成，直接加载结果
- 切换后同步更新聊天摘要和主视图区

**Step 5: 手动验证**

验证场景：

1. 上传文件并执行任务
2. 刷新页面
3. 自动恢复最近任务结果
4. 点击另一条历史任务
5. 主视图区和 AI 面板同步更新

**Step 6: Commit**

```bash
git add apps/web/src/composables/useTaskHistory.ts apps/web/src/components/workbench/RecentTasksPanel.vue apps/web/src/composables/useWorkbenchSession.ts apps/web/src/api.ts apps/web/src/style.css
git commit -m "feat: add recent tasks panel and restore last task"
```

### Task 5: 完成视觉统一和中文产品文案收口

**Files:**
- Modify: [apps/web/src/style.css](/D:/work/my-test/excel-to-ai/apps/web/src/style.css)
- Modify: [apps/web/src/App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue)
- Modify: `apps/web/src/components/workbench/*.vue`

**Step 1: 删除工具感过强的旧文案**

替换以下语义：

- “源数据/计划/结果”这种开发流程词
- “原始计划数据”这种技术词
- “请求失败”这种通用程序词

统一改成：

- 文件
- 当前处理
- AI 建议
- 结果预览
- 失败记录
- 继续处理

**Step 2: 调整视觉层次**

要求：

- 预览区视觉权重最高
- 聊天区卡片化，不要像客服工单系统
- 最近任务区清晰但不抢戏
- 移动端退化为纵向堆叠

**Step 3: 手动走查 4 个页面状态**

- 空状态
- 已上传未执行
- 执行中
- 有结果

**Step 4: 构建和截图自检**

Run:

```bash
pnpm --filter @excel-to-ai/web typecheck
pnpm build:web
```

Expected:

- 类型检查通过
- 构建通过
- 页面四种状态可清晰区分

**Step 5: Commit**

```bash
git add apps/web/src/App.vue apps/web/src/style.css apps/web/src/components/workbench
git commit -m "style: polish productized workbench copy and layout"
```

---

## 5. Manual QA Checklist

- 上传 `.xlsx` / `.xls` 后，主区域优先显示表格预览
- 在 AI 面板输入需求后，返回的是自然语言动作摘要，而不是原始 JSON
- 点击确认执行后，用户能看到执行中状态、任务编号和手动刷新按钮
- 页面刷新后，最近一次任务可以恢复
- 最近任务列表可以切换查看
- 结果页能看到预览、变更对比、失败记录、下载按钮
- 全页面无英文用户文案

---

## 6. Risks And Guardrails

- 风险 1：如果这轮同时上真实聊天后端，范围会失控
  约束：第一阶段只做聊天式 UI，不做新 AI 协议

- 风险 2：如果继续把逻辑堆在 [App.vue](/D:/work/my-test/excel-to-ai/apps/web/src/App.vue)，后续功能会越来越难改
  约束：本轮先拆组件和 composable，再做视觉

- 风险 3：刷新恢复如果依赖浏览器 file 对象，会失败
  约束：只恢复任务，不恢复本地文件句柄

- 风险 4：最近任务接口如果不带业务上下文，前端只能恢复结果，无法恢复语义
  约束：结果接口和列表接口都必须返回文件名、工作表、用户需求

---

## 7. Recommended Execution Order

1. 先做 Task 1，补服务端任务历史和结果上下文字段
2. 再做 Task 2，拆前端骨架
3. 接着做 Task 3，完成 AI 副驾驶交互
4. 然后做 Task 4，补最近任务和刷新恢复
5. 最后做 Task 5，统一视觉和文案

Plan complete and saved to `docs/plans/2026-03-19-product-ui-rebuild-design.md`. Two execution options:

1. Subagent-Driven (this session) - 我在当前会话按任务逐步实现并在关键节点回顾
2. Parallel Session (separate) - 新开会话按该计划批量执行

Which approach?
