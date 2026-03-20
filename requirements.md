# Excel to AI 表格智能修改系统需求与实现文档

## 1. 项目目标

构建一个 Web 项目，允许用户上传 Excel 文件，将表格解析为结构化数组数据，并结合用户输入的自然语言修改需求，借助 AI 生成可执行的修改规则或直接处理指定字段，最终预览结果并导出新的 Excel 文件。

该项目的核心不是“让 AI 直接无约束修改整份 Excel”，而是建立一套可控、可审计、可预览、可回滚的表格智能处理流程。

## 2. 产品定位

### 2.1 一句话定义

一个“Excel 上传 + AI 理解需求 + 程序执行修改 + 结果预览导出”的智能表格处理工具。

### 2.2 目标用户

- 需要批量清洗 Excel 数据的运营人员
- 需要按自然语言规则整理表格的非技术用户
- 需要做字段标准化、格式转换、内容提取的业务团队

### 2.3 核心价值

- 降低 Excel 批量处理门槛
- 用自然语言替代复杂函数和手工操作
- 将 AI 能力用于“理解需求”和“处理复杂文本字段”
- 将高风险的数据改动交给程序执行，保证稳定性

## 3. 产品边界

### 3.1 本期必须支持

- 上传 `.xlsx` / `.xls` 文件
- 解析首个 Sheet 或指定 Sheet 为对象数组
- 展示表头和前 N 行预览
- 用户输入自然语言修改需求
- AI 基于样例数据生成结构化操作规则
- 程序根据规则执行可控修改
- 预览修改前后差异
- 导出新的 Excel 文件

### 3.2 本期建议支持

- 多 Sheet 选择
- 指定列执行 AI 处理
- 操作日志与执行报告
- 错误行标记
- 大文件分批处理

### 3.3 本期不做

- 复杂公式恢复与重建
- 宏文件 `.xlsm` 完整保真修改
- 图表、数据透视表、批注等复杂 Excel 资产的完整保留
- 无限大文件的实时在线处理
- 完全自由的任意代码执行型 AI 修改

## 4. 核心设计原则

### 4.1 AI 负责理解，程序负责执行

优先让 AI 输出结构化规则，而不是让 AI 直接返回整份修改后的表格。

推荐模式：

1. AI 读取字段信息、样例数据和用户需求
2. AI 返回 JSON 格式的操作规则
3. 后端根据规则对全量数据执行处理
4. 前端展示变更预览并支持导出

### 4.2 复杂文本场景允许 AI 逐行参与

对于以下类型，可以允许 AI 逐行或分批处理指定字段：

- 地址标准化
- 商品标题精简或重写
- 评论分类
- 标签提取
- 文本摘要
- 命名实体识别

### 4.3 全流程可审计

系统必须记录：

- 原始文件名
- 处理时间
- 用户输入需求
- AI 返回的规则
- 实际执行的操作
- 失败行与原因
- 导出文件信息

### 4.4 不覆盖原文件

所有处理结果必须导出为新文件，禁止直接覆盖原始上传文件。

## 5. 用户流程

### 5.1 标准流程

1. 用户上传 Excel 文件
2. 系统解析 Sheet 和表头
3. 用户选择要处理的 Sheet
4. 系统展示前 20 行预览
5. 用户输入自然语言需求
6. 后端将列名、样例数据、需求发送给 AI
7. AI 返回结构化操作规则
8. 系统展示“AI 理解到的操作计划”
9. 用户确认执行
10. 后端执行规则，必要时对指定列调用 AI
11. 系统展示修改前后预览和变更摘要
12. 用户下载结果文件

### 5.2 示例需求

- 把手机号前后空格去掉
- 把金额统一保留两位小数
- 从地址中提取省份到新列
- 将商品标题缩短到 20 个字以内
- 把“订单状态”统一映射为“待支付/已支付/已取消”
- 删除空白行，去重手机号

## 6. 功能模块拆分

### 6.1 文件上传模块

功能要求：

- 支持拖拽上传和点击上传
- 限制文件类型为 `.xlsx` / `.xls`
- 限制文件大小，例如 20MB 或 50MB
- 返回文件基础信息：文件名、大小、Sheet 列表

### 6.2 Excel 解析模块

功能要求：

- 读取工作簿和 Sheet
- 将选定 Sheet 解析为对象数组
- 第一行默认作为表头
- 空列名自动补全，如 `__EMPTY_1`
- 记录原始行号，便于错误定位

建议数据结构：

```ts
type ExcelRow = {
  __rowIndex: number;
  [key: string]: any;
};

type ParsedSheet = {
  sheetName: string;
  columns: string[];
  rows: ExcelRow[];
};
```

### 6.3 需求输入模块

功能要求：

- 用户输入自然语言需求
- 支持补充说明，例如“只处理 Sheet1”“只修改手机号列”
- 支持多条规则组合输入

示例输入：

```txt
1. 去掉手机号前后空格
2. 将金额列格式化为两位小数
3. 新增“省份”列，从地址中提取
4. 删除手机号为空的行
```

### 6.4 AI 规则生成模块

职责：

- 理解用户需求
- 结合表头和样例识别可执行操作
- 输出结构化 JSON
- 禁止输出散文式说明作为最终执行结果

推荐输出结构：

```ts
type Operation =
  | {
      type: 'trim';
      column: string;
    }
  | {
      type: 'format_number';
      column: string;
      digits: number;
    }
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

interface AiPlan {
  summary: string;
  operations: Operation[];
  warnings: string[];
}
```

### 6.5 规则执行引擎

职责：

- 校验 AI 返回的 JSON 是否符合 schema
- 对非法字段、未知列名、危险操作进行拦截
- 执行确定性规则
- 对需要 AI 的列按批次处理

执行顺序建议：

1. 规则校验
2. 列存在性校验
3. 数据复制生成 workingRows
4. 执行非 AI 规则
5. 执行 AI 字段处理
6. 生成差异摘要
7. 输出结果数据

### 6.6 结果预览模块

功能要求：

- 展示前 N 行修改前后对比
- 展示每个操作影响的行数
- 展示失败记录
- 支持仅查看变更行

### 6.7 导出模块

功能要求：

- 导出 `.xlsx`
- 保持基础表头顺序
- 新增列追加到末尾或按规则插入
- 附带“处理报告” Sheet 可选

## 7. AI 能力设计

## 7.1 推荐的 AI 使用方式

分成两层：

### 第一层：意图理解层

输入：

- 列名
- 样例数据
- 用户需求

输出：

- 标准化操作规则 JSON

### 第二层：字段处理层

仅在必须时启用，针对具体字段逐行处理。

输入：

- 当前行指定列数据
- 明确的字段处理指令

输出：

- 单字段结果或多字段结构化结果

## 7.2 不建议的 AI 用法

- 将几万行数据整表直接发给模型要求返回全量结果
- 允许模型输出任意 JS/SQL/Python 代码后直接执行
- 允许模型引用不存在的列并自动猜测落库
- 不做 JSON 校验就直接执行规则

## 7.3 AI 提示词规范

### 规则生成 Prompt 目标

要求模型：

- 只输出 JSON
- 优先使用已有操作类型
- 不要虚构列名
- 如果需求无法执行，写入 warnings
- 不要返回 Markdown 代码块

示例 Prompt：

```txt
你是一个 Excel 数据处理规则生成器。

你的任务是根据用户需求，将表格处理意图转换为可执行的 JSON 操作计划。

规则：
1. 只输出合法 JSON，不要输出任何解释。
2. 不允许虚构不存在的列名。
3. 如果需求描述不清楚，请在 warnings 中说明。
4. 优先输出可程序执行的规则。
5. 只有在无法用普通规则处理时，才使用 ai_transform 或 ai_extract 类操作。

输入信息：
- columns: {{columns}}
- sampleRows: {{sampleRows}}
- userRequest: {{userRequest}}

输出结构：
{
  "summary": "",
  "operations": [],
  "warnings": []
}
```

### 字段处理 Prompt 目标

要求模型：

- 只处理指定列
- 输出结构化字段值
- 不改动无关列
- 不添加多余说明

示例 Prompt：

```txt
你是一个字段处理助手。

请根据 instruction 处理输入内容，并只返回 JSON。

输入：
{
  "instruction": "从地址中提取省份",
  "value": "广东省深圳市南山区科技园"
}

输出：
{
  "result": "广东省"
}
```

## 8. 后端接口设计

建议采用 Node.js 服务。

### 8.1 上传文件

`POST /api/files/upload`

响应：

```json
{
  "fileId": "file_xxx",
  "fileName": "客户数据.xlsx",
  "sheets": ["Sheet1", "Sheet2"]
}
```

### 8.2 获取 Sheet 预览

`GET /api/files/:fileId/sheets/:sheetName/preview`

响应：

```json
{
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
```

### 8.3 生成 AI 处理计划

`POST /api/ai/plan`

请求：

```json
{
  "fileId": "file_xxx",
  "sheetName": "Sheet1",
  "userRequest": "去掉手机号空格，把金额保留两位小数，并新增省份列"
}
```

响应：

```json
{
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
```

### 8.4 执行处理

`POST /api/tasks/execute`

请求：

```json
{
  "fileId": "file_xxx",
  "sheetName": "Sheet1",
  "plan": {
    "summary": "...",
    "operations": []
  }
}
```

响应：

```json
{
  "taskId": "task_xxx",
  "status": "success",
  "changedRows": 234,
  "downloadUrl": "/api/tasks/task_xxx/download",
  "report": {
    "operationCount": 3,
    "failedRows": 2
  }
}
```

### 8.5 下载结果

`GET /api/tasks/:taskId/download`

返回新生成的 Excel 文件。

## 9. 前端页面规划

建议页面结构：

### 9.1 上传页

- 文件上传区
- 上传历史列表，可选
- 文件基础信息展示

### 9.2 规则配置页

- Sheet 选择
- 表头展示
- 样例数据表格
- 自然语言输入框
- “生成 AI 计划”按钮
- AI 计划预览卡片

### 9.3 执行结果页

- 任务状态
- 变更摘要
- 修改前后对比表格
- 错误明细
- 导出按钮

## 10. 推荐技术方案

### 10.1 前端

推荐：

- Vue 3 + TypeScript
- Vite
- Ant Design Vue 或 Element Plus
- `xlsx` 用于基础解析预览，或交给后端统一解析

### 10.2 后端

推荐：

- Node.js + TypeScript
- Express / Fastify / NestJS 均可
- `exceljs` 负责读写 Excel
- `zod` 负责 AI 返回结构校验
- OpenAI SDK 或兼容大模型 SDK

### 10.3 存储

最小版本：

- 本地文件系统保存上传文件和导出文件
- 内存或简单数据库保存任务记录

进阶版本：

- 对象存储保存文件
- MySQL / PostgreSQL 保存任务与日志
- Redis 保存异步任务状态

## 11. 数据安全与风控

### 11.1 隐私提醒

上传页必须提示：

- Excel 内容可能被发送给 AI 进行处理
- 建议不要上传敏感个人信息文件
- 可选启用脱敏模式

### 11.2 脱敏策略

可选实现：

- 手机号中间四位脱敏后再发送给 AI
- 身份证号部分掩码
- 姓名只保留姓氏
- 仅把必要列传给 AI

### 11.3 风险控制

- 限制 AI 只能输出约定 schema
- 禁止执行模型返回的代码
- 禁止任意文件读写路径拼接
- 禁止直接覆盖原文件
- 对大文件采用异步任务和批处理

## 12. 大文件处理策略

当数据量较大时，采用以下策略：

- 解析全量数据，但只发送前 5 到 20 行样例给 AI 生成规则
- 非 AI 规则在本地全量执行
- AI 字段处理按批次执行，例如 50 行或 100 行一批
- 记录批次进度与失败重试信息

## 13. 错误处理设计

### 13.1 常见错误类型

- 文件格式不支持
- Sheet 不存在
- 表头为空
- AI 返回非 JSON
- AI 返回未知操作类型
- 引用不存在的列
- 某行字段处理失败
- 导出失败

### 13.2 错误返回规范

```json
{
  "code": "INVALID_AI_PLAN",
  "message": "AI 返回的处理计划不符合预期格式",
  "details": {
    "reason": "operations[1].column is required"
  }
}
```

## 14. 最小可用版本 MVP

### 14.1 MVP 功能清单

- 上传单个 Excel 文件
- 选择一个 Sheet
- 解析为数组并预览前 20 行
- 输入自然语言需求
- AI 返回结构化规则
- 支持以下规则执行：
  - trim
  - format_number
  - delete_rows
  - deduplicate
  - map_values
  - derive_column
- 导出结果 Excel

### 14.2 MVP 不包含

- 多用户系统
- 权限管理
- 历史任务中心
- 超大文件并发队列
- 复杂模板保真导出

## 15. 开发阶段建议

### 第一阶段：打通主链路

目标：

- 文件上传
- Sheet 解析
- 样例预览
- AI 规则生成
- 规则执行
- 导出结果

### 第二阶段：增强可用性

目标：

- 差异预览
- 执行报告
- 错误行提示
- 多 Sheet 支持
- 指定列 AI 处理

### 第三阶段：增强稳定性

目标：

- 任务异步化
- 大文件分批处理
- 历史记录
- 脱敏模式
- 配额与限流

## 16. 给 AI 编码助手的实现要求

如果将此文档交给 AI 编码助手继续开发，可附加以下约束：

```txt
请基于以下要求实现一个 Excel 智能处理 Web 项目：

1. 使用前后端分离结构。
2. 前端负责上传、预览、展示 AI 计划、展示修改结果、导出下载。
3. 后端负责 Excel 解析、AI 计划生成、规则校验、规则执行、导出文件。
4. 不允许让 AI 直接返回整份表格并直接落盘。
5. AI 只能输出符合 schema 的 JSON 操作计划。
6. 使用 schema 校验 AI 返回结果。
7. 对无法确定的需求给出 warnings，而不是胡乱生成规则。
8. 所有处理必须基于副本，不覆盖原始文件。
9. 对需要 AI 的字段逐行或分批处理，不要把整份大表发送给模型。
10. 代码需具备清晰的模块划分：上传、解析、AI、执行器、导出、任务记录。
```

## 17. 建议目录结构

```txt
excel-to-ai/
  apps/
    web/
    server/
  docs/
    requirements.md
    api.md
    prompts.md
  packages/
    shared/
  uploads/
  outputs/
```

如果做单仓最小版本，也可以：

```txt
excel-to-ai/
  src/
    modules/
      upload/
      excel/
      ai/
      executor/
      export/
    types/
    utils/
  docs/
  uploads/
  outputs/
```

## 18. 成功标准

项目成功的标准：

- 用户可以上传 Excel 并看到结构化预览
- 用户用自然语言描述需求后，AI 能生成可执行计划
- 程序可以稳定执行计划并导出新文件
- 用户能预览关键变更并确认结果
- 整个过程可追踪、可解释、可回滚

## 19. 后续可扩展方向

- 支持 CSV
- 支持多表联动处理
- 支持模板映射
- 支持自然语言生成公式建议
- 支持企业知识库驱动的字段标准化
- 支持审批后执行
- 支持工作流编排

## 20. 建议文件名

建议将本文件保存为：

- `requirements.md`：偏产品/需求说明
- `implementation-plan.md`：偏技术实现
- `ai-prompts.md`：偏提示词规范

当前可先落地为一份总文档，后续再拆分。
