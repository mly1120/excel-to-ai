# Excel to AI MVP Architecture Design

**Goal:** 构建一个前后端分离的 Excel 智能处理 Web 应用，支持上传 Excel、预览 Sheet、生成 AI 处理计划、执行规则并导出新文件。

**Recommended Stack:** `pnpm workspace` + `Vue 3` + `TypeScript` + `Vite` + `Element Plus` + `Node.js` + `TypeScript` + `Fastify` + `zod` + `xlsx` + `SQLite`

---

## 1. Final Decisions

### 1.1 Product Boundary

MVP 聚焦主链路：

- 上传单个 Excel 文件
- 支持读取 `.xlsx` 和 `.xls`
- 选择一个 Sheet
- 预览前 20 行
- 输入自然语言需求
- 由 AI 生成结构化计划
- 用户确认后执行规则
- 预览变更结果
- 导出新的 `.xlsx` 文件

MVP 暂不实现：

- 多用户和权限系统
- 历史任务中心
- 超大文件队列系统
- 宏、图表、透视表等复杂 Excel 资产保真
- 浏览器端直接调用 AI

### 1.2 Architecture Choice

采用前后端分离的 monorepo：

```txt
excel-to-ai/
  apps/
    web/
    server/
  packages/
    shared/
  docs/
    plans/
  uploads/
  outputs/
```

原因：

- Excel 解析、AI 调用、规则执行、导出和审计都应该由服务端统一负责
- 前后端共享类型和 schema，降低联调成本
- 后续拆分 worker 或替换 AI provider 更容易

### 1.3 AI Strategy

平台统一管理 AI Key，前端不直接调用模型。

所有 AI 请求都走服务端，分成两层：

- `generatePlan`：根据列名、样例数据和用户需求生成结构化计划
- `transformCells`：针对必须使用 AI 的字段按批次处理

---

## 2. Technology Choices

### 2.1 Frontend

- `Vue 3`
- `TypeScript`
- `Vite`
- `Vue Router`
- `Pinia`
- `Element Plus`
- `Axios`

推荐做成单页 4 步流程：

1. 上传文件
2. 预览与需求输入
3. AI 计划确认
4. 执行结果与下载

不建议前端自行解析 Excel。前端只负责：

- 上传文件
- 展示 Sheet 列表和预览
- 提交用户需求
- 展示 AI 计划
- 展示执行结果与差异摘要

### 2.2 Backend

- `Node.js 20+`
- `TypeScript`
- `Fastify`
- `@fastify/multipart`
- `zod`
- `xlsx`
- `better-sqlite3`
- `drizzle-orm`

不建议首期使用 Java、NestJS 或 Next.js API Routes：

- Java 对当前 MVP 偏重
- NestJS 会引入较多框架样板
- Next.js 不如独立服务适合后续文件处理和批任务演进

### 2.3 Storage

MVP 存储方式：

- `uploads/`：原始上传文件
- `outputs/`：导出结果文件
- `SQLite`：文件记录、任务记录、AI 计划、执行日志、错误记录

---

## 3. Core Data Model

### 3.1 Parsed Sheet

统一内部数据结构，不为 `.xls` 和 `.xlsx` 分别定义业务模型：

```ts
export interface ExcelRow {
  __rowIndex: number;
  [key: string]: unknown;
}

export interface ParsedSheet {
  sheetName: string;
  columns: string[];
  rows: ExcelRow[];
  total: number;
}
```

读取策略：

- 使用 `xlsx` 统一读取 `.xlsx` 和 `.xls`
- 读取后归一化为统一 `ParsedSheet`
- 后续预览、AI、执行器、导出只面向统一结构

导出策略：

- MVP 统一导出 `.xlsx`

### 3.2 AI Plan Schema

放在 `packages/shared`，前后端共享：

```ts
type Operation =
  | { type: 'trim'; column: string }
  | { type: 'format_number'; column: string; digits: number }
  | {
      type: 'derive_column';
      sourceColumn: string;
      targetColumn: string;
      method: 'regex' | 'mapping' | 'ai_extract';
      instruction: string;
    }
  | {
      type: 'delete_rows';
      condition: {
        column: string;
        operator: 'is_empty' | 'equals' | 'not_equals';
        value?: string;
      };
    }
  | { type: 'deduplicate'; column: string; keep: 'first' | 'last' }
  | { type: 'map_values'; column: string; mapping: Record<string, string> }
  | {
      type: 'ai_transform';
      sourceColumn: string;
      targetColumn: string;
      instruction: string;
    };

interface AiPlan {
  summary: string;
  operations: Operation[];
  warnings: string[];
}
```

MVP 执行器必须支持：

- `trim`
- `format_number`
- `delete_rows`
- `deduplicate`
- `map_values`
- `derive_column`

`ai_transform` 保留接口，但是否首期开放可在实现阶段再决定。

---

## 4. Service Boundaries

### 4.1 packages/shared

职责：

- `zod` schema
- TypeScript 类型
- API 请求响应 DTO
- 错误码常量

### 4.2 apps/server

建议模块：

```txt
apps/server/src/
  modules/
    files/
    excel/
    ai/
    executor/
    tasks/
    export/
  db/
  providers/
  utils/
```

模块职责：

- `files`: 上传、文件元信息、路径管理
- `excel`: Workbook 读取、Sheet 归一化、预览生成
- `ai`: prompt 组装、provider 调用、plan 解析和校验
- `executor`: 规则校验、规则执行、差异统计
- `tasks`: 任务状态、执行日志、失败记录
- `export`: 输出新 workbook 和报告 sheet

### 4.3 apps/web

建议模块：

```txt
apps/web/src/
  pages/
  components/
  stores/
  services/
  types/
```

前端状态建议拆分为：

- `fileSessionStore`: 当前文件、Sheet、预览
- `planStore`: 用户需求、AI 计划、warnings
- `taskStore`: 执行状态、结果摘要、下载链接

---

## 5. End-to-End Data Flow

### 5.1 Upload and Preview

流程：

1. 前端上传文件到 `POST /api/files/upload`
2. 服务端保存文件，读取 workbook
3. 服务端返回：
   - `fileId`
   - `fileName`
   - `sheets`
   - `defaultSheet`
   - `defaultPreview`
4. 前端直接渲染默认 Sheet 预览

这样避免“上传成功后还要立即补一次预览请求”的额外等待。

### 5.2 Generate Plan

前端请求：

```json
{
  "fileId": "file_xxx",
  "sheetName": "Sheet1",
  "userRequest": "去掉手机号空格，把金额保留两位小数，并新增省份列"
}
```

服务端补充上下文后发送给 AI：

```json
{
  "task": "generate_plan",
  "sheet": {
    "name": "Sheet1",
    "totalRows": 1000,
    "columns": ["姓名", "手机号", "地址", "金额"]
  },
  "sampleRows": [
    {
      "__rowIndex": 2,
      "姓名": "张三",
      "手机号": " 13800138000 ",
      "地址": "广东省深圳市南山区",
      "金额": "12.5"
    }
  ],
  "userRequest": "去掉手机号空格，把金额保留两位小数，并新增省份列",
  "allowedOperations": [
    "trim",
    "format_number",
    "delete_rows",
    "deduplicate",
    "map_values",
    "derive_column",
    "ai_transform"
  ]
}
```

约束：

- 前端不直接调用 AI
- 服务端不发送整份 Excel
- 只发送必要样例和列结构
- 返回结果必须通过 `zod` 校验

### 5.3 Execute Plan

执行流程：

1. 前端提交确认后的 `plan`
2. 服务端校验 plan schema
3. 校验涉及列是否存在
4. 复制 `workingRows`
5. 执行确定性规则
6. 如存在 AI 字段操作，按批次调用 `transformCells`
7. 生成差异摘要和错误记录
8. 输出结果文件
9. 返回任务结果和下载地址

AI 字段批处理输入建议：

```json
{
  "task": "transform_cells",
  "operation": {
    "type": "derive_column",
    "sourceColumn": "地址",
    "targetColumn": "省份",
    "instruction": "从地址中提取省级行政区"
  },
  "batch": [
    { "rowIndex": 2, "value": "广东省深圳市南山区科技园" },
    { "rowIndex": 3, "value": "浙江省杭州市西湖区文三路" }
  ]
}
```

---

## 6. API Design

### 6.1 Upload File

`POST /api/files/upload`

响应建议：

```json
{
  "fileId": "file_xxx",
  "fileName": "客户数据.xls",
  "sheets": ["Sheet1", "Sheet2"],
  "defaultSheet": "Sheet1",
  "defaultPreview": {
    "columns": ["姓名", "手机号", "地址", "金额"],
    "rows": [],
    "total": 1000
  }
}
```

### 6.2 Get Preview

`GET /api/files/:fileId/sheets/:sheetName/preview`

### 6.3 Generate AI Plan

`POST /api/ai/plan`

### 6.4 Execute Task

`POST /api/tasks/execute`

### 6.5 Get Task Result

`GET /api/tasks/:taskId/result`

### 6.6 Download Output

`GET /api/tasks/:taskId/download`

---

## 7. Database Design

MVP 建议最少包含 4 张表：

- `files`
- `file_sheets`
- `tasks`
- `task_failures`

### 7.1 files

- `id`
- `original_name`
- `stored_path`
- `file_ext`
- `file_size`
- `sheet_names`
- `created_at`

### 7.2 file_sheets

- `id`
- `file_id`
- `sheet_name`
- `columns_json`
- `preview_rows_json`
- `total_rows`

MVP 不建议把全量行数据直接存数据库。全量解析结果可临时驻留内存或落到中间 JSON 文件，后续再优化。

### 7.3 tasks

- `id`
- `file_id`
- `sheet_name`
- `user_request`
- `ai_plan_json`
- `status`
- `changed_rows`
- `failed_rows`
- `output_path`
- `summary_json`
- `created_at`
- `finished_at`

### 7.4 task_failures

- `id`
- `task_id`
- `row_index`
- `operation_type`
- `reason`

---

## 8. Error Handling and Security

### 8.1 Error Codes

建议统一错误码：

- `UNSUPPORTED_FILE_TYPE`
- `FILE_TOO_LARGE`
- `FILE_NOT_FOUND`
- `SHEET_NOT_FOUND`
- `EMPTY_HEADER_ROW`
- `INVALID_AI_PLAN`
- `UNKNOWN_OPERATION`
- `COLUMN_NOT_FOUND`
- `AI_REQUEST_FAILED`
- `EXPORT_FAILED`

### 8.2 Security Rules

- 平台统一 AI Key，仅服务端持有
- 禁止前端直连模型
- 禁止执行模型返回代码
- 禁止 AI 输出未在白名单内的操作
- 对 plan 和字段结果都做 schema 校验
- 仅向 AI 发送必要列和必要样例
- 原始文件只读，永不覆盖

### 8.3 Privacy Notice

上传页面必须提示：

- 表格内容可能被发送给 AI 做规则生成或字段处理
- 不建议上传高敏感数据
- 后续可扩展脱敏模式

---

## 9. Implementation Phases

### Phase 1: Main Flow MVP

完成：

- 项目脚手架
- 文件上传
- Workbook 读取
- Sheet 预览
- AI 计划生成
- 规则执行器
- 结果导出

### Phase 2: Usability Improvements

完成：

- 差异预览
- 失败行明细
- 操作影响统计
- 指定列 AI 处理

### Phase 3: Stability Improvements

完成：

- 异步任务化
- 分批处理
- 历史记录
- 脱敏模式
- 限流和配额

---

## 10. Recommended Next Step

下一步建议不是直接写业务代码，而是先落两份文档：

1. `docs/api.md`
   - 固化接口定义
   - 固化错误码
   - 固化响应结构

2. `docs/prompts.md`
   - 固化 plan prompt
   - 固化 cell transform prompt
   - 固化 schema 约束和输出示例

文档定稳后，再进入详细 implementation plan 和脚手架搭建阶段。
