# Excel to AI API 设计文档

## 1. 目标

本文档用于固化 Excel to AI MVP 的服务端接口协议，覆盖：

- 文件上传
- Sheet 预览
- AI 计划生成
- 任务执行
- 结果查询
- 文件下载
- 错误码规范

本文档面向：

- 前端开发
- 服务端开发
- AI 调用模块开发
- 测试联调

---

## 2. 通用约定

### 2.1 Base URL

本地开发建议：

```txt
/api
```

示例：

- `POST /api/files/upload`
- `POST /api/ai/plan`

### 2.2 Content-Type

- 文件上传：`multipart/form-data`
- 其他 JSON 接口：`application/json`

### 2.3 响应格式

成功响应：

```json
{
  "success": true,
  "data": {}
}
```

失败响应：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_AI_PLAN",
    "message": "AI 返回的处理计划不符合预期格式",
    "details": {
      "reason": "operations[1].column is required"
    }
  }
}
```

### 2.4 时间格式

统一使用 ISO 8601 字符串，例如：

```txt
2026-03-17T09:30:00.000Z
```

### 2.5 标识符格式

- `fileId`: `file_<uuid or cuid>`
- `taskId`: `task_<uuid or cuid>`

### 2.6 分页约定

MVP 预览接口默认只返回前 20 行，不开放复杂分页。

---

## 3. 核心类型

### 3.1 ExcelRow

```ts
export interface ExcelRow {
  __rowIndex: number;
  [key: string]: unknown;
}
```

### 3.2 PreviewData

```ts
export interface PreviewData {
  columns: string[];
  rows: ExcelRow[];
  total: number;
}
```

### 3.3 Operation

```ts
export type Operation =
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
  | {
      type: 'deduplicate';
      column: string;
      keep: 'first' | 'last';
    }
  | {
      type: 'map_values';
      column: string;
      mapping: Record<string, string>;
    }
  | {
      type: 'ai_transform';
      sourceColumn: string;
      targetColumn: string;
      instruction: string;
    };
```

### 3.4 AiPlan

```ts
export interface AiPlan {
  summary: string;
  operations: Operation[];
  warnings: string[];
}
```

### 3.5 TaskStatus

```ts
export type TaskStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failed';
```

---

## 4. 接口设计

## 4.1 上传文件

### `POST /api/files/upload`

上传 Excel 文件，服务端保存原始文件，解析 workbook，并返回文件信息与默认 Sheet 预览。

### 请求

`multipart/form-data`

字段：

- `file`: Excel 文件

### 约束

- 允许扩展名：`.xlsx`、`.xls`
- 默认最大文件大小：`20MB`
- 服务端应同时校验扩展名和实际文件内容

### 成功响应

```json
{
  "success": true,
  "data": {
    "fileId": "file_01JQ6ABCDEF",
    "fileName": "客户数据.xls",
    "fileSize": 182736,
    "fileExt": ".xls",
    "sheets": ["Sheet1", "Sheet2"],
    "defaultSheet": "Sheet1",
    "defaultPreview": {
      "columns": ["姓名", "手机号", "地址", "金额"],
      "rows": [
        {
          "__rowIndex": 2,
          "姓名": "张三",
          "手机号": " 13800138000 ",
          "地址": "广东省深圳市南山区",
          "金额": "12.5"
        }
      ],
      "total": 1000
    },
    "createdAt": "2026-03-17T09:30:00.000Z"
  }
}
```

### 失败错误码

- `UNSUPPORTED_FILE_TYPE`
- `FILE_TOO_LARGE`
- `INVALID_EXCEL_FILE`
- `EMPTY_WORKBOOK`
- `INTERNAL_SERVER_ERROR`

---

## 4.2 获取 Sheet 预览

### `GET /api/files/:fileId/sheets/:sheetName/preview`

返回指定 Sheet 的预览数据。

### 路径参数

- `fileId`
- `sheetName`

### 查询参数

- `limit`，可选，默认 `20`，最大 `100`

### 成功响应

```json
{
  "success": true,
  "data": {
    "fileId": "file_01JQ6ABCDEF",
    "sheetName": "Sheet1",
    "preview": {
      "columns": ["姓名", "手机号", "地址", "金额"],
      "rows": [
        {
          "__rowIndex": 2,
          "姓名": "张三",
          "手机号": " 13800138000 ",
          "地址": "广东省深圳市南山区",
          "金额": "12.5"
        }
      ],
      "total": 1000
    }
  }
}
```

### 失败错误码

- `FILE_NOT_FOUND`
- `SHEET_NOT_FOUND`
- `INVALID_LIMIT`

---

## 4.3 生成 AI 处理计划

### `POST /api/ai/plan`

根据用户需求、列名和样例数据生成结构化计划。

### 请求体

```json
{
  "fileId": "file_01JQ6ABCDEF",
  "sheetName": "Sheet1",
  "userRequest": "去掉手机号空格，把金额保留两位小数，并新增省份列"
}
```

### 服务端行为

服务端收到请求后：

1. 从文件上下文中读取指定 Sheet
2. 取 `columns`
3. 取 `sampleRows`，默认前 `10` 行非空样例
4. 组装 plan prompt
5. 调用 AI
6. 对返回 JSON 做 schema 校验
7. 返回结构化 `AiPlan`

### 成功响应

```json
{
  "success": true,
  "data": {
    "summary": "清洗手机号、格式化金额并提取省份",
    "operations": [
      { "type": "trim", "column": "手机号" },
      { "type": "format_number", "column": "金额", "digits": 2 },
      {
        "type": "derive_column",
        "sourceColumn": "地址",
        "targetColumn": "省份",
        "method": "ai_extract",
        "instruction": "从地址中提取省级行政区"
      }
    ],
    "warnings": []
  }
}
```

### 失败错误码

- `FILE_NOT_FOUND`
- `SHEET_NOT_FOUND`
- `EMPTY_USER_REQUEST`
- `AI_REQUEST_FAILED`
- `INVALID_AI_RESPONSE`
- `INVALID_AI_PLAN`

---

## 4.4 执行任务

### `POST /api/tasks/execute`

对确认后的计划执行处理，生成结果文件、摘要和错误记录。

### 请求体

```json
{
  "fileId": "file_01JQ6ABCDEF",
  "sheetName": "Sheet1",
  "plan": {
    "summary": "清洗手机号、格式化金额并提取省份",
    "operations": [
      { "type": "trim", "column": "手机号" },
      { "type": "format_number", "column": "金额", "digits": 2 },
      {
        "type": "derive_column",
        "sourceColumn": "地址",
        "targetColumn": "省份",
        "method": "ai_extract",
        "instruction": "从地址中提取省级行政区"
      }
    ],
    "warnings": []
  }
}
```

### 服务端执行顺序

1. 校验 `plan` schema
2. 校验列存在性
3. 基于原始解析结果复制 `workingRows`
4. 执行非 AI 规则
5. 对 AI 操作按批次处理
6. 生成差异摘要
7. 导出结果文件
8. 记录任务日志

### 成功响应

```json
{
  "success": true,
  "data": {
    "taskId": "task_01JQ6XYZABC",
    "status": "success",
    "changedRows": 234,
    "failedRows": 2,
    "downloadUrl": "/api/tasks/task_01JQ6XYZABC/download",
    "createdAt": "2026-03-17T09:35:00.000Z"
  }
}
```

### 失败错误码

- `FILE_NOT_FOUND`
- `SHEET_NOT_FOUND`
- `INVALID_AI_PLAN`
- `UNKNOWN_OPERATION`
- `COLUMN_NOT_FOUND`
- `AI_REQUEST_FAILED`
- `EXPORT_FAILED`

---

## 4.5 获取最近任务列表

### `GET /api/tasks`

返回最近任务列表（默认最新 20 条），用于工作台左侧历史导航、刷新恢复和回看结果。

### 查询参数

- `limit`（可选）：返回数量上限，必须是 `1` 到 `100` 的整数；未传时默认 `20`。

### 服务端行为

- 按 `createdAt` 倒序返回最新任务。
- 任务状态为 `pending` / `running` 时，`finishedAt` 可能为 `null`。

### 成功响应

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "taskId": "task_01JQ6XYZABC",
        "status": "success",
        "fileId": "file_01JQ6ABCDEF",
        "fileName": "contacts.xlsx",
        "sheetName": "Sheet1",
        "userRequest": "去掉手机号前后空格，把金额保留两位小数，并新增省份列。",
        "changedRows": 1,
        "failedRows": 0,
        "createdAt": "2026-03-17T09:35:00.000Z",
        "finishedAt": "2026-03-17T09:36:00.000Z"
      }
    ]
  }
}
```

### 失败错误码

- `INVALID_LIMIT`

---

## 4.6 查询任务结果

### `GET /api/tasks/:taskId/result`

返回任务详情、摘要、失败记录和结果预览。

### 路径参数

- `taskId`

### 成功响应

```json
{
  "success": true,
  "data": {
    "taskId": "task_01JQ6XYZABC",
    "status": "partial_success",
    "summary": {
      "operationCount": 3,
      "changedRows": 234,
      "failedRows": 2,
      "warnings": []
    },
    "preview": {
      "columns": ["姓名", "手机号", "地址", "金额", "省份"],
      "rows": [
        {
          "__rowIndex": 2,
          "姓名": "张三",
          "手机号": "13800138000",
          "地址": "广东省深圳市南山区",
          "金额": "12.50",
          "省份": "广东省"
        }
      ],
      "total": 998
    },
    "changedOnlyPreview": {
      "columns": ["__rowIndex", "before", "after"],
      "rows": []
    },
    "failures": [
      {
        "rowIndex": 37,
        "operationType": "derive_column",
        "reason": "地址为空，无法提取省份"
      }
    ],
    "downloadUrl": "/api/tasks/task_01JQ6XYZABC/download",
    "finishedAt": "2026-03-17T09:36:00.000Z"
  }
}
```

### 失败错误码

- `TASK_NOT_FOUND`

---

## 4.7 下载结果文件

### `GET /api/tasks/:taskId/download`

返回导出后的 `.xlsx` 文件。

### 行为

- 成功时返回文件流
- 设置下载文件名，例如：`客户数据_processed_20260317_173600.xlsx`

### 失败错误码

- `TASK_NOT_FOUND`
- `OUTPUT_NOT_FOUND`

---

## 4.8 健康检查

### `GET /api/health`

用于开发环境、部署探针和本地联调。

### 成功响应

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "time": "2026-03-17T09:40:00.000Z"
  }
}
```

---

## 5. 错误码规范

### 5.1 错误码列表

- `UNSUPPORTED_FILE_TYPE`
- `FILE_TOO_LARGE`
- `INVALID_EXCEL_FILE`
- `EMPTY_WORKBOOK`
- `FILE_NOT_FOUND`
- `SHEET_NOT_FOUND`
- `INVALID_LIMIT`
- `EMPTY_USER_REQUEST`
- `INVALID_AI_RESPONSE`
- `INVALID_AI_PLAN`
- `UNKNOWN_OPERATION`
- `COLUMN_NOT_FOUND`
- `AI_REQUEST_FAILED`
- `TASK_NOT_FOUND`
- `OUTPUT_NOT_FOUND`
- `EXPORT_FAILED`
- `INTERNAL_SERVER_ERROR`

### 5.2 建议 HTTP 状态码

- `400`：请求参数错误、plan 不合法
- `404`：文件、Sheet、任务或输出文件不存在
- `413`：文件过大
- `422`：AI 返回结构不合法
- `500`：系统内部错误
- `502`：AI provider 调用失败

---

## 6. 前端联调建议

前端状态流建议：

1. 上传文件，拿到 `fileId + sheets + defaultPreview`
2. 选择 Sheet 时拉取 preview
3. 提交自然语言需求，拿到 `AiPlan`
4. 用户确认后提交执行
5. 轮询或直接拉取任务结果
6. 下载导出文件

前端不要做以下事情：

- 不自行解析 Excel
- 不自行校验 plan schema
- 不直接调用 AI provider
- 不拼接下载文件真实存储路径

---

## 7. 后续可扩展点

- 增加 `GET /api/files/:fileId` 查询文件详情
- 增强任务列表接口：分页/筛选/按文件聚合、按状态过滤等
- 增加异步任务轮询和进度接口
- 增加脱敏模式开关
- 增加“仅查看变更行”的专用 preview 接口
